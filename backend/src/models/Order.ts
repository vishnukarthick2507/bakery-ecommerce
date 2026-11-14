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

export type ProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "ALTERNATIVE_REQUESTED";

export type ExpiryNotificationStatus = "PENDING" | "SENT" | "FAILED";

export interface IRescheduleProposal {
  proposalId: string;
  previousConfirmedSlot?: Date;
  proposedSlot: Date;
  reason: string;
  proposedBy: mongoose.Types.ObjectId;
  proposedAt: Date;
  status: ProposalStatus;
  expiresAt: Date;
  customerResponse?: "ACCEPTED" | "DECLINED" | "REQUESTED_ALTERNATIVE";
  customerResponseAt?: Date;
  customerAlternativeSlot?: Date;
  customerAlternativeNote?: string;
  expiryNotificationStatus?: ExpiryNotificationStatus;
  expiryNotificationAttempts?: number;
  expiryNotificationNextRetryAt?: Date | null;
  expiryNotificationSentAt?: Date | null;
  expiryNotificationLastError?: string | null;
}

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
  // Cost snapshot captured at order creation time for profitability reporting.
  // Optional so existing orders remain backward-compatible.
  costSnapshot?: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId?: mongoose.Types.ObjectId;
  idempotencyKey: string;
  idempotencyHash: string;
  inventoryStatus?: InventoryStatus;
  reservationExpiresAt?: Date | undefined;
  reconciliationStatus?: "NONE" | "REVIEW_REQUIRED";
  reconciliationReason?: string | undefined;
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
  rescheduleProposals: IRescheduleProposal[];
  slotHistory?: ISlotHistoryEntry[];
  reschedulePreviousStatus?: OrderStatus | undefined;
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
  razorpaySettlementId?: string;
  razorpayFee?: number;
  taxAmount?: number;
  readyAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  acquisitionSource?: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
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

    // Cost snapshot captured at order creation time.
    costSnapshot: {
      type: Number,
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
            enum: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "ALTERNATIVE_REQUESTED"],
      },
      expiresAt: { type: Date },
    },

    rescheduleProposals: {
      type: [
        {
          proposalId: { type: String },
          previousConfirmedSlot: { type: Date },
          proposedSlot: { type: Date },
          reason: { type: String, trim: true },
          proposedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
          proposedAt: { type: Date },
          status: {
            type: String,
            enum: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "ALTERNATIVE_REQUESTED"],
          },
          expiresAt: { type: Date },
          customerResponse: {
            type: String,
            enum: ["ACCEPTED", "DECLINED", "REQUESTED_ALTERNATIVE"],
          },
          customerResponseAt: { type: Date },
          customerAlternativeSlot: { type: Date },
          customerAlternativeNote: { type: String, trim: true, maxlength: 500 },
          expiryNotificationStatus: {
            type: String,
            enum: ["PENDING", "SENT", "FAILED"],
          },
          expiryNotificationAttempts: {
            type: Number,
            default: 0,
          },
          expiryNotificationNextRetryAt: {
            type: Date,
          },
          expiryNotificationSentAt: {
            type: Date,
          },
          expiryNotificationLastError: {
            type: String,
            trim: true,
          },
        },
      ],
      default: [],
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

    // Financial fields for reconciliation and profitability (Phase 1 data foundation).
    // All optional so existing orders remain backward-compatible.
    razorpaySettlementId: {
      type: String,
      trim: true,
    },

    razorpayFee: {
      type: Number,
      min: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
    },

    // Order lifecycle timestamps for fulfilment SLA reporting.
    readyAt: {
      type: Date,
    },

    dispatchedAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },

    // Customer acquisition source attribution (optional, for marketing analytics).
    acquisitionSource: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Archive (soft delete) fields for order lifecycle management.
    // Archived orders are hidden from admin operational lists but remain
    // visible to customers and guests. Archiving never deletes the record
    // or modifies payment, inventory, or financial data.
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ phone: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderStatus: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);