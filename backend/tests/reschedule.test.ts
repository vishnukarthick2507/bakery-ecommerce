import crypto from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

import { Order } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { User } from "../src/models/User.js";
import { Admin } from "../src/models/Admin.js";
import { Settings } from "../src/models/Settings.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import adminOrderRoutes from "../src/routes/adminOrderRoutes.js";
import settingsRoutes from "../src/routes/settingsRoutes.js";
import {
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  app.use("/api/admin/orders", adminOrderRoutes);
  app.use("/api/settings", settingsRoutes);
  return app;
}

const app = createTestApp();

function makeAdminToken(adminId: string): string {
  return jwt.sign(
    { adminId, username: "testadmin", role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function makeCustomerToken(customerId: string, tokenVersion = 0): string {
  return jwt.sign(
    { customerId, accountType: "CUSTOMER", tokenVersion },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

let counter = 0;

async function createTestUser(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return User.create({
    name: "Test User",
    email: `rs${counter}-${Date.now()}@example.com`,
    phone: `9${String(counter).padStart(9, "0")}`,
    passwordHash: await bcrypt.hash("Password123", 10),
    active: true,
    tokenVersion: 0,
    ...overrides,
  });
}

async function createTestProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: "Test Product",
    slug: `rs-product-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
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
  return `SV-RS-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

// Generate a future time at 2:00 PM IST (within business hours on any day)
function futureBusinessHourTime(daysFromNow = 2): Date {
  const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // UTC+5:30
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const result = new Date(istNow);
  result.setDate(istNow.getDate() + daysFromNow);
  result.setHours(14, 0, 0, 0); // 2:00 PM IST
  // Convert back to UTC for storage
  return new Date(result.getTime() - IST_OFFSET_MS);
}

async function createTestOrderInDB(
  overrides: Record<string, unknown> = {},
  userId?: mongoose.Types.ObjectId,
) {
  const product = await createTestProduct();
  const now = new Date();
  // Set requestedSlot to tomorrow at 10:00 AM IST (within business hours)
  const requestedSlot = new Date(now);
  requestedSlot.setDate(now.getDate() + 1);
  requestedSlot.setHours(10, 0, 0, 0);
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
    address: undefined,
    scheduledDate: requestedSlot.toISOString().split("T")[0],
    scheduledTime: "10:00 AM - 12:00 PM",
    requestedSlot,
    confirmedSlot: new Date(requestedSlot.getTime()),
    paymentMethod: "COD",
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

  await Product.findByIdAndUpdate(product._id, {
    $inc: { stock: -1 },
  });

  return { order, product };
}

describe("Reschedule Proposal", () => {
  beforeAll(
    async () => {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          args: ["--replSet", "rs-rs"],
        },
      });
      const uri = mongoServer.getUri();
      await mongoose.connect(uri, { directConnection: true });

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
      await new Promise((resolve) => setTimeout(resolve, 10000));
    },
    120000,
  );

  beforeEach(async () => {
    await clearTestDB();
    await Admin.create({
      username: "testadmin",
      password: await bcrypt.hash("CorrectPassword123", 10),
      role: "ADMIN",
    });
    await Settings.getSingleton();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("Admin propose slot", () => {
    let adminToken: string;
    let customerToken: string;
    let user: any;
    let order: any;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      user = await createTestUser();
      customerToken = makeCustomerToken(user._id.toString());
      const result = await createTestOrderInDB({}, user._id);
      order = result.order;
    });

    it("admin can propose a new slot", async () => {
      const futureTime = futureBusinessHourTime(); // 2 days from now

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString(), note: "Requested slot unavailable" });

      expect(response.status).toBe(200);
      expect(response.body.order.orderStatus).toBe("RESCHEDULE_PROPOSED");
      expect(response.body.order.proposedSlot.status).toBe("PENDING");
      expect(response.body.order.proposedSlot.proposedBy).toBeDefined();
      expect(response.body.order.requestedSlot).toBeDefined();
      expect(response.body.order.confirmedSlot).toBeDefined();

      const updated = await Order.findById(order._id).lean();
      expect(updated?.orderStatus).toBe("RESCHEDULE_PROPOSED");
      expect(updated?.proposedSlot?.status).toBe("PENDING");
      expect(updated?.requestedSlot?.getTime()).toBe(order.requestedSlot.getTime()); // unchanged
    });

    it("non-admin cannot propose a slot", async () => {
      const futureTime = futureBusinessHourTime();

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(401);
    });

    it("invalid order ID rejected", async () => {
      const futureTime = futureBusinessHourTime();

      const response = await request(app)
        .post("/api/admin/orders/invalid-id/propose-slot")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("nonexistent order rejected", async () => {
      const futureTime = futureBusinessHourTime();
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/admin/orders/${fakeId}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(404);
    });

    it("past slot rejected", async () => {
      const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: pastTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("outside business hours slot rejected", async () => {
      // 3:00 AM IST - outside business hours (7 AM – 9 PM weekdays)
      const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const now = new Date();
      const istNow = new Date(now.getTime() + IST_OFFSET_MS);
      const monday3amIst = new Date(istNow);
      const daysToMonday = ((1 - istNow.getUTCDay() + 7) % 7) || 1;
      monday3amIst.setUTCDate(istNow.getUTCDate() + daysToMonday);
      monday3amIst.setUTCHours(3, 0, 0, 0);
      const monday3amUtc = new Date(monday3amIst.getTime() - IST_OFFSET_MS);

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: monday3amUtc.toISOString() });

      expect(response.status).toBe(400);
    });

    it("duplicate pending proposal rejected", async () => {
      const futureTime = futureBusinessHourTime();

      const firstResponse = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(firstResponse.status).toBe(200);

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(409);
    });

    it("same-as-confirmed slot rejected", async () => {
      const sameTime = new Date(order.confirmedSlot.getTime());

      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: sameTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("delivered order rejected for reschedule", async () => {
      const product = await createTestProduct();
      const deliveredOrder = await Order.create({
        orderNumber: makeOrderNumber(),
        idempotencyKey: `idem-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "T", email: "t@e.com", phone: "9876543210" },
        customerName: "T",
        phone: "9876543210",
        fulfillmentType: "DELIVERY",
        address: { addressLine: "123 St", city: "City", pincode: "600001" },
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        requestedSlot: new Date("2026-12-01T10:00:00Z"),
        confirmedSlot: new Date("2026-12-01T10:00:00Z"),
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "DELIVERED",
        items: [
          {
            productId: product._id,
            productName: product.name,
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
      } as any);

      const futureTime = futureBusinessHourTime();

      const response = await request(app)
        .post(`/api/admin/orders/${deliveredOrder._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("collected order rejected for reschedule", async () => {
      const product = await createTestProduct();
      const collectedOrder = await Order.create({
        orderNumber: makeOrderNumber(),
        idempotencyKey: `idem-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "T", email: "t@e.com", phone: "9876543210" },
        customerName: "T",
        phone: "9876543210",
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        requestedSlot: new Date("2026-12-01T10:00:00Z"),
        confirmedSlot: new Date("2026-12-01T10:00:00Z"),
        paymentMethod: "PAY_AT_STORE",
        paymentStatus: "PAID",
        orderStatus: "COLLECTED",
        items: [
          {
            productId: product._id,
            productName: product.name,
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
      } as any);

      const futureTime = futureBusinessHourTime();

      const response = await request(app)
        .post(`/api/admin/orders/${collectedOrder._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("cancelled order rejected for reschedule", async () => {
      const product = await createTestProduct();
      const cancelledOrder = await Order.create({
        orderNumber: makeOrderNumber(),
        idempotencyKey: `idem-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "T", email: "t@e.com", phone: "9876543210" },
        customerName: "T",
        phone: "9876543210",
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        requestedSlot: new Date("2026-12-01T10:00:00Z"),
        confirmedSlot: new Date("2026-12-01T10:00:00Z"),
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        orderStatus: "CANCELLED",
        items: [
          {
            productId: product._id,
            productName: product.name,
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
      } as any);

      const futureTime = futureBusinessHourTime();

      const response = await request(app)
        .post(`/api/admin/orders/${cancelledOrder._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      expect(response.status).toBe(400);
    });

    it("payment status unchanged after proposal", async () => {
      const futureTime = futureBusinessHourTime();

      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      const updated = await Order.findById(order._id).lean();
      expect(updated?.paymentStatus).toBe("PENDING");
      expect(updated?.paymentMethod).toBe(order.paymentMethod);
    });

    it("inventory unchanged after proposal", async () => {
      const product = await createTestProduct({ stock: 10 });
      const stockBefore = product.stock;

      const futureTime = futureBusinessHourTime();

      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      const after = await Product.findById(product._id).lean();
      expect(after?.stock).toBe(stockBefore);
    });
  });

  describe("Customer accept proposal", () => {
    let adminToken: string;
    let customerToken: string;
    let user: any;
    let order: any;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      user = await createTestUser();
      customerToken = makeCustomerToken(user._id.toString());
      const result = await createTestOrderInDB({}, user._id);
      order = result.order;

      // Create a proposal
      const futureTime = futureBusinessHourTime();
      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString(), note: "New suggested time" });
    });

    it("owner can accept proposal", async () => {
      const updatedOrder = await Order.findById(order._id).lean();
      const proposedTime = updatedOrder?.proposedSlot?.time;

      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order.orderStatus).toBe("CONFIRMED");
      expect(response.body.order.confirmedSlot).toBeDefined();
      expect(new Date(response.body.order.confirmedSlot).getTime()).toBe(
        new Date(proposedTime!).getTime(),
      );
      expect(response.body.order.proposedSlot.status).toBe("ACCEPTED");

      const final = await Order.findById(order._id).lean();
      expect(final?.requestedSlot?.getTime()).toBe(order.requestedSlot.getTime()); // unchanged
      expect(final?.confirmedSlot?.getTime()).toBe(new Date(proposedTime!).getTime());
      expect(final?.createdAt?.getTime()).toBe(order.createdAt.getTime()); // unchanged
      expect(final?.slotHistory.length).toBeGreaterThan(0);
    });

    it("another customer cannot accept", async () => {
      const attacker = await createTestUser();
      const attackerToken = makeCustomerToken(attacker._id.toString());

      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${attackerToken}`);

      expect(response.status).toBe(404);
    });

    it("unauthenticated request rejected", async () => {
      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .send({});

      expect(response.status).toBe(401);
    });

    it("already accepted proposal cannot be accepted again", async () => {
      // First accept
      await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      // Second accept
      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(400);
    });

    it("requestedSlot never changes after accept", async () => {
      const originalRequestedSlot = order.requestedSlot.getTime();

      await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      const final = await Order.findById(order._id).lean();
      expect(final?.requestedSlot?.getTime()).toBe(originalRequestedSlot);
    });
  });

  describe("Customer decline proposal", () => {
    let adminToken: string;
    let customerToken: string;
    let user: any;
    let order: any;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      user = await createTestUser();
      customerToken = makeCustomerToken(user._id.toString());
      const result = await createTestOrderInDB({}, user._id);
      order = result.order;

      const futureTime = futureBusinessHourTime();
      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString(), note: "New suggested time" });
    });

    it("owner can decline proposal", async () => {
      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/decline`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order.proposedSlot.status).toBe("DECLINED");
      expect(response.body.order.confirmedSlot).toBeDefined();
      expect(response.body.order.orderStatus).toBe("PLACED"); // restored to previous

      const final = await Order.findById(order._id).lean();
      expect(final?.requestedSlot?.getTime()).toBe(order.requestedSlot.getTime()); // unchanged
      expect(final?.confirmedSlot?.getTime()).toBe(order.confirmedSlot.getTime()); // unchanged
    });

    it("another customer cannot decline", async () => {
      const attacker = await createTestUser();
      const attackerToken = makeCustomerToken(attacker._id.toString());

      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/decline`)
        .set("Authorization", `Bearer ${attackerToken}`);

      expect(response.status).toBe(404);
    });

    it("already declined proposal cannot be accepted", async () => {
      // First decline
      await request(app)
        .post(`/api/orders/${order._id}/proposal/decline`)
        .set("Authorization", `Bearer ${customerToken}`);

      // Try to accept
      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe("Expired proposal", () => {
    it("expired proposal cannot be accepted", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());
      const user = await createTestUser();
      const customerToken = makeCustomerToken(user._id.toString());
      const result = await createTestOrderInDB({}, user._id);
      const order = result.order;

      // First create a valid proposal
      const validTime = futureBusinessHourTime();
      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: validTime.toISOString() });

      // Manually expire the proposal by setting expiresAt to past
      await Order.findByIdAndUpdate(order._id, {
        "proposedSlot.expiresAt": new Date(Date.now() - 60 * 60 * 1000),
        "proposedSlot.status": "PENDING",
      });

      const response = await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("expired");
    });
  });

  describe("Timestamp integrity", () => {
    it("createdAt remains unchanged after proposal and accept", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());
      const user = await createTestUser();
      const customerToken = makeCustomerToken(user._id.toString());
      const result = await createTestOrderInDB({}, user._id);
      const order = result.order;
      const originalCreatedAt = order.createdAt.getTime();

      const futureTime = futureBusinessHourTime();
      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });

      await request(app)
        .post(`/api/orders/${order._id}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      const final = await Order.findById(order._id).lean();
      expect(final?.createdAt?.getTime()).toBe(originalCreatedAt);
    });

    it("proposedAt uses server-side timestamp", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());
      const result = await createTestOrderInDB();
      const order = result.order;

      const before = new Date();
      const futureTime = futureBusinessHourTime();
      await request(app)
        .post(`/api/admin/orders/${order._id}/propose-slot`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ time: futureTime.toISOString() });
      const after = new Date();

      const updated = await Order.findById(order._id).lean();
      const proposedAt = new Date(updated?.proposedSlot?.proposedAt!);
      expect(proposedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(proposedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("Existing order compatibility", () => {
    it("existing orders without new slot fields remain accessible", async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const order = await Order.create(
        {
          orderNumber: makeOrderNumber(),
          idempotencyKey: `idem-${Date.now()}`,
          idempotencyHash: "hash",
          userId: user._id,
          customer: { name: "T", email: "t@e.com", phone: "9876543210" },
          customerName: "T",
          phone: "9876543210",
          fulfillmentType: "DELIVERY",
          address: { addressLine: "123 St", city: "City", pincode: "600001" },
          scheduledDate: "2026-12-01",
          scheduledTime: "10:00 AM - 12:00 PM",
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          orderStatus: "PLACED",
          items: [
            {
              productId: product._id,
              productName: product.name,
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
        } as any,
      );

      const token = makeCustomerToken(user._id.toString());
      // Fetch by order number should still work
      const response = await request(app)
        .get(`/api/orders/${order.orderNumber}`)
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.order.orderNumber).toBe(order.orderNumber);
    });

    it("delivery orders continue working", async () => {
      const product = await createTestProduct();
      const response = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", crypto.randomUUID())
        .send({
          customerName: "Test Customer",
          email: `deli-${Date.now()}@example.com`,
          phone: "9876543210",
          fulfillmentType: "DELIVERY",
          address: { addressLine: "123 St", city: "City", pincode: "600001" },
          scheduledDate: "2026-12-01",
          scheduledTime: "10:00 AM - 12:00 PM",
          paymentMethod: "COD",
          items: [
            { productId: product._id.toString(), productName: product.name, variantId: "default", quantity: 1 },
          ],
        });

      expect(response.status).toBe(201);
    });

    it("pickup orders continue working", async () => {
      const product = await createTestProduct();
      const response = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", crypto.randomUUID())
        .send({
          customerName: "Test Customer",
          email: `pick-${Date.now()}@example.com`,
          phone: "9876543210",
          fulfillmentType: "PICKUP",
          scheduledDate: "2026-12-01",
          scheduledTime: "10:00 AM - 12:00 PM",
          paymentMethod: "PAY_AT_STORE",
          items: [
            { productId: product._id.toString(), productName: product.name, variantId: "default", quantity: 1 },
          ],
        });

      expect(response.status).toBe(201);
    });
  });
});
