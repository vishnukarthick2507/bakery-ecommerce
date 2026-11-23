import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function waitFor<T>(fn: () => Promise<T | null | false | undefined>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result as T;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for condition");
}

process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

const actualConsent = await vi.importActual<typeof import("../src/services/whatsappConsentService.js")>(
  "../src/services/whatsappConsentService.js",
);
const actualOutbox = await vi.importActual<typeof import("../src/services/notificationOutboxService.js")>(
  "../src/services/notificationOutboxService.js",
);

const grantConsentMock = vi.fn(actualConsent.grantConsent);
const enqueueNotificationMock = vi.fn(actualOutbox.enqueueNotification);
const sendCustomerOrderEmailOnceMock = vi.fn().mockResolvedValue(true);

vi.mock("../src/services/whatsappConsentService.js", async () => {
  const actual = await vi.importActual<typeof import("../src/services/whatsappConsentService.js")>(
    "../src/services/whatsappConsentService.js",
  );
  return {
    ...actual,
    grantConsent: (...args: Parameters<typeof actual.grantConsent>) => grantConsentMock(...args),
  };
});

vi.mock("../src/services/notificationOutboxService.js", async () => {
  const actual = await vi.importActual<typeof import("../src/services/notificationOutboxService.js")>(
    "../src/services/notificationOutboxService.js",
  );
  return {
    ...actual,
    enqueueNotification: (...args: Parameters<typeof actual.enqueueNotification>) =>
      enqueueNotificationMock(...args),
  };
});

vi.mock("../src/services/emailService.js", () => ({
  sendCustomerOrderEmailOnce: (...args: unknown[]) => sendCustomerOrderEmailOnceMock(...args),
}));

import { Order } from "../src/models/Order.js";
import { Product } from "../src/models/Product.js";
import { Settings } from "../src/models/Settings.js";
import { User } from "../src/models/User.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import orderRoutes from "../src/routes/orderRoutes.js";

let mongoServer: MongoMemoryServer;

async function connectTestDBWithReplSet(): Promise<void> {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000,  args: ["--replSet", "f1-checkout-rs"] },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { directConnection: true });
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not established");
  const adminDb = db.admin();
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

async function disconnectTestDBWithReplSet(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  return app;
}

const app = createTestApp();

const baseProduct = {
  name: "Consent Test Product",
  slug: "consent-test-product",
  description: "A test product",
  price: 100,
  category: "Cakes",
  images: [],
  stock: 20,
  availability: "AVAILABLE" as const,
  preparationTime: 60,
  active: true,
};

function tomorrowISTDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const kolkataOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const tomorrowIST = new Date(tomorrow.getTime() + kolkataOffsetMs);
  return tomorrowIST.toISOString().split("T")[0]!;
}

function makeBasePayload(productId: string) {
  return {
    customerName: "Checkout User",
    email: "guest@example.com",
    phone: "9840916058",
    fulfillmentType: "PICKUP" as const,
    scheduledDate: tomorrowISTDate(),
    scheduledTime: "10:00 AM - 12:00 PM",
    paymentMethod: "COD" as const,
    items: [
      {
        productId,
        productName: "Consent Test Product",
        variantId: "default",
        quantity: 1,
      },
    ],
  };
}

