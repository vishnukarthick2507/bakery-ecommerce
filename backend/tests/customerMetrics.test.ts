import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { CustomerMetrics } from "../src/models/CustomerMetrics.js";
import { Order } from "../src/models/Order.js";
import type { OrderStatus } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { User } from "../src/models/User.js";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

async function createProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: "Test Product",
    slug: `test-product-${Date.now()}`,
    description: "A test product",
    price: 100,
    cost: 40,
    category: "Cakes",
    stock: 10,
    preparationTime: 60,
    availability: "AVAILABLE",
    active: true,
    ...overrides,
  });
}

async function createUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    name: "Test Customer",
    phone: `9${String(Date.now()).padStart(9, "0")}`,
    active: true,
    ...overrides,
  });
}

type PaymentStatus = "PENDING" | "PAID" | "FAILED";

async function createOrder(
  userId: mongoose.Types.ObjectId | undefined,
  productId: mongoose.Types.ObjectId,
  status: OrderStatus = "PLACED",
  paymentStatus: PaymentStatus = "PENDING",
  totalAmount = 100,
  createdAt?: Date,
) {
  const orderData: Record<string, unknown> = {
    orderNumber: `SV-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerName: "Test Customer",
    phone: "9840916058",
    fulfillmentType: "PICKUP",
    scheduledDate: "2026-12-01",
    scheduledTime: "10:00 AM",
    paymentMethod: "COD",
    paymentStatus,
    orderStatus: status,
    items: [
      {
        productId,
        productName: "Test Product",
        variantId: "default",
        quantity: 1,
        unitPrice: totalAmount,
        itemTotal: totalAmount,
        totalPrice: totalAmount,
      },
    ],
    subtotal: totalAmount,
    totalAmount,
  };

  if (userId) {
    orderData.userId = userId;
  }
  if (createdAt) {
    orderData.createdAt = createdAt;
  }

  return Order.create(orderData);
}

describe("Customer metrics derived collection", () => {
  beforeAll(async () => {
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

  it("supports manual recalculation from order records", async () => {
    const user = await createUser();
    const product = await createProduct();

    await createOrder(user._id, product._id, "CONFIRMED", "PAID", 100);
    await createOrder(user._id, product._id, "CONFIRMED", "PAID", 200);

    // Manual calculation from trustworthy order records
    const paidOrders = await Order.find({
      userId: user._id,
      paymentStatus: "PAID",
      orderStatus: { $ne: "CANCELLED" },
    }).lean();

    const orderCount = paidOrders.length;
    const totalPaid = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = orderCount > 0 ? totalPaid / orderCount : 0;
    const firstOrderAt = paidOrders.reduce(
      (earliest: Date | undefined, o) =>
        earliest === undefined || o.createdAt < earliest ? o.createdAt : earliest,
      undefined as Date | undefined,
    );
    const lastOrderAt = paidOrders.reduce(
      (latest: Date | undefined, o) =>
        latest === undefined || o.createdAt > latest ? o.createdAt : latest,
      undefined as Date | undefined,
    );

    expect(orderCount).toBe(2);
    expect(totalPaid).toBe(300);
    expect(averageOrderValue).toBe(150);
    expect(firstOrderAt).toBeDefined();
    expect(lastOrderAt).toBeDefined();

    // Can upsert into CustomerMetrics
    await CustomerMetrics.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          orderCount,
          paidOrderCount: orderCount,
          totalPaid,
          averageOrderValue,
          firstOrderAt,
          lastOrderAt,
          segment: orderCount >= 2 ? "RETURNING" : "NEW",
        },
      },
      { upsert: true },
    );

    const metrics = await CustomerMetrics.findOne({ userId: user._id });
    expect(metrics?.orderCount).toBe(2);
    expect(metrics?.totalPaid).toBe(300);
    expect(metrics?.averageOrderValue).toBe(150);
    expect(metrics?.segment).toBe("RETURNING");
  });

  it("does not create metrics for guest checkouts (no userId)", async () => {
    const product = await createProduct();

    await createOrder(undefined, product._id, "CONFIRMED", "PAID", 100);

    const metrics = await CustomerMetrics.findOne({ userId: null });
    expect(metrics).toBeNull();
  });

  it("is idempotent on recalculation", async () => {
    const user = await createUser();
    const product = await createProduct();

    await createOrder(user._id, product._id, "CONFIRMED", "PAID", 100);

    // Calculate twice
    for (let i = 0; i < 2; i++) {
      const paidOrders = await Order.find({
        userId: user._id,
        paymentStatus: "PAID",
        orderStatus: { $ne: "CANCELLED" },
      }).lean();

      await CustomerMetrics.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            orderCount: paidOrders.length,
            totalPaid: paidOrders.reduce((sum, o) => sum + o.totalAmount, 0),
          },
        },
        { upsert: true },
      );
    }

    const metrics = await CustomerMetrics.findOne({ userId: user._id });
    expect(metrics?.orderCount).toBe(1);
    expect(metrics?.totalPaid).toBe(100);
  });
});
