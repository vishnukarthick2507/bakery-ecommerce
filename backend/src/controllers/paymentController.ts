import crypto from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { Order, type IOrder } from "../models/Order.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  InventoryUnavailableError,
  reserveInventory,
  restoreInventory,
} from "../services/inventory.js";
import { ONLINE_RESERVATION_TTL_MS } from "../services/inventoryExpiry.js";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayKeySecret,
} from "../services/razorpay.js";

/*
|--------------------------------------------------------------------------
| VALIDATION SCHEMAS
|--------------------------------------------------------------------------
| The browser only ever sends identifiers and the Razorpay signature.
| The payable amount is ALWAYS read from MongoDB — never from the request.
|--------------------------------------------------------------------------
*/

const createPaymentOrderSchema = z.object({
  orderNumber: z.string().trim().min(1),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    signatureBuffer,
  );
}

export async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        $or: [{ razorpayOrderId }, { razorpayOrderIds: razorpayOrderId }],
      }).session(session);
      if (!order) return;

      const capturedPaymentIds = order.razorpayPaymentIds ?? [];
      if (order.paymentStatus === "PAID") {
        if (
          order.razorpayPaymentId === razorpayPaymentId ||
          capturedPaymentIds.includes(razorpayPaymentId)
        ) {
          return;
        }

        order.razorpayPaymentIds = [...capturedPaymentIds, razorpayPaymentId];
        order.reconciliationStatus = "REVIEW_REQUIRED";
        order.reconciliationReason =
          "Multiple Razorpay payment IDs were captured for this order; verify the duplicate charge and arrange a refund manually.";
        await order.save({ session });
        return;
      }

      const supersededAttempt = Boolean(
        order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId,
      );

      order.paymentStatus = "PAID";
      order.razorpayPaymentId = razorpayPaymentId;
      order.razorpayPaymentIds = [...new Set([...capturedPaymentIds, razorpayPaymentId])];

      const inventoryUnavailable =
        order.inventoryStatus === "RELEASED" ||
        order.orderStatus === "CANCELLED" ||
        !order.inventoryStatus;

      if (inventoryUnavailable) {
        order.reconciliationStatus = "REVIEW_REQUIRED";
        order.reconciliationReason = supersededAttempt
          ? "A superseded Razorpay attempt was captured after inventory was released; review stock and arrange fulfillment or refund manually."
          : "Payment captured after inventory was released or could not be verified; review stock and arrange fulfillment or refund manually.";
      } else if (supersededAttempt) {
        order.reconciliationStatus = "REVIEW_REQUIRED";
        order.reconciliationReason =
          "A superseded Razorpay attempt was captured; verify duplicate payments and arrange a refund manually if needed.";
      }

      if (!inventoryUnavailable && order.inventoryStatus === "RESERVED") {
        order.inventoryStatus = "COMMITTED";
      }
      if (order.orderStatus === "PLACED" && order.inventoryStatus === "COMMITTED") {
        if (order.reconciliationStatus !== "REVIEW_REQUIRED") {
          order.orderStatus = "PAYMENT_CONFIRMED";
        }
      }
      order.reservationExpiresAt = undefined;
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

export async function markOrderPaymentFailed(
  razorpayOrderId: string,
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        $or: [{ razorpayOrderId }, { razorpayOrderIds: razorpayOrderId }],
        paymentStatus: "PENDING",
      }).session(session);
      if (!order) return;
      if (order.razorpayOrderId !== razorpayOrderId) return;

      if (order.inventoryStatus === "RESERVED") {
        await restoreInventory(session, order.items);
        order.inventoryStatus = "RELEASED";
      }
      order.reservationExpiresAt = undefined;
      order.paymentStatus = "FAILED";
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

async function markOrderPaymentFailedById(orderId: string): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        paymentStatus: "PENDING",
      }).session(session);
      if (!order) return;

      if (order.inventoryStatus === "RESERVED") {
        await restoreInventory(session, order.items);
        order.inventoryStatus = "RELEASED";
      }
      order.reservationExpiresAt = undefined;
      order.paymentStatus = "FAILED";
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

/*
|--------------------------------------------------------------------------
| SHARED RAZORPAY ATTEMPT
|--------------------------------------------------------------------------
| Creates a new Razorpay order attempt for an already-validated order.
| Re-reserves inventory if it was released (e.g. after a failed payment),
| resets payment state to PENDING, refreshes the reservation TTL, creates a
| Razorpay order, and records the attempt on the order.
*/

