/*
|--------------------------------------------------------------------------
| WHATSAPP WEBHOOK CONTROLLER
|--------------------------------------------------------------------------
| Meta WhatsApp Business Platform Cloud API webhook.
|
| GET  /api/whatsapp/webhook/verify   — Meta subscription verification
| POST /api/whatsapp/webhook          — Inbound messages & status callbacks
|
| Signature validation uses the raw request body (mounted via express.raw
| in server.ts) and the Meta app secret (WHATSAPP_APP_SECRET). Access tokens
*   and app secrets are never logged or echoed.
|
| Webhook processing is idempotent: each Meta event ID is recorded once and
| duplicate deliveries are ignored.
*/

import type { Request, Response } from "express";
import crypto from "node:crypto";

import {
  normalisePhone,
  withdrawAllConsent,
} from "../services/whatsappConsentService.js";
import { WhatsAppMessage } from "../models/WhatsAppMessage.js";
import { WhatsAppWebhookEvent } from "../models/WhatsAppWebhookEvent.js";
import { NotificationOutbox } from "../models/NotificationOutbox.js";
import { Order } from "../models/Order.js";
import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "../services/uatSafetyLog.js";
import { logger } from "../lib/logger.js";

type WhatsAppMessageStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "RECEIVED";

type ProviderDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

const PROVIDER_DELIVERY_RANK: Record<ProviderDeliveryStatus, number> = {
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

function parseProviderCallbackTimestamp(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Meta status timestamps are typically unix seconds; accept ms-like values defensively.
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return undefined;
      const ms = n > 1_000_000_000_000 ? n : n * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function sanitizeProviderErrorCode(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return s.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 64) || undefined;
}

function sanitizeProviderErrorMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  // Keep short/safe; never store raw payloads/secrets.
  return s.slice(0, 200);
}

function extractProviderFailureDetails(statusObj: Record<string, unknown>): {
  code?: string;
  message?: string;
} {
  const errors = statusObj["errors"];
  if (!Array.isArray(errors) || errors.length === 0) return {};
  const first = errors[0];
  if (!first || typeof first !== "object") return {};
  const err = first as Record<string, unknown>;
  const code =
    sanitizeProviderErrorCode(err["code"]) ??
    sanitizeProviderErrorCode(err["error_code"]) ??
    sanitizeProviderErrorCode(err["title"]);
  const message =
    sanitizeProviderErrorMessage(err["title"]) ??
    sanitizeProviderErrorMessage(err["message"]) ??
    sanitizeProviderErrorMessage(err["details"]);
  return { ...(code ? { code } : {}), ...(message ? { message } : {}) };
}

function providerStatusField(status: ProviderDeliveryStatus): string {
  switch (status) {
    case "SENT":
      return "providerSentAt";
    case "DELIVERED":
      return "providerDeliveredAt";
    case "READ":
      return "providerReadAt";
    case "FAILED":
      return "providerFailedAt";
  }
}

function canApplyProviderDeliveryStatus(
  currentStatus: ProviderDeliveryStatus | undefined,
  nextStatus: ProviderDeliveryStatus,
  currentTs: Date | undefined,
  nextTs: Date | undefined,
): boolean {
  if (!currentStatus) return true;
  if (currentStatus === nextStatus) {
    // Duplicate callback: safe no-op unless we need to fill missing timestamp/error details handled separately.
    return false;
  }

  // Conflicting terminal handling (deterministic): preserve READ over FAILED; preserve FAILED over non-FAILED regressions.
  if (currentStatus === "READ" && nextStatus === "FAILED") return false;
  if (currentStatus === "FAILED" && nextStatus !== "FAILED") return false;

  // Timestamp-aware stale protection when both timestamps are known.
  if (currentTs && nextTs) {
    if (nextTs.getTime() < currentTs.getTime()) return false;
    if (nextTs.getTime() > currentTs.getTime()) {
      // Allow forward time movement except explicit rank regressions on success path.
      if (
        (currentStatus === "READ" && (nextStatus === "DELIVERED" || nextStatus === "SENT")) ||
        (currentStatus === "DELIVERED" && nextStatus === "SENT")
      ) {
        return false;
      }
      return true;
    }
    // Equal timestamps: fall through to rank rules (no invented ordering).
  }

  // Missing timestamp(s): deterministic rank-based progression only; never regress.
  return PROVIDER_DELIVERY_RANK[nextStatus] > PROVIDER_DELIVERY_RANK[currentStatus];
}

