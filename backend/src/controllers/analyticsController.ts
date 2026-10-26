import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import ExcelJS from "exceljs";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { CustomCakeRequest } from "../models/CustomCakeRequest.js";
import { User } from "../models/User.js";
import type { AuthRequest } from "../middleware/auth.js";

/* ---------------------------------------------------------------
   Types
   --------------------------------------------------------------- */

interface OrderDoc {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  phone: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  fulfillmentType: "DELIVERY" | "PICKUP";
  address?: {
    addressLine: string;
    city: string;
    pincode: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  razorpayOrderId?: string;
  razorpayOrderIds?: string[];
  razorpayPaymentId?: string;
  razorpayPaymentIds?: string[];
  orderStatus:
    | "PLACED"
    | "PAYMENT_CONFIRMED"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  inventoryStatus?: "RESERVED" | "COMMITTED" | "RELEASED";
  items: Array<{
    productId: mongoose.Types.ObjectId;
    productName: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    itemTotal: number;
    totalPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  stock: number;
  availability: "AVAILABLE" | "OUT_OF_STOCK" | "DISABLED";
  preparationTime: number;
  active: boolean;
}

interface CustomCakeDoc {
  _id: mongoose.Types.ObjectId;
  referenceNumber: string;
  name: string;
  phone: string;
  flavour: string;
  weight: string;
  theme: string;
  messageOnCake: string;
  instructions: string;
  referenceImageUrl: string;
  status: "PENDING" | "CONTACTED" | "CLOSED";
  createdAt: Date;
}

/* ---------------------------------------------------------------
   Validation
   --------------------------------------------------------------- */

const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  range: z
    .enum(["today", "7d", "30d", "thisMonth", "lastMonth", "custom"])
    .optional()
    .default("30d"),
});

type AnalyticsRange = z.infer<typeof analyticsQuerySchema>["range"];

/* ---------------------------------------------------------------
   Date helpers
   --------------------------------------------------------------- */

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function startOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return result;
}

function dateRangeLabel(
  dateFilter: { start: Date; end: Date } | undefined,
  range: AnalyticsRange,
): string {
  if (!dateFilter) return "All time";
  const start = dateFilter.start.toLocaleDateString("en-IN");
  const end = dateFilter.end.toLocaleDateString("en-IN");
  return `${start} – ${end} (${range})`;
}

function buildDateFilter(
  range: AnalyticsRange,
  startDate?: Date,
  endDate?: Date,
): { start: Date; end: Date } | undefined {
  const now = new Date();

  switch (range) {
    case "today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return { start, end };
    }
    case "7d": {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 6);
      return { start, end: endOfDay(now) };
    }
    case "30d": {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 29);
      return { start, end: endOfDay(now) };
    }
    case "thisMonth": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "custom": {
      if (startDate && endDate) {
        return { start: startOfDay(startDate), end: endOfDay(endDate) };
      }
      return undefined;
    }
  }
}

/* ---------------------------------------------------------------
   Revenue logic (matches existing order/payment rules)
   ---------------------------------------------------------------
   Collected revenue = ONLINE + PAID + NOT CANCELLED
                      OR COD + DELIVERED + NOT CANCELLED
   Pending COD = COD + not DELIVERED + not CANCELLED
   Cancelled orders never count as collected revenue
   --------------------------------------------------------------- */

function isCollectedRevenue(o: OrderDoc): boolean {
  if (o.orderStatus === "CANCELLED") return false;
  if (o.paymentMethod === "ONLINE") {
    return o.paymentStatus === "PAID";
  }
  if (o.paymentMethod === "COD") {
    return o.orderStatus === "DELIVERED";
  }
  return false;
}

function isPendingCod(o: OrderDoc): boolean {
  if (o.orderStatus === "CANCELLED") return false;
  if (o.paymentMethod === "COD") {
    return o.orderStatus !== "DELIVERED";
  }
  return false;
}

function isNonCancelled(o: OrderDoc): boolean {
  return o.orderStatus !== "CANCELLED";
}

/* ---------------------------------------------------------------
   GET /api/admin/analytics
   --------------------------------------------------------------- */

