import mongoose, { Schema } from "mongoose";

interface IOtpSendCooldown {
  _id: string;
  claimId: string;
  expiresAt: Date;
}

const otpSendCooldownSchema = new Schema<IOtpSendCooldown>(
  {
    _id: {
      type: String,
      required: true,
    },
    claimId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: false },
);

export const OtpSendCooldown = mongoose.model<IOtpSendCooldown>(
  "OtpSendCooldown",
  otpSendCooldownSchema,
);
