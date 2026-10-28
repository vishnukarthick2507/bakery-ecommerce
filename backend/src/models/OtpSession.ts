import mongoose, { Schema } from "mongoose";

const otpSessionSchema = new Schema(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpSalt: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["LOGIN", "REGISTER"],
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: auto-delete when expiresAt is reached
    },
  },
  {
    timestamps: true,
  }
);

export const OtpSession = mongoose.model("OtpSession", otpSessionSchema);
