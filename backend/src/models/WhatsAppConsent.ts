import mongoose, { Schema } from "mongoose";

export type WhatsAppConsentStatus = "GRANTED" | "DENIED" | "WITHDRAWN";
export type WhatsAppConsentCategory = "TRANSACTIONAL" | "MARKETING";

export type ConsentHistoryEntry = {
  category: WhatsAppConsentCategory;
  action: "GRANT" | "WITHDRAW" | "DENY";
  reason?: string;
  source?: string;
  occurredAt: Date;
};

/**
 * Records a customer's WhatsApp communication consent.
 *
 * Phase A (additive): supports separate TRANSACTIONAL and MARKETING consent
 * categories with independent status/timestamps/history while preserving existing
 * transactional fields and behavior for backward compatibility.
 *
 * Backward-compatibility rules:
 * - `status`, `consentTimestamp`, `optOutTimestamp`, `withdrawalReason`, and
 *   `withdrawalHistory` continue to represent TRANSACTIONAL consent semantics.
 * - Existing transactional consent never implies marketing consent.
 * - Marketing consent is explicit and tracked independently.
 */
const historyEntrySchema = new Schema(
  {
    category: {
      type: String,
      enum: ["TRANSACTIONAL", "MARKETING"],
      required: true,
    },
    action: {
      type: String,
      enum: ["GRANT", "WITHDRAW", "DENY"],
      required: true,
    },
    reason: { type: String, trim: true },
    source: { type: String, trim: true },
    occurredAt: { type: Date, required: true },
  },
  { _id: false },
);

const withdrawalHistorySchema = new Schema(
  {
    reason: { type: String, trim: true },
    withdrawnAt: { type: Date, required: true },
    source: { type: String, trim: true },
  },
  { _id: false },
);

const whatsappConsentSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    // TRANSACTIONAL (legacy/backward-compatible fields)
    status: {
      type: String,
      enum: ["GRANTED", "DENIED", "WITHDRAWN"],
      default: "GRANTED",
      required: true,
    },
    source: {
      type: String,
      trim: true,
    },
    consentText: {
      type: String,
      trim: true,
    },
    consentTimestamp: {
      type: Date,
    },
    optOutTimestamp: {
      type: Date,
    },
    withdrawalReason: {
      type: String,
      trim: true,
    },
    withdrawalHistory: {
      type: [withdrawalHistorySchema],
      default: [],
    },
    // MARKETING (independent, explicit opt-in required)
    marketingStatus: {
      type: String,
      enum: ["GRANTED", "DENIED", "WITHDRAWN"],
      default: "DENIED",
      required: true,
    },
    marketingSource: {
      type: String,
      trim: true,
    },
    marketingConsentText: {
      type: String,
      trim: true,
    },
    marketingConsentTimestamp: {
      type: Date,
    },
    marketingOptOutTimestamp: {
      type: Date,
    },
    marketingWithdrawalReason: {
      type: String,
      trim: true,
    },
    marketingWithdrawalHistory: {
      type: [withdrawalHistorySchema],
      default: [],
    },
    // Unified auditable history across categories (additive)
    consentHistory: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const WhatsAppConsent = mongoose.model(
  "WhatsAppConsent",
  whatsappConsentSchema,
);
