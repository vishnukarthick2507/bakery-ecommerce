import crypto from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Test environment variables must be set before modules that read them load.
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
process.env.RAZORPAY_KEY_SECRET = "mock_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "mock_webhook_secret";

// Mock Razorpay client before importing payment controller.
const mockOrdersCreate = vi.fn();
vi.mock("../src/services/razorpay.js", () => ({
  getRazorpayClient: vi.fn(() => ({
    orders: { create: mockOrdersCreate },
  })),
  getRazorpayKeyId: vi.fn().mockReturnValue("rzp_test_mock"),
  getRazorpayKeySecret: vi.fn().mockReturnValue("mock_secret"),
}));

import { Order } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { User } from "../src/models/User.js";
import paymentRoutes from "../src/routes/paymentRoutes.js";
import {
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

function createTestApp() {
  const app = express();

  // Raw body parser for webhook MUST run before express.json() so req.body
  // stays a Buffer for signature verification.
  app.use(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
  );

  app.use(express.json());

  app.use("/api/payments", paymentRoutes);

  return app;
}

const app = createTestApp();

function makeCustomerToken(
  customerId: string | mongoose.Types.ObjectId,
  tokenVersion = 0,
): string {
  return jwt.sign(
    { customerId, accountType: "CUSTOMER", tokenVersion },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

let userCounter = 0;

async function createTestUser(overrides: Record<string, unknown> = {}) {
  userCounter += 1;
  return User.create({
    name: "Test User",
    email: `test${userCounter}-${Date.now()}@example.com`,
    phone: `9${String(userCounter).padStart(9, "0")}`,
    passwordHash: await bcrypt.hash("Password123", 10),
    active: true,
    tokenVersion: 0,
    ...overrides,
  });
}

async function createTestProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: "Test Product",
    slug: `test-product-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    description: "A test product",
    price: 100,
    category: "Test",
    stock: 50,
    availability: "AVAILABLE",
    preparationTime: 30,
    active: true,
    ...overrides,
  });
}

function makeOrderNumber(): string {
  return `SV-TEST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function createTestOrder(
  overrides: Record<string, unknown> = {},
  userId?: mongoose.Types.ObjectId,
) {
  const product = await createTestProduct();
  const order = await Order.create({
    orderNumber: makeOrderNumber(),
    idempotencyKey: `idem-${Date.now()}`,
    idempotencyHash: "test-hash",
    userId,
    customer: {
      name: "Test Customer",
      email: "customer@example.com",
      phone: "9876543210",
    },
    customerName: "Test Customer",
    phone: "9876543210",
    fulfillmentType: "PICKUP",
    scheduledDate: "2026-11-01",
    scheduledTime: "10:00 AM - 12:00 PM",
    paymentMethod: "ONLINE",
    paymentStatus: "PENDING",
    inventoryStatus: "RESERVED",
    orderStatus: "PLACED",
    items: [
      {
        productId: product._id,
        productName: product.name,
        variantId: "default",
        quantity: 1,
        unitPrice: product.price,
        itemTotal: product.price,
        totalPrice: product.price,
      },
    ],
    subtotal: product.price,
    deliveryFee: 0,
    totalAmount: product.price,
    ...overrides,
  } as any);

  // Reduce product stock to simulate reservation
  await Product.findByIdAndUpdate(product._id, {
    $inc: { stock: -1 },
  });

  return { order, product };
}

function makeRazorpaySignature(
  orderId: string,
  paymentId: string,
  secret = "mock_secret",
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function makeWebhookSignature(
  payload: string,
  secret = "mock_webhook_secret",
): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("Payments API", () => {
  beforeAll(
    async () => {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          args: ["--replSet", "testrs"],
        },
      });
      const uri = mongoServer.getUri();

      // Connect with directConnection to reach the uninitiated replica-set node.
      await mongoose.connect(uri, { directConnection: true });

      // Initiate replica set so transactions work (with retries).
      const adminDb = (mongoose.connection.db as import("mongodb").Db).admin();
      let lastError: unknown;
      for (let i = 0; i < 10; i++) {
        try {
          await adminDb.command({ replSetInitiate: {} });
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Wait for replica set to elect a primary.
      await new Promise((resolve) => setTimeout(resolve, 10000));
    },
    120000,
  );

  beforeEach(async () => {
    await clearTestDB();
    mockOrdersCreate.mockReset();
    vi.restoreAllMocks();
  });

  afterAll(
    async () => {
      await mongoose.disconnect();
      if (mongoServer) {
        await mongoServer.stop();
      }
    },
    120000,
  );

  describe("POST /api/payments/verify", () => {
    it("verifies a valid payment signature and marks the order PAID", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      mockOrdersCreate.mockResolvedValue({ id: "rzp_order_test_123" });

      const razorpayOrderId = "rzp_order_test_123";
      const razorpayPaymentId = "rzp_payment_test_456";
      const signature = makeRazorpaySignature(razorpayOrderId, razorpayPaymentId);

      // First create the Razorpay attempt on the order
      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId,
        razorpayOrderIds: [razorpayOrderId],
      });

      const response = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Payment verified successfully");

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PAID");
      expect(updated?.razorpayPaymentId).toBe(razorpayPaymentId);
    });

    it("rejects an invalid Razorpay signature", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId: "rzp_order_test_123",
        razorpayOrderIds: ["rzp_order_test_123"],
      });

      const response = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: "rzp_order_test_123",
          razorpay_payment_id: "rzp_payment_test_456",
          razorpay_signature: "invalid_signature",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Payment verification failed");

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PENDING");
    });

    it("treats duplicate verification of the same payment as a no-op success", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      const razorpayOrderId = "rzp_order_test_123";
      const razorpayPaymentId = "rzp_payment_test_456";
      const signature = makeRazorpaySignature(razorpayOrderId, razorpayPaymentId);

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "PAID",
        razorpayOrderId,
        razorpayPaymentId,
        razorpayPaymentIds: [razorpayPaymentId],
        orderStatus: "PAYMENT_CONFIRMED",
        inventoryStatus: "COMMITTED",
      });

      // First verification
      const response1 = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
        });

      expect(response1.status).toBe(200);
      expect(response1.body.message).toBe("Payment already verified");

      // Second verification with same payment - still a no-op success
      const response2 = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
        });

      expect(response2.status).toBe(200);
      expect(response2.body.message).toBe("Payment already verified");
    });

    it("returns 404 for a different customer's order", async () => {
      const owner = await createTestUser();
      const attacker = await createTestUser();
      const token = makeCustomerToken(attacker._id);
      const { order } = await createTestOrder({}, owner._id);

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId: "rzp_order_test_123",
        razorpayOrderIds: ["rzp_order_test_123"],
      });

      const signature = makeRazorpaySignature(
        "rzp_order_test_123",
        "rzp_payment_test_456",
      );

      const response = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          razorpay_order_id: "rzp_order_test_123",
          razorpay_payment_id: "rzp_payment_test_456",
          razorpay_signature: signature,
        });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("handles payment.captured and marks the order PAID", async () => {
      const user = await createTestUser();
      const { order } = await createTestOrder({}, user._id);

      const razorpayOrderId = "rzp_order_webhook_123";
      const razorpayPaymentId = "rzp_payment_webhook_456";

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId,
        razorpayOrderIds: [razorpayOrderId],
      });

      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
              id: razorpayPaymentId,
            },
          },
        },
      });

      const signature = makeWebhookSignature(payload);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PAID");
    });

    it("handles payment.failed and marks the order FAILED", async () => {
      const user = await createTestUser();
      const { order, product } = await createTestOrder({}, user._id);
      const stockBefore = (await Product.findById(product._id)).stock; // 49 after reservation

      const razorpayOrderId = "rzp_order_webhook_fail";

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId,
        razorpayOrderIds: [razorpayOrderId],
      });

      const payload = JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
            },
          },
        },
      });

      const signature = makeWebhookSignature(payload);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("FAILED");
      expect(updated?.inventoryStatus).toBe("RELEASED");

      // Stock should be restored by one unit
      const restoredProduct = await Product.findById(product._id).lean();
      expect(restoredProduct?.stock).toBe(stockBefore + 1);
    });

    it("rejects invalid webhook signature", async () => {
      const payload = JSON.stringify({ event: "payment.failed" });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "bad_signature")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid webhook signature");
    });

    it("ignores superseded failed-payment webhooks", async () => {
      const user = await createTestUser();
      const { order } = await createTestOrder({}, user._id);

      const oldRazorpayOrderId = "rzp_order_old";
      const newRazorpayOrderId = "rzp_order_new";

      // Order currently points to the new Razorpay attempt (superseded the old)
      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId: newRazorpayOrderId,
        razorpayOrderIds: [oldRazorpayOrderId, newRazorpayOrderId],
        paymentStatus: "PENDING",
        inventoryStatus: "RESERVED",
      });

      const payload = JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              order_id: oldRazorpayOrderId,
            },
          },
        },
      });

      const signature = makeWebhookSignature(payload);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);

      // Order should remain PENDING (old attempt webhook ignored)
      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PENDING");
      expect(updated?.inventoryStatus).toBe("RESERVED");
    });

    it("is safe when called twice (duplicate webhook events)", async () => {
      const user = await createTestUser();
      const { order } = await createTestOrder({}, user._id);

      const razorpayOrderId = "rzp_order_dup_webhook";
      const razorpayPaymentId = "rzp_payment_dup_webhook";

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId,
        razorpayOrderIds: [razorpayOrderId],
      });

      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
              id: razorpayPaymentId,
            },
          },
        },
      });

      const signature = makeWebhookSignature(payload);

      // First webhook
      const response1 = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(response1.status).toBe(200);

      // Second webhook (duplicate)
      const response2 = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(response2.status).toBe(200);

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PAID");
    });
  });

  describe("POST /api/payments/retry", () => {
    it("reuses the same order and creates a new Razorpay attempt", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      // Simulate a failed payment state
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "FAILED",
        inventoryStatus: "RELEASED",
        razorpayOrderId: "rzp_order_old",
        razorpayOrderIds: ["rzp_order_old"],
      });

      mockOrdersCreate.mockResolvedValue({ id: "rzp_order_new_attempt" });

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      expect(response.status).toBe(200);
      expect(response.body.razorpayOrderId).toBe("rzp_order_new_attempt");
      expect(response.body.orderNumber).toBe(order.orderNumber);

      // Same order reused (not duplicated)
      const orders = await Order.find({ orderNumber: order.orderNumber });
      expect(orders).toHaveLength(1);

      // New Razorpay attempt appended
      const updated = await Order.findById(order._id).lean();
      expect(updated?.razorpayOrderIds).toContain("rzp_order_new_attempt");
      expect(updated?.paymentStatus).toBe("PENDING");
      expect(updated?.inventoryStatus).toBe("RESERVED");
    });

    it("re-reserves released inventory on retry", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order, product } = await createTestOrder({}, user._id);

      const stockBeforeFailure = (await Product.findById(product._id)).stock; // 49 after reservation

      // Simulate failure: inventory released (stock restored to 50)
      await Product.findByIdAndUpdate(product._id, {
        $inc: { stock: 1 },
      });

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "FAILED",
        inventoryStatus: "RELEASED",
      });

      mockOrdersCreate.mockResolvedValue({ id: "rzp_order_retry" });

      await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      // Inventory should be re-reserved (stock decremented again back to 49)
      const stockAfterRetry = (await Product.findById(product._id)).stock;
      expect(stockAfterRetry).toBe(stockBeforeFailure);
    });

    it("rejects cancelled orders", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      await Order.findByIdAndUpdate(order._id, {
        orderStatus: "CANCELLED",
      });

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("This order has been cancelled");
    });

    it("rejects already-paid orders", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder({}, user._id);

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "PAID",
      });

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("This order has already been paid");
    });

    it("rejects non-ONLINE payment orders", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);
      const { order } = await createTestOrder(
        { paymentMethod: "COD" },
        user._id,
      );

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("This order is not an online payment order");
    });

    it("cannot be used by another customer", async () => {
      const owner = await createTestUser();
      const attacker = await createTestUser();
      const token = makeCustomerToken(attacker._id);
      const { order } = await createTestOrder({}, owner._id);

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "FAILED",
        inventoryStatus: "RELEASED",
      });

      mockOrdersCreate.mockResolvedValue({ id: "rzp_order_retry" });

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: order.orderNumber });

      expect(response.status).toBe(404);
    });

    it("returns 404 for a non-existent order", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({ orderNumber: "SV-NONEXISTENT-0000" });

      expect(response.status).toBe(404);
    });

    it("returns 400 for invalid request body", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id);

      const response = await request(app)
        .post("/api/payments/retry")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe("Inventory release on failed payment", () => {
    it("releases inventory exactly once for a failed payment", async () => {
      const user = await createTestUser();
      const { order, product } = await createTestOrder({}, user._id);
      const stockBefore = (await Product.findById(product._id)).stock; // 49 after reservation

      const razorpayOrderId = "rzp_order_release_test";

      await Order.findByIdAndUpdate(order._id, {
        razorpayOrderId,
        razorpayOrderIds: [razorpayOrderId],
      });

      const payload = JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              order_id: razorpayOrderId,
            },
          },
        },
      });

      const signature = makeWebhookSignature(payload);

      // Call webhook twice - inventory should only be restored once
      await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("FAILED");
      expect(updated?.inventoryStatus).toBe("RELEASED");

      const restoredProduct = await Product.findById(product._id).lean();
      expect(restoredProduct?.stock).toBe(stockBefore + 1);
    });
  });
});
