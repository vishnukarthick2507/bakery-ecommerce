import mongoose, { Schema } from "mongoose";

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value > 0,
        message: "Price must be greater than 0",
      },
    },

    category: {
      type: String,
      required: true,
    },

    images: {
      type: [String],
      default: [],
    },

    stock: {
      type: Number,
      min: 0,
      default: 0,
    },

    availability: {
      type: String,
      enum: ["AVAILABLE", "OUT_OF_STOCK", "DISABLED"],
      default: "AVAILABLE",
    },

    preparationTime: {
      type: Number,
      required: true,
      min: 0,
    },

    active: {
      type: Boolean,
      default: true,
    },

    // Optional cost basis for profitability reporting (Phase 1 data foundation).
    // Optional so existing products remain backward-compatible.
    cost: {
      type: Number,
      min: 0,
    },

    reorderLevel: {
      type: Number,
      min: 0,
    },

    leadTimeDays: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: { active: 1 } },
      { fields: { category: 1 } },
    ],
  }
);

export const Product = mongoose.model("Product", productSchema);