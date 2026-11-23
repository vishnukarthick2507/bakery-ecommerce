import type { Response } from "express";
import { z } from "zod";

import { NotificationOutbox } from "../models/NotificationOutbox.js";
import { WhatsAppConsent } from "../models/WhatsAppConsent.js";
import { WhatsAppMessage } from "../models/WhatsAppMessage.js";
import {
  WHATSAPP_NOTIFICATION_EVENT_TYPES,
  WhatsAppNotificationPreference,
} from "../models/WhatsAppNotificationPreference.js";
import type { AuthRequest } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const OUTBOX_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "RETRYING",
  "DEAD_LETTER",
  "SKIPPED",
  "RECONCILIATION_REQUIRED",
] as const;

const MESSAGE_STATUSES = ["SENT", "DELIVERED", "READ", "FAILED", "RECEIVED"] as const;

const OUTBOX_PROVIDER_DELIVERY_STATUSES = ["SENT", "DELIVERED", "READ", "FAILED"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional().default(""),
  // Backward-compatible parameter: outbox processing statuses. Legacy delivery-only
  // values are mapped to providerDeliveryStatus when used.
  status: z
    .enum([
      "PENDING",
      "PROCESSING",
      "SENT",
      "DELIVERED",
      "READ",
      "FAILED",
      "RETRYING",
      "DEAD_LETTER",
      "SKIPPED",
      "RECEIVED",
      "RECONCILIATION_REQUIRED",
    ])
    .optional(),
  // Additive provider delivery filter for outbox records (exact provider callback state).
  providerDeliveryStatus: z
    .enum(["SENT", "DELIVERED", "READ", "FAILED", "UNKNOWN"])
    .optional(),
  channel: z.enum(["WHATSAPP", "EMAIL"]).optional(),
  eventType: z.string().trim().optional(),
});

function safeErrorMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Avoid leaking secrets/tokens; keep short, user-safe text.
  return trimmed.slice(0, 300);
}

export async function getWhatsAppStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [outboxAgg, messageAgg] = await Promise.all([
      NotificationOutbox.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      WhatsAppMessage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const outbox: Record<string, number> = {};
    for (const s of OUTBOX_STATUSES) outbox[s] = 0;
    for (const row of outboxAgg) {
      if (row?._id && typeof row.count === "number") outbox[row._id] = row.count;
    }

    const message: Record<string, number> = {};
    for (const s of MESSAGE_STATUSES) message[s] = 0;
    for (const row of messageAgg) {
      if (row?._id && typeof row.count === "number") message[row._id] = row.count;
    }

    // Combined stats using statuses actually supported by the models.
    const stats = {
      PENDING: outbox.PENDING ?? 0,
      PROCESSING: outbox.PROCESSING ?? 0,
      SENT: (outbox.SENT ?? 0) + (message.SENT ?? 0),
      DELIVERED: message.DELIVERED ?? 0,
      READ: message.READ ?? 0,
      FAILED: message.FAILED ?? 0,
      RETRYING: outbox.RETRYING ?? 0,
      DEAD_LETTER: outbox.DEAD_LETTER ?? 0,
      SKIPPED: outbox.SKIPPED ?? 0,
      RECEIVED: message.RECEIVED ?? 0,
      RECONCILIATION_REQUIRED: outbox.RECONCILIATION_REQUIRED ?? 0,
    };

    res.status(200).json({ stats, breakdown: { outbox, message } });
  } catch (error) {
    logger.error("Get WhatsApp stats failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to fetch WhatsApp statistics" });
  }
}

