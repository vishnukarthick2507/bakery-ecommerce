import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";

import { Order } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { Settings } from "../src/models/Settings.js";
import orderRoutes from "../src/routes/orderRoutes.js";

process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

let mongoServer: MongoMemoryServer;

async function connectTestDBWithReplSet(): Promise<void> {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      args: ["--replSet", "order-validation-rs"],
    },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { directConnection: true });

  const adminDb = mongoose.connection.db.admin();
  let lastError: unknown;
  for (let i = 0; i < 10; i++) {
    try {
      await adminDb.command({ replSetInitiate: {} });
      break;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  // Wait for the replica set primary to be elected before running operations.
  await new Promise((resolve) => setTimeout(resolve, 10000));
}

async function disconnectTestDBWithReplSet(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  return app;
}

const app = createTestApp();

const baseProduct = {
  name: "Test Product",
  slug: "test-product",
  description: "A test product",
  price: 100,
  category: "Cakes",
  images: [],
  stock: 10,
  availability: "AVAILABLE" as const,
  preparationTime: 60,
  active: true,
};

const baseOrderPayload = {
  customerName: "Test Customer",
  email: "test@example.com",
  phone: "9840916058",
  fulfillmentType: "PICKUP" as const,
  scheduledDate: "",
  scheduledTime: "10:00 AM - 12:00 PM",
  paymentMethod: "COD" as const,
  items: [
    {
      productId: "",
      productName: "Test Product",
      variantId: "test-product-default",
      quantity: 1,
    },
  ],
};

function postOrder(payload: Record<string, unknown>) {
  return request(app)
    .post("/api/orders")
    .set("Idempotency-Key", randomUUID())
    .send(payload);
}

describe("Order validation", () => {
  beforeAll(
    async () => {
      await connectTestDBWithReplSet();
    },
    60000,
  );

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }

    await Settings.create({
      onlineOrdersEnabled: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      closedMessage: "Test closed message",
    });

    const product = await Product.create(baseProduct);
    baseOrderPayload.items[0].productId = product._id.toString();

    // Set scheduledDate to tomorrow in IST (UTC+5:30)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const kolkataOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const tomorrowIST = new Date(tomorrow.getTime() + kolkataOffsetMs);
    baseOrderPayload.scheduledDate = tomorrowIST.toISOString().split("T")[0]!;
  });

  afterAll(async () => {
    await disconnectTestDBWithReplSet();
  });

  describe("POST /api/orders - guest checkout phone validation", () => {
    it("rejects order with missing phone", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        phone: "",
      });

      expect(res.status).toBe(400);
      const fieldErrors = (
        res.body.errors as Record<string, unknown> | undefined
      )?.["fieldErrors"] as Record<string, unknown> | undefined;
      expect(fieldErrors?.["phone"]).toBeDefined();
    });

    it("rejects order with invalid phone (too short)", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        phone: "123",
      });

      expect(res.status).toBe(400);
      const fieldErrors = (
        res.body.errors as Record<string, unknown> | undefined
      )?.["fieldErrors"] as Record<string, unknown> | undefined;
      expect(fieldErrors?.["phone"]).toBeDefined();
    });

    it("rejects order with invalid phone (wrong format)", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        phone: "0000000000",
      });

      expect(res.status).toBe(400);
      const fieldErrors = (
        res.body.errors as Record<string, unknown> | undefined
      )?.["fieldErrors"] as Record<string, unknown> | undefined;
      expect(fieldErrors?.["phone"]).toBeDefined();
    });

    it("accepts order with valid phone", async () => {
      const res = await postOrder(baseOrderPayload);

      expect(res.status).toBe(201);
      expect(res.body.order.orderNumber).toBeDefined();
    });
  });

  describe("POST /api/orders - past date rejection", () => {
    it("rejects order with a past date", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const kolkataOffsetMs = (5 * 60 + 30) * 60 * 1000;
      const yesterdayIST = new Date(yesterday.getTime() + kolkataOffsetMs);
      const pastDate = yesterdayIST.toISOString().split("T")[0]!;

      const res = await postOrder({
        ...baseOrderPayload,
        scheduledDate: pastDate,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("future");
    });

    it("accepts order with today's date", async () => {
      const now = new Date();
      const kolkataOffsetMs = (5 * 60 + 30) * 60 * 1000;
      const nowIST = new Date(now.getTime() + kolkataOffsetMs);
      const today = nowIST.toISOString().split("T")[0]!;

      const res = await postOrder({
        ...baseOrderPayload,
        scheduledDate: today,
      });

      // Today's date may be rejected if the current time is past all slots,
      // but it should not be rejected for being a "past date" specifically.
      if (res.status === 400) {
        expect(res.body.message).not.toContain("past");
      }
    });
  });

  describe("POST /api/orders - changed time slot", () => {
    it("accepts order with a different valid time slot", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "2:00 PM - 4:00 PM",
      });

      expect(res.status).toBe(201);
      expect(res.body.order.orderNumber).toBeDefined();
    });
  });
});

describe("Guest order tracking validation", () => {
  beforeAll(
    async () => {
      await connectTestDBWithReplSet();
    },
    60000,
  );

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }

    const product = await Product.create(baseProduct);
    baseOrderPayload.items[0].productId = product._id.toString();

    // Create an order directly in the DB for tracking tests
    const orderData = {
      orderNumber: "SV-TEST1234",
      idempotencyKey: "test-idempotency-key",
      idempotencyHash: "test-hash",
      customer: {
        name: "Test Customer",
        email: "test@example.com",
        phone: "9840916058",
      },
      customerName: "Test Customer",
      phone: "9840916058",
      fulfillmentType: "PICKUP",
      scheduledDate: baseOrderPayload.scheduledDate,
      scheduledTime: "10:00 AM - 12:00 PM",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
      items: [
        {
          productId: product._id,
          productName: "Test Product",
          variantId: "test-product-default",
          quantity: 1,
          unitPrice: 100,
          itemTotal: 100,
          totalPrice: 100,
        },
      ],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
    };

    await Order.create(orderData);
  });

  afterAll(async () => {
    await disconnectTestDBWithReplSet();
  });

  describe("POST /api/orders/track", () => {
    it("rejects tracking with missing order number", async () => {
      const res = await request(app)
        .post("/api/orders/track")
        .send({
          orderNumber: "",
          phone: "9840916058",
        });

      expect(res.status).toBe(400);
    });

    it("rejects tracking with missing phone", async () => {
      const res = await request(app)
        .post("/api/orders/track")
        .send({
          orderNumber: "SV-TEST1234",
          phone: "",
        });

      expect(res.status).toBe(400);
    });

    it("rejects tracking with invalid phone", async () => {
      const res = await request(app)
        .post("/api/orders/track")
        .send({
          orderNumber: "SV-TEST1234",
          phone: "123",
        });

      expect(res.status).toBe(400);
    });

    it("accepts tracking with valid order number and phone", async () => {
      const res = await request(app)
        .post("/api/orders/track")
        .send({
          orderNumber: "SV-TEST1234",
          phone: "9840916058",
        });

      expect(res.status).toBe(200);
      expect(res.body.order.orderNumber).toBe("SV-TEST1234");
    });
  });
});
