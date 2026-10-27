import mongoose, { Document, Schema } from "mongoose";

export type OrderStatus =
  | "PLACED"
  | "PAYMENT_CONFIRMED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COLLECTED"
  | "CANCELLED"
  | "RESCHEDULE_PROPOSED";

export type PaymentMethod = "COD" | "ONLINE" | "PAY_AT_STORE";

export type FulfillmentType = "DELIVERY" | "PICKUP";
export type InventoryStatus = "RESERVED" | "COMMITTED" | "RELEASED";

export type ProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export interface IProposedSlot {
  time: Date;
  note: string;
  proposedBy: mongoose.Types.ObjectId;
  proposedAt: Date;
  status: ProposalStatus;
  expiresAt: Date;
}

export interface ISlotHistoryEntry {
  from: Date;
  to: Date;
  reason: string;
  by: string;
  at: Date;
}

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  totalPrice: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId?: mongoose.Types.ObjectId;
  idempotencyKey: string;
  idempotencyHash: string;
  inventoryStatus?: InventoryStatus;
  reservationExpiresAt?: Date;
  reconciliationStatus?: "NONE" | "REVIEW_REQUIRED";
  reconciliationReason?: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  customerName: string;
  phone: string;
  fulfillmentType: FulfillmentType;
  address?: {
    addressLine: string;
    city: string;
    pincode: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  requestedSlot?: Date;
  confirmedSlot?: Date;
  proposedSlot?: IProposedSlot;
  slotHistory?: ISlotHistoryEntry[];
  reschedulePreviousStatus?: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  razorpayOrderId?: string;
  razorpayOrderIds?: string[];
  razorpayPaymentId?: string;
  razorpayPaymentIds?: string[];
  orderStatus: OrderStatus;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    variantId: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    itemTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    idempotencyHash: {
      type: String,
      select: false,
    },
    inventoryStatus: {
      type: String,
      enum: ["RESERVED", "COMMITTED", "RELEASED"],
    },
    reservationExpiresAt: {
      type: Date,
      index: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ["NONE", "REVIEW_REQUIRED"],
      default: "NONE",
    },
    reconciliationReason: {
      type: String,
      trim: true,
    },
    customer: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    fulfillmentType: {
      type: String,
      enum: ["DELIVERY", "PICKUP"],
      required: true,
    },

    address: {
      addressLine: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        trim: true,
      },
    },

    scheduledDate: {
      type: String,
      required: true,
      trim: true,
    },

    scheduledTime: {
      type: String,
      required: true,
      trim: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE", "PAY_AT_STORE"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayOrderIds: {
      type: [String],
      default: [],
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    razorpayPaymentIds: {
      type: [String],
      default: [],
    },

    paidAt: {
      type: Date,
    },

    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    orderStatus: {
      type: String,
      enum: [
        "PLACED",
        "PAYMENT_CONFIRMED",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COLLECTED",
        "CANCELLED",
        "RESCHEDULE_PROPOSED",
      ],
      default: "PLACED",
    },

    requestedSlot: {
      type: Date,
    },

    confirmedSlot: {
      type: Date,
    },

    proposedSlot: {
      time: { type: Date },
      note: { type: String, trim: true },
      proposedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
      proposedAt: { type: Date },
      status: {
        type: String,
        enum: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"],
      },
      expiresAt: { type: Date },
    },

    slotHistory: [
      {
        from: { type: Date },
        to: { type: Date },
        reason: { type: String, trim: true },
        by: { type: String, trim: true },
        at: { type: Date },
      },
    ],

    reschedulePreviousStatus: {
      type: String,
      enum: [
        "PLACED",
        "PAYMENT_CONFIRMED",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COLLECTED",
        "CANCELLED",
      ],
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);