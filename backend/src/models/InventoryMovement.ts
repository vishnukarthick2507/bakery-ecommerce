import mongoose, { Schema, Document, Model } from "mongoose";

export type InventoryMovementReason =
  | "ORDER_RESERVATION"
  | "ORDER_RESTORE"
  | "ORDER_COMMIT"
  | "MANUAL_ADJUSTMENT"
  | "RESTOCK"
  | "EXPIRY_RELEASE";

export interface IInventoryMovement extends Document {
  productId: mongoose.Types.ObjectId;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: InventoryMovementReason;
  adjustmentReason?: string;
  relatedOrderId?: mongoose.Types.ObjectId;
  relatedUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    quantityChange: {
      type: Number,
      required: true,
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },

    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: [
        "ORDER_RESERVATION",
        "ORDER_RESTORE",
        "ORDER_COMMIT",
        "MANUAL_ADJUSTMENT",
        "RESTOCK",
        "EXPIRY_RELEASE",
      ],
      required: true,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    relatedOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },

    relatedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index for querying movements by product and time range.
inventoryMovementSchema.index({ productId: 1, createdAt: -1 });

export const InventoryMovement = mongoose.model<
  IInventoryMovement,
  Model<IInventoryMovement>
>("InventoryMovement", inventoryMovementSchema);