async function createRazorpayAttempt(
  order: IOrder,
): Promise<{
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string | null;
  orderNumber: string;
  totalAmount: number;
}> {
  // If inventory was released (e.g. after a failed payment), re-reserve it
  // and reset the payment state so a new Razorpay attempt can be made.
  if (
    order.inventoryStatus !== "RESERVED" &&
    order.inventoryStatus !== "COMMITTED"
  ) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const retryOrder = await Order.findById(order._id).session(session);
        if (!retryOrder || retryOrder.paymentStatus === "PAID") {
          throw new Error("Order payment state changed; refresh and try again");
        }
        if (retryOrder.inventoryStatus === "RELEASED") {
          await reserveInventory(session, retryOrder.items);
          retryOrder.inventoryStatus = "RESERVED";
          retryOrder.reconciliationStatus = "NONE";
          retryOrder.reconciliationReason = undefined;
        }
        retryOrder.paymentStatus = "PENDING";
        retryOrder.reservationExpiresAt = new Date(
          Date.now() + ONLINE_RESERVATION_TTL_MS,
        );
        await retryOrder.save({ session });
        order = retryOrder;
      });
    } catch (error) {
      if (error instanceof InventoryUnavailableError) {
        throw error;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } else {
    // Already reserved/committed — reset payment state and refresh TTL
    // for a fresh payment attempt.
    order.paymentStatus = "PENDING";
    order.reservationExpiresAt = new Date(
      Date.now() + ONLINE_RESERVATION_TTL_MS,
    );
    await order.save();
  }

  // Amount comes from MongoDB only — never from the browser.
  const amount = toPaise(order.totalAmount);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Order amount is invalid");
  }

  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpayClient().orders.create({
      amount,
      currency: "INR",
      receipt: order.orderNumber,
      notes: {
        orderNumber: order.orderNumber,
      },
    });
  } catch (razorpayError) {
    console.error("Razorpay order creation failed:", razorpayError);

    await markOrderPaymentFailedById(order._id.toString());

    throw new Error(
      "Unable to start online payment right now. Please try again or choose Cash on Delivery.",
    );
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: "PENDING",
      inventoryStatus: "RESERVED",
      orderStatus: { $ne: "CANCELLED" },
    },
    {
      $set: {
        razorpayOrderId: razorpayOrder.id,
        reservationExpiresAt: new Date(Date.now() + ONLINE_RESERVATION_TTL_MS),
      },
      $addToSet: {
        razorpayOrderIds: razorpayOrder.id,
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!updatedOrder) {
    throw new Error("Order is no longer available for payment");
  }

  const keyId = getRazorpayKeyId();
  return {
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: "INR",
    keyId,
    orderNumber: updatedOrder.orderNumber,
    totalAmount: updatedOrder.totalAmount,
  };
};

/*
|--------------------------------------------------------------------------
| CREATE RAZORPAY ORDER
|--------------------------------------------------------------------------
| POST /api/payments/create-order
| Body: { "orderNumber": "SV-12345678-1234" }
|--------------------------------------------------------------------------
*/

