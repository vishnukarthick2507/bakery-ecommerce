import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  assertUatSafeModeConfig,
  assertUatSafeModeMongoTarget,
  isUatSafeModeEnabled,
  parseUatSafeModeEnv,
  validateUatMongoTarget,
} from "../src/config/uatSafeMode.js";
import {
  isUatExternalSideEffectsBlocked,
} from "../src/config/uatSafeMode.js";
import { sendOtpEmail, sendCustomerOrderEmailOnce, sendRescheduleExpiryAlert, sendAdminLoginAlert } from "../src/services/emailService.js";
import { sendWhatsAppTemplate } from "../src/services/whatsappService.js";
import { WHATSAPP_TEMPLATE_REGISTRY } from "../src/services/whatsappTemplateRegistry.js";
import { enqueueNotification, claimJob, processJob, getOutboxStats } from "../src/services/notificationOutboxService.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";
import { Order } from "../src/models/Order.js";
import { processPendingExpiryNotifications } from "../src/services/proposalExpiry.js";
import { expireOnlineReservations } from "../src/services/inventoryExpiry.js";
import { Product } from "../src/models/Product.js";
import { getRazorpayClient } from "../src/services/razorpay.js";
import { handleWebhook as handleRazorpayWebhook, createPaymentOrder } from "../src/controllers/paymentController.js";
import { receiveWebhook as receiveWhatsAppWebhook, verifyWebhook as verifyWhatsAppWebhook } from "../src/controllers/whatsappWebhookController.js";
import { getUploadSignature, deleteAsset } from "../src/services/cloudinary.js";
import { isGoogleConfigured, verifyGoogleIdToken } from "../src/services/googleAuth.js";
import { googleAuth } from "../src/controllers/customerAuthController.js";

const ORIGINAL_ENV = { ...process.env };
let mongo: MongoMemoryReplSet;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.UAT_SAFE_MODE;
}

function mockRes(status = 200) {
  const res: any = {
    statusCode: status,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.set = vi.fn((k: string, v: string) => {
    res.headers[k] = v;
    return res;
  });
  return res as Response & { statusCode: number; body: any };
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  restoreEnv();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Fail fast if any test accidentally performs real network I/O.
  const fetchSpy = vi.fn(async () => {
    throw new Error("Unexpected external fetch call in UAT safe-mode tests");
  });
  vi.stubGlobal("fetch", fetchSpy);
  await Promise.all([
    NotificationOutbox.deleteMany({}),
    WhatsAppConsent.deleteMany({}),
    Order.deleteMany({}),
    Product.deleteMany({}),
  ]);
});

afterEach(async () => {
  restoreEnv();
  vi.unstubAllGlobals();
});

describe("UAT Safe Mode configuration and DB target validation", () => {
  it("parses UAT_SAFE_MODE strictly and defaults disabled when absent", () => {
    delete process.env.UAT_SAFE_MODE;
    expect(parseUatSafeModeEnv(undefined)).toBe(false);
    expect(parseUatSafeModeEnv("true")).toBe(true);
    expect(parseUatSafeModeEnv(" TRUE ")).toBe(true);
    expect(parseUatSafeModeEnv("false")).toBe(false);
    expect(parseUatSafeModeEnv(" False ")).toBe(false);
    expect(isUatSafeModeEnabled()).toBe(false);
  });

  it("rejects invalid UAT_SAFE_MODE values", () => {
    expect(() => parseUatSafeModeEnv("1")).toThrow(/Invalid UAT_SAFE_MODE value/);
    expect(() => parseUatSafeModeEnv("yes")).toThrow(/Invalid UAT_SAFE_MODE value/);
    expect(() => parseUatSafeModeEnv("")).toThrow(/Invalid UAT_SAFE_MODE value/);
  });

  it("rejects port 27017, remote/Atlas targets, and accepts only verified local UAT target", () => {
    expect(validateUatMongoTarget("mongodb://127.0.0.1:27017/bluebell_whatsapp_uat").ok).toBe(false);
    expect(validateUatMongoTarget("mongodb://localhost:27017/bluebell_whatsapp_uat").reason).toMatch(/27017/);
    expect(validateUatMongoTarget("mongodb://remote.example.com:27018/bluebell_whatsapp_uat").ok).toBe(false);
    expect(validateUatMongoTarget("mongodb+srv://cluster.example/bluebell_whatsapp_uat").ok).toBe(false);
    expect(validateUatMongoTarget("mongodb://127.0.0.1:27018/other_db").ok).toBe(false);
    expect(validateUatMongoTarget("mongodb://127.0.0.1:27018/bluebell_whatsapp_uat?authSource=admin").ok).toBe(true);
    expect(validateUatMongoTarget("mongodb://localhost:27018/bluebell_whatsapp_uat").ok).toBe(true);

    process.env.UAT_SAFE_MODE = "true";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bluebell_whatsapp_uat";
    expect(() => assertUatSafeModeMongoTarget(process.env.MONGODB_URI)).toThrow(/27017/);
    expect(() => assertUatSafeModeConfig()).toThrow();

    process.env.MONGODB_URI = "mongodb://127.0.0.1:27018/bluebell_whatsapp_uat";
    expect(() => assertUatSafeModeConfig()).not.toThrow();
  });
});

