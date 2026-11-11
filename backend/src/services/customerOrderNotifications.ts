import type { IOrder } from "../models/Order.js";
import { User } from "../models/User.js";
import {
  sendCustomerOrderEmailOnce,
  type CustomerOrderEmailInput,
} from "./emailService.js";

type CustomerOrderEvent = CustomerOrderEmailInput["event"];

/** Resolves only the current registered customer address; unverified guests are skipped. */
export async function notifyCustomerOrder(
  order: IOrder,
  event: CustomerOrderEvent,
  eventId: string,
  details: string,
  status: string = order.orderStatus,
): Promise<void> {
  try {
    if (!order.userId) return;
    const customer = await User.findById(order.userId).select("name email emailVerified").lean();
    if (!customer?.email || !customer.emailVerified) return;

    await sendCustomerOrderEmailOnce({
      recipient: customer.email,
      customerName: customer.name || order.customerName,
      orderNumber: order.orderNumber,
      event,
      status,
      details,
      eventId: `customer-order:${order._id}:${eventId}`,
    });
  } catch {
    // Customer notifications must never affect the committed order/payment action.
  }
}

export function orderEmailDetails(order: IOrder): string {
  const items = order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ");
  return `${items}; total ${order.totalAmount}; ${order.fulfillmentType.toLowerCase()} scheduled ${order.scheduledDate} at ${order.scheduledTime}`;
}