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
import orderRoutes from "../src/routes/orderRoutes.js";
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

let userCounter = 0;

async function createTestUser(overrides: Record<string, unknown> = {}) {
  userCounter += 1;
  return User.create({
    name: "Test User",
    email: `st${userCounter}-${Date.now()}@example.com`,
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
    slug: `st-product-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
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
  return `SV-ST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function createTestOrderViaAPI(
  token: string | null,
  body: Record<string, unknown>,
) {
  let req = request(app)
    .post("/api/orders")
    .set("Idempotency-Key", crypto.randomUUID());
  if (token) {
    req = req.set("Authorization", `Bearer ${token}`);
  }
  return req.send(body);
}

const baseOrderBody = {
  customerName: "Test Customer",
  email: `stcustomer-${Date.now()}@example.com`,
  phone: "9876543210",
  fulfillmentType: "DELIVERY",
  address: {
    addressLine: "123 Test Street",
    city: "Test City",
    pincode: "600001",
  },
  scheduledDate: "2026-12-01",
  scheduledTime: "10:00 AM - 12:00 PM",
  paymentMethod: "COD",
  items: [
    {
      productId: "",
      productName: "Test Product",
      variantId: "default",
      quantity: 1,
    },
  ],
};

describe("Settings API", () => {
  beforeAll(
    async () => {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          args: ["--replSet", "settings-rs"],
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
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("GET /api/settings", () => {
    it("returns default settings", async () => {
      const response = await request(app).get("/api/settings");

      expect(response.status).toBe(200);
      expect(response.body.settings.onlineOrdersEnabled).toBe(true);
      expect(response.body.settings.deliveryEnabled).toBe(true);
      expect(response.body.settings.pickupEnabled).toBe(true);
      expect(typeof response.body.settings.closedMessage).toBe("string");
      expect(response.body.settings.closedMessage.length).toBeGreaterThan(0);
      expect(response.body.settings.reopenAt).toBeNull();
    });
  });

  describe("PATCH /api/settings", () => {
    it("allows an admin to update settings", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const response = await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({
          onlineOrdersEnabled: false,
          deliveryEnabled: false,
          pickupEnabled: true,
          closedMessage: "We are closed for the day.",
        });

      expect(response.status).toBe(200);
      expect(response.body.settings.onlineOrdersEnabled).toBe(false);
      expect(response.body.settings.deliveryEnabled).toBe(false);
      expect(response.body.settings.pickupEnabled).toBe(true);
      expect(response.body.settings.closedMessage).toBe(
        "We are closed for the day.",
      );
    });

    it("rejects a settings update without an admin token", async () => {
      const response = await request(app)
        .patch("/api/settings")
        .send({ onlineOrdersEnabled: false });

      expect(response.status).toBe(401);
    });

    it("validates the settings request body", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const response = await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ closedMessage: "" });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe("Order creation enforcement (settings)", () => {
    it("blocks all new orders when online ordering is OFF", async () => {
      const product = await createTestProduct();
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ onlineOrdersEnabled: false });

      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
      };
      const response = await createTestOrderViaAPI(null, body);

      expect(response.status).toBe(403);

      // No order was created and no inventory was reserved.
      const orders = await Order.find({});
      expect(orders).toHaveLength(0);

      const after = await Product.findById(product._id);
      expect(after?.stock).toBe(50);
    });

    it("blocks DELIVERY orders when delivery is OFF", async () => {
      const product = await createTestProduct();
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ deliveryEnabled: false });

      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
        fulfillmentType: "DELIVERY",
      };
      const response = await createTestOrderViaAPI(null, body);

      expect(response.status).toBe(403);

      const orders = await Order.find({});
      expect(orders).toHaveLength(0);
    });

    it("blocks PICKUP orders when pickup is OFF", async () => {
      const product = await createTestProduct();
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ pickupEnabled: false });

      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
        fulfillmentType: "PICKUP",
        address: undefined,
      };
      const response = await createTestOrderViaAPI(null, body);

      expect(response.status).toBe(403);

      const orders = await Order.find({});
      expect(orders).toHaveLength(0);
    });

    it("allows orders when settings are enabled", async () => {
      const product = await createTestProduct();

      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
        fulfillmentType: "PICKUP",
        address: undefined,
      };
      const response = await createTestOrderViaAPI(null, body);

      expect(response.status).toBe(201);

      const orders = await Order.find({});
      expect(orders).toHaveLength(1);
    });

    it("does not reserve inventory when rejected by settings", async () => {
      const product = await createTestProduct({ stock: 5 });
      const stockBefore = product.stock;
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ onlineOrdersEnabled: false });

      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
      };
      await createTestOrderViaAPI(null, body);

      const after = await Product.findById(product._id);
      expect(after?.stock).toBe(stockBefore);
    });

    it("existing orders remain accessible when settings are switched OFF", async () => {
      const product = await createTestProduct();
      const user = await createTestUser();

      const order = await Order.create(
        {
          orderNumber: makeOrderNumber(),
          idempotencyKey: `idem-${Date.now()}`,
          idempotencyHash: "test-hash",
          userId: user._id,
          customer: {
            name: "Test Customer",
            email: "customer@example.com",
            phone: "9876543210",
          },
          customerName: "Test Customer",
          phone: "9876543210",
          fulfillmentType: "DELIVERY",
          address: {
            addressLine: "123 Test Street",
            city: "Test City",
            pincode: "600001",
          },
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

      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());

      await request(app)
        .patch("/api/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ onlineOrdersEnabled: false });

      const customerToken = makeCustomerToken(user._id.toString());
      const response = await request(app)
        .get(`/api/orders/me/${order.orderNumber}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order.orderNumber).toBe(order.orderNumber);
    });
  });

  describe("Slot fields population (Feature 4)", () => {
    // Construct a future business-hour date/time in Asia/Kolkata (UTC+5:30).
    // 10:00 AM–12:00 PM is within business hours for every day of the week.
    function futureBusinessHourSlot(): {
      date: string;
      time: string;
    } {
      const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const utcNow = new Date();
      const futureIstMs =
        utcNow.getTime() + IST_OFFSET_MS + 2 * 24 * 60 * 60 * 1000; // 2 days later
      const futureDate = new Date(futureIstMs);
      const y = futureDate.getUTCFullYear();
      const m = String(futureDate.getUTCMonth() + 1).padStart(2, "0");
      const d = String(futureDate.getUTCDate()).padStart(2, "0");
      return {
        date: `${y}-${m}-${d}`,
        time: "10:00 AM - 12:00 PM",
      };
    }

    async function createOrderWithSlot(
      overrides: Record<string, unknown> = {},
      userId?: mongoose.Types.ObjectId,
    ) {
      const product = await createTestProduct();
      const slot = futureBusinessHourSlot();
      const body = {
        ...baseOrderBody,
        items: [
          { ...baseOrderBody.items[0], productId: product._id.toString() },
        ],
        scheduledDate: slot.date,
        scheduledTime: slot.time,
        ...overrides,
      } as any;
      if (userId) {
        body.userId = userId;
      }
      const response = await createTestOrderViaAPI(null, body);
      return { response, product, slot };
    }

    it("populates requestedSlot and confirmedSlot for a new DELIVERY order", async () => {
      const { response, product, slot } = await createOrderWithSlot({
        fulfillmentType: "DELIVERY",
      });

      expect(response.status).toBe(201);

      const order = await Order.findOne({
        orderNumber: response.body.order.orderNumber,
      }).lean();

      expect(order?.requestedSlot).toBeDefined();
      expect(order?.confirmedSlot).toBeDefined();

      // Both initially represent the selected scheduled slot.
      expect(new Date(order!.requestedSlot!).getTime()).toBe(
        new Date(order!.confirmedSlot!).getTime(),
      );

      // Legacy fields remain populated.
      expect(order?.scheduledDate).toBe(slot.date);
      expect(order?.scheduledTime).toBe(slot.time);

      // requestedSlot is in the future.
      expect(new Date(order!.requestedSlot!).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it("populates requestedSlot and confirmedSlot for a new PICKUP order", async () => {
      const { response, slot } = await createOrderWithSlot({
        fulfillmentType: "PICKUP",
        address: undefined,
      });

      expect(response.status).toBe(201);

      const order = await Order.findOne({
        orderNumber: response.body.order.orderNumber,
      }).lean();

      expect(order?.requestedSlot).toBeDefined();
      expect(order?.confirmedSlot).toBeDefined();
      expect(new Date(order!.requestedSlot!).getTime()).toBe(
        new Date(order!.confirmedSlot!).getTime(),
      );
      expect(order?.scheduledDate).toBe(slot.date);
      expect(order?.scheduledTime).toBe(slot.time);
    });

    it("scheduledDate/scheduledTime remain populated alongside slot fields", async () => {
      const { response, slot } = await createOrderWithSlot();

      expect(response.status).toBe(201);

      const order = await Order.findOne({
        orderNumber: response.body.order.orderNumber,
      }).lean();

      expect(order?.scheduledDate).toBe(slot.date);
      expect(order?.scheduledTime).toBe(slot.time);
      expect(order?.requestedSlot).toBeDefined();
      expect(order?.confirmedSlot).toBeDefined();
    });

    it("requestedSlot is not overwritten by a status update", async () => {
      const { response } = await createOrderWithSlot();

      const order = await Order.findOne({
        orderNumber: response.body.order.orderNumber,
      }).lean();
      const originalRequestedSlot = order!.requestedSlot!;
      const originalCreatedAt = order!.createdAt!;

      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());

      // Advance status through CONFIRMED -> PREPARING -> READY
      await request(app)
        .patch(`/api/orders/${order.orderNumber}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "CONFIRMED" });
      await request(app)
        .patch(`/api/orders/${order.orderNumber}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "PREPARING" });
      await request(app)
        .patch(`/api/orders/${order.orderNumber}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "READY" });

      const updated = await Order.findById(order._id).lean();

      // requestedSlot must remain exactly as created.
      expect(new Date(updated!.requestedSlot!).getTime()).toBe(
        new Date(originalRequestedSlot).getTime(),
      );
      // confirmedSlot should still equal requestedSlot (no proposal was made).
      expect(new Date(updated!.confirmedSlot!).getTime()).toBe(
        new Date(originalRequestedSlot).getTime(),
      );
      // createdAt must remain unchanged.
      expect(new Date(updated!.createdAt!).getTime()).toBe(
        new Date(originalCreatedAt).getTime(),
      );
    });

    it("rescheduling preserves requestedSlot and updates confirmedSlot", async () => {
      const { response } = await createOrderWithSlot();

      const order = await Order.findOne({
        orderNumber: response.body.order.orderNumber,
      }).lean();
      const originalRequestedSlot = order!.requestedSlot!;
      const originalConfirmedSlot = order!.confirmedSlot!;

      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());

      // Admin proposes a new slot 3 days from now at 12:00 PM UTC (5:30 PM IST).
      const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
      const utcNow = new Date();
      const proposedIstMs =
        utcNow.getTime() + IST_OFFSET_MS + 3 * 24 * 60 * 60 * 1000; // 3 days later in IST
      const proposedDate = new Date(proposedIstMs);
      const py = proposedDate.getUTCFullYear();
      const pm = String(proposedDate.getUTCMonth() + 1).padStart(2, "0");
      const pd = String(proposedDate.getUTCDate()).padStart(2, "0");
      const proposedIso = `${py}-${pm}-${pd}T12:00:00.000Z`;
      const expiresAtIso = new Date(
        utcNow.getTime() + 2 * 60 * 60 * 1000,
      ).toISOString();

      // Directly insert a proposedSlot into the database to test accept/decline logic.
      await Order.findByIdAndUpdate(order._id.toHexString(), {
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: order.orderStatus,
        proposedSlot: {
          time: proposedIso,
          note: "Suggested later slot",
          proposedBy: admin._id,
          proposedAt: new Date(),
          status: "PENDING",
          expiresAt: expiresAtIso,
        },
      } as any);

      // Verify proposal persisted.
      const orderWithProposal = await Order.findById(order._id.toHexString()).lean();
      expect(orderWithProposal?.proposedSlot?.status).toBe("PENDING");
      expect(orderWithProposal?.orderStatus).toBe("RESCHEDULE_PROPOSED");

      // Customer accepts.
      const user = await User.create({
        name: "Accept User",
        email: `accept-${Date.now()}@example.com`,
        phone: `9${String(Date.now()).padStart(10, "0")}`,
        passwordHash: await bcrypt.hash("Password123", 10),
        active: true,
        tokenVersion: 0,
      });
      const customerToken = makeCustomerToken(user._id.toString());
      await request(app)
        .post(`/api/orders/${order._id.toHexString()}/proposal/accept`)
        .set("Authorization", `Bearer ${customerToken}`);

      const updated = await Order.findById(order._id.toHexString()).lean();

      // requestedSlot must remain the original.
      expect(new Date(updated!.requestedSlot!).getTime()).toBe(
        new Date(originalRequestedSlot).getTime(),
      );
      // confirmedSlot must become the proposed time.
      expect(new Date(updated!.confirmedSlot!).getTime()).toBe(
        new Date(proposedIso).getTime(),
      );
      expect(new Date(updated!.confirmedSlot!).getTime()).not.toBe(
        new Date(originalConfirmedSlot).getTime(),
      );
      // Legacy fields synced to confirmed slot.
      expect(updated!.scheduledDate).toBe(
        new Date(proposedIso).toISOString().split("T")[0],
      );
      // slotHistory records the change.
      expect(updated!.slotHistory.length).toBeGreaterThan(0);
    });

    it("existing orders without slot fields remain accessible", async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const order = await Order.create(
        {
          orderNumber: makeOrderNumber(),
          idempotencyKey: `idem-${Date.now()}`,
          idempotencyHash: "test-hash",
          userId: user._id,
          customer: {
            name: "Test Customer",
            email: "customer@example.com",
            phone: "9876543210",
          },
          customerName: "Test Customer",
          phone: "9876543210",
          fulfillmentType: "DELIVERY",
          address: {
            addressLine: "123 Test Street",
            city: "Test City",
            pincode: "600001",
          },
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

      const customerToken = makeCustomerToken(user._id.toString());
      const response = await request(app)
        .get(`/api/orders/me/${order.orderNumber}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.order.orderNumber).toBe(order.orderNumber);
    });
  });
});