async function createCustomerToken(userId: mongoose.Types.ObjectId, tokenVersion = 0) {
  return jwt.sign(
    { customerId: userId.toString(), accountType: "CUSTOMER", tokenVersion },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function postOrder(payload: Record<string, unknown>, opts?: { token?: string; idempotencyKey?: string }) {
  let req = request(app)
    .post("/api/orders")
    .set("Idempotency-Key", opts?.idempotencyKey ?? randomUUID())
    .send(payload);
  if (opts?.token) req = req.set("Authorization", `Bearer ${opts.token}`);
  return req;
}

describe("F1: checkout WhatsApp consent/order placement timing", () => {
  beforeAll(async () => {
    await connectTestDBWithReplSet();
  }, 120000);

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    grantConsentMock.mockClear();
    enqueueNotificationMock.mockClear();
    sendCustomerOrderEmailOnceMock.mockClear();
    grantConsentMock.mockImplementation(actualConsent.grantConsent);
    enqueueNotificationMock.mockImplementation(actualOutbox.enqueueNotification);

    await Settings.create({
      onlineOrdersEnabled: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      closedMessage: "Closed",
    });
  });

  afterEach(async () => {
    // restore defaults
    grantConsentMock.mockImplementation(actualConsent.grantConsent);
    enqueueNotificationMock.mockImplementation(actualOutbox.enqueueNotification);
  });

  afterAll(async () => {
    await disconnectTestDBWithReplSet();
  }, 60000);

  it("new guest checkout with explicit WhatsApp consent persists consent before ORDER_PLACED enqueue and does not grant marketing", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()), whatsappConsent: true };

    const events: string[] = [];
    grantConsentMock.mockImplementation(async (...args) => {
      events.push("grantConsent");
      return actualConsent.grantConsent(...args);
    });
    enqueueNotificationMock.mockImplementation(async (input) => {
      events.push(`enqueue:${input.eventType}`);
      return actualOutbox.enqueueNotification(input);
    });

    const res = await postOrder(payload);
    expect(res.status).toBe(201);
    expect(res.body.order?.orderNumber).toBeDefined();

    const order = await Order.findOne({ orderNumber: res.body.order.orderNumber }).lean();
    expect(order).toBeTruthy();
    expect(order?.userId).toBeFalsy();

    const consent = await waitFor(async () => {
      const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
      return record?.status === "GRANTED" ? record : null;
    });
    expect(consent?.status).toBe("GRANTED");
    expect(consent?.marketingStatus ?? "DENIED").toBe("DENIED");
    expect(await actualConsent.hasValidMarketingConsent("919840916058")).toBe(false);

    const outbox = await waitFor(async () => {
      const rows = await NotificationOutbox.find({ channel: "WHATSAPP", eventType: "ORDER_PLACED" }).lean();
      return rows.length === 1 ? rows : null;
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.idempotencyKey).toBe(`whatsapp:${order!._id}:placed`);
    expect(outbox[0]?.recipient).toBe("9840916058");

    const grantIdx = events.indexOf("grantConsent");
    const enqueueIdx = events.findIndex((e) => e === "enqueue:ORDER_PLACED");
    expect(grantIdx).toBeGreaterThanOrEqual(0);
    expect(enqueueIdx).toBeGreaterThan(grantIdx);
  });

  it("new registered-customer checkout with explicit WhatsApp consent persists consent before ORDER_PLACED enqueue", async () => {
    const product = await Product.create(baseProduct);
    const user = await User.create({
      name: "Registered User",
      email: "registered@example.com",
      phone: "9840916058",
      passwordHash: await bcrypt.hash("Password123", 10),
      active: true,
      emailVerified: true,
      tokenVersion: 0,
    });
    const token = await createCustomerToken(user._id, 0);
    const payload = {
      ...makeBasePayload(product._id.toString()),
      customerName: "Registered User",
      email: "registered@example.com",
      phone: "9840916058",
      whatsappConsent: true,
    };

    const events: string[] = [];
    grantConsentMock.mockImplementation(async (...args) => {
      events.push("grantConsent");
      return actualConsent.grantConsent(...args);
    });
    enqueueNotificationMock.mockImplementation(async (input) => {
      events.push(`enqueue:${input.eventType}`);
      return actualOutbox.enqueueNotification(input);
    });

    const res = await postOrder(payload, { token });
    expect(res.status).toBe(201);

    const order = await Order.findOne({ orderNumber: res.body.order.orderNumber }).lean();
    expect(order?.userId?.toString()).toBe(user._id.toString());

    const consent = await waitFor(async () => {
      const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
      return record?.status === "GRANTED" ? record : null;
    });
    expect(consent?.status).toBe("GRANTED");
    expect(consent?.marketingStatus ?? "DENIED").toBe("DENIED");

    const outbox = await waitFor(async () => {
      const rows = await NotificationOutbox.find({ channel: "WHATSAPP", eventType: "ORDER_PLACED" }).lean();
      return rows.length === 1 ? rows : null;
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.idempotencyKey).toBe(`whatsapp:${order!._id}:placed`);

    expect(events.indexOf("grantConsent")).toBeGreaterThanOrEqual(0);
    expect(events.findIndex((e) => e === "enqueue:ORDER_PLACED")).toBeGreaterThan(events.indexOf("grantConsent"));

    // Preserve existing email behavior for verified registered customer
    await waitFor(async () => {
      const emailCall = sendCustomerOrderEmailOnceMock.mock.calls.find((c: any[]) => c[0]?.event === "ORDER_PLACED");
      return emailCall ? emailCall : null;
    });
    const emailCall = sendCustomerOrderEmailOnceMock.mock.calls.find((c: any[]) => c[0]?.event === "ORDER_PLACED");
    expect(emailCall?.[0]).toMatchObject({
      recipient: "registered@example.com",
      event: "ORDER_PLACED",
      eventId: `customer-order:${order!._id}:placed`,
    });
  });

  it("checkout without explicit consent does not enqueue WhatsApp ORDER_PLACED", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()) };

    const res = await postOrder(payload);
    expect(res.status).toBe(201);

    const consent = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(consent).toBeNull();
    const outbox = await NotificationOutbox.find({ channel: "WHATSAPP", eventType: "ORDER_PLACED" }).lean();
    expect(outbox).toHaveLength(0);
  });

  it("consent persistence failure does not fail order and does not enqueue unauthorized WhatsApp", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()), whatsappConsent: true };
    grantConsentMock.mockRejectedValueOnce(new Error("consent db error"));

    const res = await postOrder(payload);
    expect(res.status).toBe(201);
    expect(res.body.order?.orderNumber).toBeDefined();

    const order = await Order.findOne({ orderNumber: res.body.order.orderNumber }).lean();
    expect(order).toBeTruthy();
    const consent = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(consent?.status).not.toBe("GRANTED");
    const outbox = await NotificationOutbox.find({ channel: "WHATSAPP", eventType: "ORDER_PLACED" }).lean();
    expect(outbox).toHaveLength(0);
  });

  it("WhatsApp enqueue failure does not fail order and consent remains persisted", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()), whatsappConsent: true };
    enqueueNotificationMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    const res = await postOrder(payload);
    expect(res.status).toBe(201);

    const consent = await waitFor(async () => {
      const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
      return record?.status === "GRANTED" ? record : null;
    });
    expect(consent?.status).toBe("GRANTED");
  });

  it("replayed order does not duplicate ORDER_PLACED notification and does not repeat consent side effects", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()), whatsappConsent: true };
    const idemKey = randomUUID();

    const first = await postOrder(payload, { idempotencyKey: idemKey });
    expect(first.status).toBe(201);
    const second = await postOrder(payload, { idempotencyKey: idemKey });
    expect(second.status).toBe(200);
    expect(second.body.order.orderNumber).toBe(first.body.order.orderNumber);

    expect(await Order.countDocuments()).toBe(1);
    const outbox = await waitFor(async () => {
      const rows = await NotificationOutbox.find({ channel: "WHATSAPP", eventType: "ORDER_PLACED" }).lean();
      return rows.length === 1 ? rows : null;
    });
    expect(outbox).toHaveLength(1);
    expect(grantConsentMock).toHaveBeenCalledTimes(1);
  });

  it("transactional checkout opt-in grants only transactional consent", async () => {
    const product = await Product.create(baseProduct);
    const payload = { ...makeBasePayload(product._id.toString()), whatsappConsent: true };

    const res = await postOrder(payload);
    expect(res.status).toBe(201);

    expect(grantConsentMock).toHaveBeenCalled();
    for (const call of grantConsentMock.mock.calls) {
      expect(call[0]?.category === undefined || call[0]?.category === "TRANSACTIONAL").toBe(true);
    }
    const consent = await waitFor(async () => {
      const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
      return record?.status === "GRANTED" ? record : null;
    });
    expect(consent?.status).toBe("GRANTED");
    expect(consent?.marketingStatus ?? "DENIED").toBe("DENIED");
  });
});
