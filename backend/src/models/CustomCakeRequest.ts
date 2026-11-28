import mongoose, { Schema } from "mongoose";

const customCakeRequestSchema = new Schema(
  {
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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

    // Account ownership for authenticated customer requests; absent on legacy guest requests.
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    flavour: {
      type: String,
      required: true,
      trim: true,
    },

    weight: {
      type: String,
      required: true,
      trim: true,
    },

    theme: {
      type: String,
      required: true,
      trim: true,
    },

    messageOnCake: {
      type: String,
      trim: true,
      default: "",
    },

    instructions: {
      type: String,
      trim: true,
      default: "",
    },

    referenceImageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["PENDING", "CONTACTED", "CONFIRMED", "CLOSED"],
      default: "PENDING",
    },

    // Admin proposal fields — set when the admin responds to a request
    proposedPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    proposedDeliveryDate: {
      type: String,
      trim: true,
      default: null,
    },

    proposedDeliveryTime: {
      type: String,
      trim: true,
      default: null,
    },

    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    // Customer response fields — set when the customer responds to a proposal
    customerConfirmed: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "DECLINED"],
      default: "PENDING",
    },

    customerConfirmedAt: {
      type: Date,
      default: null,
    },

    adminContactedAt: {
      type: Date,
      default: null,
    },

    // Conversion linkage — set atomically when an admin converts an accepted
    // proposal into an Order. Used with convertedAt for idempotent/concurrent safety.
    convertedOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    convertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const CustomCakeRequest = mongoose.model(
  "CustomCakeRequest",
  customCakeRequestSchema
);
