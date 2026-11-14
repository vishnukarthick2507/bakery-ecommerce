import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { Order } from "../src/models/Order.js";
import { Admin } from "../src/models/Admin.js";
import { Product } from "../src/models/Product.js";
import { Settings } from "../src/models/Settings.js";
import { User } from "../src/models/User.js";
import orderRoutes from "../src/routes/orderRoutes.js";

process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

let mongoServer: MongoMemoryServer;

async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function disconnectTestDB(): Promise<void> {
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

function createAdminToken(adminId: string, username: string): string {
  return jwt.sign(
    {
      adminId,
      username,
      role: "ADMIN",
      tokenVersion: 0,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function createCustomerToken(customerId: string, tokenVersion: number): string {
  return jwt.sign(
    {
      customerId,
      accountType: "CUSTOMER",
      tokenVersion,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

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

async function createOrderInDB(overrides: Record<string, unknown> = {}) {
  const slug = `test-product-${Date.now()}-${Math.floor(Math.random() * 9000)}`;
  const product = await Product.create({ ...baseProduct, slug });
  return Order.create({
    orderNumber: `SV-TEST-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    idempotencyKey: `test-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    idempotencyHash: "test-hash",
    customer: {
      name: "Test Customer",
      email: "test@example.com",
      phone: "9840916058",
    },
    customerName: "Test Customer",
    phone: "9840916058",
    fulfillmentType: "PICKUP",
    scheduledDate: "2026-12-01",
    scheduledTime: "10:00 AM - 12:00 PM",
    paymentMethod: "COD",
    paymentStatus: "PAID",
    orderStatus: "DELIVERED",
    items: [
      {
        productId: product._id,
        productName: "Test Product",
        variantId: "default",
        quantity: 1,
        unitPrice: 100,
        itemTotal: 100,
        totalPrice: 100,
      },
    ],
    subtotal: 100,
    deliveryFee: 0,
    totalAmount: 100,
    ...overrides,
  });
}

describe("Order archive", () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    await connectTestDB();
  });

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

    const admin = await Admin.create({
      username: "testadmin",
      password: await bcrypt.hash("password123", 10),
      role: "ADMIN",
    });
    adminId = admin._id.toString();
    adminToken = createAdminToken(adminId, "testadmin");
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe("PATCH /api/orders/:orderNumber/archive", () => {
    it("requires admin authentication", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .send({});
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Authentication required");
    });

    it("archives a DELIVERED order", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Order archived successfully");
      expect(res.body.order.isArchived).toBe(true);
      expect(res.body.order.archivedAt).toBeDefined();
      expect(res.body.order.archivedBy).toBe(adminId);
      // Payment and inventory fields must be unchanged
      expect(res.body.order.paymentStatus).toBe("PAID");
      expect(res.body.order.inventoryStatus).toBeUndefined();
      expect(res.body.order.orderStatus).toBe("DELIVERED");
      expect(res.body.order.totalAmount).toBe(100);
    });

    it("archives a COLLECTED order", async () => {
      const order = await createOrderInDB({ orderStatus: "COLLECTED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.order.isArchived).toBe(true);
      expect(res.body.order.orderStatus).toBe("COLLECTED");
    });

    it("archives a CANCELLED order", async () => {
      const order = await createOrderInDB({ orderStatus: "CANCELLED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.order.isArchived).toBe(true);
      expect(res.body.order.orderStatus).toBe("CANCELLED");
    });

    it("rejects archiving a PLACED order", async () => {
      const order = await createOrderInDB({ orderStatus: "PLACED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Only delivered, collected or cancelled orders can be archived");
    });

    it("rejects archiving a CONFIRMED order", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects archiving a PREPARING order", async () => {
      const order = await createOrderInDB({ orderStatus: "PREPARING" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects archiving an already-archived order with 409", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Order is already archived");
    });

    it("returns 404 for a non-existent order", async () => {
      const res = await request(app)
        .patch("/api/orders/SV-NONEXISTENT/archive")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Order not found");
    });

    it("does not delete the order document", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED" });
      await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      const stillExists = await Order.findOne({ orderNumber: order.orderNumber });
      expect(stillExists).not.toBeNull();
      expect(stillExists!.isArchived).toBe(true);
    });

    it("does not create inventory movement records", async () => {
      const { InventoryMovement } = await import("../src/models/InventoryMovement.js");
      const order = await createOrderInDB({ orderStatus: "DELIVERED" });
      await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/archive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      const movements = await InventoryMovement.find({ relatedOrderId: order._id });
      expect(movements.length).toBe(0);
    });
  });

  describe("PATCH /api/orders/:orderNumber/restore", () => {
    it("requires admin authentication", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/restore`)
        .send({});
      expect(res.status).toBe(401);
    });

    it("restores an archived order", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/restore`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Order restored successfully");
      expect(res.body.order.isArchived).toBe(false);
      expect(res.body.order.archivedAt).toBeUndefined();
      expect(res.body.order.archivedBy).toBeUndefined();
    });

    it("rejects restoring a non-archived order with 409", async () => {
      const order = await createOrderInDB({ orderStatus: "DELIVERED" });
      const res = await request(app)
        .patch(`/api/orders/${encodeURIComponent(order.orderNumber)}/restore`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Order is not archived");
    });

    it("returns 404 for a non-existent order", async () => {
      const res = await request(app)
        .patch("/api/orders/SV-NONEXISTENT/restore")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Order not found");
    });
  });

  describe("GET /api/orders (admin list filter)", () => {
    it("excludes archived orders by default", async () => {
      await createOrderInDB({ orderStatus: "DELIVERED" });
      await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true });
      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBe(1);
      expect(res.body.orders[0].isArchived).toBe(false);
    });

    it("returns only archived orders with ?archived=true", async () => {
      await createOrderInDB({ orderStatus: "DELIVERED" });
      await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true });
      const res = await request(app)
        .get("/api/orders?archived=true")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBe(1);
      expect(res.body.orders[0].isArchived).toBe(true);
    });

    it("preserves existing filters with archive filter", async () => {
      await createOrderInDB({ orderStatus: "DELIVERED", phone: "1111111111" });
      await createOrderInDB({ orderStatus: "DELIVERED", isArchived: true, phone: "2222222222" });
      const res = await request(app)
        .get("/api/orders?phone=1111111111")
        .set("Authorization", `Bearer ${adminToken}`);
      // Search doesn't filter by phone directly; it searches orderNumber, customerName, phone
      expect(res.status).toBe(200);
      // Archived orders should not appear in default list
      expect(res.body.orders.every((o: { isArchived: boolean }) => !o.isArchived)).toBe(true);
    });
  });

  describe("Customer history and guest tracking visibility", () => {
    it("getMyOrderByNumber returns archived orders for customers", async () => {
      const user = await User.create({
        name: "Test Customer",
        email: "customer@example.com",
        phone: "9840916058",
        passwordHash: "hash",
        emailVerified: true,
        active: true,
      });
      const order = await createOrderInDB({
        orderStatus: "DELIVERED",
        isArchived: true,
        userId: user._id,
      });
      const customerToken = createCustomerToken(user._id.toString(), 0);
      const res = await request(app)
        .get(`/api/orders/me/${encodeURIComponent(order.orderNumber)}`)
        .set("Authorization", `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.order.orderNumber).toBe(order.orderNumber);
    });

    it("trackGuestOrder returns archived guest orders", async () => {
      const order = await createOrderInDB({
        orderStatus: "DELIVERED",
        isArchived: true,
        userId: undefined,
      });
      const res = await request(app)
        .post("/api/orders/track")
        .send({ orderNumber: order.orderNumber, phone: order.phone });
      expect(res.status).toBe(200);
      expect(res.body.order.orderNumber).toBe(order.orderNumber);
    });
  });

  describe("Existing documents without isArchived", () => {
    it("treats missing isArchived as non-archived in default list", async () => {
      const product = await Product.create(baseProduct);
      // Insert directly via collection to bypass Mongoose default
      await Order.collection.insertOne({
        orderNumber: `SV-LEGACY-${Date.now()}`,
        idempotencyKey: `legacy-${Date.now()}`,
        idempotencyHash: "legacy-hash",
        customer: { name: "Legacy Customer", email: "legacy@example.com", phone: "9999999999" },
        customerName: "Legacy Customer",
        phone: "9999999999",
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "DELIVERED",
        items: [
          {
            productId: product._id,
            productName: "Legacy Product",
            variantId: "default",
            quantity: 1,
            unitPrice: 50,
            itemTotal: 50,
            totalPrice: 50,
          },
        ],
        subtotal: 50,
        deliveryFee: 0,
        totalAmount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const legacyOrder = res.body.orders.find((o: { orderNumber: string }) => o.orderNumber.startsWith("SV-LEGACY"));
      expect(legacyOrder).toBeDefined();
      // Missing isArchived on existing documents behaves as false
      expect(legacyOrder.isArchived ?? false).toBe(false);
    });
  });
});
