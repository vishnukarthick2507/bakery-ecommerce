/*
|--------------------------------------------------------------------------
| NOTIFICATION OUTBOX SERVICE
|--------------------------------------------------------------------------
| Durable, restart-safe notification processing.
|
| Every customer notification is enqueued to the outbox before delivery.
*   Workers atomically claim pending jobs, process them with leases, and
|   recover expired leases after crashes. Failed deliveries are retried with
|   exponential backoff; exhausted jobs are dead-lettered.
|
| Multiple backend instances can run workers concurrently without processing
| the same job twice, thanks to MongoDB's atomic find-and-update.
*/

import {
  NotificationOutbox,
  type NotificationStatus,
  type NotificationChannel,
} from "../models/NotificationOutbox.js";
import { WhatsAppConsent } from "../models/WhatsAppConsent.js";
import { hasValidTransactionalConsent } from "./whatsappConsentService.js";
import {
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
} from "./whatsappService.js";
import { validateTemplateForSend } from "./whatsappTemplateRegistry.js";
import { sendCustomerOrderEmailOnce, emitEmailSuppressionDiagnostic } from "./emailService.js";
import { logger } from "../lib/logger.js";
import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "./uatSafetyLog.js";
import { isExternalEmailDeliveryBlocked } from "../config/emailDeliverySafety.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 5_000; // 5 seconds
const MAX_BACKOFF_MS = 4 * 60 * 60 * 1000; // 4 hours
const LEASE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type OutboxJob = {
  _id: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  templateName: string | undefined;
  params: string[];
  eventType: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError: string | undefined;
  metaMessageId: string | undefined;
  workerId: string | undefined;
  leaseExpiresAt: Date | undefined;
  orderNumber: string | undefined;
  referenceNumber: string | undefined;
};

/**
 * Generates exponential backoff delay in milliseconds.
 */
function computeBackoffMs(attemptCount: number): number {
  const backoff = Math.min(INITIAL_BACKOFF_MS * 2 ** attemptCount, MAX_BACKOFF_MS);
  // Add jitter to prevent thundering herd.
  const jitter = Math.floor(Math.random() * backoff * 0.2);
  return backoff + jitter;
}

/**
 * Enqueues a notification to the outbox with persistent idempotency.
 *
 * The same business event (same idempotencyKey) is never enqueued twice,
 * even across server restarts or concurrent enqueue requests. Returns the
 * existing document if a duplicate is detected.
 *
 * Never throws: enqueue failures are logged and the caller continues.
 */