async function applyOutboundProviderDeliveryCallback(input: {
  providerMessageId: string;
  providerStatus: ProviderDeliveryStatus;
  providerTimestamp?: Date;
  providerErrorCode?: string;
  providerErrorMessage?: string;
}): Promise<void> {
  // Exact provider message ID correlation only; never use recipient phone.
  const job = await NotificationOutbox.findOne({ metaMessageId: input.providerMessageId }).lean();
  if (!job) return;

  const currentStatus = (job as any).providerDeliveryStatus as ProviderDeliveryStatus | undefined;
  const currentStatusTsField = currentStatus ? providerStatusField(currentStatus) : undefined;
  const currentStatusTs = currentStatusTsField ? ((job as any)[currentStatusTsField] as Date | undefined) : undefined;

  const shouldApply = canApplyProviderDeliveryStatus(
    currentStatus,
    input.providerStatus,
    currentStatusTs,
    input.providerTimestamp,
  );

  if (!shouldApply) {
    // Idempotent enrichment for repeated FAILED callbacks when state already FAILED: allow filling missing safe details only.
    if (currentStatus === "FAILED" && input.providerStatus === "FAILED") {
      const set: Record<string, unknown> = {};
      if (!(job as any).providerFailedAt && input.providerTimestamp) set.providerFailedAt = input.providerTimestamp;
      if (!(job as any).providerErrorCode && input.providerErrorCode) set.providerErrorCode = input.providerErrorCode;
      if (!(job as any).providerErrorMessage && input.providerErrorMessage) set.providerErrorMessage = input.providerErrorMessage;
      if (Object.keys(set).length > 0) {
        await NotificationOutbox.updateOne({ _id: job._id, providerDeliveryStatus: "FAILED" }, { $set: set });
      }
    }
    return;
  }

  const tsField = providerStatusField(input.providerStatus);
  const set: Record<string, unknown> = {
    providerDeliveryStatus: input.providerStatus,
  };
  if (input.providerTimestamp) {
    set[tsField] = input.providerTimestamp;
  }
  if (input.providerStatus === "FAILED") {
    if (input.providerErrorCode) set.providerErrorCode = input.providerErrorCode;
    if (input.providerErrorMessage) set.providerErrorMessage = input.providerErrorMessage;
  }

  // Conditional update to reduce races/regressions if another callback advanced state concurrently.
  const currentRank = currentStatus ? PROVIDER_DELIVERY_RANK[currentStatus] : 0;
  const guards: Record<string, unknown>[] = [
    { providerDeliveryStatus: { $exists: false } },
    { providerDeliveryStatus: null },
  ];
  if (currentStatus) {
    guards.push({ providerDeliveryStatus: currentStatus });
    // Allow forward rank transitions; terminal/conflicting cases already filtered above.
    guards.push({ providerDeliveryStatus: { $in: (Object.keys(PROVIDER_DELIVERY_RANK) as ProviderDeliveryStatus[]).filter(s => PROVIDER_DELIVERY_RANK[s] < PROVIDER_DELIVERY_RANK[input.providerStatus]) } });
  } else {
    // Unknown -> any valid status
  }

  await NotificationOutbox.updateOne(
    {
      _id: job._id,
      $or: guards,
    },
    { $set: set },
  );
}

interface WebhookEventResult {
  eventId: string;
  alreadyProcessed: boolean;
}

/**
 * Verifies the Meta webhook signature (X-Hub-Signature-256) against the
 * raw request body using the app secret. Returns false when unconfigured
 * or when the signature does not match. Never logs the secret.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) return false;
  if (!signatureHeader) return false;

  const payload =
    rawBody instanceof Buffer ? rawBody.toString("utf8") : String(rawBody);

  // Meta header format: "sha256=<hex-hmac>"
  const [algo, signature] = String(signatureHeader).split("=");
  if (algo !== "sha256" || !signature) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

/**
 * Records a webhook event for idempotency. Returns the event ID and whether
 * it was already processed. Duplicate-key races are treated as already processed.
 */
