import mongoose from "mongoose";

import { CustomerMetrics } from "../models/CustomerMetrics.js";
import { Order } from "../models/Order.js";
import type { OrderStatus, PaymentMethod } from "../models/Order.js";

/*
|--------------------------------------------------------------------------
| CUSTOMER METRICS SERVICE
|--------------------------------------------------------------------------
| Derives customer metrics from trustworthy order records. Metrics are
| recalculated on demand via recalculateCustomerMetrics(); they are not
| updated inline on every order to avoid double-counting from retries,
// duplicate webhooks, or concurrent updates.
|
| Only paid, non-cancelled orders contribute to paid metrics.
| Guest checkouts (orders without userId) do not produce metrics,
| preserving existing guest checkout behavior.
|--------------------------------------------------------------------------
*/

type PaidOrder = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  totalAmount: number;
  createdAt: Date;
  paymentStatus: PaymentMethod extends never ? never : "PENDING" | "PAID" | "FAILED";
  orderStatus: OrderStatus;
};

export async function recalculateCustomerMetrics(
  userId: mongoose.Types.ObjectId,
): Promise<void> {
  const paidOrders = (await Order.find({
    userId,
    paymentStatus: "PAID",
    orderStatus: { $ne: "CANCELLED" },
  }).lean()) as unknown as PaidOrder[];

  const orderCount = paidOrders.length;
  const totalPaid = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageOrderValue =
    orderCount > 0 ? totalPaid / orderCount : 0;

  const firstOrderAt = paidOrders.reduce(
    (earliest: Date | undefined, o) =>
      earliest === undefined || o.createdAt < earliest
        ? o.createdAt
        : earliest,
    undefined as Date | undefined,
  );

  const lastOrderAt = paidOrders.reduce(
    (latest: Date | undefined, o) =>
      latest === undefined || o.createdAt > latest
        ? o.createdAt
        : latest,
    undefined as Date | undefined,
  );

  const segment =
    orderCount === 0
      ? "NEW"
      : orderCount === 1
        ? "RETURNING"
        : totalPaid >= 5000
          ? "VIP"
          : "AT_RISK";

  await CustomerMetrics.findOneAndUpdate(
    { userId },
    {
      $set: {
        orderCount,
        paidOrderCount: orderCount,
        totalPaid,
        averageOrderValue,
        firstOrderAt,
        lastOrderAt,
        segment,
      },
    },
    { upsert: true },
  );
}

/*
|--------------------------------------------------------------------------
| RECALCULATE ALL CUSTOMER METRICS
|--------------------------------------------------------------------------
| Recalculates metrics for every customer who has at least one order.
| Intended for use as a scheduled maintenance job, not per-request.
|--------------------------------------------------------------------------
*/

export async function recalculateAllCustomerMetrics(): Promise<void> {
  const userIds = await Order.distinct("userId", {
    userId: { $exists: true, $ne: null },
  });

  for (const rawUserId of userIds) {
    const userIdStr = String(rawUserId);
    try {
      await recalculateCustomerMetrics(
        new mongoose.Types.ObjectId(userIdStr),
      );
    } catch (error) {
      console.error(
        `Failed to recalculate metrics for user ${userIdStr}:`,
        error,
      );
    }
  }
}
