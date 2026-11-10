import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { CustomCakeRequest } from "../models/CustomCakeRequest.js";
import { User } from "../models/User.js";
import { InventoryMovement } from "../models/InventoryMovement.js";
import type { OrderStatus, PaymentMethod } from "../models/Order.js";
import { logger } from "../lib/logger.js";

/*
|--------------------------------------------------------------------------
| SHARED ANALYTICS TYPES
|--------------------------------------------------------------------------
*/

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentChange: number | null;
  trend: "up" | "down" | "flat";
}

export interface KPICard {
  label: string;
  value: number | string;
  subtitle?: string;
  trend?: PeriodComparison;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PaymentBreakdown {
  method: string;
  label: string;
  count: number;
  amount: number;
  collected: number;
  pendingCod: number;
}

export interface OrderStatusBreakdown {
  status: string;
  label: string;
  count: number;
}

export interface ProductPerformance {
  productId: mongoose.Types.ObjectId;
  productName: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cogs: number | null;
  grossProfit: number | null;
  grossProfitMargin: number | null;
}

export interface CustomerMetric {
  userId: mongoose.Types.ObjectId | null;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  isGuest: boolean;
}

export interface InventorySummary {
  productId: mongoose.Types.ObjectId;
  productName: string;
  category: string;
  stock: number;
  price: number;
  reorderLevel: number | null;
  availability: string;
  isLowStock: boolean;
  unitsSold: number;
}

/*
|--------------------------------------------------------------------------
| DATE RANGE HELPERS
|--------------------------------------------------------------------------
*/

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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function buildDateFilter(
  range: string,
  startDate?: Date,
  endDate?: Date,
): DateRange | undefined {
  const now = new Date();

  switch (range) {
    case "today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return { start, end };
    }
    case "yesterday": {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
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
      const start = startOfMonth(now);
      return { start, end: endOfDay(now) };
    }
    case "lastMonth": {
      const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const end = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      return { start, end };
    }
    case "thisYear": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "custom": {
      if (startDate && endDate) {
        return { start: startOfDay(startDate), end: endOfDay(endDate) };
      }
      return undefined;
    }
    default: {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 29);
      return { start, end: endOfDay(now) };
    }
  }
}

