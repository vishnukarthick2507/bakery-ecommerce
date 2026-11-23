import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { Admin } from "../src/models/Admin.js";
import authRoutes from "../src/routes/authRoutes.js";
import adminWhatsAppRoutes from "../src/routes/adminWhatsAppRoutes.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";
import { WhatsAppMessage } from "../src/models/WhatsAppMessage.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use("/api/admin", authRoutes);
  app.use("/api/admin/whatsapp", adminWhatsAppRoutes);
  return app;
}

const app = createApp();

// Stable test identity so the auth cookie (JWT subject) remains valid across
// beforeEach DB resets without repeated login calls. This avoids tripping the
// real admin login rate limiter in aggregate suite runs while still exercising
// actual admin login once and real authenticated admin-route middleware in tests.
const TEST_ADMIN_ID = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
let cachedAdminCookie: string | null = null;

async function loginAdmin() {
  if (cachedAdminCookie) return cachedAdminCookie;
  const res = await request(app)
    .post("/api/admin/login")
    .send({ username: "testadmin", password: "CorrectPassword123" });
  expect(res.status).toBe(200);
  const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0];
  expect(cookie).toBeTruthy();
  cachedAdminCookie = cookie as string;
  return cachedAdminCookie;
}

describe("Admin WhatsApp Centre API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await Admin.create({
      _id: TEST_ADMIN_ID,
      username: "testadmin",
      password: await bcrypt.hash("CorrectPassword123", 10),
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    cachedAdminCookie = null;
    await disconnectTestDB();
  });

  it("requires admin authentication for stats, messages, consents, and preferences", async () => {
    const endpoints = [
      { method: "get", path: "/api/admin/whatsapp/stats" },
      { method: "get", path: "/api/admin/whatsapp/messages" },
      { method: "get", path: "/api/admin/whatsapp/consents" },
      { method: "get", path: "/api/admin/whatsapp/preferences" },
    ] as const;

    for (const e of endpoints) {
      const res = await (request(app) as any)[e.method](e.path);
      expect(res.status).toBe(401);
    }
  });

  it("returns accurate statistics from outbox and WhatsApp message models", async () => {
    const cookie = await loginAdmin();
    const now = new Date();

    await NotificationOutbox.create([
      { idempotencyKey: "o1", channel: "WHATSAPP", status: "PENDING", recipient: "9191", params: [], eventType: "ORDER_PLACED", attemptCount: 0, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "o2", channel: "WHATSAPP", status: "PROCESSING", recipient: "9192", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "o3", channel: "WHATSAPP", status: "SENT", recipient: "9193", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "o4", channel: "WHATSAPP", status: "RETRYING", recipient: "9194", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "o5", channel: "WHATSAPP", status: "DEAD_LETTER", recipient: "9195", params: [], eventType: "ORDER_PLACED", attemptCount: 5, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "o6", channel: "WHATSAPP", status: "SKIPPED", recipient: "9196", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
    ]);

    await WhatsAppMessage.create([
      { direction: "OUTBOUND", phone: "9193", messageId: "m-sent", status: "SENT" },
      { direction: "OUTBOUND", phone: "9193", messageId: "m-delivered", status: "DELIVERED" },
      { direction: "OUTBOUND", phone: "9193", messageId: "m-read", status: "READ" },
      { direction: "OUTBOUND", phone: "9193", messageId: "m-failed", status: "FAILED" },
      { direction: "INBOUND", phone: "9193", messageId: "m-recv", status: "RECEIVED" },
    ]);

    const res = await request(app).get("/api/admin/whatsapp/stats").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      PENDING: 1,
      PROCESSING: 1,
      SENT: 2, // 1 outbox SENT + 1 message SENT
      DELIVERED: 1,
      READ: 1,
      FAILED: 1,
      RETRYING: 1,
      DEAD_LETTER: 1,
      SKIPPED: 1,
      RECEIVED: 1,
    });
  });

  it("supports message history pagination, filtering, and search", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    await NotificationOutbox.create([
      { idempotencyKey: "a1", channel: "WHATSAPP", status: "DEAD_LETTER", recipient: "919000000001", params: [], eventType: "ORDER_PLACED", attemptCount: 5, maxAttempts: 5, nextRetryAt: now, orderNumber: "SV-AAA" },
      { idempotencyKey: "a2", channel: "WHATSAPP", status: "RETRYING", recipient: "919000000002", params: [], eventType: "PAYMENT_CONFIRMED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now, orderNumber: "SV-BBB" },
      { idempotencyKey: "a3", channel: "EMAIL", status: "SENT", recipient: "user@example.com", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now, orderNumber: "SV-CCC" },
    ]);

    const page1 = await request(app)
      .get("/api/admin/whatsapp/messages?page=1&limit=2")
      .set("Cookie", cookie);
    expect(page1.status).toBe(200);
    expect(page1.body.messages).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const filtered = await request(app)
      .get("/api/admin/whatsapp/messages?status=DEAD_LETTER&channel=WHATSAPP")
      .set("Cookie", cookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body.messages).toHaveLength(1);
    expect(filtered.body.messages[0].status).toBe("DEAD_LETTER");

    const search = await request(app)
      .get("/api/admin/whatsapp/messages?search=SV-BBB")
      .set("Cookie", cookie);
    expect(search.status).toBe(200);
    expect(search.body.messages).toHaveLength(1);
    expect(search.body.messages[0].orderNumber).toBe("SV-BBB");
  });

  it("shows consent visibility with separate categories and does not provide bypass", async () => {
    const cookie = await loginAdmin();
    await WhatsAppConsent.create([
      {
        phone: "919111111111",
        status: "GRANTED",
        source: "CHECKOUT",
        consentTimestamp: new Date(),
        marketingStatus: "DENIED",
        withdrawalHistory: [],
        marketingWithdrawalHistory: [],
        consentHistory: [],
      },
      {
        phone: "919222222222",
        status: "WITHDRAWN",
        source: "OPT_IN_MESSAGE",
        optOutTimestamp: new Date(),
        withdrawalReason: "STOP",
        marketingStatus: "WITHDRAWN",
        marketingOptOutTimestamp: new Date(),
        marketingWithdrawalReason: "STOP",
        withdrawalHistory: [],
        marketingWithdrawalHistory: [],
        consentHistory: [],
      },
    ]);

    const res = await request(app).get("/api/admin/whatsapp/consents?search=919111").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.consents).toHaveLength(1);
    expect(res.body.consents[0]).toMatchObject({
      phone: "919111111111",
      status: "GRANTED",
      hasConsent: true,
    });
    expect(res.body.consents[0].transactional).toMatchObject({ status: "GRANTED", hasConsent: true });
    expect(res.body.consents[0].marketing).toMatchObject({ status: "DENIED", hasConsent: false });

    // No endpoint exists to grant/override consent via admin WhatsApp centre routes.
    const bypassAttempt = await request(app)
      .post("/api/admin/whatsapp/consents/grant")
      .set("Cookie", cookie)
      .send({ phone: "919222222222" });
    expect([404, 405]).toContain(bypassAttempt.status);
  });

  it("retries eligible failed messages idempotently without creating duplicates", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const job = await NotificationOutbox.create({
      idempotencyKey: "retry-key-1",
      channel: "WHATSAPP",
      status: "DEAD_LETTER",
      recipient: "919333333333",
      params: ["a"],
      eventType: "ORDER_PLACED",
      attemptCount: 5,
      maxAttempts: 5,
      nextRetryAt: now,
      lastError: "Permanent failure",
    });

    const retry = await request(app)
      .post(`/api/admin/whatsapp/messages/${job._id.toString()}/retry`)
      .set("Cookie", cookie)
      .send({});
    expect(retry.status).toBe(200);
    expect(retry.body.job).toMatchObject({ status: "PENDING", attemptCount: 0, idempotencyKey: "retry-key-1" });

    const count = await NotificationOutbox.countDocuments({ idempotencyKey: "retry-key-1" });
    expect(count).toBe(1);

    // Retrying again while PENDING is rejected (no duplicate, no second reset)
    const retryAgain = await request(app)
      .post(`/api/admin/whatsapp/messages/${job._id.toString()}/retry`)
      .set("Cookie", cookie)
      .send({});
    expect(retryAgain.status).toBe(409);
    expect(await NotificationOutbox.countDocuments({ idempotencyKey: "retry-key-1" })).toBe(1);
  });

  it("rejects retry for ineligible messages and enforces authorization", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const sent = await NotificationOutbox.create({
      idempotencyKey: "sent-key",
      channel: "WHATSAPP",
      status: "SENT",
      recipient: "919444444444",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
    });
    const processing = await NotificationOutbox.create({
      idempotencyKey: "proc-key",
      channel: "WHATSAPP",
      status: "PROCESSING",
      recipient: "919555555555",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
      workerId: "w1",
      leaseExpiresAt: new Date(Date.now() + 60000),
    });

    const sentRes = await request(app).post(`/api/admin/whatsapp/messages/${sent._id}/retry`).set("Cookie", cookie).send({});
    expect(sentRes.status).toBe(409);
    const procRes = await request(app).post(`/api/admin/whatsapp/messages/${processing._id}/retry`).set("Cookie", cookie).send({});
    expect(procRes.status).toBe(409);

    const unauth = await request(app).post(`/api/admin/whatsapp/messages/${sent._id}/retry`).send({});
    expect(unauth.status).toBe(401);
  });

  it("updates event-specific notification preferences", async () => {
    const cookie = await loginAdmin();

    const list = await request(app).get("/api/admin/whatsapp/preferences").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.preferences)).toBe(true);
    expect(list.body.preferences.length).toBeGreaterThan(0);
    expect((list.body.preferences as Array<{ eventType: string }>).some((p) => p.eventType === "PAYMENT_FAILED")).toBe(true);

    const update = await request(app)
      .patch("/api/admin/whatsapp/preferences")
      .set("Cookie", cookie)
      .send({ eventType: "ORDER_PLACED", enabled: false });
    expect(update.status).toBe(200);
    expect(update.body.preference).toMatchObject({ eventType: "ORDER_PLACED", enabled: false });

    const updatePaymentFailed = await request(app)
      .patch("/api/admin/whatsapp/preferences")
      .set("Cookie", cookie)
      .send({ eventType: "PAYMENT_FAILED", enabled: false });
    expect(updatePaymentFailed.status).toBe(200);
    expect(updatePaymentFailed.body.preference).toMatchObject({ eventType: "PAYMENT_FAILED", enabled: false });

    const listAfter = await request(app).get("/api/admin/whatsapp/preferences").set("Cookie", cookie);
    const pref = (listAfter.body.preferences as Array<{ eventType: string; enabled: boolean }>).find((p) => p.eventType === "ORDER_PLACED");
    expect(pref?.enabled).toBe(false);
    const paymentFailedPref = (listAfter.body.preferences as Array<{ eventType: string; enabled: boolean }>).find((p) => p.eventType === "PAYMENT_FAILED");
    expect(paymentFailedPref?.enabled).toBe(false);
  });

  it("returns message detail with safe error info and retry history", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const job = await NotificationOutbox.create({
      idempotencyKey: "detail-key",
      channel: "WHATSAPP",
      status: "DEAD_LETTER",
      recipient: "919666666666",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 5,
      maxAttempts: 5,
      nextRetryAt: now,
      lastError: "Delivery failed: WHATSAPP API did not accept message",
      orderNumber: "SV-DETAIL",
      metaMessageId: "meta-123",
    });
    await WhatsAppMessage.create({
      direction: "OUTBOUND",
      phone: "919666666666",
      messageId: "meta-123",
      status: "FAILED",
      errorMessage: "Template error",
      orderNumber: "SV-DETAIL",
    });

    const res = await request(app)
      .get(`/api/admin/whatsapp/messages/${job._id.toString()}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatchObject({ id: job._id.toString(), orderNumber: "SV-DETAIL", status: "DEAD_LETTER" });
    expect(res.body.retryHistory).toMatchObject({ attemptCount: 5, maxAttempts: 5, status: "DEAD_LETTER" });
    expect(Array.isArray(res.body.relatedWhatsAppMessages)).toBe(true);
  });

  it("returns provider delivery fields separately from outbox status and shows UNKNOWN-equivalent nulls when missing", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    await NotificationOutbox.create([
      {
        idempotencyKey: "pd-sent",
        channel: "WHATSAPP",
        status: "SENT", // outbox processing accepted
        providerDeliveryStatus: "SENT",
        metaMessageId: "wamid-sent",
        recipient: "919700000001",
        params: [],
        eventType: "ORDER_PLACED",
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: now,
      },
      {
        idempotencyKey: "pd-unknown",
        channel: "WHATSAPP",
        status: "SENT",
        recipient: "919700000002",
        params: [],
        eventType: "ORDER_PLACED",
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: now,
      },
    ]);

    const res = await request(app).get("/api/admin/whatsapp/messages?limit=50").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const sent = res.body.messages.find((m: any) => m.idempotencyKey === "pd-sent");
    const unknown = res.body.messages.find((m: any) => m.idempotencyKey === "pd-unknown");
    expect(sent).toMatchObject({ status: "SENT", providerDeliveryStatus: "SENT", metaMessageId: "wamid-sent" });
    expect(unknown.status).toBe("SENT");
    expect(unknown.providerDeliveryStatus).toBeNull();
  });

  it("returns provider delivery timestamps and sanitized failure details in detail view", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const job = await NotificationOutbox.create({
      idempotencyKey: "pd-failed",
      channel: "WHATSAPP",
      status: "SENT",
      providerDeliveryStatus: "FAILED",
      providerFailedAt: new Date("2026-11-17T10:00:00.000Z"),
      providerErrorCode: "131026",
      providerErrorMessage: "Message undeliverable",
      metaMessageId: "wamid-fail",
      recipient: "919700000003",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
    } as any);

    const res = await request(app)
      .get(`/api/admin/whatsapp/messages/${job._id.toString()}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatchObject({
      status: "SENT",
      providerDeliveryStatus: "FAILED",
      providerErrorCode: "131026",
      providerErrorMessage: "Message undeliverable",
      metaMessageId: "wamid-fail",
    });
    expect(res.body.message.providerFailedAt).toBeTruthy();
    expect(res.body.message.providerDeliveredAt).toBeNull();
    expect(res.body.message.providerReadAt).toBeNull();
  });

  it("supports provider delivery filters (SENT/DELIVERED/READ/FAILED/UNKNOWN) and preserves outbox status filters", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    await NotificationOutbox.create([
      { idempotencyKey: "f1", channel: "WHATSAPP", status: "SENT", providerDeliveryStatus: "DELIVERED", recipient: "9198", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "f2", channel: "WHATSAPP", status: "SENT", providerDeliveryStatus: "READ", recipient: "9198", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "f3", channel: "WHATSAPP", status: "SENT", providerDeliveryStatus: "FAILED", recipient: "9198", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "f4", channel: "WHATSAPP", status: "SENT", recipient: "9198", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
      { idempotencyKey: "f5", channel: "WHATSAPP", status: "RETRYING", recipient: "9198", params: [], eventType: "ORDER_PLACED", attemptCount: 1, maxAttempts: 5, nextRetryAt: now },
    ]);

    for (const s of ["DELIVERED", "READ", "FAILED"]) {
      const res = await request(app).get(`/api/admin/whatsapp/messages?providerDeliveryStatus=${s}`).set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].providerDeliveryStatus).toBe(s);
      expect(res.body.messages[0].status).toBe("SENT");
    }

    const unknown = await request(app).get(`/api/admin/whatsapp/messages?providerDeliveryStatus=UNKNOWN`).set("Cookie", cookie);
    expect(unknown.status).toBe(200);
    expect(unknown.body.messages.map((m: any) => m.idempotencyKey).sort()).toEqual(["f4", "f5"]);

    const outboxRetry = await request(app).get(`/api/admin/whatsapp/messages?status=RETRYING`).set("Cookie", cookie);
    expect(outboxRetry.status).toBe(200);
    expect(outboxRetry.body.messages).toHaveLength(1);
    expect(outboxRetry.body.messages[0].status).toBe("RETRYING");
  });

  it("does not present unrelated same-phone WhatsApp messages as correlated and uses exact ID only", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const job = await NotificationOutbox.create({
      idempotencyKey: "corr-exact",
      channel: "WHATSAPP",
      status: "SENT",
      providerDeliveryStatus: "DELIVERED",
      metaMessageId: "wamid-exact",
      recipient: "919700000099",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
    });
    await WhatsAppMessage.create([
      { direction: "OUTBOUND", phone: "919700000099", messageId: "wamid-exact", status: "DELIVERED" },
      { direction: "INBOUND", phone: "919700000099", messageId: "wamid-other-same-phone", status: "RECEIVED", bodyText: "hello" },
    ]);

    const res = await request(app).get(`/api/admin/whatsapp/messages/${job._id.toString()}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.correlation).toMatchObject({ basis: "EXACT_META_MESSAGE_ID", metaMessageId: "wamid-exact" });
    expect(res.body.relatedWhatsAppMessages).toHaveLength(1);
    expect(res.body.relatedWhatsAppMessages[0].messageId).toBe("wamid-exact");
  });

  it("does not use phone fallback when provider message ID is missing", async () => {
    const cookie = await loginAdmin();
    const now = new Date();
    const job = await NotificationOutbox.create({
      idempotencyKey: "corr-none",
      channel: "WHATSAPP",
      status: "SENT",
      recipient: "919700000088",
      params: [],
      eventType: "ORDER_PLACED",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
    });
    await WhatsAppMessage.create([
      { direction: "INBOUND", phone: "919700000088", messageId: "wamid-unrelated", status: "RECEIVED", bodyText: "hi" },
    ]);

    const res = await request(app).get(`/api/admin/whatsapp/messages/${job._id.toString()}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.correlation).toMatchObject({ basis: "NONE", metaMessageId: null });
    expect(res.body.relatedWhatsAppMessages).toHaveLength(0);
  });
});
