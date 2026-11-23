import mongoose, { Schema } from "mongoose";

type NotificationStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "RETRYING"
  | "DEAD_LETTER"
  | "SKIPPED"
  | "RECONCILIATION_REQUIRED";

type NotificationChannel = "WHATSAPP" | "EMAIL";

export type { NotificationStatus, NotificationChannel };

/**
 * Durable notification outbox.
 *
 * Every customer notification is first persisted here before delivery.
 * This guarantees that order creation and status changes never fail because
 * WhatsApp (or email) is unavailable, and that no notification is lost across
 * server restarts or concurrent worker instances.
 *
 * Fields:
 *   idempotencyKey   - Unique key per business event (prevents duplicate enqueue)
 *   channel          - WHATSAPP or EMAIL
 *   status           - PENDING / PROCESSING / SENT / RETRYING / DEAD_LETTER / SKIPPED / RECONCILIATION_REQUIRED
 *   recipient        - Normalised phone (WhatsApp) or email address
 *   templateName     - Approved template name (WhatsApp) or undefined (email)
 *   params           - Template body parameters (WhatsApp) or email payload
 *   eventType        - Business event that triggered this notification
 *   attemptCount     - Number of delivery attempts made
 *   maxAttempts      - Maximum attempts before dead-lettering
 *   nextRetryAt      - Earliest time the next attempt may run
 *   lastError        - Last error message (PII-safe; no secrets)
 *   metaMessageId    - Meta Cloud API message ID on successful send
 *   workerId         - ID of the worker instance currently processing the job
 *   leaseExpiresAt   - Expiration of the processing lease (crash recovery)
 *   orderNumber      - Associated order number, if identifiable
 *   referenceNumber  - Associated custom cake reference number, if identifiable
 *
 * Indexes:
 *   idempotencyKey (unique)  - One record per business event
 *   status + nextRetryAt     - Worker claim query (pending jobs due for retry)
 *   status + leaseExpiresAt  - Expired lease recovery
 *
 * No migration is run by defining this model; collections are created on
 * first write only.
 */
const notificationOutboxSchema = new Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["WHATSAPP", "EMAIL"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SENT", "RETRYING", "DEAD_LETTER", "SKIPPED", "RECONCILIATION_REQUIRED"],
      required: true,
      default: "PENDING",
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    templateName: {
      type: String,
      trim: true,
    },
    params: {
      type: [String],
      default: [],
    },
    eventType: {
      type: String,
      trim: true,
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      required: true,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      required: true,
    },
    nextRetryAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastError: {
      type: String,
      trim: true,
    },
    metaMessageId: {
      type: String,
      trim: true,
      // Sparse lookup index added below for exact provider callback correlation.
    },
    providerAcceptedAt: {
      type: Date,
    },
    reconciliationCode: {
      type: String,
      trim: true,
    },
    reconciliationReason: {
      type: String,
      trim: true,
    },
    reconciliationDetectedAt: {
      type: Date,
    },
    providerDeliveryStatus: {
      type: String,
      enum: ["SENT", "DELIVERED", "READ", "FAILED"],
      trim: true,
    },
    providerSentAt: {
      type: Date,
    },
    providerDeliveredAt: {
      type: Date,
    },
    providerReadAt: {
      type: Date,
    },
    providerFailedAt: {
      type: Date,
    },
    providerErrorCode: {
      type: String,
      trim: true,
    },
    providerErrorMessage: {
      type: String,
      trim: true,
    },
    workerId: {
      type: String,
      trim: true,
    },
    leaseExpiresAt: {
      type: Date,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index for worker claim: pending jobs whose retry time has arrived.
notificationOutboxSchema.index(
  { status: 1, nextRetryAt: 1 },
  { name: "status_nextRetryAt_idx" },
);

// Compound index for expired lease recovery.
notificationOutboxSchema.index(
  { status: 1, leaseExpiresAt: 1 },
  { name: "status_leaseExpiresAt_idx" },
);

// Sparse lookup index for exact provider callback correlation by Meta message ID.
// Not unique: existing/legacy data patterns and missing-provider-ID cases make a
// blind uniqueness constraint unsafe without migration/audit; app logic enforces
// exact-ID matching and idempotent progression.
notificationOutboxSchema.index(
  { metaMessageId: 1 },
  { name: "metaMessageId_sparse_idx", sparse: true },
);

export const NotificationOutbox = mongoose.model(
  "NotificationOutbox",
  notificationOutboxSchema,
);
