import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { z } from "zod";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

import { Product } from "../src/models/Product.js";
import { Order } from "../src/models/Order.js";
import {
  getFinancialAnalytics,
  getSalesAnalytics,
  getProductAnalytics,
} from "../src/services/analyticsService.js";
import { buildFinancialReport } from "../src/services/pdfReportService.js";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: any;

const orderSchema = z.object({
  orderNumber: z.string(),
  customerName: z.string(),
  phone: z.string(),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  paymentMethod: z.enum(["COD", "ONLINE", "PAY_AT_STORE"]),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]),
  orderStatus: z.string(),
  items: z.array(
    z.object({
      productId: z.any(),
      productName: z.string(),
      variantId: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      itemTotal: z.number(),
      totalPrice: z.number(),
      costSnapshot: z.number().optional(),
    }),
  ),
  subtotal: z.number(),
  totalAmount: z.number(),
});

async function createOrder(overrides: Record<string, unknown> = {}) {
  const data = {
    orderNumber: `SV-TEST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerName: "Test Customer",
    phone: "9840916058",
    fulfillmentType: "PICKUP" as const,
    scheduledDate: "2026-12-01",
    scheduledTime: "10:00 AM",
    paymentMethod: "COD" as const,
    paymentStatus: "PAID" as const,
    orderStatus: "CONFIRMED" as const,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        productName: "Test Product",
        variantId: "default",
        quantity: 1,
        unitPrice: 100,
        itemTotal: 100,
        totalPrice: 100,
      },
    ],
    subtotal: 100,
    totalAmount: 100,
    ...overrides,
  };
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid order: ${parsed.error}`);
  return Order.create(parsed.data as any) as Promise<
    mongoose.Document & { _id: mongoose.Types.ObjectId }
  >;
}

