import mongoose, { Schema } from "mongoose";

interface IPendingRegistration extends mongoose.Document {
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  expiresAt: Date;
}

const pendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: auto-delete after 10 minutes
    },
  },
  { timestamps: false },
);

export const PendingRegistration = mongoose.model<IPendingRegistration>(
  "PendingRegistration",
  pendingRegistrationSchema,
);