export async function listWhatsAppMessages(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid query parameters", errors: parsed.error.flatten() });
      return;
    }

    const { page, limit, search, status, providerDeliveryStatus, channel, eventType } = parsed.data;
    const filter: Record<string, unknown> = {};

    if (channel) filter.channel = channel;
    if (eventType) filter.eventType = eventType;

    // Preserve existing outbox processing status filter behavior.
    // Legacy delivery-only status values are treated as provider delivery filters
    // on outbox records (additive/corrected behavior) rather than conflated with
    // outbox processing status.
    let effectiveProviderDeliveryStatus = providerDeliveryStatus;
    if (status) {
      if ((OUTBOX_STATUSES as readonly string[]).includes(status)) {
        filter.status = status;
      } else if ((OUTBOX_PROVIDER_DELIVERY_STATUSES as readonly string[]).includes(status)) {
        // DELIVERED/READ/FAILED are provider delivery states; SENT is ambiguous in
        // legacy param but maps to provider callback SENT for outbox delivery view.
        effectiveProviderDeliveryStatus = effectiveProviderDeliveryStatus ?? (status as "SENT" | "DELIVERED" | "READ" | "FAILED");
      } else if (status === "RECEIVED") {
        // RECEIVED is an inbound WhatsAppMessage state and does not apply to outbox rows.
        res.status(200).json({
          messages: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          note: "RECEIVED is tracked on inbound WhatsApp message records; no outbox entries match this status.",
        });
        return;
      }
    }

    if (effectiveProviderDeliveryStatus) {
      if (effectiveProviderDeliveryStatus === "UNKNOWN") {
        filter.$and = [
          ...(Array.isArray(filter.$and) ? filter.$and : []),
          {
            $or: [
              { providerDeliveryStatus: { $exists: false } },
              { providerDeliveryStatus: null },
            ],
          },
        ];
      } else {
        filter.providerDeliveryStatus = effectiveProviderDeliveryStatus;
      }
    }

    if (search) {
      const searchOr = [
        { recipient: { $regex: search, $options: "i" } },
        { eventType: { $regex: search, $options: "i" } },
        { orderNumber: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
        { idempotencyKey: { $regex: search, $options: "i" } },
      ];
      if (Array.isArray(filter.$and)) {
        filter.$and.push({ $or: searchOr });
      } else {
        filter.$or = searchOr;
      }
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      NotificationOutbox.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationOutbox.countDocuments(filter),
    ]);

    // Attach Meta message IDs from WhatsAppMessage when available (best-effort).
    const ids = rows
      .map((r) => r.metaMessageId)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    const metaById = new Set(ids);

    const messages = rows.map((r: any) => ({
      id: r._id.toString(),
      idempotencyKey: r.idempotencyKey,
      channel: r.channel,
      status: r.status, // outbox processing status
      providerDeliveryStatus: r.providerDeliveryStatus ?? null,
      providerSentAt: r.providerSentAt ?? null,
      providerDeliveredAt: r.providerDeliveredAt ?? null,
      providerReadAt: r.providerReadAt ?? null,
      providerFailedAt: r.providerFailedAt ?? null,
      providerErrorCode: r.providerErrorCode ?? null,
      providerErrorMessage: safeErrorMessage(r.providerErrorMessage),
      recipient: r.recipient,
      eventType: r.eventType,
      templateName: r.templateName ?? null,
      orderNumber: r.orderNumber ?? null,
      referenceNumber: r.referenceNumber ?? null,
      attemptCount: r.attemptCount,
      maxAttempts: r.maxAttempts,
      nextRetryAt: r.nextRetryAt ?? null,
      lastError: safeErrorMessage(r.lastError),
      metaMessageId: r.metaMessageId ?? null,
      workerId: r.workerId ?? null,
      leaseExpiresAt: r.leaseExpiresAt ?? null,
      reconciliationCode: r.reconciliationCode ?? null,
      reconciliationReason: safeErrorMessage(r.reconciliationReason),
      providerAcceptedAt: r.providerAcceptedAt ?? null,
      reconciliationDetectedAt: r.reconciliationDetectedAt ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("List WhatsApp messages failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to fetch WhatsApp message history" });
  }
}