async function createProduct(overrides: Record<string, unknown> = {}) {
  const data = {
    name: "Test Product",
    slug: `test-product-${Date.now()}`,
    description: "A test product",
    price: 100,
    category: "Cakes",
    stock: 10,
    availability: "AVAILABLE" as const,
    preparationTime: 30,
    ...overrides,
  };
  return Product.create(data) as Promise<
    mongoose.Document & { _id: mongoose.Types.ObjectId }
  >;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

describe("Analytics business logic — COD revenue recognition", () => {
  beforeAll(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("delivered COD contributes to gross revenue and collected revenue", async () => {
    await createOrder({
      paymentMethod: "COD",
      paymentStatus: "PAID",
      orderStatus: "DELIVERED",
      totalAmount: 200,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.grossRevenue).toBe(200);
    expect(result.collectedRevenue).toBe(200);
    expect(result.pendingCod).toBe(0);
  });

  it("undelivered COD does not contribute to gross revenue", async () => {
    await createOrder({
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PREPARING",
      totalAmount: 200,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.grossRevenue).toBe(0);
    expect(result.collectedRevenue).toBe(0);
    expect(result.pendingCod).toBe(200);
  });

  it("pending COD is excluded from outstanding amount", async () => {
    await createOrder({
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "CONFIRMED",
      totalAmount: 300,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.pendingCod).toBe(300);
    expect(result.outstandingAmount).toBe(0);
  });

  it("cancelled orders are excluded from gross and collected revenue", async () => {
    await createOrder({
      paymentMethod: "ONLINE",
      paymentStatus: "PAID",
      orderStatus: "CANCELLED",
      totalAmount: 500,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.grossRevenue).toBe(0);
    expect(result.collectedRevenue).toBe(0);
    expect(result.cancelledOrders).toBe(1);
  });

  it("paid online orders count as completed sales", async () => {
    await createOrder({
      paymentMethod: "ONLINE",
      paymentStatus: "PAID",
      orderStatus: "DELIVERED",
      totalAmount: 400,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.grossRevenue).toBe(400);
    expect(result.collectedRevenue).toBe(400);
  });

  it("paid pay-at-store orders count as completed sales", async () => {
    await createOrder({
      paymentMethod: "PAY_AT_STORE",
      paymentStatus: "PAID",
      orderStatus: "DELIVERED",
      totalAmount: 600,
    });

    const result = await getFinancialAnalytics(todayRange());
    expect(result.grossRevenue).toBe(600);
    expect(result.collectedRevenue).toBe(600);
  });

  it("daily revenue excludes undelivered COD orders", async () => {
    await createOrder({
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PREPARING",
      totalAmount: 150,
    });

    const salesResult = await getSalesAnalytics(todayRange());
    // Undelivered COD should appear in trend with zero revenue (not inflated)
    expect(salesResult.revenueOverTime).toEqual([
      { date: expect.any(String), orders: 1, revenue: 0 },
    ]);
    expect(salesResult.grossSales).toBe(0);
  });

  it("financial PDF builder includes financial sections without empty sales tables", async () => {
    const report = buildFinancialReport({
      title: "Financial Report",
      periodLabel: "30d",
      generatedAt: new Date(),
      kpis: [
        { label: "Gross Revenue", value: "₹1,000" },
        { label: "Pending COD", value: "₹0" },
        { label: "Outstanding Amount", value: "₹0" },
      ],
    });

    expect(report.title).toBe("Financial Report");
    expect(report.periodLabel).toBe("30d");
    expect(report.sections).toHaveLength(1);
    const section0 = report.sections[0]!;
    expect(section0.title).toBe("Financial Summary");
    expect(section0.rows.length).toBeGreaterThan(0);
    // Ensure no sales-only sections are present
    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).not.toContain("Daily Sales Summary");
    expect(sectionTitles).not.toContain("Payment Method Breakdown");
  });
});

describe("Product analytics — null/missing cost data handling", () => {
  let mongoServer: any;

  beforeAll(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("returns null cogs/grossProfit when order items lack costSnapshot", async () => {
    const product = await createProduct({ name: "Vanilla Cake", slug: "vanilla-cake" });

    await createOrder({
      orderNumber: "SV-NOCOST-001",
      items: [
        {
          productId: product._id,
          productName: "Vanilla Cake",
          variantId: "default",
          quantity: 2,
          unitPrice: 500,
          itemTotal: 1000,
          totalPrice: 1000,
          // No costSnapshot — simulates orders placed before cost tracking
        },
      ],
      subtotal: 1000,
      totalAmount: 1000,
    });

    const result = await getProductAnalytics(todayRange());

    expect(result.products).toHaveLength(1);
    const p0 = result.products[0]!;
    expect(p0.productName).toBe("Vanilla Cake");
    expect(p0.revenue).toBe(1000);
    expect(p0.unitsSold).toBe(2);
    // Cost data missing → null values
    expect(p0.cogs).toBeNull();
    expect(p0.grossProfit).toBeNull();
    expect(p0.grossProfitMargin).toBeNull();
    // Aggregates still computed from available data
    expect(result.totalRevenue).toBe(1000);
    expect(result.totalUnits).toBe(2);
    expect(result.totalCogs).toBe(0);
    expect(result.totalGrossProfit).toBe(0);
    expect(result.productsWithoutCost).toBe(1);
    expect(result.productsWithCost).toBe(0);
  });

  it("computes cogs/grossProfit when order items include costSnapshot", async () => {
    const product = await createProduct({ name: "Chocolate Cake", slug: "chocolate-cake" });

    await createOrder({
      orderNumber: "SV-WITHCOST-001",
      items: [
        {
          productId: product._id,
          productName: "Chocolate Cake",
          variantId: "default",
          quantity: 3,
          unitPrice: 400,
          itemTotal: 1200,
          totalPrice: 1200,
          costSnapshot: 150, // cost per unit
        },
      ],
      subtotal: 1200,
      totalAmount: 1200,
    });

    const result = await getProductAnalytics(todayRange());

    expect(result.products).toHaveLength(1);
    const p1 = result.products[0]!;
    expect(p1.cogs).toBe(450); // 150 * 3
    expect(p1.grossProfit).toBe(750); // 1200 - 450
    expect(p1.grossProfitMargin).toBeCloseTo(62.5); // (750/1200)*100
    expect(result.totalCogs).toBe(450);
    expect(result.totalGrossProfit).toBe(750);
    expect(result.productsWithCost).toBe(1);
    expect(result.productsWithoutCost).toBe(0);
  });

  it("handles mixed cost data — some products with cost, some without", async () => {
    const withCost = await createProduct({ name: "With Cost", slug: "with-cost" });
    const withoutCost = await createProduct({ name: "Without Cost", slug: "without-cost" });

    await createOrder({
      orderNumber: "SV-MIXED-001",
      items: [
        {
          productId: withCost._id,
          productName: "With Cost",
          variantId: "default",
          quantity: 1,
          unitPrice: 300,
          itemTotal: 300,
          totalPrice: 300,
          costSnapshot: 100,
        },
        {
          productId: withoutCost._id,
          productName: "Without Cost",
          variantId: "default",
          quantity: 1,
          unitPrice: 200,
          itemTotal: 200,
          totalPrice: 200,
          // No costSnapshot
        },
      ],
      subtotal: 500,
      totalAmount: 500,
    });

    const result = await getProductAnalytics(todayRange());

    expect(result.products).toHaveLength(2);

    const withCostProduct = result.products.find((p) => p.productName === "With Cost");
    const withoutCostProduct = result.products.find(
      (p) => p.productName === "Without Cost",
    );

    expect(withCostProduct!.cogs).toBe(100);
    expect(withCostProduct!.grossProfit).toBe(200);
    expect(withCostProduct!.grossProfitMargin).toBeCloseTo(66.67);

    expect(withoutCostProduct!.cogs).toBeNull();
    expect(withoutCostProduct!.grossProfit).toBeNull();
    expect(withoutCostProduct!.grossProfitMargin).toBeNull();

    expect(result.productsWithCost).toBe(1);
    expect(result.productsWithoutCost).toBe(1);
    expect(result.totalCogs).toBe(100);
    expect(result.totalGrossProfit).toBe(200);
  });

  it("returns empty products and null margin when no orders exist", async () => {
    const result = await getProductAnalytics(todayRange());

    expect(result.products).toEqual([]);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalUnits).toBe(0);
    expect(result.totalCogs).toBe(0);
    expect(result.totalGrossProfit).toBe(0);
    expect(result.totalGrossProfitMargin).toBeNull();
    expect(result.productsWithCost).toBe(0);
    expect(result.productsWithoutCost).toBe(0);
  });
});