describe("External side-effect blocking in UAT_SAFE_MODE", () => {
  beforeEach(() => {
    process.env.UAT_SAFE_MODE = "true";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27018/bluebell_whatsapp_uat";
    // Provider config present, but calls must still be blocked by UAT policy.
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_FROM_EMAIL = "from@example.com";
    process.env.WHATSAPP_ACCESS_TOKEN = "wa-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_wh_secret";
    process.env.WHATSAPP_APP_SECRET = "wa_app_secret";
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-token";
    process.env.CLOUDINARY_CLOUD_NAME = "cloud";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
  });

  it("blocks Brevo calls (OTP/admin/order/reschedule) without external network calls", async () => {
    expect(isUatExternalSideEffectsBlocked()).toBe(true);
    await expect(sendOtpEmail("user@example.com", "123456", "AUTH")).resolves.toBe(false);
    await expect(sendAdminLoginAlert({ username: "admin", occurredAt: new Date() })).resolves.toBe(false);
    await expect(sendCustomerOrderEmailOnce({
      recipient: "user@example.com",
      customerName: "User",
      orderNumber: "SV-1",
      event: "ORDER_PLACED",
      status: "PLACED",
      details: "details",
      eventId: "evt-1",
    })).resolves.toBe(false);
    await expect(sendRescheduleExpiryAlert({
      orderNumber: "SV-1",
      customerName: "User",
      proposedSlot: new Date(),
      expiresAt: new Date(),
    })).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("blocks WhatsApp outbound requests and outbox cannot bypass policy", async () => {
    await WhatsAppConsent.create({ phone: "919840916058", status: "GRANTED", source: "CHECKOUT" });
    const sendResult = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
    });
    expect(sendResult.accepted).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();

    await enqueueNotification({
      idempotencyKey: "uat-wa-1",
      channel: "WHATSAPP",
      recipient: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
      eventType: "ORDER_PLACED",
      orderNumber: "SV-123",
    });
    const job = await claimJob("worker-uat");
    expect(job).not.toBeNull();
    await processJob(job!);
    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("PENDING"); // released, not sent, not dead-lettered
    expect(String(doc!.lastError || "")).toMatch(/Suppressed in UAT_SAFE_MODE/);
    expect((doc as any).metaMessageId ?? undefined).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("suppressed proposal-expiry notifications do not send and are not marked delivered", async () => {
    const now = new Date();
    await Order.create({
      orderNumber: "SV-UAT-PE-1",
      customerName: "User",
      customer: { name: "User", email: "u@example.com", phone: "9999999999" },
      phone: "9999999999",
      items: [{ productName: "Cake", variantId: "default", quantity: 1, unitPrice: 100, itemTotal: 100, totalPrice: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
      fulfillmentType: "PICKUP",
      scheduledDate: "2099-01-01",
      scheduledTime: "10:00 AM",
      orderStatus: "RESCHEDULE_PROPOSED",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      reschedulePreviousStatus: "CONFIRMED",
      rescheduleProposals: [{
        proposalId: "p1",
        proposedSlot: new Date(now.getTime() + 86400000),
        reason: "test",
        proposedBy: new mongoose.Types.ObjectId(),
        proposedAt: now,
        status: "EXPIRED",
        expiresAt: new Date(now.getTime() - 1000),
        expiryNotificationStatus: "PENDING",
        expiryNotificationAttempts: 1,
      }],
    } as any);

    const result = await processPendingExpiryNotifications(now);
    expect(result.sentCount).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
    const updated = await Order.findOne({ orderNumber: "SV-UAT-PE-1" }).lean();
    const p = (updated as any).rescheduleProposals[0];
    expect(p.expiryNotificationStatus).not.toBe("SENT");
    expect(p.expiryNotificationAttempts).toBe(1); // not consumed
    expect(String(p.expiryNotificationLastError || "")).toMatch(/Suppressed in UAT_SAFE_MODE/);
  });

  it("blocks Razorpay transaction operations and rejects live Razorpay/WhatsApp webhooks", async () => {
    expect(() => getRazorpayClient()).toThrow(/blocked in UAT_SAFE_MODE/i);

    const reqCreate: any = { body: { orderNumber: "SV-1" }, customer: { id: "c1" } };
    const resCreate = mockRes();
    await createPaymentOrder(reqCreate, resCreate);
    expect(resCreate.status).toHaveBeenCalledWith(403);
    expect(String(resCreate.body?.code || resCreate.body?.message)).toMatch(/UAT_SAFE_MODE|blocked/i);

    const raw = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } }));
    const reqRzp: any = { body: raw, get: (h: string) => h.toLowerCase() === "x-razorpay-signature" ? "sig" : undefined };
    const resRzp = mockRes();
    await handleRazorpayWebhook(reqRzp as Request, resRzp);
    expect(resRzp.status).toHaveBeenCalledWith(403);

    const reqWa: any = { body: raw, get: (h: string) => h.toLowerCase() === "x-hub-signature-256" ? "sha256=x" : undefined, query: {} };
    const resWaPost = mockRes();
    await receiveWhatsAppWebhook(reqWa as Request, resWaPost);
    expect(resWaPost.status).toHaveBeenCalledWith(403);
    const resWaGet = mockRes();
    await verifyWhatsAppWebhook({ query: { "hub.mode": "subscribe", "hub.verify_token": "verify-token", "hub.challenge": "c" } } as any, resWaGet);
    expect(resWaGet.status).toHaveBeenCalledWith(403);
  });

  it("blocks Cloudinary uploads/destructive operations and prevents production Google OAuth use", async () => {
    expect(() => getUploadSignature({ folder: "sv-bakery/products" })).toThrow(/blocked in UAT_SAFE_MODE/i);
    await expect(deleteAsset("public-id")).resolves.toMatchObject({ deleted: false, result: "suppressed_uat_safe_mode" });
    expect(isGoogleConfigured()).toBe(false);
    await expect(verifyGoogleIdToken("fake-token")).rejects.toThrow(/blocked in UAT_SAFE_MODE/i);
    const req: any = { body: { idToken: "x" } };
    const res = mockRes();
    await googleAuth(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("Inventory expiry remains DB-only on verified UAT data", () => {
  it("continues safely against UAT DB data", async () => {
    process.env.UAT_SAFE_MODE = "true";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27018/bluebell_whatsapp_uat";
    const product = await Product.create({
      name: "Cake",
      slug: `cake-${Date.now()}`,
      description: "desc",
      price: 100,
      category: "cakes",
      stock: 5,
      availability: "AVAILABLE",
      preparationTime: 24,
      active: true,
    } as any);
    await Order.create({
      orderNumber: `SV-INV-${Date.now()}`,
      customerName: "User",
      customer: { name: "User", email: "u@example.com", phone: "9999999999" },
      phone: "9999999999",
      items: [{ productId: product._id, productName: "Cake", variantId: "default", quantity: 1, unitPrice: 100, itemTotal: 100, totalPrice: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
      fulfillmentType: "PICKUP",
      scheduledDate: "2099-01-01",
      scheduledTime: "10:00 AM",
      orderStatus: "PLACED",
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      inventoryStatus: "RESERVED",
      reservationExpiresAt: new Date(Date.now() - 60_000),
    } as any);

    const released = await expireOnlineReservations(new Date());
    expect(released).toBeGreaterThanOrEqual(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("Normal production-mode behavior unchanged when UAT_SAFE_MODE is disabled/absent", () => {
  it("keeps external side effects unblocked by UAT policy", async () => {
    delete process.env.UAT_SAFE_MODE;
    process.env.WHATSAPP_ACCESS_TOKEN = "wa-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    const orderReceived = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === "order_received") as any;
    const prevEnabled = orderReceived?.enabled;
    const prevApproval = orderReceived?.approvalState;
    const prevEvidence = orderReceived?.metaApprovalEvidence;
    if (orderReceived) {
      orderReceived.enabled = true;
      orderReceived.approvalState = "APPROVED";
      orderReceived.metaApprovalEvidence = {
        provider: "META",
        metaTemplateName: orderReceived.templateName,
        metaTemplateId: `meta-${orderReceived.templateName}`,
        metaLanguageCode: orderReceived.language || "en",
        approvalStatus: "APPROVED",
        evidenceRef: `test-evidence-${orderReceived.templateName}`,
        verifiedAt: "2026-11-22T00:00:00.000Z",
      };
    }
    try {
      await WhatsAppConsent.create({ phone: "919840916058", status: "GRANTED", source: "CHECKOUT" });
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) } as any)));
      const result = await sendWhatsAppTemplate({
        to: "919840916058",
        templateName: "order_received",
        params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
      });
      expect(result.accepted).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    } finally {
      if (orderReceived) {
        orderReceived.enabled = prevEnabled;
        orderReceived.approvalState = prevApproval;
        if (prevEvidence === undefined) delete orderReceived.metaApprovalEvidence;
        else orderReceived.metaApprovalEvidence = prevEvidence;
      }
    }
  });
});
