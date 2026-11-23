import mongoose, { Schema } from "mongoose";

export type WhatsAppNotificationEventType =
  | "ORDER_PLACED"
  | "PAYMENT_CONFIRMED"
  | "STATUS_CHANGED"
  | "CANCELLED"
  | "RESCHEDULE_REQUESTED"
  | "RESCHEDULE_ACCEPTED"
  | "RESCHEDULE_REJECTED"
  | "PAYMENT_FAILED";

export const WHATSAPP_NOTIFICATION_EVENT_TYPES: WhatsAppNotificationEventType[] = [
  "ORDER_PLACED",
  "PAYMENT_CONFIRMED",
  "STATUS_CHANGED",
  "CANCELLED",
  "RESCHEDULE_REQUESTED",
  "RESCHEDULE_ACCEPTED",
  "RESCHEDULE_REJECTED",
  "PAYMENT_FAILED",
];

const whatsappNotificationPreferenceSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: WHATSAPP_NOTIFICATION_EVENT_TYPES,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

export const WhatsAppNotificationPreference = mongoose.model(
  "WhatsAppNotificationPreference",
  whatsappNotificationPreferenceSchema,
);
