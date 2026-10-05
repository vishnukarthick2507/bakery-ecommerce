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
      enum: ["PENDING", "CONTACTED", "CLOSED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const CustomCakeRequest = mongoose.model(
  "CustomCakeRequest",
  customCakeRequestSchema
);
