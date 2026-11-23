import crypto from "node:crypto";
import type { Request, Response } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import { WhatsAppMessage } from "../src/models/WhatsAppMessage.js";
import { WhatsAppWebhookEvent } from "../src/models/WhatsAppWebhookEvent.js";
import { Order } from "../src/models/Order.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";
import { receiveWebhook } from "../src/controllers/whatsappWebhookController.js";

const SECRET = "test-webhook-secret";

function sign(payload: string, secret = SECRET): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function makeRes() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  res.send = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res as Response & { statusCode?: number; body?: any };
}

async function postWebhook(bodyObj: unknown, signature?: string) {
  const raw = Buffer.from(JSON.stringify(bodyObj), "utf8");
  const req = {
    body: raw,
    get: (name: string) =>
      name.toLowerCase() === "x-hub-signature-256"
        ? signature ?? sign(raw.toString("utf8"))
        : undefined,
  } as unknown as Request;
  const res = makeRes();
  await receiveWebhook(req, res);
  return res;
}

function statusPayload(status: string, id: string, extra: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              statuses: [
                {
                  id,
                  status,
                  timestamp: "1700000000",
                  recipient_id: "15550001111",
                  ...extra,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function inboundTextPayload(messageId: string, from: string, text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-in",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  id: messageId,
                  from,
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function seedOutbox(overrides: Record<string, unknown> = {}) {
  return await NotificationOutbox.create({
    idempotencyKey: `k-${Math.random()}`,
    channel: "WHATSAPP",
    status: "SENT",
    recipient: "15550001111",
    params: [],
    eventType: "ORDER_PLACED",
    attemptCount: 1,
    maxAttempts: 5,
    nextRetryAt: new Date(),
    metaMessageId: "wamid.1",
    ...overrides,
  });
}

describe("WhatsApp webhook -> NotificationOutbox delivery correlation (R2-A)", () => {
  const prevSecret = process.env.WHATSAPP_APP_SECRET;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    await connectTestDB();
  });

  afterAll(async () => {
    if (prevSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = prevSecret;
    await disconnectTestDB();
  });

  beforeEach(async () => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    await clearTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("updates exact outbox by metaMessageId for sent/delivered/read callbacks", async () => {
    await seedOutbox({ metaMessageId: "wamid.sent" });
    await seedOutbox({ metaMessageId: "wamid.delivered" });
    await seedOutbox({ metaMessageId: "wamid.read" });
    await seedOutbox({ metaMessageId: "wamid.other" });

    let res = await postWebhook(statusPayload("sent", "wamid.sent", { timestamp: "1700000100" }));
    expect(res.statusCode).toBe(200);
    res = await postWebhook(statusPayload("delivered", "wamid.delivered", { timestamp: "1700000200" }));
    expect(res.statusCode).toBe(200);
    res = await postWebhook(statusPayload("read", "wamid.read", { timestamp: "1700000300" }));
    expect(res.statusCode).toBe(200);

    const sent = await NotificationOutbox.findOne({ metaMessageId: "wamid.sent" }).lean();
    const delivered = await NotificationOutbox.findOne({ metaMessageId: "wamid.delivered" }).lean();
    const read = await NotificationOutbox.findOne({ metaMessageId: "wamid.read" }).lean();
    const other = await NotificationOutbox.findOne({ metaMessageId: "wamid.other" }).lean();

    expect(sent?.providerDeliveryStatus).toBe("SENT");
    expect(sent?.providerSentAt).toBeInstanceOf(Date);
    expect(delivered?.providerDeliveryStatus).toBe("DELIVERED");
    expect(delivered?.providerDeliveredAt).toBeInstanceOf(Date);
    expect(read?.providerDeliveryStatus).toBe("READ");
    expect(read?.providerReadAt).toBeInstanceOf(Date);
    expect(other?.providerDeliveryStatus ?? null).toBeNull();
  });

  it("updates exact outbox for failed callback and stores sanitized error details", async () => {
    await seedOutbox({ metaMessageId: "wamid.fail" });
    const res = await postWebhook(statusPayload("failed", "wamid.fail", {
      timestamp: "1700000400",
      errors: [{ code: "131026", title: "  Message   undeliverable  ", message: "SECRET=abc should not appear raw but text is truncated/sanitized" }],
    }));
    expect(res.statusCode).toBe(200);

    const job = await NotificationOutbox.findOne({ metaMessageId: "wamid.fail" }).lean();
    expect(job?.providerDeliveryStatus).toBe("FAILED");
    expect(job?.providerFailedAt).toBeInstanceOf(Date);
    expect(job?.providerErrorCode).toBe("131026");
    expect(typeof job?.providerErrorMessage).toBe("string");
    expect(String(job?.providerErrorMessage)).not.toContain("\n");
    expect(String(job?.providerErrorMessage).length).toBeLessThanOrEqual(200);
  });

  it("unknown provider ID does not update any outbox record and cannot correlate by phone", async () => {
    const samePhone = "15550009999";
    const job = await seedOutbox({ metaMessageId: "wamid.known", recipient: samePhone });
    const res = await postWebhook(statusPayload("delivered", "wamid.unknown", { recipient_id: samePhone, timestamp: "1700000500" }));
    expect(res.statusCode).toBe(200);

    const unchanged = await NotificationOutbox.findById(job._id).lean();
    expect(unchanged?.providerDeliveryStatus ?? null).toBeNull();
    expect(unchanged?.providerDeliveredAt ?? null).toBeNull();
  });

  it("leaves provider delivery status unknown when original send has no provider ID", async () => {
    const job = await seedOutbox({ metaMessageId: undefined, recipient: "15550007777" });
    const res = await postWebhook(statusPayload("delivered", "wamid.some-id", { recipient_id: "15550007777", timestamp: "1700000600" }));
    expect(res.statusCode).toBe(200);

    const unchanged = await NotificationOutbox.findById(job._id).lean();
    expect(unchanged?.providerDeliveryStatus ?? null).toBeNull();
  });

  it("supports SENT -> DELIVERED -> READ progression", async () => {
    await seedOutbox({ metaMessageId: "wamid.prog" });
    await postWebhook(statusPayload("sent", "wamid.prog", { timestamp: "1700000100" }));
    await postWebhook(statusPayload("delivered", "wamid.prog", { timestamp: "1700000200" }));
    await postWebhook(statusPayload("read", "wamid.prog", { timestamp: "1700000300" }));
    const job = await NotificationOutbox.findOne({ metaMessageId: "wamid.prog" }).lean();
    expect(job?.providerDeliveryStatus).toBe("READ");
    expect(job?.providerSentAt).toBeInstanceOf(Date);
    expect(job?.providerDeliveredAt).toBeInstanceOf(Date);
    expect(job?.providerReadAt).toBeInstanceOf(Date);
  });

  it("does not regress READ -> DELIVERED, READ -> SENT, or DELIVERED -> SENT", async () => {
    await seedOutbox({ metaMessageId: "wamid.noreg-read", providerDeliveryStatus: "READ", providerReadAt: new Date(1700000300 * 1000) } as any);
    await seedOutbox({ metaMessageId: "wamid.noreg-del", providerDeliveryStatus: "DELIVERED", providerDeliveredAt: new Date(1700000200 * 1000) } as any);

    await postWebhook(statusPayload("delivered", "wamid.noreg-read", { timestamp: "1700000400" }));
    await postWebhook(statusPayload("sent", "wamid.noreg-read", { timestamp: "1700000400" }));
    await postWebhook(statusPayload("sent", "wamid.noreg-del", { timestamp: "1700000400" }));

    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.noreg-read" }).lean())?.providerDeliveryStatus).toBe("READ");
    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.noreg-del" }).lean())?.providerDeliveryStatus).toBe("DELIVERED");
  });

  it("treats duplicate DELIVERED/READ/FAILED callbacks as idempotent/safe", async () => {
    await seedOutbox({ metaMessageId: "wamid.dup-del" });
    await seedOutbox({ metaMessageId: "wamid.dup-read" });
    await seedOutbox({ metaMessageId: "wamid.dup-fail" });

    await postWebhook(statusPayload("delivered", "wamid.dup-del", { timestamp: "1700000200" }));
    await postWebhook(statusPayload("delivered", "wamid.dup-del", { timestamp: "1700000200" }));
    await postWebhook(statusPayload("read", "wamid.dup-read", { timestamp: "1700000300" }));
    await postWebhook(statusPayload("read", "wamid.dup-read", { timestamp: "1700000300" }));
    await postWebhook(statusPayload("failed", "wamid.dup-fail", { timestamp: "1700000400", errors: [{ code: "E1", title: "err" }] }));
    await postWebhook(statusPayload("failed", "wamid.dup-fail", { timestamp: "1700000400", errors: [{ code: "E1", title: "err" }] }));

    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.dup-del" }).lean())?.providerDeliveryStatus).toBe("DELIVERED");
    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.dup-read" }).lean())?.providerDeliveryStatus).toBe("READ");
    const failed = await NotificationOutbox.findOne({ metaMessageId: "wamid.dup-fail" }).lean();
    expect(failed?.providerDeliveryStatus).toBe("FAILED");
    expect(failed?.providerErrorCode).toBe("E1");
  });

  it("older timestamp callback cannot overwrite newer state; missing timestamps are deterministic", async () => {
    await seedOutbox({ metaMessageId: "wamid.oldts" });
    await postWebhook(statusPayload("read", "wamid.oldts", { timestamp: "1700000300" }));
    await postWebhook(statusPayload("delivered", "wamid.oldts", { timestamp: "1700000200" }));
    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.oldts" }).lean())?.providerDeliveryStatus).toBe("READ");

    await seedOutbox({ metaMessageId: "wamid.missingts" });
    await postWebhook(statusPayload("delivered", "wamid.missingts", { timestamp: undefined }));
    await postWebhook(statusPayload("sent", "wamid.missingts", { timestamp: undefined }));
    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.missingts" }).lean())?.providerDeliveryStatus).toBe("DELIVERED");
  });

  it("handles conflicting terminal behavior deterministically (FAILED does not overwrite READ; READ not regressed by FAILED)", async () => {
    await seedOutbox({ metaMessageId: "wamid.read-fail", providerDeliveryStatus: "READ", providerReadAt: new Date(1700000300 * 1000) } as any);
    await postWebhook(statusPayload("failed", "wamid.read-fail", { timestamp: "1700000400", errors: [{ code: "X", title: "late fail" }] }));
    const job = await NotificationOutbox.findOne({ metaMessageId: "wamid.read-fail" }).lean();
    expect(job?.providerDeliveryStatus).toBe("READ");
    expect(job?.providerFailedAt ?? null).toBeNull();
  });

  it("preserves webhook-event deduplication for status callbacks", async () => {
    await seedOutbox({ metaMessageId: "wamid.dedupe" });
    const payload = statusPayload("delivered", "wamid.dedupe", { timestamp: "1700000200" });
    await postWebhook(payload);
    await postWebhook(payload);
    const events = await WhatsAppWebhookEvent.find({ eventType: "status", eventId: /:status:delivered:1700000200$/ }).lean();
    expect(events).toHaveLength(1);
    expect((await NotificationOutbox.findOne({ metaMessageId: "wamid.dedupe" }).lean())?.providerDeliveryStatus).toBe("DELIVERED");
  });

  it("preserves inbound WhatsApp message handling and TRACK internal-only audit semantics (S06 Option A)", async () => {
    // Inbound HELP is logged as inbound message.
    await postWebhook(inboundTextPayload("wamid-in-1", "919999999999", "HELP"));
    const inbound = await WhatsAppMessage.findOne({ messageId: "wamid-in-1" }).lean();
    expect(inbound).toBeTruthy();
    expect(inbound?.direction).toBe("INBOUND");
    expect(inbound?.status).toBe("RECEIVED");

    const helpEvent = await WhatsAppWebhookEvent.findOne({ eventId: "wamid-in-1" }).lean();
    expect(helpEvent?.command).toBe("HELP");

    // TRACK by order number must remain internal/audit-only: no synthetic OUTBOUND/SENT
    // WhatsAppMessage, no provider dispatch, no outbox enqueue.
    await Order.collection.insertOne({
      orderNumber: "SV-TRACK-1",
      customerName: "T",
      phone: "919999999999",
      fulfillmentType: "PICKUP",
      scheduledDate: "2026-11-20",
      scheduledTime: "10:00 AM",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
      items: [],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const outboxBefore = await NotificationOutbox.countDocuments();
    await postWebhook(inboundTextPayload("wamid-in-2", "919999999999", "TRACK SV-TRACK-1"));

    const trackInbound = await WhatsAppMessage.findOne({ messageId: "wamid-in-2" }).lean();
    expect(trackInbound?.direction).toBe("INBOUND");
    expect(trackInbound?.status).toBe("RECEIVED");

    const trackMsgs = await WhatsAppMessage.find({ orderNumber: "SV-TRACK-1", direction: "OUTBOUND" }).lean();
    expect(trackMsgs).toHaveLength(0);
    expect(await NotificationOutbox.countDocuments()).toBe(outboxBefore);

    const trackEvent = await WhatsAppWebhookEvent.findOne({ eventId: "wamid-in-2" }).lean();
    expect(trackEvent?.command).toBe("TRACK");
    expect(trackEvent?.processed).toBe(true);
  });

  it("TRACK unknown order/phone mismatch is safely ignored (no synthetic outbound, no outbox)", async () => {
    await Order.collection.insertOne({
      orderNumber: "SV-TRACK-OTHER",
      customerName: "T",
      phone: "919999999998",
      fulfillmentType: "PICKUP",
      scheduledDate: "2026-11-20",
      scheduledTime: "10:00 AM",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
      items: [],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const outboxBefore = await NotificationOutbox.countDocuments();
    await postWebhook(inboundTextPayload("wamid-track-mismatch", "919999999999", "TRACK SV-TRACK-OTHER"));

    expect(await WhatsAppMessage.countDocuments({ direction: "OUTBOUND" })).toBe(0);
    expect(await NotificationOutbox.countDocuments()).toBe(outboxBefore);
    const event = await WhatsAppWebhookEvent.findOne({ eventId: "wamid-track-mismatch" }).lean();
    expect(event?.processed).toBe(true);
    expect(event?.command).toBe("TRACK");
  });

  it("duplicate TRACK webhook event is idempotent and does not create outbound/outbox side effects", async () => {
    await Order.collection.insertOne({
      orderNumber: "SV-TRACK-DUPE",
      customerName: "T",
      phone: "919999999999",
      fulfillmentType: "PICKUP",
      scheduledDate: "2026-11-20",
      scheduledTime: "10:00 AM",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
      items: [],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const payload = inboundTextPayload("wamid-track-dupe", "919999999999", "TRACK SV-TRACK-DUPE");
    await postWebhook(payload);
    await postWebhook(payload);

    expect(await WhatsAppWebhookEvent.countDocuments({ eventId: "wamid-track-dupe" })).toBe(1);
    expect(await WhatsAppMessage.countDocuments({ direction: "OUTBOUND" })).toBe(0);
    expect(await NotificationOutbox.countDocuments()).toBe(0);
  });
});
