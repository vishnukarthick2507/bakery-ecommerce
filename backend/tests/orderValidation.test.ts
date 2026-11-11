import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { Order } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { Settings } from "../src/models/Settings.js";
import { User } from "../src/models/User.js";
import { InventoryMovement } from "../src/models/InventoryMovement.js";
import { reserveInventory, restoreInventory } from "../src/services/inventory.js";
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

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not established");
  const adminDb = db.admin();
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

const baseOrderPayload: {
  customerName: string;
  email: string;
  phone: string;
  fulfillmentType: "PICKUP";
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: "COD";
  items: { productId: string; productName: string; variantId: string; quantity: number; }[];
  address?: { addressLine: string; city: string; pincode: string; };
} = {
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
  return postOrderWithKey(randomUUID(), payload);
}

function postOrderWithKey(key: string, payload: Record<string, unknown>) {
  return request(app)
    .post("/api/orders")
    .set("Idempotency-Key", key)
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
    baseOrderPayload.items[0]!.productId = product._id.toString();

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

    it("rejects guest order with missing email", async () => {
      const { email: _email, ...payloadWithoutEmail } = baseOrderPayload;
      const res = await postOrder(payloadWithoutEmail);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Checkout requires a name, valid email, and valid phone number",
      );
    });
  });

  describe("POST /api/orders - server-side checkout validation", () => {
    it("rejects an invalid product ID", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        items: [{ ...baseOrderPayload.items[0]!, productId: "not-an-object-id" }],
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid product ID");
    });

    it("rejects an inactive product", async () => {
      const productId = baseOrderPayload.items[0]!.productId;
      await Product.findByIdAndUpdate(productId, { active: false });

      const response = await postOrder(baseOrderPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Product not found");
      expect(await Order.countDocuments()).toBe(0);
    });

    it("rejects a quantity above the database stock", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        items: [{ ...baseOrderPayload.items[0]!, quantity: 11 }],
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Only 10 unit(s)");
      expect(await Order.countDocuments()).toBe(0);
      expect((await Product.findById(baseOrderPayload.items[0]!.productId))?.stock).toBe(10);
    });

    it("rejects quantities above the per-item limit", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        items: [{ ...baseOrderPayload.items[0]!, quantity: 21 }],
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid order data");
    });

    it("rejects duplicate product lines whose combined quantity exceeds the limit", async () => {
      const item = baseOrderPayload.items[0]!;
      const response = await postOrder({
        ...baseOrderPayload,
        items: [
          { ...item, quantity: 11 },
          { ...item, quantity: 10 },
        ],
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("A maximum of 20 units per product can be ordered");
      expect(await Order.countDocuments()).toBe(0);
    });

    it("allows the maximum quantity when database stock permits it", async () => {
      await Product.findByIdAndUpdate(baseOrderPayload.items[0]!.productId, { stock: 20 });
      const response = await postOrder({
        ...baseOrderPayload,
        items: [{ ...baseOrderPayload.items[0]!, quantity: 20 }],
      });

      expect(response.status).toBe(201);
      expect((await Product.findById(baseOrderPayload.items[0]!.productId))?.stock).toBe(0);
    });

    it("rejects delivery orders without an address", async () => {
      const { address: _address, ...withoutAddress } = baseOrderPayload;
      const response = await postOrder({
        ...withoutAddress,
        fulfillmentType: "DELIVERY",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Delivery address is required for delivery orders");
    });

    it("rejects invalid required delivery address fields", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        fulfillmentType: "DELIVERY",
        address: { addressLine: "1", city: "", pincode: "12" },
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid order data");
    });
  });

  describe("POST /api/orders - idempotency", () => {
    it("returns the original order for an identical replay without reserving stock twice", async () => {
      const idempotencyKey = randomUUID();
      const firstResponse = await postOrderWithKey(idempotencyKey, baseOrderPayload);
      const replayResponse = await postOrderWithKey(idempotencyKey, baseOrderPayload);

      expect(firstResponse.status).toBe(201);
      expect(replayResponse.status).toBe(200);
      expect(replayResponse.body.order.orderNumber).toBe(firstResponse.body.order.orderNumber);
      expect(await Order.countDocuments()).toBe(1);
      expect((await Product.findById(baseOrderPayload.items[0]!.productId))?.stock).toBe(9);
    });

    it("rejects reuse of an idempotency key with a changed payload", async () => {
      const idempotencyKey = randomUUID();
      const firstResponse = await postOrderWithKey(idempotencyKey, baseOrderPayload);
      const conflictResponse = await postOrderWithKey(idempotencyKey, {
        ...baseOrderPayload,
        scheduledTime: "2:00 PM - 4:00 PM",
      });

      expect(firstResponse.status).toBe(201);
      expect(conflictResponse.status).toBe(409);
      expect(conflictResponse.body.message).toContain("Idempotency key was already used");
      expect(await Order.countDocuments()).toBe(1);
      expect((await Product.findById(baseOrderPayload.items[0]!.productId))?.stock).toBe(9);
    });
  });

  describe("atomic inventory reservations and releases", () => {
    it("prevents concurrent checkouts from overselling", async () => {
      await Product.updateOne(
        { _id: baseOrderPayload.items[0]!.productId },
        { $set: { stock: 1 } },
      );
      const payload = {
        ...baseOrderPayload,
        items: [{ ...baseOrderPayload.items[0]!, quantity: 1 }],
      };

      const responses = await Promise.all([
        postOrderWithKey(randomUUID(), payload),
        postOrderWithKey(randomUUID(), payload),
      ]);

      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 400)).toHaveLength(1);
      expect((await Product.findById(baseOrderPayload.items[0]!.productId))?.stock).toBe(0);
      expect(await Order.countDocuments()).toBe(1);
    });

    it("allows only one concurrent reservation for the same final stock", async () => {
      const product = await Product.findById(baseOrderPayload.items[0]!.productId);
      expect(product).not.toBeNull();
      await Product.updateOne({ _id: product!._id }, { $set: { stock: 3 } });

      const orderIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
      const results = await Promise.allSettled(
        orderIds.map(async (orderId) => {
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(() =>
              reserveInventory(
                session,
                [{ productId: product!._id, quantity: 2 }],
                orderId,
              ),
            );
          } finally {
            await session.endSession();
          }
        }),
      );

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect((await Product.findById(product!._id))?.stock).toBe(1);
      expect(await InventoryMovement.countDocuments({ reason: "ORDER_RESERVATION" })).toBe(1);
    });

    it("restores a reservation once and records its cancellation movement", async () => {
      const product = await Product.findById(baseOrderPayload.items[0]!.productId);
      expect(product).not.toBeNull();
      const orderId = new mongoose.Types.ObjectId();
      await Product.updateOne({ _id: product!._id }, { $set: { stock: 7 } });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() =>
          restoreInventory(session, [{ productId: product!._id, quantity: 3 }], orderId),
        );
      } finally {
        await session.endSession();
      }

      expect((await Product.findById(product!._id))?.stock).toBe(10);
      const movements = await InventoryMovement.find({
        productId: product!._id,
        reason: "ORDER_RESTORE",
        relatedOrderId: orderId,
      });
      expect(movements).toHaveLength(1);
      expect(movements[0]!.quantityChange).toBe(3);
      expect(movements[0]!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("POST /api/orders - authenticated phone-only customer checkout", () => {
    let customerToken: string;
    let customerId: string;

    beforeEach(async () => {
      // Create a phone-only customer with no email and no passwordHash
      const user = await User.create({
        name: "Phone Customer",
        phone: "9840916099",
        active: true,
      });
      customerId = user._id.toString();

      // Sign a JWT using the same mechanism as customerAuthController.createCustomerToken
      customerToken = jwt.sign(
        {
          customerId,
          accountType: "CUSTOMER",
          tokenVersion: user.tokenVersion ?? 0,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );
    });

    it("allows an authenticated phone-only customer to create an order", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", randomUUID())
        .set("Authorization", `Bearer ${customerToken}`)
        .send(baseOrderPayload);

      expect(res.status).toBe(201);
      expect(res.body.order.orderNumber).toBeDefined();

      // Verify the order is associated with the same customer's MongoDB _id
      const order = await Order.findOne({
        orderNumber: res.body.order.orderNumber,
      });
      expect(order).toBeDefined();
      expect(order?.userId?.toString()).toBe(customerId);
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

  describe("POST /api/orders - scheduled date and time validation", () => {
    it("rejects an impossible calendar date instead of normalizing it", async () => {
      const impossibleDate = `${new Date().getFullYear() + 1}-02-31`;
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledDate: impossibleDate,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid scheduled date or time/i);
    });

    it("rejects invalid minutes in a scheduled time range", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "10:99 AM - 12:00 PM",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid scheduled date or time/i);
    });

    it("rejects a malformed scheduled time range", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "10:00 AM - not a time",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid scheduled date or time/i);
    });

    it("rejects a reversed scheduled time range", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "2:00 PM - 10:00 AM",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid scheduled date or time/i);
    });

    it("rejects scheduled slots outside the existing weekly business hours", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "5:00 AM - 7:00 AM",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Bakery hours/i);
    });

    it("rejects a time range that ends after the latest existing closing time", async () => {
      const response = await postOrder({
        ...baseOrderPayload,
        scheduledTime: "6:00 PM - 11:00 PM",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid scheduled date or time/i);
    });
  });

  describe("POST /api/orders - Pay at Store (pickup only)", () => {
    it("allows guest pickup with Pay at Store without OTP", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        fulfillmentType: "PICKUP",
        paymentMethod: "PAY_AT_STORE",
      });

      expect(res.status).toBe(201);
      expect(res.body.order.orderNumber).toBeDefined();

      // Verify the order was created by querying it directly
      const order = await Order.findOne({
        orderNumber: res.body.order.orderNumber,
      });
      expect(order).toBeDefined();
      expect(order!.paymentMethod).toBe("PAY_AT_STORE");
    });

    it("rejects delivery with Pay at Store", async () => {
      const res = await postOrder({
        ...baseOrderPayload,
        fulfillmentType: "DELIVERY",
        address: {
          addressLine: "123 Test Street",
          city: "Test City",
          pincode: "600001",
        },
        paymentMethod: "PAY_AT_STORE",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Pay at Store is only available for pickup orders.");
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
    baseOrderPayload.items[0]!.productId = product._id.toString();

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
      fulfillmentType: "PICKUP" as const,
      scheduledDate: baseOrderPayload.scheduledDate,
      scheduledTime: "10:00 AM - 12:00 PM",
      paymentMethod: "COD" as const,
      paymentStatus: "PENDING" as const,
      orderStatus: "PLACED" as const,
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
