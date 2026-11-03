import mongoose, { Schema } from "mongoose";

interface ICustomerOtpProof extends mongoose.Document {
  proofId: string;
  phone: string;
  expiresAt: Date;
}

const customerOtpProofSchema = new Schema<ICustomerOtpProof>(
  {
    proofId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: false },
);

export const CustomerOtpProof = mongoose.model<ICustomerOtpProof>(
  "CustomerOtpProof",
  customerOtpProofSchema,
);