export function buildPreviousPeriodFilter(dateRange: DateRange): DateRange {
  const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
  const previousEnd = new Date(dateRange.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { start: startOfDay(previousStart), end: endOfDay(previousEnd) };
}

/*
|--------------------------------------------------------------------------
| REVENUE HELPERS
|--------------------------------------------------------------------------
*/

function isCollectedRevenue(o: any): boolean {
  if (o.orderStatus === "CANCELLED") return false;
  if (o.paymentMethod === "ONLINE") {
    return o.paymentStatus === "PAID";
  }
  if (o.paymentMethod === "COD") {
    return o.orderStatus === "DELIVERED";
  }
  if (o.paymentMethod === "PAY_AT_STORE") {
    return o.paymentStatus === "PAID";
  }
  return false;
}

function isCompletedSale(o: any): boolean {
  if (o.orderStatus === "CANCELLED") return false;
  if (o.paymentMethod === "ONLINE" && o.paymentStatus !== "PAID") return false;
  if (o.paymentMethod === "PAY_AT_STORE" && o.paymentStatus !== "PAID") return false;
  if (o.paymentMethod === "COD" && o.orderStatus !== "DELIVERED") return false;
  return true;
}

function isPendingCod(o: any): boolean {
  if (o.orderStatus === "CANCELLED") return false;
  if (o.paymentMethod === "COD") {
    return o.orderStatus !== "DELIVERED";
  }
  return false;
}

function isNonCancelled(o: any): boolean {
  return o.orderStatus !== "CANCELLED";
}

function calculatePeriodComparison(current: number, previous: number): PeriodComparison {
  const absoluteChange = current - previous;
  let percentChange: number | null = null;
  let trend: "up" | "down" | "flat" = "flat";

  if (previous === 0) {
    percentChange = current > 0 ? 100 : 0;
    trend = current > 0 ? "up" : "flat";
  } else {
    percentChange = (absoluteChange / previous) * 100;
    if (absoluteChange > 0) trend = "up";
    else if (absoluteChange < 0) trend = "down";
    else trend = "flat";
  }

  return { current, previous, absoluteChange, percentChange, trend };
}

/*
|--------------------------------------------------------------------------
| SALES ANALYTICS
|--------------------------------------------------------------------------
*/

export async function getSalesAnalytics(dateRange: DateRange) {
  const dateMatch = { createdAt: { $gte: dateRange.start, $lte: dateRange.end } };
  const prevRange = buildPreviousPeriodFilter(dateRange);
  const prevDateMatch = { createdAt: { $gte: prevRange.start, $lte: prevRange.end } };

  const [orders, prevOrders] = await Promise.all([
    Order.find({ ...dateMatch }).lean(),
    Order.find({ ...prevDateMatch }).lean(),
  ]);

  const nonCancelledOrders = orders.filter(isNonCancelled);
  const collectedOrders = orders.filter(isCollectedRevenue);
  const pendingCodOrders = orders.filter(isPendingCod);
  const cancelledOrders = orders.filter((o) => o.orderStatus === "CANCELLED");

  const grossSales = nonCancelledOrders.filter(isCompletedSale).reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const collectedRevenue = collectedOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const pendingCodAmount = pendingCodOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const totalOrders = orders.length;
  const averageOrderValue = nonCancelledOrders.length
    ? grossSales / nonCancelledOrders.length
    : 0;

  // Previous period comparison
  const prevNonCancelled = prevOrders.filter(isNonCancelled);
  const prevGrossSales = prevNonCancelled.filter(isCompletedSale).reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );
  const prevTotalOrders = prevOrders.length;

  const grossSalesComparison = calculatePeriodComparison(grossSales, prevGrossSales);
  const totalOrdersComparison = calculatePeriodComparison(totalOrders, prevTotalOrders);

  // Daily revenue trend
  const salesByDate = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const d = new Date(o.createdAt ?? new Date()).toISOString().slice(0, 10);
    if (!salesByDate.has(d)) {
      salesByDate.set(d, { orders: 0, revenue: 0 });
    }
    const entry = salesByDate.get(d)!;
    entry.orders += 1;
    if (isCompletedSale(o)) entry.revenue += o.totalAmount;
  }

  const revenueOverTime = Array.from(salesByDate.entries()).map(([date, data]) => ({
    date,
    orders: data.orders,
    revenue: data.revenue,
  }));

  // Payment method breakdown
  const paymentMethodStats = new Map<
    string,
    { count: number; amount: number; collected: number; pendingCod: number }
  >();
  for (const o of nonCancelledOrders) {
    if (!paymentMethodStats.has(o.paymentMethod)) {
      paymentMethodStats.set(o.paymentMethod, { count: 0, amount: 0, collected: 0, pendingCod: 0 });
    }
    const entry = paymentMethodStats.get(o.paymentMethod)!;
    entry.count += 1;
    entry.amount += o.totalAmount;
    if (isCollectedRevenue(o)) entry.collected += o.totalAmount;
    if (isPendingCod(o)) entry.pendingCod += o.totalAmount;
  }

  const paymentBreakdown: Array<{
    method: string;
    label: string;
    count: number;
    amount: number;
    collected: number;
    pendingCod: number;
  }> = [
    { id: "COD", label: "Cash on Delivery" },
    { id: "ONLINE", label: "Online Payment" },
    { id: "PAY_AT_STORE", label: "Pay at Store" },
  ].map((pm) => {
    const stats = paymentMethodStats.get(pm.id) ?? { count: 0, amount: 0, collected: 0, pendingCod: 0 };
    return {
      method: pm.id,
      label: pm.label,
      count: stats.count,
      amount: stats.amount,
      collected: stats.collected,
      pendingCod: stats.pendingCod,
    };
  });

  return {
    grossSales,
    collectedRevenue,
    pendingCod: pendingCodAmount,
    totalOrders,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    cancelledOrders: cancelledOrders.length,
    grossSalesComparison,
    totalOrdersComparison,
    revenueOverTime,
    paymentBreakdown,
  };
}

/*
|--------------------------------------------------------------------------
| PRODUCT PERFORMANCE ANALYTICS
|--------------------------------------------------------------------------
*/

