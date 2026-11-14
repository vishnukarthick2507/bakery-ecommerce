import { describe, expect, it, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
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
import { proposeSlot } from "../src/controllers/orderController.js";
import { expireProposals, processPendingExpiryNotifications, MAX_NOTIFICATION_ATTEMPTS, NOTIFICATION_CLAIM_LEASE_MS, calculateBackoffMs, isNotificationConfigured } from "../src/services/proposalExpiry.js";

import { sendRescheduleExpiryAlert, isBrevoConfigured } from "../src/services/emailService.js";

process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

vi.mock("../src/services/emailService.js", () => ({
  sendRescheduleExpiryAlert: vi.fn().mockResolvedValue(true),
  isBrevoConfigured: vi.fn().mockReturnValue(true),
  sendAdminLoginAlertOnce: vi.fn().mockResolvedValue(true),
  getBrevoPresenceChecks: vi.fn().mockReturnValue({ apiKeyPresent: true }),
}));

let mongoServer: MongoMemoryServer;

async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      args: ["--replSet", "proposal-expiry-rs"],
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
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
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
  app.post(
    "/propose/:id",
    (req: any, res, next) => {
      req.admin = { id: "507f1f77bcf86cd799439011", username: "testadmin", role: "ADMIN" };
      next();
    },
    proposeSlot,
  );
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

async function createTestData() {
  await Settings.create({
    onlineOrdersEnabled: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    closedMessage: "Test closed message",
  });

  const admin = await Admin.create({
    username: `testadmin-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    password: await bcrypt.hash("password123", 10),
    role: "ADMIN",
  });
  const adminToken = createAdminToken(admin._id.toString(), admin.username);

  const customer = await User.create({
    name: "Test Customer",
    email: `customer-${Date.now()}@example.com`,
    phone: "9840916058",
    passwordHash: "hash",
    emailVerified: true,
    active: true,
  });

  const product = await Product.create({
    ...baseProduct,
    slug: `test-product-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
  });

  return { adminToken, customer, product };
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

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

async function createExpiredOrder(
  productObj: { _id: mongoose.Types.ObjectId },
  proposalId: string,
  notificationOverrides: Record<string, unknown> = {},
) {
  const pastTime = subtractHours(new Date(), 2);
  return Order.create({
    orderNumber: `SV-EXPIRE-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    idempotencyKey: `expire-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    idempotencyHash: "hash",
    customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
    customerName: "Test Customer",
    phone: "9840916058",
    fulfillmentType: "PICKUP",
    scheduledDate: "2026-12-01",
    scheduledTime: "10:00 AM - 12:00 PM",
    paymentMethod: "COD",
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
    items: [
      {
        productId: productObj._id,
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
    proposedSlot: {
      time: pastTime,
      note: "Expired",
      proposedBy: new mongoose.Types.ObjectId(),
      proposedAt: subtractHours(new Date(), 5),
      status: "EXPIRED",
      expiresAt: pastTime,
    },
    rescheduleProposals: [
      {
        proposalId,
        proposedSlot: pastTime,
        reason: "Test",
        proposedBy: new mongoose.Types.ObjectId(),
        proposedAt: subtractHours(new Date(), 5),
        status: "EXPIRED",
        expiresAt: pastTime,
        ...notificationOverrides,
      },
    ],
  });
}

describe("Order reschedule expiry", () => {
  let adminToken: string;
  let customer: any;
  let product: any;

  beforeAll(
    async () => {
      await connectTestDB();
    },
    60000,
  );

  // Safe test-only notification recipient. Restored in afterEach so the
  // change never leaks into other test files or production code paths.
  const originalAdminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  beforeEach(async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com";
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    const data = await createTestData();
    adminToken = data.adminToken;
    customer = data.customer;
    product = data.product;
  });

  afterEach(() => {
    if (originalAdminNotificationEmail === undefined) {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
    } else {
      process.env.ADMIN_NOTIFICATION_EMAIL = originalAdminNotificationEmail;
    }
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe("Response window (admin-selectable)", () => {
    it("defaults to 3 hours when responseWindowHours is omitted", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const futureTime = new Date(Date.UTC(2026, 10, 20, 12, 0, 0)); // Fri Nov 20, 2026 12:00 UTC = 5:30 PM Kolkata (within business hours)

      const res = await request(app)
        .post(`/propose/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          time: futureTime.toISOString(),
          note: "Test proposal",
        });

      expect(res.status).toBe(200);
      const expiry = new Date(res.body.order.proposedSlot.expiresAt);
      const now = new Date();
      const diffFromNow = (expiry.getTime() - now.getTime()) / (60 * 60 * 1000);
      expect(diffFromNow).toBeGreaterThan(2.5);
      expect(diffFromNow).toBeLessThan(3.5);
    });

    it("uses 1 hour when responseWindowHours is 1", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const futureTime = new Date(Date.UTC(2026, 10, 20, 12, 0, 0));

      const res = await request(app)
        .post(`/propose/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          time: futureTime.toISOString(),
          note: "Test proposal",
          responseWindowHours: 1,
        });

      expect(res.status).toBe(200);
      const expiry = new Date(res.body.order.proposedSlot.expiresAt);
      const now = new Date();
      const diffFromNow = (expiry.getTime() - now.getTime()) / (60 * 60 * 1000);
      expect(diffFromNow).toBeGreaterThan(0.5);
      expect(diffFromNow).toBeLessThan(1.5);
    });

    it("uses 72 hours when responseWindowHours is 72", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const futureTime = new Date(Date.UTC(2026, 10, 20, 12, 0, 0));

      const res = await request(app)
        .post(`/propose/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          time: futureTime.toISOString(),
          note: "Test proposal",
          responseWindowHours: 72,
        });

      expect(res.status).toBe(200);
      const expiry = new Date(res.body.order.proposedSlot.expiresAt);
      const now = new Date();
      const diffFromNow = (expiry.getTime() - now.getTime()) / (60 * 60 * 1000);
      expect(diffFromNow).toBeGreaterThan(71);
      expect(diffFromNow).toBeLessThan(73);
    });

    it("rejects responseWindowHours below 1", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const futureTime = addHours(new Date(), 5);

      const res = await request(app)
        .post(`/propose/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          time: futureTime.toISOString(),
          note: "Test proposal",
          responseWindowHours: 0,
        });

      expect(res.status).toBe(400);
    });

    it("rejects responseWindowHours above 72", async () => {
      const order = await createOrderInDB({ orderStatus: "CONFIRMED" });
      const futureTime = addHours(new Date(), 5);

      const res = await request(app)
        .post(`/propose/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          time: futureTime.toISOString(),
          note: "Test proposal",
          responseWindowHours: 73,
        });

      expect(res.status).toBe(400);
    });
  });

  describe("Expiry worker", () => {
    it("marks a pending expired proposal as EXPIRED", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-EXPIRE-${Date.now()}`,
        idempotencyKey: `expire-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Expired proposal",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-1",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "PENDING",
            expiresAt: pastTime,
          },
        ],
      });

      const expiredCount = await expireProposals(new Date());

      expect(expiredCount).toBe(1);

      const updated = await Order.findById(order._id).lean();
      expect(updated).not.toBeNull();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "test-proposal-1",
      );
      expect(proposal.status).toBe("EXPIRED");
      expect(updated!.proposedSlot!.status).toBe("EXPIRED");
      expect(updated!.orderStatus).toBe("CONFIRMED");
    });

    it("does not expire a non-expired proposal", async () => {
      const futureTime = addHours(new Date(), 5);

      const order = await Order.create({
        orderNumber: `SV-NOEXPIRE-${Date.now()}`,
        idempotencyKey: `noexpire-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: futureTime,
          note: "Future proposal",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: new Date(),
          status: "PENDING",
          expiresAt: addHours(new Date(), 5),
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-2",
            proposedSlot: futureTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: new Date(),
            status: "PENDING",
            expiresAt: addHours(new Date(), 5),
          },
        ],
      });

      const expiredCount = await expireProposals(new Date());

      expect(expiredCount).toBe(0);

      const updated = await Order.findById(order._id).lean();
      expect(updated).not.toBeNull();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "test-proposal-2",
      );
      expect(proposal.status).toBe("PENDING");
      expect(updated!.orderStatus).toBe("RESCHEDULE_PROPOSED");
    });

    it("does not expire an already accepted proposal", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-ACCEPTED-${Date.now()}`,
        idempotencyKey: `accepted-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Accepted",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "ACCEPTED",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-3",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "ACCEPTED",
            expiresAt: pastTime,
          },
        ],
      });

      const expiredCount = await expireProposals(new Date());

      expect(expiredCount).toBe(0);

      const updated = await Order.findById(order._id).lean();
      expect(updated).not.toBeNull();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "test-proposal-3",
      );
      expect(proposal.status).toBe("ACCEPTED");
    });

    it("restores previous order status after expiry", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-RESTORE-${Date.now()}`,
        idempotencyKey: `restore-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "PLACED",
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
        proposedSlot: {
          time: pastTime,
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-4",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "PENDING",
            expiresAt: pastTime,
          },
        ],
      });

      await expireProposals(new Date());

      const updated = await Order.findById(order._id).lean();
      expect(updated).not.toBeNull();
      expect(updated!.orderStatus).toBe("PLACED");
      expect(updated!.paymentStatus).toBe("PAID");
      expect(updated!.reschedulePreviousStatus).toBeUndefined();
    });

    it("sends admin notification on expiry", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-NOTIFY-${Date.now()}`,
        idempotencyKey: `notify-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-5",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "PENDING",
            expiresAt: pastTime,
          },
        ],
      });

      await expireProposals(new Date());

      expect(
        vi.mocked(sendRescheduleExpiryAlert).mock.calls.length,
      ).toBeGreaterThan(0);
      const lastCall = vi.mocked(sendRescheduleExpiryAlert).mock.calls.at(-1);
      expect(lastCall?.[0].orderNumber).toBe(order.orderNumber);
    });

    it("does not send duplicate notifications for already expired proposals", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-DUP-${Date.now()}`,
        idempotencyKey: `dup-${Date.now()}`,
        idempotencyHash: "hash",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        customerName: customer.name,
        phone: customer.phone,
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Already expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "EXPIRED",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "test-proposal-6",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: pastTime,
          },
        ],
      });

      vi.mocked(sendRescheduleExpiryAlert).mockClear();

      await expireProposals(new Date());

      expect(vi.mocked(sendRescheduleExpiryAlert).mock.calls.length).toBe(0);
    });
  });

  describe("Retry schedule (calculateBackoffMs)", () => {
    it("attempt 1 retries after 1 minute", () => {
      expect(calculateBackoffMs(1)).toBe(1 * 60 * 1000);
    });

    it("attempt 2 retries after 5 minutes", () => {
      expect(calculateBackoffMs(2)).toBe(5 * 60 * 1000);
    });

    it("attempt 3 retries after 15 minutes", () => {
      expect(calculateBackoffMs(3)).toBe(15 * 60 * 1000);
    });

    it("attempt 4 retries after 30 minutes", () => {
      expect(calculateBackoffMs(4)).toBe(30 * 60 * 1000);
    });

    it("attempt 5 returns terminal backoff (no further retry)", () => {
      const result = calculateBackoffMs(5);
      expect(result).toBe(30 * 60 * 1000);
    });

    it("attempts beyond 5 do not increase backoff", () => {
      expect(calculateBackoffMs(6)).toBe(30 * 60 * 1000);
      expect(calculateBackoffMs(10)).toBe(30 * 60 * 1000);
    });
  });

  describe("Configuration (isNotificationConfigured)", () => {
    const originalEnv = process.env.ADMIN_NOTIFICATION_EMAIL;
    const originalBrevo = process.env.BREVO_API_KEY;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.ADMIN_NOTIFICATION_EMAIL;
      } else {
        process.env.ADMIN_NOTIFICATION_EMAIL = originalEnv;
      }
      if (originalBrevo === undefined) {
        delete process.env.BREVO_API_KEY;
      } else {
        process.env.BREVO_API_KEY = originalBrevo;
      }
      vi.mocked(isBrevoConfigured).mockReturnValue(true);
    });

    it("returns configured when both ADMIN_NOTIFICATION_EMAIL and BREVO_API_KEY are set", () => {
      process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com";
      process.env.BREVO_API_KEY = "test-key";
      vi.mocked(isBrevoConfigured).mockReturnValue(true);

      const result = isNotificationConfigured();
      expect(result.configured).toBe(true);
    });

    it("returns not configured when ADMIN_NOTIFICATION_EMAIL is missing", () => {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
      vi.mocked(isBrevoConfigured).mockReturnValue(true);

      const result = isNotificationConfigured();
      expect(result.configured).toBe(false);
      expect(result.reason).toContain("ADMIN_NOTIFICATION_EMAIL");
    });

    it("returns not configured when BREVO_API_KEY is missing", () => {
      process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com";
      delete process.env.BREVO_API_KEY;
      vi.mocked(isBrevoConfigured).mockReturnValue(false);

      const result = isNotificationConfigured();
      expect(result.configured).toBe(false);
      expect(result.reason).toContain("Brevo API key");
    });

    it("configuration failures do not create endless retries (attempts capped at MAX)", async () => {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
      vi.mocked(isBrevoConfigured).mockReturnValue(false);

      const order = await Order.create({
        orderNumber: `SV-CONFIG-${Date.now()}`,
        idempotencyKey: `config-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
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
        proposedSlot: {
          time: subtractHours(new Date(), 2),
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "EXPIRED",
          expiresAt: subtractHours(new Date(), 2),
        },
        rescheduleProposals: [
          {
            proposalId: "config-proposal-1",
            proposedSlot: subtractHours(new Date(), 2),
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: subtractHours(new Date(), 2),
            expiryNotificationStatus: "PENDING",
            expiryNotificationAttempts: MAX_NOTIFICATION_ATTEMPTS - 1,
            expiryNotificationNextRetryAt: new Date(0),
          },
        ],
      });

      await expireProposals(new Date());

      const updated = await Order.findById(order._id).lean();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "config-proposal-1",
      );
      expect(proposal.expiryNotificationStatus).toBe("FAILED");
      expect(proposal.expiryNotificationAttempts).toBe(MAX_NOTIFICATION_ATTEMPTS);
      expect(proposal.expiryNotificationLastError).toContain(
        "ADMIN_NOTIFICATION_EMAIL",
      );
    });
  });

  describe("Admin notification (sendRescheduleExpiryAlert)", () => {
    it("successful notification returns true", async () => {
      vi.mocked(sendRescheduleExpiryAlert).mockResolvedValue(true);

      const result = await sendRescheduleExpiryAlert({
        orderNumber: "SV-TEST-123",
        customerName: "Test Customer",
        customerEmail: "test@example.com",
        customerPhone: "9840916058",
        originalSlot: new Date(),
        proposedSlot: new Date(),
        expiresAt: new Date(),
      });

      expect(result).toBe(true);
    });

    it("SENT notification is not retried", async () => {
      const order = await Order.create({
        orderNumber: `SV-SENT-${Date.now()}`,
        idempotencyKey: `sent-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
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
        proposedSlot: {
          time: subtractHours(new Date(), 2),
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "EXPIRED",
          expiresAt: subtractHours(new Date(), 2),
        },
        rescheduleProposals: [
          {
            proposalId: "sent-proposal-1",
            proposedSlot: subtractHours(new Date(), 2),
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: subtractHours(new Date(), 2),
            expiryNotificationStatus: "SENT",
            expiryNotificationAttempts: 1,
            expiryNotificationSentAt: new Date(),
          },
        ],
      });

      vi.mocked(sendRescheduleExpiryAlert).mockClear();

      await expireProposals(new Date());

      expect(vi.mocked(sendRescheduleExpiryAlert).mock.calls.length).toBe(0);

      const updated = await Order.findById(order._id).lean();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "sent-proposal-1",
      );
      expect(proposal.expiryNotificationStatus).toBe("SENT");
    });

    it("failed delivery records error and does not crash expiry", async () => {
      vi.mocked(sendRescheduleExpiryAlert).mockResolvedValue(false);

      const order = await Order.create({
        orderNumber: `SV-FAIL-${Date.now()}`,
        idempotencyKey: `fail-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: subtractHours(new Date(), 2),
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: subtractHours(new Date(), 2),
        },
        rescheduleProposals: [
          {
            proposalId: "fail-proposal-1",
            proposedSlot: subtractHours(new Date(), 2),
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: subtractHours(new Date(), 2),
            expiryNotificationStatus: "PENDING",
            expiryNotificationAttempts: 0,
            expiryNotificationNextRetryAt: new Date(0),
          },
        ],
      });

      await expireProposals(new Date());

      const updated = await Order.findById(order._id).lean();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "fail-proposal-1",
      );
      expect(proposal.expiryNotificationStatus).toBe("FAILED");
      expect(proposal.expiryNotificationAttempts).toBe(1);
      expect(proposal.expiryNotificationLastError).toBeDefined();
    });

    it("expiry proceeds even when email delivery fails", async () => {
      vi.mocked(sendRescheduleExpiryAlert).mockResolvedValue(false);

      const order = await Order.create({
        orderNumber: `SV-EXPIRE2-${Date.now()}`,
        idempotencyKey: `expire2-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: subtractHours(new Date(), 2),
          note: "Expired",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: subtractHours(new Date(), 2),
        },
        rescheduleProposals: [
          {
            proposalId: "expire-proposal-1",
            proposedSlot: subtractHours(new Date(), 2),
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "PENDING",
            expiresAt: subtractHours(new Date(), 2),
            expiryNotificationStatus: "PENDING",
            expiryNotificationAttempts: 0,
            expiryNotificationNextRetryAt: new Date(0),
          },
        ],
      });

      const expiredCount = await expireProposals(new Date());
      expect(expiredCount).toBe(1);

      const updated = await Order.findById(order._id).lean();
      expect(updated).not.toBeNull();
      expect(updated!.orderStatus).toBe("CONFIRMED");
      expect(updated!.reschedulePreviousStatus).toBeUndefined();
    });
  });

  describe("Atomic claims and lease recovery", () => {
    it("concurrent workers cannot claim the same proposal twice", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-CONCUR-${Date.now()}`,
        idempotencyKey: `concur-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Concurrent test",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "PENDING",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "concur-proposal-1",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "PENDING",
            expiresAt: pastTime,
            expiryNotificationStatus: "PENDING",
            expiryNotificationAttempts: 0,
            expiryNotificationNextRetryAt: new Date(0),
          },
        ],
      });

      // First worker claims and processes
      const count1 = await expireProposals(new Date());
      expect(count1).toBe(1);

      // Second worker finds nothing to claim (already processed)
      vi.mocked(sendRescheduleExpiryAlert).mockClear();
      const count2 = await expireProposals(new Date());
      expect(count2).toBe(0);
      expect(vi.mocked(sendRescheduleExpiryAlert).mock.calls.length).toBe(0);
    });

    it("expired lease can be reclaimed", async () => {
      const pastTime = subtractHours(new Date(), 2);
      const expiredLeaseTime = subtractHours(new Date(), 5); // Lease expired 5 minutes ago

      const order = await Order.create({
        orderNumber: `SV-LEASE-${Date.now()}`,
        idempotencyKey: `lease-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "RESCHEDULE_PROPOSED",
        reschedulePreviousStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Lease test",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "EXPIRED",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "lease-proposal-1",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: pastTime,
            expiryNotificationStatus: "PENDING",
            expiryNotificationAttempts: 0,
            expiryNotificationNextRetryAt: expiredLeaseTime, // Lease expired
          },
        ],
      });

      // First sweep claims the expired lease and processes the notification
      await expireProposals(new Date());

      const updated1 = await Order.findById(order._id).lean();
      const proposal1 = (updated1 as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "lease-proposal-1",
      );
      // Notification should have been processed (attempts incremented from 0)
      expect(proposal1.expiryNotificationAttempts).toBeGreaterThan(0);
      expect(["SENT", "FAILED"]).toContain(proposal1.expiryNotificationStatus);

      // Manually expire the lease by setting it to the past
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "rescheduleProposals.$[p].expiryNotificationNextRetryAt": new Date(
              Date.now() - NOTIFICATION_CLAIM_LEASE_MS - 1000,
            ),
          },
        },
        {
          arrayFilters: [{ "p.proposalId": "lease-proposal-1" }],
        },
      );

      // Second sweep should NOT re-send (status is already SENT)
      vi.mocked(sendRescheduleExpiryAlert).mockClear();
      await expireProposals(new Date());

      const updated2 = await Order.findById(order._id).lean();
      const proposal2 = (updated2 as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "lease-proposal-1",
      );
      // Status should remain as-is (not re-processed)
      expect(proposal2.expiryNotificationStatus).toBe(
        proposal1.expiryNotificationStatus,
      );
    });

    it("SENT notification cannot be reclaimed", async () => {
      const pastTime = subtractHours(new Date(), 2);

      const order = await Order.create({
        orderNumber: `SV-SENT2-${Date.now()}`,
        idempotencyKey: `sent2-${Date.now()}`,
        idempotencyHash: "hash",
        customer: { name: "Test Customer", email: "test@example.com", phone: "9840916058" },
        customerName: "Test Customer",
        phone: "9840916058",
        userId: customer._id,
        fulfillmentType: "PICKUP",
        scheduledDate: "2026-12-01",
        scheduledTime: "10:00 AM - 12:00 PM",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
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
        proposedSlot: {
          time: pastTime,
          note: "Sent test",
          proposedBy: new mongoose.Types.ObjectId(),
          proposedAt: subtractHours(new Date(), 5),
          status: "EXPIRED",
          expiresAt: pastTime,
        },
        rescheduleProposals: [
          {
            proposalId: "sent2-proposal-1",
            proposedSlot: pastTime,
            reason: "Test",
            proposedBy: new mongoose.Types.ObjectId(),
            proposedAt: subtractHours(new Date(), 5),
            status: "EXPIRED",
            expiresAt: pastTime,
            expiryNotificationStatus: "SENT",
            expiryNotificationAttempts: 1,
            expiryNotificationSentAt: new Date(),
          },
        ],
      });

      vi.mocked(sendRescheduleExpiryAlert).mockClear();

      await expireProposals(new Date());

      expect(vi.mocked(sendRescheduleExpiryAlert).mock.calls.length).toBe(0);

      const updated = await Order.findById(order._id).lean();
      const proposal = (updated as any).rescheduleProposals.find(
        (p: any) => p.proposalId === "sent2-proposal-1",
      );
      expect(proposal.expiryNotificationStatus).toBe("SENT");
    });
  });
});