async function recordWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<WebhookEventResult> {
  const existing = await WhatsAppWebhookEvent.findOne({ eventId }).lean();
  if (existing) {
    return { eventId, alreadyProcessed: true };
  }

  try {
    await WhatsAppWebhookEvent.create({
      eventId,
      eventType,
      processed: false,
    });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 11000) {
      return { eventId, alreadyProcessed: true };
    }
    throw error;
  }

  return { eventId, alreadyProcessed: false };
}

async function markEventProcessed(eventId: string): Promise<void> {
  await WhatsAppWebhookEvent.updateOne(
    { eventId },
    { $set: { processed: true, processedAt: new Date() } },
  );
}

async function logInboundMessage(input: {
  phone: string;
  messageId: string;
  bodyText: string;
  metaPayload?: Record<string, unknown>;
}): Promise<void> {
  await WhatsAppMessage.create({
    direction: "INBOUND",
    phone: input.phone,
    messageId: input.messageId,
    status: "RECEIVED",
    bodyText: input.bodyText,
    metaPayload: input.metaPayload,
  });
}

async function logOutboundMessage(input: {
  phone: string;
  messageId: string;
  templateName?: string;
  status: WhatsAppMessageStatus;
  bodyText?: string;
  errorCode?: string;
  errorMessage?: string;
  orderNumber?: string;
  referenceNumber?: string;
  metaPayload?: Record<string, unknown>;
}): Promise<void> {
  const outbox: Record<string, unknown> = {
    direction: "OUTBOUND",
    phone: input.phone,
    messageId: input.messageId,
    status: input.status,
    bodyText: input.bodyText,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    orderNumber: input.orderNumber,
    referenceNumber: input.referenceNumber,
    metaPayload: input.metaPayload,
  };

  if (input.templateName !== undefined) {
    outbox.templateName = input.templateName;
  }

  await WhatsAppMessage.create(outbox);
}

function redactMetaPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("key")
    ) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      redacted[key] = redactMetaPayload(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Extracts the customer's phone number from a Meta message object and
 * normalises it to international format.
 */
function extractPhoneFromMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const from = obj["from"];
  if (typeof from !== "string") return null;
  return normalisePhone(from);
}