export async function getProductAnalytics(dateRange: DateRange) {
  const dateMatch = { createdAt: { $gte: dateRange.start, $lte: dateRange.end } };

  const orders = await Order.find({
    ...dateMatch,
    orderStatus: { $ne: "CANCELLED" },
  }).lean();

  const productSales = new Map<string, {
    productId: mongoose.Types.ObjectId;
    productName: string;
    category: string;
    units: number;
    revenue: number;
    cogs: number;
  }>();

  for (const o of orders) {
    for (const item of o.items) {
      const pid = item.productId.toString();
      if (!productSales.has(pid)) {
        const product = await Product.findById(item.productId).lean();
        productSales.set(pid, {
          productId: item.productId,
          productName: item.productName,
          category: product?.category ?? "Unknown",
          units: 0,
          revenue: 0,
          cogs: 0,
        });
      }
      const entry = productSales.get(pid)!;
      entry.units += item.quantity;
      entry.revenue += item.itemTotal;
      if (item.costSnapshot !== undefined) {
        entry.cogs += item.costSnapshot * item.quantity;
      }
    }
  }

  const products: ProductPerformance[] = Array.from(productSales.values()).map((p) => ({
    productId: p.productId,
    productName: p.productName,
    category: p.category,
    unitsSold: p.units,
    revenue: p.revenue,
    cogs: p.cogs > 0 ? p.cogs : null,
    grossProfit: p.cogs > 0 ? p.revenue - p.cogs : null,
    grossProfitMargin: p.cogs > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : null,
  }));

  products.sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.unitsSold, 0);
  const totalCogs = products.reduce((sum, p) => sum + (p.cogs ?? 0), 0);
  const totalGrossProfit = products.reduce((sum, p) => sum + (p.grossProfit ?? 0), 0);

  return {
    products,
    totalRevenue,
    totalUnits,
    totalCogs,
    totalGrossProfit,
    totalGrossProfitMargin: totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : null,
    productsWithCost: products.filter((p) => p.cogs !== null).length,
    productsWithoutCost: products.filter((p) => p.cogs === null).length,
  };
}

/*
|--------------------------------------------------------------------------
| CUSTOMER INTELLIGENCE
|--------------------------------------------------------------------------
*/

export async function getCustomerAnalytics(dateRange: DateRange) {
  const dateMatch = { createdAt: { $gte: dateRange.start, $lte: dateRange.end } };

  const orders = await Order.find({ ...dateMatch }).lean();

  const customerStats = new Map<string, {
    name: string;
    phone: string;
    email: string | null;
    userId: mongoose.Types.ObjectId | null;
    orderCount: number;
    totalSpent: number;
    firstOrderAt: Date | null;
    lastOrderAt: Date | null;
    isGuest: boolean;
  }>();

  for (const o of orders) {
    const key = o.userId?.toString() || o.phone;
    if (!customerStats.has(key)) {
      customerStats.set(key, {
        name: o.customerName,
        phone: o.phone,
        email: o.customer?.email ?? null,
        userId: o.userId ?? null,
        orderCount: 0,
        totalSpent: 0,
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
        isGuest: !o.userId,
      });
    }
    const entry = customerStats.get(key)!;
    if (!isNonCancelled(o)) continue;
    entry.orderCount += 1;
    if (isCollectedRevenue(o)) entry.totalSpent += o.totalAmount;
    if (o.createdAt < entry.firstOrderAt!) entry.firstOrderAt = o.createdAt;
    if (o.createdAt > entry.lastOrderAt!) entry.lastOrderAt = o.createdAt;
  }

  const customers: CustomerMetric[] = Array.from(customerStats.values()).map((c) => ({
    userId: c.userId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
    averageOrderValue: c.orderCount > 0 ? c.totalSpent / c.orderCount : 0,
    firstOrderAt: c.firstOrderAt,
    lastOrderAt: c.lastOrderAt,
    isGuest: c.isGuest,
  }));

  customers.sort((a, b) => b.totalSpent - a.totalSpent);

  const totalCustomers = customers.length;
  const paidCustomers = customers.filter((c) => c.totalSpent > 0).length;
  const repeatCustomers = customers.filter((c) => c.orderCount > 1).length;
  const guestCustomers = customers.filter((c) => c.isGuest).length;
  const registeredCustomers = customers.filter((c) => !c.isGuest).length;

  const totalCustomerSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const customerLTV = paidCustomers > 0 ? totalCustomerSpent / paidCustomers : 0;
  const avgOrderCount = paidCustomers > 0
    ? customers.filter((c) => c.totalSpent > 0).reduce((sum, c) => sum + c.orderCount, 0) / paidCustomers
    : 0;

  return {
    totalCustomers,
    paidCustomers,
    repeatCustomers,
    guestCustomers,
    registeredCustomers,
    totalCustomerSpent,
    customerLTV: Math.round(customerLTV * 100) / 100,
    avgOrderCount: Math.round(avgOrderCount * 100) / 100,
    customers: customers.slice(0, 50),
  };
}

