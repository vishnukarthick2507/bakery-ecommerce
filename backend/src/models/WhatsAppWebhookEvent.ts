import mongoose, { Schema } from "mongoose";

/**
 * Idempotency ledger for inbound WhatsApp webhook events.
 *
 * Meta may deliver the same webhook event more than once (e.g. retries after
 * a transient 2xx delay). Each event is recorded here with its Meta-provided
 * entry ID so duplicate deliveries are detected and ignored.
 *
 * Fields:
 *   eventId        - Unique Meta webhook entry/message ID
 *   eventType      - "message" | "status" | "other"
 *   processed      - Whether the event has been fully processed
 *   processedAt    - When processing completed
 *   phone          - Customer phone number extracted from the event, if any
 *   command        - Recognised inbound command (TRACK / HELP / STOP), if any
 *   createdAt      - When the record was first created
 *
 * Indexes:
 *   eventId (unique)  - One record per webhook event; prevents duplicate processing
 *
 * No migration is run by defining this model; collections are created on
 * first write only.
 */
const whatsappWebhookEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      trim: true,
      // "message", "status", or "other"
    },
    processed: {
      type: Boolean,
      default: false,
      required: true,
    },
    processedAt: {
      type: Date,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
    },
    command: {
      type: String,
      trim: true,
      // "TRACK", "HELP", "STOP", or undefined
    },
  },
  { timestamps: true },
);

export const WhatsAppWebhookEvent = mongoose.model(
  "WhatsAppWebhookEvent",
  whatsappWebhookEventSchema,
);