export async function enqueueNotification(input: {
  idempotencyKey: string;
  channel: NotificationChannel;
  recipient: string;
  templateName?: string;
  params?: string[];
  eventType: string;
  maxAttempts?: number;
  nextRetryAt?: Date;
  orderNumber?: string;
  referenceNumber?: string;
}): Promise<{ enqueued: boolean; duplicate: boolean }> {
  const {
    idempotencyKey,
    channel,
    recipient,
    templateName,
    params = [],
    eventType,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    orderNumber,
    referenceNumber,
  } = input;

  try {
    const now = new Date();
    const existing = await NotificationOutbox.findOne({ idempotencyKey }).lean();

    if (existing) {
      return { enqueued: false, duplicate: true };
    }

    const outboxData: Record<string, unknown> = {
      idempotencyKey,
      channel,
      status: "PENDING",
      recipient,
      params,
      eventType,
      attemptCount: 0,
      maxAttempts,
      nextRetryAt: input.nextRetryAt ?? now,
      orderNumber,
      referenceNumber,
    };

    if (templateName !== undefined) {
      outboxData.templateName = templateName;
    }

    await NotificationOutbox.create(outboxData);

    return { enqueued: true, duplicate: false };
  } catch (error) {
    logger.error("Enqueue notification failed", {
      idempotencyKey,
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
    return { enqueued: false, duplicate: false };
  }
}

/**
 * Atomically claims the next pending outbox job whose retry time has
 * arrived. Uses findOneAndUpdate so only one worker instance can claim
 * each job. Sets a lease that expires after LEASE_TTL_MS.
 *
 * Returns null if no job is available.
 */
export async function claimJob(workerId: string): Promise<OutboxJob | null> {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS);

  const job = await NotificationOutbox.findOneAndUpdate(
    {
      status: { $in: ["PENDING", "RETRYING"] },
      nextRetryAt: { $lte: now },
    },
    {
      $set: {
        status: "PROCESSING",
        workerId,
        leaseExpiresAt,
      },
      $inc: { attemptCount: 1 },
    },
    {
      returnDocument: "after",
      sort: { nextRetryAt: 1, createdAt: 1 },
    },
  ).lean();

  if (!job) return null;

  return {
    _id: job._id.toString(),
    idempotencyKey: job.idempotencyKey,
    channel: job.channel as NotificationChannel,
    status: job.status as NotificationStatus,
    recipient: job.recipient,
    templateName: (job.templateName ?? undefined) as string | undefined,
    params: job.params ?? [],
    eventType: job.eventType,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    nextRetryAt: job.nextRetryAt,
    lastError: (job.lastError ?? undefined) as string | undefined,
    metaMessageId: (job.metaMessageId ?? undefined) as string | undefined,
    workerId: (job.workerId ?? undefined) as string | undefined,
    leaseExpiresAt: (job.leaseExpiresAt ?? undefined) as Date | undefined,
    orderNumber: (job.orderNumber ?? undefined) as string | undefined,
    referenceNumber: (job.referenceNumber ?? undefined) as string | undefined,
  };
}

/**
 * Marks a claimed job as SENT (delivered successfully).
 * Enforces worker ownership so a reclaimed lease cannot be completed by a stale worker.
 */
export async function markSent(
  jobId: string,
  workerId: string,
  metaMessageId?: string,
): Promise<boolean> {
  const update: Record<string, unknown> = {
    $set: {
      status: "SENT",
      ...(metaMessageId ? { metaMessageId } : {}),
    },
    $unset: {
      workerId: "",
      leaseExpiresAt: "",
    },
  };

  const result = await NotificationOutbox.updateOne(
    { _id: jobId, status: "PROCESSING", workerId },
    update,
  );
  return (result.modifiedCount ?? 0) === 1;
}

/**
 * Marks a provider-accepted WhatsApp job as RECONCILIATION_REQUIRED when local SENT persistence fails.
 * This state is terminal for automatic processing: it must never be claimed, retried, or lease-recovered.
 * Enforces worker ownership to avoid mutating a reclaimed lease.
 */
export async function markReconciliationRequired(
  jobId: string,
  workerId: string,
  input: {
    reconciliationCode: string;
    reconciliationReason: string;
    providerAcceptedAt: Date;
    metaMessageId?: string;
  },
): Promise<boolean> {
  const now = new Date();
  const result = await NotificationOutbox.updateOne(
    { _id: jobId, status: "PROCESSING", workerId },
    {
      $set: {
        status: "RECONCILIATION_REQUIRED",
        reconciliationCode: input.reconciliationCode,
        reconciliationReason: input.reconciliationReason,
        providerAcceptedAt: input.providerAcceptedAt,
        reconciliationDetectedAt: now,
        lastError: `[${input.reconciliationCode}] ${input.reconciliationReason}`,
        ...(input.metaMessageId ? { metaMessageId: input.metaMessageId } : {}),
      },
      $unset: {
        workerId: "",
        leaseExpiresAt: "",
      },
    },
  );
  return (result.modifiedCount ?? 0) === 1;
}

/**
 * Marks a claimed job as SKIPPED when delivery must not be attempted
 * (e.g. missing, denied, or withdrawn WhatsApp consent).
 */
export async function markSkipped(
  jobId: string,
  workerId: string,
  reason: string,
): Promise<boolean> {
  const result = await NotificationOutbox.updateOne(
    { _id: jobId, status: "PROCESSING", workerId },
    {
      $set: {
        status: "SKIPPED",
        lastError: reason,
      },
      $unset: {
        workerId: "",
        leaseExpiresAt: "",
      },
    },
  );
  return (result.modifiedCount ?? 0) === 1;
}

/**
 * Marks a job as RETRYING with exponential backoff, or DEAD_LETTER if
 * maxAttempts is exhausted or the failure is permanent/non-retriable.
 * Enforces worker ownership so a reclaimed lease cannot be mutated by a stale worker.
 */
export async function markFailed(
  jobId: string,
  workerId: string,
  errorMessage: string,
  options?: { permanent?: boolean },
): Promise<"retried" | "dead_letter" | "stale"> {
  const job = await NotificationOutbox.findOne({ _id: jobId, status: "PROCESSING", workerId }).lean();

  if (!job) return "stale";

  const attemptsMade = job.attemptCount;
  const isExhausted = attemptsMade >= job.maxAttempts;
  const permanent = options?.permanent === true;

  if (permanent || isExhausted) {
    const result = await NotificationOutbox.updateOne(
      { _id: jobId, status: "PROCESSING", workerId },
      {
        $set: {
          status: "DEAD_LETTER",
          lastError: errorMessage,
        },
        $unset: {
          workerId: "",
          leaseExpiresAt: "",
        },
      },
    );
    return (result.modifiedCount ?? 0) === 1 ? "dead_letter" : "stale";
  }

  const result = await NotificationOutbox.updateOne(
    { _id: jobId, status: "PROCESSING", workerId },
    {
      $set: {
        status: "RETRYING",
        nextRetryAt: new Date(Date.now() + computeBackoffMs(attemptsMade)),
        lastError: errorMessage,
      },
      $unset: {
        workerId: "",
        leaseExpiresAt: "",
      },
    },
  );
  return (result.modifiedCount ?? 0) === 1 ? "retried" : "stale";
}

/**
 * Releases a claimed job suppressed by UAT_SAFE_MODE without consuming retry
 * attempts and without marking it delivered. The job remains retryable for a
 * future non-UAT run.
 */
export async function releaseSuppressedJob(
  jobId: string,
  workerId: string,
  reason: string,
): Promise<boolean> {
  const result = await NotificationOutbox.updateOne(
    { _id: jobId, status: "PROCESSING", workerId },
    {
      $set: {
        status: "PENDING",
        lastError: reason,
        nextRetryAt: new Date(Date.now() + 60_000),
      },
      $inc: { attemptCount: -1 },
      $unset: {
        workerId: "",
        leaseExpiresAt: "",
      },
    },
  );
  return (result.modifiedCount ?? 0) === 1;
}

/**
 * Recovers jobs whose processing lease has expired (worker crashed).
 * Resets them to PENDING so they can be claimed again.
 */
export async function recoverExpiredLeases(): Promise<number> {
  const now = new Date();
  const result = await NotificationOutbox.updateMany(
    {
      status: "PROCESSING",
      leaseExpiresAt: { $lt: now },
    },
    {
      $set: {
        status: "PENDING",
      },
      $unset: {
        workerId: "",
        leaseExpiresAt: "",
      },
    },
  );

  const recovered = result.modifiedCount ?? 0;
  if (recovered > 0) {
    logger.info("Recovered expired outbox leases", { count: recovered });
  }

  return recovered;
}

const STATUS_CHANGED_TEMPLATE_TO_INTERNAL_EVENT: Record<string, string> = {
  order_confirmed: "STATUS_CHANGED_CONFIRMED",
  order_preparing: "STATUS_CHANGED_PREPARING",
  order_ready: "STATUS_CHANGED_READY",
  order_out_for_delivery: "STATUS_CHANGED_OUT_FOR_DELIVERY",
  order_completed: "STATUS_CHANGED_COMPLETED",
  // D20-08 placeholder: disabled/NOT_SUBMITTED in registry; D20-08-E wording NOT DECIDED.
  order_reschedule_proposed: "STATUS_CHANGED_RESCHEDULE_PROPOSED",
};

const DIRECT_EVENT_TYPE_TO_INTERNAL_EVENT: Record<string, string> = {
  ORDER_PLACED: "ORDER_PLACED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  CANCELLED: "CANCELLED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  RESCHEDULE_REQUESTED: "RESCHEDULE_REQUESTED",
  RESCHEDULE_ACCEPTED: "RESCHEDULE_ACCEPTED",
  RESCHEDULE_REJECTED: "RESCHEDULE_REJECTED",
  CUSTOM_CAKE_REQUEST_RECEIVED: "CUSTOM_CAKE_REQUEST_RECEIVED",
  CUSTOM_CAKE_QUOTE_PREPARED: "CUSTOM_CAKE_QUOTE_PREPARED",
  CUSTOM_CAKE_QUOTE_ACCEPTED: "CUSTOM_CAKE_QUOTE_ACCEPTED",
  CUSTOM_CAKE_QUOTE_DECLINED: "CUSTOM_CAKE_QUOTE_DECLINED",
  CUSTOM_CAKE_REQUEST_CLOSED: "CUSTOM_CAKE_REQUEST_CLOSED",
  CUSTOM_CAKE_CONVERTED_TO_ORDER: "CUSTOM_CAKE_CONVERTED_TO_ORDER",
};

function resolveWhatsAppInternalEventForValidation(
  job: Pick<OutboxJob, "eventType" | "templateName">,
):
  | { ok: true; internalEvent: string }
  | { ok: false; reason: "MISSING_EVENT" | "UNKNOWN_EVENT"; message: string } {
  const eventType = typeof job.eventType === "string" ? job.eventType.trim() : "";
  if (!eventType) {
    return { ok: false, reason: "MISSING_EVENT", message: "Outbox job is missing internal business event type" };
  }

  const direct = DIRECT_EVENT_TYPE_TO_INTERNAL_EVENT[eventType];
  if (direct) {
    return { ok: true, internalEvent: direct };
  }

  if (eventType === "STATUS_CHANGED") {
    const templateName = typeof job.templateName === "string" ? job.templateName.trim() : "";
    const internalEvent = templateName ? STATUS_CHANGED_TEMPLATE_TO_INTERNAL_EVENT[templateName] : undefined;
    if (internalEvent) {
      return { ok: true, internalEvent };
    }
    return {
      ok: false,
      reason: "UNKNOWN_EVENT",
      message: `Outbox job has unknown or unsupported STATUS_CHANGED template mapping (${templateName || "<missing template>"})`,
    };
  }

  return { ok: false, reason: "UNKNOWN_EVENT", message: `Outbox job has unknown internal business event type (${eventType})` };
}

/**
 * Processes a single outbox job: checks WhatsApp consent (for WhatsApp
 * channel), delivers via the appropriate channel, and marks sent/failed/skipped.
 *
 * Never throws: delivery failures are routed through markFailed.
 */
export async function processJob(job: OutboxJob): Promise<void> {
  const workerId = job.workerId;
  if (!workerId) {
    logger.error("Processed outbox job without workerId", { jobId: job._id });
    return;
  }

  // --- UAT_SAFE_MODE: block all external notification delivery centrally ---
  if (isUatExternalSideEffectsBlocked() && (job.channel === "WHATSAPP" || job.channel === "EMAIL")) {
    logUatSuppressed(`notification_outbox.${job.channel.toLowerCase()}`, {
      eventType: job.eventType,
      jobId: job._id,
    });
    const released = await releaseSuppressedJob(
      job._id,
      workerId,
      `Suppressed in UAT_SAFE_MODE: external ${job.channel} delivery blocked (not sent, retry not consumed).`,
    );
    if (!released) {
      logger.warn("Failed to release UAT-suppressed outbox job", { jobId: job._id, channel: job.channel });
    }
    return;
  }

  // --- WhatsApp consent/config/template enforcement (Phase A) ---
  if (job.channel === "WHATSAPP") {
    if (!isWhatsAppConfigured()) {
      // Permanent configuration error: do not retry indefinitely.
      await markFailed(
        job._id,
        workerId,
        "WhatsApp Cloud API is not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)",
        { permanent: true },
      );
      return;
    }

    // Transactional WhatsApp notifications require explicit TRANSACTIONAL consent.
    const hasTransactionalConsent = await hasValidTransactionalConsent(job.recipient);
    if (!hasTransactionalConsent) {
      await markSkipped(job._id, workerId, "Skipped: WhatsApp transactional consent absent, denied, or withdrawn");
      return;
    }
  }

  // --- Deliver ---
  let delivered = false;
  let errorMessage = "";

  try {
    if (job.channel === "WHATSAPP") {
      // Final transactional consent check immediately before send to prevent bypass during processing.
      const consentStillGranted = await hasValidTransactionalConsent(job.recipient);
      if (!consentStillGranted) {
        await markSkipped(job._id, workerId, "Skipped: WhatsApp transactional consent absent, denied, or withdrawn");
        return;
      }

      const internalEventResolution = resolveWhatsAppInternalEventForValidation(job);
      if (!internalEventResolution.ok) {
        await markFailed(
          job._id,
          workerId,
          `Template validation failed: ${internalEventResolution.reason} - ${internalEventResolution.message}`,
          { permanent: true },
        );
        return;
      }

      const templateValidation = validateTemplateForSend({
        internalEvent: internalEventResolution.internalEvent,
        templateName: job.templateName ?? "",
        params: job.params,
        expectedCategory: "TRANSACTIONAL",
      });
      if (!templateValidation.ok) {
        await markFailed(
          job._id,
          workerId,
          `Template validation failed: ${templateValidation.reason} - ${templateValidation.message}`,
          { permanent: true },
        );
        return;
      }

      const sendResult = await sendWhatsAppTemplate({
        to: job.recipient,
        templateName: templateValidation.definition.templateName,
        params: templateValidation.normalizedParams,
      });
      delivered = sendResult.accepted;

      if (delivered) {
        let markedSent = false;
        let markSentError: unknown;
        try {
          markedSent = await markSent(job._id, workerId, sendResult.providerMessageId);
        } catch (error) {
          markSentError = error;
          markedSent = false;
        }
        if (!markedSent) {
          // Provider accepted the message, but the outbox could not be durably transitioned to SENT
          // (e.g. stale/reclaimed lease or DB update failure). Do not report failure/retry and do not resend.
          const reconciliationCode = "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED";
          const reconciliationReason =
            "Provider accepted WhatsApp message but local SENT persistence failed; automatic resend suppressed pending reconciliation.";
          const providerAcceptedAt = new Date();
          let reconciliationHoldPersisted = false;
          try {
            reconciliationHoldPersisted = await markReconciliationRequired(job._id, workerId, {
              reconciliationCode,
              reconciliationReason,
              providerAcceptedAt,
              ...(sendResult.providerMessageId ? { metaMessageId: sendResult.providerMessageId } : {}),
            });
          } catch (holdError) {
            reconciliationHoldPersisted = false;
            logger.error("Failed to persist reconciliation hold after provider-accepted SENT persistence failure", {
              code: reconciliationCode,
              jobId: job._id,
              idempotencyKey: job.idempotencyKey,
              channel: job.channel,
              eventType: job.eventType,
              templateName: job.templateName,
              workerId,
              providerMessageIdPresent: Boolean(sendResult.providerMessageId),
              reconciliationRequired: true,
              reconciliationHoldPersisted: false,
              duplicateSendSuppressed: true,
              ...(markSentError ? { markSentPersistError: markSentError instanceof Error ? markSentError.message : String(markSentError) } : {}),
              holdPersistError: holdError instanceof Error ? holdError.message : String(holdError),
            });
          }

          logger.warn("WhatsApp provider accepted message but outbox SENT transition was not persisted", {
            code: reconciliationCode,
            jobId: job._id,
            idempotencyKey: job.idempotencyKey,
            channel: job.channel,
            eventType: job.eventType,
            templateName: job.templateName,
            workerId,
            providerMessageIdPresent: Boolean(sendResult.providerMessageId),
            reconciliationRequired: true,
            reconciliationHoldPersisted,
            duplicateSendSuppressed: true,
            ...(markSentError ? { markSentPersistError: markSentError instanceof Error ? markSentError.message : String(markSentError) } : {}),
          });

          if (!reconciliationHoldPersisted) {
            logger.error("Reconciliation hold was not persisted; manual reconciliation required before any resend decision", {
              code: reconciliationCode,
              jobId: job._id,
              idempotencyKey: job.idempotencyKey,
              channel: job.channel,
              eventType: job.eventType,
              templateName: job.templateName,
              workerId,
              providerMessageIdPresent: Boolean(sendResult.providerMessageId),
              reconciliationRequired: true,
              reconciliationHoldPersisted: false,
              duplicateSendSuppressed: true,
              ...(markSentError ? { markSentPersistError: markSentError instanceof Error ? markSentError.message : String(markSentError) } : {}),
            });
          }
          return;
        }
      } else {
        errorMessage = `Delivery failed: ${job.channel} API did not accept message`;
        await markFailed(job._id, workerId, errorMessage);
      }
    } else if (job.channel === "EMAIL") {
      if (isExternalEmailDeliveryBlocked()) {
        emitEmailSuppressionDiagnostic("notification_outbox_email");
        logUatSuppressed("notification_outbox.email_delivery_blocked", {
          eventType: job.eventType,
          jobId: job._id,
        });
        const released = await releaseSuppressedJob(
          job._id,
          workerId,
          "Suppressed: external email delivery blocked (EMAIL_EXTERNAL_DELIVERY_BLOCKED=true; not sent, retry not consumed).",
        );
        if (!released) {
          logger.warn("Failed to release email-suppressed outbox job", {
            jobId: job._id,
            channel: job.channel,
          });
        }
        return;
      }

      // Email delivery via existing Brevo service.
      // params: [recipient, customerName, orderNumber, event, status, details, eventId]
      const [
        recipient,
        customerName,
        orderNumber,
        event,
        status,
        details,
        eventId,
      ] = job.params;
      delivered = await sendCustomerOrderEmailOnce({
        recipient: recipient ?? job.recipient,
        customerName: customerName ?? "",
        orderNumber: orderNumber ?? "",
        event: (event ?? "ORDER_PLACED") as
          | "ORDER_PLACED"
          | "PAYMENT_CONFIRMED"
          | "STATUS_CHANGED"
          | "CANCELLED"
          | "RESCHEDULE_REQUESTED"
          | "RESCHEDULE_ACCEPTED"
          | "RESCHEDULE_REJECTED",
        status: status ?? "",
        details: details ?? "",
        eventId: eventId ?? job.idempotencyKey,
      });

      if (delivered) {
        await markSent(job._id, workerId);
      } else {
        errorMessage = `Delivery failed: ${job.channel} API did not accept message`;
        await markFailed(job._id, workerId, errorMessage);
      }
    }

    if (job.channel === "WHATSAPP") {
      // WhatsApp handling above is terminal for this attempt (including safe early-return on
      // provider-accepted but non-persisted SENT transition) to avoid duplicate sends.
      return;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : String(error);
    await markFailed(job._id, workerId, errorMessage);
  }

  logger.info("Processed outbox job", {
    jobId: job._id,
    channel: job.channel,
    status: delivered ? "SENT" : "FAILED",
    error: errorMessage,
  });
}

/**
 * Returns the count of jobs by status (for admin monitoring).
 */
export async function getOutboxStats(): Promise<Record<string, number>> {
  const stats = await NotificationOutbox.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const result: Record<string, number> = {};
  for (const entry of stats) {
    result[entry._id] = entry.count;
  }
  return result;
}
