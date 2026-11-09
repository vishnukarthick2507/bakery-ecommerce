import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomerMetrics extends Document {
  userId: mongoose.Types.ObjectId;
  orderCount: number;
  paidOrderCount: number;
  totalPaid: number;
  averageOrderValue: number;
  firstOrderAt?: Date;
  lastOrderAt?: Date;
  segment: "NEW" | "RETURNING" | "VIP" | "AT_RISK";
  updatedAt: Date;
}

const customerMetricsSchema = new Schema<ICustomerMetrics>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    orderCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidOrderCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    firstOrderAt: {
      type: Date,
    },

    lastOrderAt: {
      type: Date,
    },

    segment: {
      type: String,
      enum: ["NEW", "RETURNING", "VIP", "AT_RISK"],
      default: "NEW",
    },
  },
  { timestamps: true },
);

export const CustomerMetrics = mongoose.model<
  ICustomerMetrics,
  Model<ICustomerMetrics>
>("CustomerMetrics", customerMetricsSchema);

/*
|--------------------------------------------------------------------------
| CUSTOMER METRICS — DERIVED COLLECTION
|--------------------------------------------------------------------------
| CustomerMetrics is a derived, denormalized collection built from
| trustworthy order records. It is NOT the source of truth for customer
| data — the User collection is. Metrics here are recalculated on demand
| or via a scheduled job; they are not updated inline on every order
| to avoid duplicate-update inaccuracies.
|
| Guest checkouts (orders without userId) do not produce CustomerMetrics
| records, preserving existing guest checkout behavior.
|--------------------------------------------------------------------------
*/