export async function getWhatsAppMessageDetail(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ message: "Message id is required" });
      return;
    }

    const job = await NotificationOutbox.findById(id).lean();
    if (!job) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    // Correlation safety: only exact provider message ID correlation is considered
    // outbox-linked. Recipient-phone fallback is intentionally not used because it
    // can mix unrelated same-phone WhatsApp messages.
    const metaMessageId = typeof (job as any).metaMessageId === "string" ? (job as any).metaMessageId.trim() : "";
    const exactCorrelatedMessages = metaMessageId
      ? await WhatsAppMessage.find({ messageId: metaMessageId })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
      : [];
    const correlationBasis = metaMessageId ? "EXACT_META_MESSAGE_ID" : "NONE";

    const jobAny = job as any;
    res.status(200).json({
      message: {
        id: job._id.toString(),
        idempotencyKey: job.idempotencyKey,
        channel: job.channel,
        status: job.status, // outbox processing status
        providerDeliveryStatus: jobAny.providerDeliveryStatus ?? null,
        providerSentAt: jobAny.providerSentAt ?? null,
        providerDeliveredAt: jobAny.providerDeliveredAt ?? null,
        providerReadAt: jobAny.providerReadAt ?? null,
        providerFailedAt: jobAny.providerFailedAt ?? null,
        providerErrorCode: jobAny.providerErrorCode ?? null,
        providerErrorMessage: safeErrorMessage(jobAny.providerErrorMessage),
        recipient: job.recipient,
        eventType: job.eventType,
        templateName: job.templateName ?? null,
        orderNumber: job.orderNumber ?? null,
        referenceNumber: job.referenceNumber ?? null,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        nextRetryAt: job.nextRetryAt ?? null,
        lastError: safeErrorMessage(job.lastError),
        metaMessageId: job.metaMessageId ?? null,
        workerId: job.workerId ?? null,
        leaseExpiresAt: job.leaseExpiresAt ?? null,
        reconciliationCode: jobAny.reconciliationCode ?? null,
        reconciliationReason: safeErrorMessage(jobAny.reconciliationReason),
        providerAcceptedAt: jobAny.providerAcceptedAt ?? null,
        reconciliationDetectedAt: jobAny.reconciliationDetectedAt ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      retryHistory: {
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        nextRetryAt: job.nextRetryAt ?? null,
        lastError: safeErrorMessage(job.lastError),
        status: job.status,
      },
      correlation: {
        basis: correlationBasis,
        metaMessageId: metaMessageId || null,
        note: metaMessageId
          ? "Related records matched by exact provider message ID only."
          : "No provider message ID available; unrelated same-phone WhatsApp records are not shown as correlated.",
      },
      // Exact outbox-linked correlation only (no recipient-phone fallback).
      relatedWhatsAppMessages: exactCorrelatedMessages.map((m) => ({
        id: m._id.toString(),
        direction: m.direction,
        phone: m.phone,
        messageId: m.messageId,
        templateName: m.templateName ?? null,
        status: m.status,
        errorCode: m.errorCode ?? null,
        errorMessage: safeErrorMessage(m.errorMessage),
        orderNumber: m.orderNumber ?? null,
        referenceNumber: m.referenceNumber ?? null,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get WhatsApp message detail failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to fetch WhatsApp message detail" });
  }
}

export async function retryWhatsAppMessage(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      res.status(400).json({ message: "Message id is required" });
      return;
    }

    const job = await NotificationOutbox.findById(id).lean();
    if (!job) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    // Eligible failed messages only: DEAD_LETTER (terminal failure) or RETRYING
    // that is not actively processing. Never retry SENT/SKIPPED/PROCESSING/PENDING duplicates.
    if (job.status === "PROCESSING") {
      res.status(409).json({ message: "Message is currently processing and cannot be retried" });
      return;
    }
    if (job.status === "RECONCILIATION_REQUIRED") {
      res.status(409).json({
        message: "Message requires reconciliation and cannot be automatically retried",
      });
      return;
    }
    if (job.status === "SENT" || job.status === "SKIPPED") {
      res.status(409).json({ message: "Message is not eligible for retry" });
      return;
    }
    if (job.status === "PENDING") {
      res.status(409).json({ message: "Message is already pending delivery" });
      return;
    }
    if (job.status !== "DEAD_LETTER" && job.status !== "RETRYING") {
      res.status(409).json({ message: "Message is not eligible for retry" });
      return;
    }

    // Reuse existing outbox record and idempotency key; do not create duplicates.
    // Reset for a safe manual retry attempt.
    const now = new Date();
    const updated = await NotificationOutbox.findOneAndUpdate(
      { _id: id, status: { $in: ["DEAD_LETTER", "RETRYING"] } },
      {
        $set: {
          status: "PENDING",
          nextRetryAt: now,
          attemptCount: 0,
          lastError: "Manual retry requested by admin",
        },
        $unset: {
          workerId: "",
          leaseExpiresAt: "",
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      res.status(409).json({ message: "Message could not be retried in its current state" });
      return;
    }

    res.status(200).json({
      message: "Message queued for retry",
      job: {
        id: updated._id.toString(),
        status: updated.status,
        attemptCount: updated.attemptCount,
        nextRetryAt: updated.nextRetryAt,
        idempotencyKey: updated.idempotencyKey,
      },
    });
  } catch (error) {
    logger.error("Retry WhatsApp message failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to retry WhatsApp message" });
  }
}

export async function listWhatsAppConsents(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const category = String(req.query.category ?? "TRANSACTIONAL").trim().toUpperCase();

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.phone = { $regex: search, $options: "i" };
    }
    if (status && ["GRANTED", "DENIED", "WITHDRAWN"].includes(status)) {
      if (category === "MARKETING") {
        filter.marketingStatus = status;
      } else {
        filter.status = status; // transactional (backward-compatible)
      }
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      WhatsAppConsent.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      WhatsAppConsent.countDocuments(filter),
    ]);

    res.status(200).json({
      consents: rows.map((c) => {
        const transactionalStatus = (c.status ?? "DENIED") as "GRANTED" | "DENIED" | "WITHDRAWN";
        const marketingStatus = ((c as any).marketingStatus ?? "DENIED") as "GRANTED" | "DENIED" | "WITHDRAWN";
        return {
          id: c._id.toString(),
          phone: c.phone,
          // Backward-compatible top-level fields represent TRANSACTIONAL consent.
          status: transactionalStatus,
          hasConsent: transactionalStatus === "GRANTED",
          source: c.source ?? null,
          consentTimestamp: c.consentTimestamp ?? null,
          optOutTimestamp: c.optOutTimestamp ?? null,
          withdrawalReason: c.withdrawalReason ?? null,
          updatedAt: c.updatedAt,
          transactional: {
            status: transactionalStatus,
            hasConsent: transactionalStatus === "GRANTED",
            source: c.source ?? null,
            consentTimestamp: c.consentTimestamp ?? null,
            optOutTimestamp: c.optOutTimestamp ?? null,
            withdrawalReason: c.withdrawalReason ?? null,
          },
          marketing: {
            status: marketingStatus,
            hasConsent: marketingStatus === "GRANTED",
            source: (c as any).marketingSource ?? null,
            consentTimestamp: (c as any).marketingConsentTimestamp ?? null,
            optOutTimestamp: (c as any).marketingOptOutTimestamp ?? null,
            withdrawalReason: (c as any).marketingWithdrawalReason ?? null,
          },
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("List WhatsApp consents failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to fetch WhatsApp consents" });
  }
}

export async function listNotificationPreferences(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const existing = await WhatsAppNotificationPreference.find().lean();
    const byEvent = new Map(existing.map((p) => [p.eventType, p]));

    const preferences = WHATSAPP_NOTIFICATION_EVENT_TYPES.map((eventType) => {
      const pref = byEvent.get(eventType);
      return {
        eventType,
        enabled: pref ? pref.enabled : true,
        updatedAt: pref?.updatedAt ?? null,
        updatedBy: pref?.updatedBy ?? null,
      };
    });

    res.status(200).json({ preferences });
  } catch (error) {
    logger.error("List WhatsApp notification preferences failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to fetch notification preferences" });
  }
}

const updatePreferenceSchema = z.object({
  eventType: z.enum(WHATSAPP_NOTIFICATION_EVENT_TYPES as unknown as [string, ...string[]]),
  enabled: z.boolean(),
});

export async function updateNotificationPreference(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const parsed = updatePreferenceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid preference update", errors: parsed.error.flatten() });
      return;
    }

    const { eventType, enabled } = parsed.data;
    const updatedBy = req.admin?.username ?? req.admin?.id ?? "admin";

    const pref = await WhatsAppNotificationPreference.findOneAndUpdate(
      { eventType } as Record<string, unknown>,
      { $set: { enabled, updatedBy } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean() as { eventType?: string; enabled?: boolean; updatedAt?: Date; updatedBy?: string } | null;

    if (!pref) {
      res.status(500).json({ message: "Unable to update notification preference" });
      return;
    }

    res.status(200).json({
      preference: {
        eventType: pref.eventType ?? eventType,
        enabled: pref.enabled ?? enabled,
        updatedAt: pref.updatedAt ?? null,
        updatedBy: pref.updatedBy ?? null,
      },
    });
  } catch (error) {
    logger.error("Update WhatsApp notification preference failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Unable to update notification preference" });
  }
}