/*
|--------------------------------------------------------------------------
| FINANCIAL ANALYTICS
|--------------------------------------------------------------------------
*/

export async function getFinancialAnalytics(dateRange: DateRange) {
  const dateMatch = { createdAt: { $gte: dateRange.start, $lte: dateRange.end } };

  const orders = await Order.find({ ...dateMatch }).lean();

  const nonCancelledOrders = orders.filter(isNonCancelled);
  const collectedOrders = orders.filter(isCollectedRevenue);
  const cancelledOrders = orders.filter((o) => o.orderStatus === "CANCELLED");
  const pendingCodOrders = orders.filter(isPendingCod);
  const unpaidOrders = orders.filter(
    (o) => o.orderStatus !== "CANCELLED" && o.paymentStatus !== "PAID",
  );

  const grossRevenue = nonCancelledOrders.filter(isCompletedSale).reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const collectedRevenue = collectedOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const pendingCodAmount = pendingCodOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0,
  );

  const totalRazorpayFees = orders.reduce(
    (sum, o) => sum + (o.razorpayFee ?? 0),
    0,
  );

  const totalTaxAmount = orders.reduce(
    (sum, o) => sum + (o.taxAmount ?? 0),
    0,
  );

  // COGS from cost snapshots
  let totalCogs = 0;
  let productsWithCost = 0;
  let productsWithoutCost = 0;
  for (const o of nonCancelledOrders) {
    for (const item of o.items) {
      if (item.costSnapshot !== undefined) {
        totalCogs += item.costSnapshot * item.quantity;
        productsWithCost++;
      } else {
        productsWithoutCost++;
      }
    }
  }

  const grossProfit = grossRevenue - totalCogs;
  const grossProfitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : null;
  const netContribution = grossProfit - totalRazorpayFees - totalTaxAmount;

  const outstandingAmount = unpaidOrders
    .filter((o) => !isPendingCod(o))
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    grossRevenue,
    collectedRevenue,
    pendingCod: pendingCodAmount,
    totalRazorpayFees,
    totalTaxAmount,
    totalCogs,
    grossProfit,
    grossProfitMargin,
    netContribution,
    outstandingAmount,
    cancelledOrders: cancelledOrders.length,
    productsWithCost,
    productsWithoutCost,
    hasCostData: productsWithCost > 0,
    hasRazorpayFeeData: orders.some((o) => o.razorpayFee !== undefined),
    hasTaxData: orders.some((o) => o.taxAmount !== undefined),
  };
}

/*
|--------------------------------------------------------------------------
| INVENTORY ANALYTICS
|--------------------------------------------------------------------------
*/

export async function getInventoryAnalytics() {
  const products = await Product.find({
    active: true,
  }).lean();

  const productIds = products.map((p) => p._id);

  const productSales = await Order.aggregate([
    {
      $match: {
        orderStatus: { $ne: "CANCELLED" },
        paymentStatus: "PAID",
        "items.productId": { $in: productIds },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: "$items.productId",
        unitsSold: { $sum: "$items.quantity" },
      },
    },
  ]);

  const salesMap = new Map<string, number>();
  for (const s of productSales) {
    salesMap.set(s._id.toString(), s.unitsSold);
  }

  const inventory: InventorySummary[] = products.map((p) => ({
    productId: p._id,
    productName: p.name,
    category: p.category,
    stock: p.stock,
    price: p.price,
    reorderLevel: p.reorderLevel ?? null,
    availability: p.availability,
    isLowStock: p.stock <= 0 || p.availability === "OUT_OF_STOCK",
    unitsSold: salesMap.get(p._id.toString()) ?? 0,
  }));

  inventory.sort((a, b) => b.unitsSold - a.unitsSold);

  const lowStockCount = inventory.filter((p) => p.isLowStock).length;
  const totalStockValue = inventory.reduce(
    (sum, p) => sum + (p.stock * p.price),
    0,
  );

  return {
    products: inventory,
    lowStockCount,
    totalStockValue,
    totalProducts: products.length,
  };
}

/*
|--------------------------------------------------------------------------
| LOGGING
|--------------------------------------------------------------------------
*/

export function logAnalyticsAccess(
  userId: string | undefined,
  endpoint: string,
  dateRange: DateRange | undefined,
): void {
  logger.info("Analytics endpoint accessed", {
    userId,
    endpoint,
    dateRange: dateRange
      ? { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() }
      : null,
  });
}
