import mongoose, { Schema } from "mongoose";

export type CustomCakeSubmissionIdempotencyStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

const customCakeSubmissionIdempotencySchema = new Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    requestFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "FAILED"],
      required: true,
      default: "IN_PROGRESS",
      index: true,
    },
    responseStatus: {
      type: Number,
    },
    responseBody: {
      type: Schema.Types.Mixed,
    },
    createdRequestId: {
      type: Schema.Types.ObjectId,
      ref: "CustomCakeRequest",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

export const CustomCakeSubmissionIdempotency = mongoose.model(
  "CustomCakeSubmissionIdempotency",
  customCakeSubmissionIdempotencySchema,
);
