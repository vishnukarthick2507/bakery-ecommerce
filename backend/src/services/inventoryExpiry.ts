import mongoose from "mongoose";

import { Order } from "../models/Order.js";
import { restoreInventory } from "./inventory.js";

export const ONLINE_RESERVATION_TTL_MS = 15 * 60 * 1000;
const EXPIRY_SCAN_INTERVAL_MS = 30 * 1000;

export async function expireOnlineReservations(now = new Date()): Promise<number> {
  const expiredOrders = await Order.find({
    paymentMethod: "ONLINE",
    paymentStatus: "PENDING",
    inventoryStatus: "RESERVED",
    reservationExpiresAt: { $lte: now },
    orderStatus: { $nin: ["CANCELLED", "DELIVERED"] },
  })
    .select("_id")
    .limit(100)
    .lean();

  let releasedCount = 0;
  for (const expired of expiredOrders) {
    const session = await mongoose.startSession();
    let released = false;
    try {
      await session.withTransaction(async () => {
        released = false;
        const order = await Order.findOne({
          _id: expired._id,
          paymentMethod: "ONLINE",
          paymentStatus: "PENDING",
          inventoryStatus: "RESERVED",
          reservationExpiresAt: { $lte: now },
          orderStatus: { $nin: ["CANCELLED", "DELIVERED"] },
        }).session(session);

        if (!order) return;

        await restoreInventory(session, order.items);
        order.inventoryStatus = "RELEASED";
        order.paymentStatus = "FAILED";
        order.orderStatus = "CANCELLED";
        order.reservationExpiresAt = undefined;
        await order.save({ session });
        released = true;
      });
      if (released) releasedCount += 1;
    } finally {
      await session.endSession();
    }
  }
  return releasedCount;
}

export function startInventoryExpiryWorker(): void {
  const runSweep = (): void => {
    void expireOnlineReservations().catch(() => {
      console.error("Inventory reservation expiry sweep failed");
    });
  };

  runSweep();
  const timer = setInterval(runSweep, EXPIRY_SCAN_INTERVAL_MS);
  timer.unref();
}