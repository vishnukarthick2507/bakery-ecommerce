import crypto from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";

import { Order } from "../models/Order.js";
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

async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  const order = await Order.findOne({
    razorpayOrderId,
  });

  if (!order || order.paymentStatus === "PAID") {
    return;
  }

  const update: Record<string, unknown> = {
    paymentStatus: "PAID",
    razorpayPaymentId,
  };

  if (order.orderStatus === "PLACED") {
    update.orderStatus = "PAYMENT_CONFIRMED";
  }

  await Order.updateOne(
    {
      _id: order._id,
      paymentStatus: { $ne: "PAID" },
    },
    { $set: update },
  );
}

async function markOrderPaymentFailed(
  razorpayOrderId: string,
): Promise<void> {
  await Order.updateOne(
    {
      razorpayOrderId,
      paymentStatus: "PENDING",
    },
    { $set: { paymentStatus: "FAILED" } },
  );
}

/*
|--------------------------------------------------------------------------
| CREATE RAZORPAY ORDER
|--------------------------------------------------------------------------
| POST /api/payments/create-order
| Body: { "orderNumber": "SV-12345678-1234" }
|--------------------------------------------------------------------------
*/

export const createPaymentOrder = async (
  req: Request,
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

    const order = await Order.findOne({
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

    // Amount comes from MongoDB only — never from the browser.
    const amount = toPaise(order.totalAmount);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      res.status(400).json({
        message: "Order amount is invalid",
      });
      return;
    }

    let razorpayOrder;

    try {
      razorpayOrder = await getRazorpayClient().orders.create(
        {
          amount,
          currency: "INR",
          receipt: order.orderNumber,
          notes: {
            orderNumber: order.orderNumber,
          },
        },
      );
    } catch (razorpayError) {
      console.error(
        "Razorpay order creation failed:",
        razorpayError,
      );

      res.status(502).json({
        message:
          "Unable to start online payment right now. Please try again or choose Cash on Delivery.",
      });
      return;
    }

    order.razorpayOrderId = razorpayOrder.id;

    // Allow retry after a failed attempt.
    if (order.paymentStatus === "FAILED") {
      order.paymentStatus = "PENDING";
    }

    await order.save();

    res.status(200).json({
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: "INR",
      keyId,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error("Create payment order failed:", error);

    res.status(500).json({
      message: "Unable to start payment",
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
  req: Request,
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
      razorpayOrderId: razorpay_order_id,
    });

    if (!order) {
      res.status(400).json({
        message: "Payment verification failed",
      });
      return;
    }

    // Duplicate verification with the same payment is a no-op success.
    if (order.paymentStatus === "PAID") {
      if (order.razorpayPaymentId === razorpay_payment_id) {
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

      res.status(409).json({
        message: "This order has already been paid",
      });
      return;
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

    const update: Record<string, unknown> = {
      paymentStatus: "PAID",
      razorpayPaymentId: razorpay_payment_id,
    };

    if (order.orderStatus === "PLACED") {
      update.orderStatus = "PAYMENT_CONFIRMED";
    }

    // Atomic guard: only one verification can mark the order PAID.
    const updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: { $ne: "PAID" },
      },
      { $set: update },
      { new: true },
    ).lean();

    if (!updated) {
      const current = await Order.findById(
        order._id,
      ).lean();

      if (
        current?.paymentStatus === "PAID" &&
        current.razorpayPaymentId === razorpay_payment_id
      ) {
        res.status(200).json({
          message: "Payment already verified",
          order: {
            orderNumber: current.orderNumber,
            paymentStatus: current.paymentStatus,
            orderStatus: current.orderStatus,
          },
        });
        return;
      }

      res.status(409).json({
        message: "This order has already been paid",
      });
      return;
    }

    res.status(200).json({
      message: "Payment verified successfully",
      order: {
        orderNumber: updated.orderNumber,
        paymentStatus: updated.paymentStatus,
        orderStatus: updated.orderStatus,
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
