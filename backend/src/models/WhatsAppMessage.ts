import mongoose, { Schema } from "mongoose";

type WhatsAppMessageDirection = "INBOUND" | "OUTBOUND";
type WhatsAppMessageStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "RECEIVED";

/**
 * Log of WhatsApp messages exchanged with customers.
 *
 * Records both outbound template notifications (sent via the Meta Cloud API)
 * and inbound webhook messages (customer replies, TRACK/HELP/STOP commands).
 *
 * Fields:
 *   direction        - INBOUND (customer -> bakery) or OUTBOUND (bakery -> customer)
 *   phone            - Normalised phone number (WhatsApp international format)
 *   messageId        - Meta message ID (unique per message)
 *   templateName     - Approved template name for outbound messages, if any
 *   status           - Message lifecycle status
 *   errorCode        - Meta error code for failed messages, if any
 *   errorMessage     - Human-readable error description, if any
 *   bodyText         - Redacted message body text (PII-safe; secrets never stored)
 *   orderNumber      - Associated order number, if identifiable
 *   referenceNumber  - Associated custom cake reference number, if identifiable
 *   metaPayload      - Redacted raw Meta webhook payload (secrets stripped)
 *
 * Indexes:
 *   messageId (unique)  - One record per Meta message ID
 *   phone + createdAt   - Query message history per customer
 *
 * No migration is run by defining this model; collections are created on
 * first write only.
 */
const whatsappMessageSchema = new Schema(
  {
    direction: {
      type: String,
      enum: ["INBOUND", "OUTBOUND"],
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    templateName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "SENT",
        "DELIVERED",
        "READ",
        "FAILED",
        "RECEIVED",
      ],
      required: true,
    },
    errorCode: {
      type: String,
      trim: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    bodyText: {
      type: String,
      trim: true,
      // Redacted message body; never contains access tokens or app secrets.
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
    metaPayload: {
      type: Schema.Types.Mixed,
      // Redacted raw Meta webhook payload; secrets stripped before storage.
    },
  },
  { timestamps: true },
);

export const WhatsAppMessage = mongoose.model(
  "WhatsAppMessage",
  whatsappMessageSchema,
);