export const createPaymentOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed =
      createPaymentOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid payment request",
      });
      return;
    }

    const keyId = getRazorpayKeyId();

    if (!keyId || !getRazorpayKeySecret()) {
      res.status(503).json({
        message:
          "Online payments are not configured yet. Please choose Cash on Delivery.",
      });
      return;
    }

    let order = await Order.findOne({
      orderNumber: parsed.data.orderNumber
        .trim()
        .toUpperCase(),
    });

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });
      return;
    }

    if (order.userId && order.userId.toString() !== req.customer?.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (order.paymentMethod !== "ONLINE") {
      res.status(400).json({
        message:
          "This order is not an online payment order",
      });
      return;
    }

    if (order.orderStatus === "CANCELLED") {
      res.status(400).json({
        message: "This order has been cancelled",
      });
      return;
    }

    if (order.paymentStatus === "PAID") {
      res.status(400).json({
        message: "This order has already been paid",
      });
      return;
    }

    let result;
    try {
      result = await createRazorpayAttempt(order);
    } catch (error) {
      if (error instanceof InventoryUnavailableError) {
        res.status(400).json({ message: "This order can no longer reserve its items" });
        return;
      }
      const err = error as Error;
      if (err.message === "Order is no longer available for payment") {
        res.status(409).json({ message: "Order is no longer available for payment" });
        return;
      }
      if (
        err.message ===
        "Unable to start online payment right now. Please try again or choose Cash on Delivery."
      ) {
        res.status(502).json({ message: err.message });
        return;
      }
      throw error;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Create payment order failed:", error);

    res.status(500).json({
      message: "Unable to start payment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| RETRY PAYMENT
|--------------------------------------------------------------------------
| POST /api/payments/retry
| Body: { "orderNumber": "SV-12345678-1234" }
|--------------------------------------------------------------------------
| Creates a new Razorpay attempt for an existing failed/pending online order
| without creating a duplicate customer order.
*/

export const retryPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed =
      createPaymentOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid payment request",
      });
      return;
    }

    const keyId = getRazorpayKeyId();

    if (!keyId || !getRazorpayKeySecret()) {
      res.status(503).json({
        message:
          "Online payments are not configured yet. Please choose Cash on Delivery.",
      });
      return;
    }

    let order = await Order.findOne({
      orderNumber: parsed.data.orderNumber
        .trim()
        .toUpperCase(),
    });

    if (!order) {
      res.status(404).json({
        message: "Order not found",
      });
      return;
    }

    if (order.userId && order.userId.toString() !== req.customer?.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    if (order.paymentMethod !== "ONLINE") {
      res.status(400).json({
        message:
          "This order is not an online payment order",
      });
      return;
    }

    if (order.orderStatus === "CANCELLED") {
      res.status(400).json({
        message: "This order has been cancelled",
      });
      return;
    }

    if (order.paymentStatus === "PAID") {
      res.status(400).json({
        message: "This order has already been paid",
      });
      return;
    }

    let result;
    try {
      result = await createRazorpayAttempt(order);
    } catch (error) {
      if (error instanceof InventoryUnavailableError) {
        res.status(400).json({ message: "This order can no longer reserve its items" });
        return;
      }
      const err = error as Error;
      if (err.message === "Order is no longer available for payment") {
        res.status(409).json({ message: "Order is no longer available for payment" });
        return;
      }
      if (
        err.message ===
        "Unable to start online payment right now. Please try again or choose Cash on Delivery."
      ) {
        res.status(502).json({ message: err.message });
        return;
      }
      throw error;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Retry payment failed:", error);

    res.status(500).json({
      message: "Unable to retry payment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT
|--------------------------------------------------------------------------
| POST /api/payments/verify
| Body: Razorpay Checkout handler response
|--------------------------------------------------------------------------
*/

export const verifyPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed =
      verifyPaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid payment data",
      });
      return;
    }

    const keySecret = getRazorpayKeySecret();

    if (!keySecret) {
      res.status(503).json({
        message: "Online payments are not configured yet.",
      });
      return;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = parsed.data;

    const order = await Order.findOne({
      $or: [
        { razorpayOrderId: razorpay_order_id },
        { razorpayOrderIds: razorpay_order_id },
      ],
    });

    if (!order) {
      res.status(400).json({
        message: "Payment verification failed",
      });
      return;
    }

    if (order.userId && order.userId.toString() !== req.customer?.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Duplicate verification with the same payment is a no-op success.
    if (order.paymentStatus === "PAID") {
      if (
        order.razorpayPaymentId === razorpay_payment_id ||
        order.razorpayPaymentIds?.includes(razorpay_payment_id)
      ) {
        res.status(200).json({
          message: "Payment already verified",
          order: {
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
          },
        });
        return;
      }

    }

    const isValidSignature = verifySignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature,
      keySecret,
    );

    if (!isValidSignature) {
      console.warn(
        `Payment signature mismatch for order ${order.orderNumber}`,
      );

      res.status(400).json({
        message:
          "Payment verification failed. If any money was deducted, it will be refunded automatically.",
      });
      return;
    }

    await markOrderPaid(razorpay_order_id, razorpay_payment_id);
    const updated = await Order.findById(order._id).lean();
    if (!updated || updated.paymentStatus !== "PAID") {
      res.status(409).json({ message: "Unable to confirm payment state" });
      return;
    }

    res.status(200).json({
      message: updated.reconciliationStatus === "REVIEW_REQUIRED"
        ? "Payment was recorded; this order requires manual reconciliation"
        : "Payment verified successfully",
      order: {
        orderNumber: updated.orderNumber,
        paymentStatus: updated.paymentStatus,
        orderStatus: updated.orderStatus,
        reconciliationStatus: updated.reconciliationStatus,
      },
    });
  } catch (error) {
    console.error("Payment verification failed:", error);

    res.status(500).json({
      message: "Unable to verify payment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| WEBHOOK
|--------------------------------------------------------------------------
| POST /api/payments/webhook
| Body arrives RAW (express.raw mounted in server.ts) so the signature
| can be verified against the exact bytes Razorpay sent.
|--------------------------------------------------------------------------
*/

export const handleWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    res.status(503).json({
      message: "Webhook is not configured",
    });
    return;
  }

  const signature = req.get("x-razorpay-signature");

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : "";

  if (
    !signature ||
    !rawBody ||
    !verifySignature(rawBody, signature, webhookSecret)
  ) {
    res.status(400).json({
      message: "Invalid webhook signature",
    });
    return;
  }

  try {
    const event = JSON.parse(rawBody);

    if (event?.event === "payment.captured") {
      const entity = event.payload?.payment?.entity;

      if (entity?.order_id && entity?.id) {
        await markOrderPaid(entity.order_id, entity.id);
      }
    } else if (event?.event === "payment.failed") {
      const entity = event.payload?.payment?.entity;

      if (entity?.order_id) {
        await markOrderPaymentFailed(entity.order_id);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook handling failed:", error);

    res.status(500).json({
      message: "Webhook processing failed",
    });
  }
};