async function recordWebhookCommand(
  eventId: string,
  command: "TRACK" | "HELP" | "STOP",
  phone: string,
): Promise<void> {
  try {
    await WhatsAppWebhookEvent.updateOne(
      { eventId },
      { $set: { command, phone } },
    );
  } catch (error) {
    // Best-effort audit metadata; command handling outcome must not be masked.
    logger.warn("WhatsApp webhook command metadata record failed", {
      code: "WHATSAPP_WEBHOOK_COMMAND_METADATA_RECORD_FAILED",
      eventId,
      command,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handles an inbound customer message. Supports TRACK, HELP and STOP
 * commands. TRACK is treated as an internal inbound tracking/audit event:
 * no customer-facing WhatsApp reply, no provider dispatch, no outbox enqueue,
 * and no synthetic OUTBOUND/SENT WhatsAppMessage record.
 */
async function handleInboundMessage(input: {
  eventId: string;
  phone: string;
  messageId: string;
  body: string;
  metaPayload: Record<string, unknown>;
}): Promise<void> {
  const { eventId, phone, messageId, body, metaPayload } = input;
  const trimmed = body.trim();
  const upper = trimmed.toUpperCase();

  await logInboundMessage({
    phone,
    messageId,
    bodyText: trimmed,
    metaPayload: redactMetaPayload(metaPayload),
  });

  if (upper === "STOP") {
    // STOP must reliably prevent subsequent marketing and transactional WhatsApp
    // messages according to applicable consent rules (Phase A).
    await withdrawAllConsent({ phone, reason: "STOP command via WhatsApp", source: "OPT_IN_MESSAGE" });
    await recordWebhookCommand(eventId, "STOP", phone);
    return;
  }

  if (upper === "HELP") {
    await recordWebhookCommand(eventId, "HELP", phone);
    return;
  }

  if (upper === "TRACK" || /^TRACK\s+/i.test(trimmed)) {
    await recordWebhookCommand(eventId, "TRACK", phone);
    const parts = trimmed.split(/\s+/);
    const orderNumber = parts.length > 1 ? parts[1] : undefined;

    if (orderNumber) {
      await trackOrderByNumber(phone, orderNumber);
    } else {
      await trackLatestOrder(phone);
    }

    return;
  }

  // Unrecognised message: no reply (avoid sending unsolicited messages).
}

/**
 * Tracks the latest order for a phone number, verifying ownership.
 * Internal-only: no WhatsApp reply/provider dispatch/outbox enqueue.
 */
async function trackLatestOrder(phone: string): Promise<void> {
  await Order.findOne({ phone }).sort({ createdAt: -1 }).select("_id").lean();
}

/**
 * Tracks a specific order by number, verifying the phone matches.
 * Internal-only: no WhatsApp reply/provider dispatch/outbox enqueue.
 */
async function trackOrderByNumber(
  phone: string,
  orderNumber: string,
): Promise<void> {
  await Order.findOne({
    orderNumber: orderNumber.toUpperCase(),
    phone,
  }).select("_id").lean();
}

/**
 * Handles a Meta message-status callback (sent/delivered/read/failed).
 * Correlates outbound template delivery to NotificationOutbox by exact provider
 * message ID (metaMessageId). Existing WhatsAppMessage status handling is preserved
 * best-effort for compatible records; unknown provider IDs are ignored safely.
 */
async function handleStatusCallback(input: {
  statuses: unknown[];
}): Promise<void> {
  const { statuses } = input;
  for (const statusObj of statuses) {
    if (!statusObj || typeof statusObj !== "object") continue;
    const obj = statusObj as Record<string, unknown>;
    const id = obj["id"];
    const status = obj["status"];
    const recipientId = obj["recipient_id"];

    if (typeof id !== "string" || !id.trim() || typeof status !== "string") continue;

    let providerStatus: ProviderDeliveryStatus;
    let whatsappMessageStatus: WhatsAppMessageStatus | null = null;
    switch (status) {
      case "sent":
        providerStatus = "SENT";
        whatsappMessageStatus = "SENT";
        break;
      case "delivered":
        providerStatus = "DELIVERED";
        whatsappMessageStatus = "DELIVERED";
        break;
      case "read":
        providerStatus = "READ";
        whatsappMessageStatus = "READ";
        break;
      case "failed":
        providerStatus = "FAILED";
        whatsappMessageStatus = "FAILED";
        break;
      default:
        // Preserve existing behavior: ignore unsupported callback statuses.
        continue;
    }

    const providerTimestamp = parseProviderCallbackTimestamp(obj["timestamp"]);
    const failureDetails =
      providerStatus === "FAILED" ? extractProviderFailureDetails(obj) : {};

    // Authoritative outbound template delivery correlation: exact outbox metaMessageId only.
    await applyOutboundProviderDeliveryCallback({
      providerMessageId: id,
      providerStatus,
      ...(providerTimestamp ? { providerTimestamp } : {}),
      ...(failureDetails.code ? { providerErrorCode: failureDetails.code } : {}),
      ...(failureDetails.message ? { providerErrorMessage: failureDetails.message } : {}),
    });

    // Preserve existing WhatsAppMessage status handling where a matching record exists.
    // This does not use phone fallback and does not create arbitrary records.
    if (whatsappMessageStatus) {
      const message = await WhatsAppMessage.findOne({ messageId: id }).lean();
      if (!message) continue;
      await WhatsAppMessage.updateOne(
        { messageId: id },
        {
          $set: {
            status: whatsappMessageStatus,
            ...(recipientId && typeof recipientId === "string"
              ? { phone: recipientId }
              : {}),
          },
        },
      );
    }
  }
}

/**
 * GET webhook verification. Meta calls this to confirm the webhook URL.
 * Returns the hub.challenge when the verify token matches.
 */
export const verifyWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("whatsapp.webhook.verify");
    res.status(403).json({
      message: "Live WhatsApp webhook verification is blocked in UAT_SAFE_MODE.",
      code: "UAT_SAFE_MODE_EXTERNAL_BLOCKED",
    });
    return;
  }

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    res.status(200).send(challenge);
    return;
  }

  res.status(403).json({ message: "Forbidden" });
};

/**
 * POST webhook. Validates the signature against the raw body, then
 * idempotently processes messages and status callbacks.
 */
export const receiveWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("whatsapp.webhook.receive");
    res.status(403).json({
      message: "Live WhatsApp webhook processing is blocked in UAT_SAFE_MODE.",
      code: "UAT_SAFE_MODE_EXTERNAL_BLOCKED",
    });
    return;
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) {
    res.status(503).json({ message: "Webhook is not configured" });
    return;
  }

  const signature = req.get("x-hub-signature-256");
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(String(req.body ?? ""), "utf8");

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ message: "Invalid webhook signature" });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    res.status(400).json({ message: "Invalid JSON payload" });
    return;
  }

  const entry = body["entry"];
  if (!entry || !Array.isArray(entry)) {
    res.status(200).json({ received: true });
    return;
  }

  const changesPromises: Promise<unknown>[] = [];

  for (const e of entry) {
    if (!e || typeof e !== "object") continue;
    const entryObj = e as Record<string, unknown>;

    const changes = entryObj["changes"];
    if (!changes || !Array.isArray(changes)) continue;

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const changeObj = change as Record<string, unknown>;
      const value = changeObj["value"];

      if (!value || typeof value !== "object") continue;
      const valueObj = value as Record<string, unknown>;

      const messagingProduct = valueObj["messaging_product"];
      if (messagingProduct !== "whatsapp") continue;

      // Inbound messages
      const messages = valueObj["messages"];
      if (messages && Array.isArray(messages)) {
        for (const message of messages) {
          if (!message || typeof message !== "object") continue;
          const messageObj = message as Record<string, unknown>;
          const messageId = messageObj["id"];
          const from = messageObj["from"];
          const textObj = messageObj["text"] as
            | { body?: string }
            | undefined;

          if (!messageId || typeof messageId !== "string") continue;
          const phone = normalisePhone(String(from ?? ""));
          if (!phone) continue;

          const eventResult = await recordWebhookEvent(
            messageId,
            "message",
          );
          if (eventResult.alreadyProcessed) {
            await markEventProcessed(messageId);
            continue;
          }

          await handleInboundMessage({
            eventId: messageId,
            phone,
            messageId,
            body: (textObj?.body ?? ""),
            metaPayload: valueObj,
          });

          await markEventProcessed(messageId);
        }
      }

      // Status callbacks
      const statuses = valueObj["statuses"];
      if (statuses && Array.isArray(statuses)) {
        const statusEventPromises: Promise<unknown>[] = [];
        for (const status of statuses) {
          if (!status || typeof status !== "object") continue;
          const statusObj = status as Record<string, unknown>;
          const statusId = statusObj["id"];
          if (!statusId || typeof statusId !== "string") continue;

          const statusName = typeof statusObj["status"] === "string" ? statusObj["status"] : "unknown";
          const tsRaw = statusObj["timestamp"];
          const tsKey = typeof tsRaw === "string" || typeof tsRaw === "number" ? String(tsRaw) : "na";
          const statusEventId = `${statusId}:status:${statusName}:${tsKey}`;
          const eventResult = await recordWebhookEvent(statusEventId, "status");
          if (eventResult.alreadyProcessed) {
            await markEventProcessed(statusEventId);
            continue;
          }

          statusEventPromises.push(
            (async () => {
              await handleStatusCallback({ statuses: [statusObj] });
              await markEventProcessed(statusEventId);
            })(),
          );
        }
        changesPromises.push(...statusEventPromises);
      }
    }
  }

  await Promise.all(changesPromises);
  res.status(200).json({ received: true });
};