export async function getAnalytics(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { range, startDate, endDate } = parsed.data;
    const dateFilter = buildDateFilter(
      range,
      parseDate(startDate),
      parseDate(endDate),
    );
    const dateMatch = dateFilter
      ? { createdAt: { $gte: dateFilter.start, $lte: dateFilter.end } }
      : {};

    /* ---------------- KPI Cards ---------------- */

    const kpiResult = await Order.aggregate([
      { $match: { ...dateMatch } },
      {
        $facet: {
          totalOrders: [{ $count: "count" }],
          grossSales: [
            { $match: { orderStatus: { $ne: "CANCELLED" } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
          ],
          cancelledOrders: [
            { $match: { orderStatus: "CANCELLED" } },
            { $count: "count" },
          ],
          pendingOrders: [
            {
              $match: {
                orderStatus: { $in: ["PLACED", "PAYMENT_CONFIRMED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] },
              },
            },
            { $count: "count" },
          ],
          totalCustomers: [
            { $group: { _id: "$phone", name: { $first: "$customerName" } } },
            { $count: "count" },
          ],
        },
      },
    ]).exec();

    const kpi = (kpiResult[0] ?? {}) as Record<string, any[]>;

    const getCount = (arr: any[] | undefined): number =>
      arr?.[0]?.count ?? 0;

    const totalOrders = getCount(kpi.totalOrders);
    const grossSalesResult = kpi.grossSales?.[0];
    const grossSales = (grossSalesResult?.total as number) ?? 0;
    const grossSalesCount = grossSalesResult?.count ?? 0;
    const cancelledOrders = getCount(kpi.cancelledOrders);
    const pendingOrders = getCount(kpi.pendingOrders);
    const totalCustomers = getCount(kpi.totalCustomers);

    /* Calculate collected revenue and pending COD from all orders (not just filtered subset) */
    const allOrders = await Order.find({ ...dateMatch })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as unknown as OrderDoc[];

    const collectedRevenue = allOrders
      .filter(isCollectedRevenue)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingCodAmount = allOrders
      .filter(isPendingCod)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const averageOrderValue = grossSalesCount > 0
      ? grossSales / grossSalesCount
      : 0;

    /* Total products sold from non-cancelled orders */
    const productSalesResult = await Order.aggregate([
      { $match: { ...dateMatch, orderStatus: { $ne: "CANCELLED" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.itemTotal" },
        },
      },
    ]).exec();

    const totalProductsSold = productSalesResult.reduce(
      (sum: number, p: { unitsSold: number }) =>
        sum + (p.unitsSold as number),
      0,
    );

    /* ---------------- Revenue over time (collected revenue) ---------------- */

    const revenueOverTime = await Order.aggregate([
      { $match: { ...dateMatch } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$orderStatus", "CANCELLED"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "ONLINE"] },
                            { $eq: ["$paymentStatus", "PAID"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $eq: ["$orderStatus", "DELIVERED"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                then: "$totalAmount",
                else: 0,
              },
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    /* ---------------- Orders over time ---------------- */

    const ordersOverTime = await Order.aggregate([
      { $match: { ...dateMatch } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    /* ---------------- Top selling products (non-cancelled) ---------------- */

    const topProducts = productSalesResult
      .slice()
      .sort(
        (a: { revenue: number }, b: { revenue: number }) =>
          (b.revenue as number) - (a.revenue as number),
      )
      .slice(0, 10)
      .map((p: { _id: unknown; productName: string; unitsSold: number; revenue: number }) => ({
        _id: p._id,
        productName: p.productName,
        unitsSold: p.unitsSold,
        revenue: p.revenue,
      }));

    /* ---------------- Revenue by product (collected revenue) ---------------- */

    const revenueByProduct = await Order.aggregate([
      { $match: { ...dateMatch } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          revenue: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$orderStatus", "CANCELLED"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "ONLINE"] },
                            { $eq: ["$paymentStatus", "PAID"] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ["$paymentMethod", "COD"] },
                            { $eq: ["$orderStatus", "DELIVERED"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
                then: "$items.itemTotal",
                else: 0,
              },
            },
          },
          unitsSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]).exec();

    /* ---------------- Order status breakdown ---------------- */

    const statusBreakdown = await Order.aggregate([
      { $match: { ...dateMatch } },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    /* ---------------- Payment method breakdown ---------------- */

    const paymentBreakdown = await Order.aggregate([
      { $match: { ...dateMatch, orderStatus: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          amount: { $sum: "$totalAmount" },
          collected: {
            $sum: {
              $cond: {
                if: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$paymentMethod", "ONLINE"] },
                        { $eq: ["$paymentStatus", "PAID"] },
                      ],
                    },
                    {
                      $and: [
                        { $eq: ["$paymentMethod", "COD"] },
                        { $eq: ["$orderStatus", "DELIVERED"] },
                      ],
                    },
                  ],
                },
                then: "$totalAmount",
                else: 0,
              },
            },
          },
          pendingCod: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$paymentMethod", "COD"] },
                    { $ne: ["$orderStatus", "DELIVERED"] },
                  ],
                },
                then: "$totalAmount",
                else: 0,
              },
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    /* ---------------- Delivery vs pickup ---------------- */

    const fulfillmentBreakdown = await Order.aggregate([
      { $match: { ...dateMatch } },
      {
        $group: {
          _id: "$fulfillmentType",
          count: { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    /* ---------------- Top customers by spending (non-cancelled) ---------------- */

    const topCustomers = await Order.aggregate([
      { $match: { ...dateMatch, orderStatus: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: "$phone",
          name: { $first: "$customerName" },
          email: { $first: "$customer.email" },
          totalSpent: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          lastOrder: { $max: "$createdAt" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ]).exec();

    /* ---------------- Low stock products ---------------- */

    const lowStockProducts = (await Product.find({
      active: true,
      $or: [
        { stock: { $lte: 0 } },
        { availability: "OUT_OF_STOCK" },
      ],
    })
      .sort({ stock: 1 })
      .limit(20)
      .lean()
      .exec()) as unknown as ProductDoc[];

    /* ---------------- Custom cake statistics ---------------- */

    const customCakeStats = await CustomCakeRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    const totalCustomCakes = await CustomCakeRequest.countDocuments(
      dateFilter,
    ).exec();

    /* -----------------------------------------------------------
       Build response
       ----------------------------------------------------------- */

    res.status(200).json({
      range,
      dateRange: dateFilter
        ? {
            start: dateFilter.start.toISOString(),
            end: dateFilter.end.toISOString(),
          }
        : null,
      kpis: {
        grossSales,
        collectedRevenue,
        pendingCod: pendingCodAmount,
        totalOrders,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        totalCustomers,
        totalProductsSold,
        cancelledOrders,
      },
      charts: {
        revenueOverTime,
        ordersOverTime,
        topProducts,
        revenueByProduct,
        orderStatusBreakdown: statusBreakdown,
        paymentBreakdown: paymentBreakdown.map((pb: any) => ({
          _id: pb._id,
          count: pb.count,
          amount: pb.amount,
          collected: pb.collected,
          pendingCod: pb.pendingCod,
        })),
        fulfillmentBreakdown,
        topCustomers,
        customCakeStats,
      },
      lowStock: lowStockProducts.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        stock: p.stock,
        availability: p.availability,
        isLowStock:
          p.stock <= 0 || p.availability === "OUT_OF_STOCK",
      })),
      totalCustomCakes,
    });
  } catch (error) {
    console.error("Analytics failed:", error);
    res.status(500).json({
      message: "Unable to generate analytics",
    });
  }
}

/* ---------------------------------------------------------------
   GET /api/admin/analytics/export
   --------------------------------------------------------------- */

export async function exportAnalytics(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { range, startDate, endDate } = parsed.data;
    const dateFilter = buildDateFilter(
      range,
      parseDate(startDate),
      parseDate(endDate),
    );
    const dateMatch = dateFilter
      ? { createdAt: { $gte: dateFilter.start, $lte: dateFilter.end } }
      : {};

    /* ---------------- Fetch all data for export ---------------- */

    const orders = (await Order.find({ ...dateMatch })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as OrderDoc[];

    const products = (await Product.find()
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as ProductDoc[];

    /* Customers: group by phone, use ALL orders (including cancelled) for count,
       but exclude cancelled from spending. This matches the web dashboard exactly. */
    const customers = await Order.aggregate([
      { $match: { ...dateMatch } },
      {
        $group: {
          _id: "$phone",
          name: { $first: "$customerName" },
          email: { $first: "$customer.email" },
          totalSpent: {
            $sum: {
              $cond: {
                if: { $ne: ["$orderStatus", "CANCELLED"] },
                then: "$totalAmount",
                else: 0,
              },
            },
          },
          totalOrders: { $sum: 1 },
          nonCancelledOrders: {
            $sum: {
              $cond: {
                if: { $ne: ["$orderStatus", "CANCELLED"] },
                then: 1,
                else: 0,
              },
            },
          },
          cancelledOrders: {
            $sum: {
              $cond: {
                if: { $eq: ["$orderStatus", "CANCELLED"] },
                then: 1,
                else: 0,
              },
            },
          },
          itemsPurchased: {
            $sum: {
              $cond: {
                if: { $ne: ["$orderStatus", "CANCELLED"] },
                then: { $size: { $ifNull: ["$items", []] } },
                else: 0,
              },
            },
          },
          lastOrder: { $max: "$createdAt" },
          firstOrder: { $min: "$createdAt" },
        },
      },
      { $sort: { totalSpent: -1 } },
    ]).exec();

    const customCakes = (await CustomCakeRequest.find(dateFilter)
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown as CustomCakeDoc[];

    /* ---------------- Compute derived data ---------------- */

    const collectedOrders = orders.filter(isCollectedRevenue);
    const pendingCodOrders = orders.filter(isPendingCod);
    const nonCancelledOrders = orders.filter(isNonCancelled);

    const grossSales = nonCancelledOrders.reduce(
      (sum: number, o: OrderDoc) => sum + o.totalAmount,
      0,
    );

    const collectedRevenue = collectedOrders.reduce(
      (sum: number, o: OrderDoc) => sum + o.totalAmount,
      0,
    );

    const pendingCodAmount = pendingCodOrders.reduce(
      (sum: number, o: OrderDoc) => sum + o.totalAmount,
      0,
    );

    const totalOrders = orders.length;

    const totalProductsSold = nonCancelledOrders.reduce(
      (sum: number, o: OrderDoc) =>
        sum +
        o.items.reduce((itemSum: number, item) => itemSum + item.quantity, 0),
      0,
    );

    const averageOrderValue = nonCancelledOrders.length > 0
      ? grossSales / nonCancelledOrders.length
      : 0;

    /* Sales by date */
    const salesByDate = new Map<
      string,
      {
        orders: number;
        nonCancelled: number;
        cancelled: number;
        gross: number;
        collected: number;
        pendingCod: number;
      }
    >();
    for (const o of orders) {
      const d = new Date(o.createdAt).toISOString().split("T")[0] as string;
      if (!salesByDate.has(d)) {
        salesByDate.set(d, {
          orders: 0,
          nonCancelled: 0,
          cancelled: 0,
          gross: 0,
          collected: 0,
          pendingCod: 0,
        });
      }
      const entry = salesByDate.get(d)!;
      if (isNonCancelled(o)) {
        entry.orders += 1;
        entry.nonCancelled += 1;
        entry.gross += o.totalAmount;
        if (isCollectedRevenue(o)) entry.collected += o.totalAmount;
        if (isPendingCod(o)) entry.pendingCod += o.totalAmount;
      } else {
        entry.cancelled += 1;
      }
    }

    /* Product sales (non-cancelled) */
    const productSales = new Map<
      string,
      { name: string; category: string; units: number; revenue: number }
    >();
    for (const o of nonCancelledOrders) {
      for (const item of o.items) {
        const pid = item.productId.toString();
        if (!productSales.has(pid)) {
          const product = products.find(
            (p) => p._id.toString() === pid,
          );
          productSales.set(pid, {
            name: item.productName,
            category: product?.category ?? "Unknown",
            units: 0,
            revenue: 0,
          });
        }
        const entry = productSales.get(pid)!;
        entry.units += item.quantity;
        entry.revenue += item.itemTotal;
      }
    }

    /* Order status breakdown */
    const orderStatusStats = new Map<string, number>();
    for (const o of orders) {
      orderStatusStats.set(
        o.orderStatus,
        (orderStatusStats.get(o.orderStatus) ?? 0) + 1,
      );
    }

    /* Payment breakdown stats */
    const paymentMethodStats = new Map<
      string,
      { count: number; amount: number; pendingCod: number }
    >();
    for (const o of nonCancelledOrders) {
      if (!paymentMethodStats.has(o.paymentMethod)) {
        paymentMethodStats.set(o.paymentMethod, {
          count: 0,
          amount: 0,
          pendingCod: 0,
        });
      }
      const entry = paymentMethodStats.get(o.paymentMethod)!;
      entry.count += 1;
      entry.amount += o.totalAmount;
      if (isPendingCod(o)) entry.pendingCod += o.totalAmount;
    }

    /* -----------------------------------------------------------
       Generate Excel workbook
       ----------------------------------------------------------- */

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "S.V. Bakery";
    workbook.lastModifiedBy = "S.V. Bakery Admin";
    workbook.created = new Date();
    workbook.modified = new Date();

    /* ---------- Shared styles ---------- */
    const titleFill = { argb: "FF0B2744" };
    const headerFill = { argb: "FF0B2744" };
    const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
    const titleFont = { bold: true, size: 16, color: { argb: "FF0B2744" } };
    const sectionFont = { bold: true, size: 12, color: { argb: "FF0B2744" } };
    const thinBorder = {
      top: { style: "thin" as const, color: { argb: "FFD9E4EE" } },
      bottom: { style: "thin" as const, color: { argb: "FFD9E4EE" } },
      left: { style: "thin" as const, color: { argb: "FFD9E4EE" } },
      right: { style: "thin" as const, color: { argb: "FFD9E4EE" } },
    };
    const altRowFill = { argb: "FFF5F9FC" };

    function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
      row.font = headerFont;
      row.fill = { type: "pattern", pattern: "solid", fgColor: headerFill };
      for (let c = 1; c <= colCount; c++) {
        row.getCell(c).border = thinBorder;
      }
      row.height = 24;
    }

    function styleDataRow(row: ExcelJS.Row, colCount: number, isAlt: boolean) {
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        if (isAlt) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: altRowFill };
        }
        if (typeof cell.value === "number" && cell.value !== 0) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      }
    }

    function currencyCell(cell: ExcelJS.Cell, value: number) {
      cell.value = value;
      cell.numFmt = '"₹"#,##0.00';
      cell.alignment = { horizontal: "right" };
    }

    function formatStatus(status: string) {
      return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }

    /* ---------- Sheet 1: Dashboard ---------- */
    const dashboardSheet = workbook.addWorksheet("Dashboard");
    dashboardSheet.columns = [
      { header: "Metric", key: "metric", width: 34 },
      { header: "Value", key: "value", width: 22 },
    ];

    const a1 = dashboardSheet.getCell("A1");
    a1.font = titleFont;
    a1.value = "S.V. Bakery";
    dashboardSheet.mergeCells("A1:B1");

    const a2 = dashboardSheet.getCell("A2");
    a2.font = { bold: true, size: 13, color: { argb: "FF173F67" } };
    a2.value = "Business Analytics Dashboard";
    dashboardSheet.mergeCells("A2:B2");

    const a4 = dashboardSheet.getCell("A4");
    a4.font = sectionFont;
    a4.value = "Key Performance Indicators";

    const rangeLabel = dateRangeLabel(dateFilter, range);
    const rangeCell = dashboardSheet.getCell("A5");
    rangeCell.font = { italic: true, size: 10, color: { argb: "FF526579" } };
    rangeCell.value = `Period: ${rangeLabel}`;
    dashboardSheet.mergeCells("A5:B5");

    const dashboardRows = [
      { metric: "Gross Sales", value: `₹${grossSales.toLocaleString("en-IN")}` },
      { metric: "Collected Revenue", value: `₹${collectedRevenue.toLocaleString("en-IN")}` },
      { metric: "Pending COD", value: `₹${pendingCodAmount.toLocaleString("en-IN")}` },
      { metric: "Total Orders", value: totalOrders.toLocaleString("en-IN") },
      { metric: "Non-Cancelled Orders", value: nonCancelledOrders.length.toLocaleString("en-IN") },
      { metric: "Cancelled Orders", value: orders.filter((o) => o.orderStatus === "CANCELLED").length.toLocaleString("en-IN") },
      { metric: "Average Order Value", value: `₹${Math.round(averageOrderValue).toLocaleString("en-IN")}` },
      { metric: "Total Customers", value: customers.length.toLocaleString("en-IN") },
      { metric: "Products Sold", value: totalProductsSold.toLocaleString("en-IN") },
      { metric: "Custom Cake Requests", value: customCakes.length.toLocaleString("en-IN") },
    ];

    dashboardSheet.addRows(dashboardRows);

    // Bold the metric labels and values
    for (let i = 0; i < dashboardRows.length; i++) {
      const row = dashboardSheet.getRow(6 + i);
      row.getCell(1).font = { bold: true, size: 11 };
      row.getCell(2).font = { bold: true, size: 11, color: { argb: "FF0B2744" } };
      row.getCell(2).alignment = { horizontal: "right" };
    }

    /* Top 5 Products */
    const top5Products = Array.from(productSales.entries())
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 5);

    const top5Row = dashboardSheet.getRow(17);
    top5Row.font = sectionFont;
    top5Row.getCell(1).value = "Top 5 Products";

    const top5HeaderRow = dashboardSheet.getRow(18);
    top5HeaderRow.getCell(1).value = "Product";
    top5HeaderRow.getCell(2).value = "Units Sold";
    top5HeaderRow.getCell(3).value = "Revenue";
    styleHeaderRow(top5HeaderRow, 3);

    top5Products.forEach((p, i) => {
      const row = dashboardSheet.getRow(19 + i);
      row.getCell(1).value = p[1].name;
      row.getCell(2).value = p[1].units;
      row.getCell(3).value = p[1].revenue;
      row.getCell(3).numFmt = '"₹"#,##0.00';
      styleDataRow(row, 3, i % 2 === 1);
    });

    /* Top 5 Customers */
    const top5Customers = customers.slice(0, 5);
    const top5CustRow = dashboardSheet.getRow(25);
    top5CustRow.font = sectionFont;
    top5CustRow.getCell(1).value = "Top 5 Customers";

    const top5CustHeaderRow = dashboardSheet.getRow(26);
    top5CustHeaderRow.getCell(1).value = "Customer";
    top5CustHeaderRow.getCell(2).value = "Total Spent";
    styleHeaderRow(top5CustHeaderRow, 2);

    top5Customers.forEach((c: { name: string; totalSpent: number }, i: number) => {
      const row = dashboardSheet.getRow(27 + i);
      row.getCell(1).value = c.name;
      row.getCell(2).value = c.totalSpent;
      row.getCell(2).numFmt = '"₹"#,##0.00';
      styleDataRow(row, 2, i % 2 === 1);
    });

    /* Payment Method Summary */
    const payRow = dashboardSheet.getRow(dashboardSheet.lastRow!.number + 2);
    payRow.font = sectionFont;
    payRow.getCell(1).value = "Payment Method Summary";

    const payHeaderRow = dashboardSheet.getRow(payRow.number + 1);
    payHeaderRow.getCell(1).value = "Method";
    payHeaderRow.getCell(2).value = "Orders";
    payHeaderRow.getCell(3).value = "Total Sales";
    payHeaderRow.getCell(4).value = "Collected";
    payHeaderRow.getCell(5).value = "Pending COD";
    styleHeaderRow(payHeaderRow, 5);

    const paymentMethods = ["COD", "ONLINE"];
    paymentMethods.forEach((pm, i) => {
      const stats = paymentMethodStats.get(pm) || { count: 0, amount: 0, pendingCod: 0 };
      const row = dashboardSheet.getRow(payRow.number + 2 + i);
      row.getCell(1).value = pm === "COD" ? "Cash on Delivery" : "Online Payment";
      row.getCell(2).value = stats.count;
      row.getCell(3).value = stats.amount;
      row.getCell(3).numFmt = '"₹"#,##0.00';
      row.getCell(4).value = stats.amount - stats.pendingCod;
      row.getCell(4).numFmt = '"₹"#,##0.00';
      row.getCell(5).value = stats.pendingCod;
      row.getCell(5).numFmt = '"₹"#,##0.00';
      styleDataRow(row, 5, i % 2 === 1);
    });

    /* Order Status Summary */
    const statusRow = dashboardSheet.getRow(dashboardSheet.lastRow!.number + 2);
    statusRow.font = sectionFont;
    statusRow.getCell(1).value = "Order Status Summary";

    const statusHeaderRow = dashboardSheet.getRow(statusRow.number + 1);
    statusHeaderRow.getCell(1).value = "Status";
    statusHeaderRow.getCell(2).value = "Orders";
    styleHeaderRow(statusHeaderRow, 2);

    const sortedStatuses = ["PLACED", "PAYMENT_CONFIRMED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;
    sortedStatuses.forEach((s: string, i: number) => {
      const count = orderStatusStats.get(s) || 0;
      const row = dashboardSheet.getRow(statusRow.number + 2 + i);
      row.getCell(1).value = formatStatus(s);
      row.getCell(2).value = count;
      styleDataRow(row, 2, i % 2 === 1);
    });

    /* Daily Sales Summary */
    const dailyRow = dashboardSheet.getRow(dashboardSheet.lastRow!.number + 2);
    dailyRow.font = sectionFont;
    dailyRow.getCell(1).value = "Daily Sales Summary";

    const dailyHeaderRow = dashboardSheet.getRow(dailyRow.number + 1);
    dailyHeaderRow.getCell(1).value = "Date";
    dailyHeaderRow.getCell(2).value = "Orders";
    dailyHeaderRow.getCell(3).value = "Gross Sales";
    dailyHeaderRow.getCell(4).value = "Collected Revenue";
    dailyHeaderRow.getCell(5).value = "Pending COD";
    styleHeaderRow(dailyHeaderRow, 5);

    const dailyRows = Array.from(salesByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10);
    dailyRows.forEach(([date, data]: [string, { orders: number; gross: number; collected: number; pendingCod: number }], i: number) => {
      const row = dashboardSheet.getRow(dailyRow.number + 2 + i);
      const displayDate = new Date(date).toLocaleDateString("en-IN");
      row.getCell(1).value = displayDate;
      row.getCell(2).value = data.orders;
      row.getCell(3).value = data.gross;
      row.getCell(3).numFmt = '"₹"#,##0.00';
      row.getCell(4).value = data.collected;
      row.getCell(4).numFmt = '"₹"#,##0.00';
      row.getCell(5).value = data.pendingCod;
      row.getCell(5).numFmt = '"₹"#,##0.00';
      styleDataRow(row, 5, i % 2 === 1);
    });

    /* ---------- Sheet 2: Orders ---------- */
    const ordersSheet = workbook.addWorksheet("Orders");
    ordersSheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 22 },
      { header: "Order Date", key: "orderDate", width: 18 },
      { header: "Customer Name", key: "customer", width: 25 },
      { header: "Customer Phone", key: "phone", width: 15 },
      { header: "Customer Email", key: "email", width: 30 },
      { header: "Fulfilment Type", key: "fulfillmentType", width: 16 },
      { header: "Delivery Address", key: "address", width: 40 },
      { header: "Scheduled Date", key: "scheduledDate", width: 16 },
      { header: "Scheduled Time", key: "scheduledTime", width: 16 },
      { header: "Items Summary", key: "items", width: 30 },
      { header: "Total Quantity", key: "quantity", width: 14 },
      { header: "Order Amount", key: "totalAmount", width: 18 },
      { header: "Payment Method", key: "paymentMethod", width: 20 },
      { header: "Payment Status", key: "paymentStatus", width: 16 },
      { header: "Order Status", key: "orderStatus", width: 18 },
      { header: "Inventory Status", key: "inventoryStatus", width: 18 },
    ];

    const ordersHeaderRow = ordersSheet.getRow(1);
    styleHeaderRow(ordersHeaderRow, 16);

    const orderRows = orders.map((o: OrderDoc) => {
      const itemsSummary = o.items.map((i) => `${i.productName} (x${i.quantity})`).join("; ");
      return {
        orderNumber: o.orderNumber,
        orderDate: new Date(o.createdAt).toLocaleDateString("en-IN"),
        customer: o.customerName,
        phone: o.phone ?? "",
        email: o.customer?.email ?? "",
        fulfillmentType: o.fulfillmentType,
        address: o.address
          ? `${o.address.addressLine ?? ""}, ${o.address.city ?? ""}, ${o.address.pincode ?? ""}`
          : "Pickup",
        scheduledDate: o.scheduledDate,
        scheduledTime: o.scheduledTime,
        items: itemsSummary,
        quantity: o.items.reduce((s: number, i) => s + i.quantity, 0),
        totalAmount: o.totalAmount,
        paymentMethod:
          o.paymentMethod === "COD"
            ? "Cash on Delivery"
            : "Online (Razorpay)",
        paymentStatus: o.paymentStatus,
        orderStatus: formatStatus(o.orderStatus),
        inventoryStatus: o.inventoryStatus
          ? formatStatus(o.inventoryStatus)
          : "Not tracked",
      };
    });
    ordersSheet.addRows(orderRows);

    ordersSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      row.eachCell((cell, colNumber) => {
        if (colNumber === 12) { // Order Amount column
          cell.numFmt = '"₹"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    });

    /* ---------- Sheet 3: Order Items ---------- */
    const orderItemsSheet = workbook.addWorksheet("Order Items");
    orderItemsSheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 20 },
      { header: "Order Date", key: "orderDate", width: 16 },
      { header: "Customer Name", key: "customer", width: 22 },
      { header: "Customer Phone", key: "phone", width: 15 },
      { header: "Product Name", key: "productName", width: 28 },
      { header: "Category", key: "category", width: 18 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Unit Price", key: "unitPrice", width: 16 },
      { header: "Item Total", key: "itemTotal", width: 16 },
      { header: "Order Status", key: "orderStatus", width: 18 },
      { header: "Payment Method", key: "paymentMethod", width: 20 },
      { header: "Payment Status", key: "paymentStatus", width: 16 },
    ];

    const itemsHeaderRow = orderItemsSheet.getRow(1);
    styleHeaderRow(itemsHeaderRow, 12);

    const itemRows: Array<{
      orderNumber: string;
      orderDate: string;
      customer: string;
      phone: string;
      productName: string;
      category: string;
      quantity: number;
      unitPrice: number;
      itemTotal: number;
      orderStatus: string;
      paymentMethod: string;
      paymentStatus: string;
    }> = [];

    for (const o of orders) {
      for (const item of o.items) {
        const product = products.find((p) => p._id.toString() === item.productId.toString());
        itemRows.push({
          orderNumber: o.orderNumber,
          orderDate: new Date(o.createdAt).toLocaleDateString("en-IN"),
          customer: o.customerName,
          phone: o.phone ?? "",
          productName: item.productName,
          category: product?.category ?? "Unknown",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemTotal: item.itemTotal,
          orderStatus: formatStatus(o.orderStatus),
          paymentMethod: o.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)",
          paymentStatus: o.paymentStatus,
        });
      }
    }

    orderItemsSheet.addRows(itemRows);

    orderItemsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        if (colNumber === 7) cell.alignment = { horizontal: "right" }; // Quantity
        if (colNumber === 8) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; } // Unit Price
        if (colNumber === 9) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; } // Item Total
      });
    });

    /* ---------- Sheet 4: Customers ---------- */
    const customersSheet = workbook.addWorksheet("Customers");
    customersSheet.columns = [
      { header: "Customer Name", key: "name", width: 26 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Total Orders", key: "totalOrders", width: 14 },
      { header: "Non-Cancelled Orders", key: "nonCancelledOrders", width: 18 },
      { header: "Cancelled Orders", key: "cancelledOrders", width: 16 },
      { header: "Items Purchased", key: "itemsPurchased", width: 16 },
      { header: "Total Spent", key: "totalSpent", width: 18 },
      { header: "Average Order Value", key: "aov", width: 18 },
      { header: "Last Order Date", key: "lastOrder", width: 18 },
      { header: "First Order Date", key: "firstOrder", width: 18 },
    ];

    const customersHeaderRow = customersSheet.getRow(1);
    styleHeaderRow(customersHeaderRow, 11);

    const customerRows = customers.map((c: any) => ({
      name: c.name,
      email: c.email ?? "",
      phone: c._id as string,
      totalOrders: c.totalOrders,
      nonCancelledOrders: c.nonCancelledOrders,
      cancelledOrders: c.cancelledOrders,
      itemsPurchased: c.itemsPurchased,
      totalSpent: c.totalSpent,
      aov: c.totalOrders > 0 ? Math.round(c.totalSpent / c.totalOrders) : 0,
      lastOrder: c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("en-IN") : "",
      firstOrder: c.firstOrder ? new Date(c.firstOrder).toLocaleDateString("en-IN") : "",
    }));
    customersSheet.addRows(customerRows);

    customersSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        if (colNumber === 8) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; }
        if (colNumber === 9) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; }
      });
    });

    /* ---------- Sheet 5: Sales Summary ---------- */
    const salesSheet = workbook.addWorksheet("Sales Summary");
    salesSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Total Orders", key: "orders", width: 14 },
      { header: "Non-Cancelled Orders", key: "nonCancelled", width: 18 },
      { header: "Cancelled Orders", key: "cancelled", width: 16 },
      { header: "Gross Sales", key: "gross", width: 18 },
      { header: "Collected Revenue", key: "collected", width: 18 },
      { header: "Pending COD", key: "pendingCod", width: 16 },
      { header: "Average Order Value", key: "aov", width: 20 },
    ];

    const salesHeaderRow = salesSheet.getRow(1);
    styleHeaderRow(salesHeaderRow, 8);

    const salesRows = Array.from(salesByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-IN"),
        orders: data.orders,
        nonCancelled: data.nonCancelled,
        cancelled: data.cancelled,
        gross: data.gross,
        collected: data.collected,
        pendingCod: data.pendingCod,
        aov: data.nonCancelled > 0 ? Math.round(data.gross / data.nonCancelled) : 0,
      }));
    salesSheet.addRows(salesRows);

    salesSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        if ([5, 6, 7, 8].includes(colNumber)) { // Gross, Collected, Pending COD, AOV
          cell.numFmt = '"₹"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    });

    /* ---------- Sheet 6: Products ---------- */
    const productsSheet = workbook.addWorksheet("Products");
    productsSheet.columns = [
      { header: "Product Name", key: "name", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 14 },
      { header: "Units Sold", key: "units", width: 14 },
      { header: "Revenue", key: "revenue", width: 18 },
      { header: "Current Stock", key: "stock", width: 14 },
      { header: "Availability", key: "availability", width: 18 },
      { header: "Low Stock Flag", key: "lowStock", width: 16 },
    ];

    const productsHeaderRow = productsSheet.getRow(1);
    styleHeaderRow(productsHeaderRow, 8);

    const productRows = products.map((p: ProductDoc) => {
      const sales = productSales.get(p._id.toString());
      return {
        name: p.name,
        category: p.category,
        price: p.price,
        units: sales?.units ?? 0,
        revenue: sales?.revenue ?? 0,
        stock: p.stock,
        availability: p.availability,
        lowStock:
          p.stock <= 0 || p.availability === "OUT_OF_STOCK"
            ? "Yes"
            : "No",
      };
    }).sort((a, b) => b.units - a.units);

    productsSheet.addRows(productRows);

    productsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        if (colNumber === 3) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; }
        if (colNumber === 5) { cell.numFmt = '"₹"#,##0.00'; cell.alignment = { horizontal: "right" }; }
      });
    });

    /* ---------- Sheet 7: Inventory ---------- */
    const inventorySheet = workbook.addWorksheet("Inventory");
    inventorySheet.columns = [
      { header: "Product", key: "name", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Current Stock", key: "stock", width: 16 },
      { header: "Availability", key: "availability", width: 18 },
      { header: "Units Sold", key: "units", width: 14 },
      { header: "Low Stock Flag", key: "lowStock", width: 16 },
    ];

    const inventoryHeaderRow = inventorySheet.getRow(1);
    styleHeaderRow(inventoryHeaderRow, 6);

    const inventoryRows = products.map((p: ProductDoc) => {
      const sales = productSales.get(p._id.toString());
      return {
        name: p.name,
        category: p.category,
        stock: p.stock,
        availability: p.availability,
        units: sales?.units ?? 0,
        lowStock:
          p.stock <= 0 || p.availability === "OUT_OF_STOCK"
            ? "Yes"
            : "No",
      };
    });
    inventorySheet.addRows(inventoryRows);

    /* ---------- Sheet 8: Payments ---------- */
    const paymentsSheet = workbook.addWorksheet("Payments");
    paymentsSheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 22 },
      { header: "Order Date", key: "orderDate", width: 16 },
      { header: "Customer", key: "customer", width: 24 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Payment Method", key: "method", width: 20 },
      { header: "Payment Status", key: "status", width: 16 },
      { header: "Order Status", key: "orderStatus", width: 18 },
      { header: "Order Amount", key: "amount", width: 16 },
      { header: "Collected Amount", key: "collectedAmount", width: 18 },
      { header: "Pending Amount", key: "pendingAmount", width: 18 },
      { header: "Razorpay/Payment ID", key: "paymentId", width: 28 },
      { header: "Payment Date", key: "date", width: 16 },
    ];

    const paymentsHeaderRow = paymentsSheet.getRow(1);
    styleHeaderRow(paymentsHeaderRow, 12);

    const paymentRows = orders.map((o: OrderDoc) => {
      const collected = isCollectedRevenue(o) ? o.totalAmount : 0;
      const pending = isPendingCod(o) ? o.totalAmount : 0;
      return {
        orderNumber: o.orderNumber,
        orderDate: new Date(o.createdAt).toLocaleDateString("en-IN"),
        customer: o.customerName,
        phone: o.phone ?? "",
        method:
          o.paymentMethod === "COD"
            ? "Cash on Delivery"
            : "Online (Razorpay)",
        status: o.paymentStatus,
        orderStatus: formatStatus(o.orderStatus),
        amount: o.totalAmount,
        collectedAmount: collected,
        pendingAmount: pending,
        paymentId:
          o.razorpayPaymentId ?? o.razorpayOrderId ?? "N/A",
        date: new Date(o.createdAt).toLocaleDateString("en-IN"),
      };
    });
    paymentsSheet.addRows(paymentRows);

    paymentsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        if ([8, 9, 10].includes(colNumber)) { // Order Amount, Collected, Pending
          cell.numFmt = '"₹"#,##0.00';
          cell.alignment = { horizontal: "right" };
        }
      });
    });

    /* ---------- Sheet 9: Custom Cakes ---------- */
    const cakesSheet = workbook.addWorksheet("Custom Cakes");
    cakesSheet.columns = [
      { header: "Reference Number", key: "ref", width: 22 },
      { header: "Created Date", key: "date", width: 16 },
      { header: "Customer Name", key: "name", width: 24 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Flavour", key: "flavour", width: 20 },
      { header: "Weight", key: "weight", width: 12 },
      { header: "Theme", key: "theme", width: 24 },
      { header: "Message On Cake", key: "message", width: 30 },
      { header: "Instructions", key: "instructions", width: 34 },
      { header: "Reference Image URL", key: "refImage", width: 30 },
      { header: "Status", key: "status", width: 16 },
    ];

    const cakesHeaderRow = cakesSheet.getRow(1);
    styleHeaderRow(cakesHeaderRow, 11);

    const cakeRows = customCakes.map((c: CustomCakeDoc) => ({
      ref: c.referenceNumber,
      date: new Date(c.createdAt).toLocaleDateString("en-IN"),
      name: c.name,
      phone: c.phone,
      flavour: c.flavour,
      weight: c.weight,
      theme: c.theme,
      message: c.messageOnCake ?? "",
      instructions: c.instructions ?? "",
      refImage: c.referenceImageUrl ?? "",
      status: c.status,
    }));
    cakesSheet.addRows(cakeRows);

    /* ---------- Freeze header rows and set autoFilters ---------- */
    const sheetsWithFilters: Array<{ sheet: ExcelJS.Worksheet; range: string }> = [
      { sheet: ordersSheet, range: `A1:P${ordersSheet.lastRow?.number ?? 1}` },
      { sheet: orderItemsSheet, range: `A1:L${orderItemsSheet.lastRow?.number ?? 1}` },
      { sheet: customersSheet, range: `A1:K${customersSheet.lastRow?.number ?? 1}` },
      { sheet: salesSheet, range: `A1:H${salesSheet.lastRow?.number ?? 1}` },
      { sheet: productsSheet, range: `A1:H${productsSheet.lastRow?.number ?? 1}` },
      { sheet: inventorySheet, range: `A1:F${inventorySheet.lastRow?.number ?? 1}` },
      { sheet: paymentsSheet, range: `A1:L${paymentsSheet.lastRow?.number ?? 1}` },
      { sheet: cakesSheet, range: `A1:K${cakesSheet.lastRow?.number ?? 1}` },
    ];

    for (const sheet of workbook.worksheets) {
      sheet.views = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];
    }

    for (const { sheet, range } of sheetsWithFilters) {
      sheet.autoFilter = range;
    }

    /* ---------- Send response ---------- */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="S.V. Bakery Analytics.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Unable to export analytics" });
    }
  }
}
