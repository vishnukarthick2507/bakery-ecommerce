import type { IOrder } from "../models/Order.js";
import { User } from "../models/User.js";
import { WhatsAppConsent } from "../models/WhatsAppConsent.js";
import { WhatsAppNotificationPreference } from "../models/WhatsAppNotificationPreference.js";
import {
  sendCustomerOrderEmailOnce,
  type CustomerOrderEmailInput,
} from "./emailService.js";
import { enqueueNotification } from "./notificationOutboxService.js";
import { normalisePhone } from "./whatsappConsentService.js";
import { formatSlotDate, formatSlotTime } from "./slotValidation.js";

type CustomerOrderEvent = CustomerOrderEmailInput["event"] | "PAYMENT_FAILED";

/** Resolves only the current registered customer address; unverified guests are skipped. */
export async function notifyCustomerOrder(
  order: IOrder,
  event: CustomerOrderEvent,
  eventId: string,
  details: string,
  status: string = order.orderStatus,
): Promise<void> {
  try {
    // --- Email (existing behaviour, best-effort, direct) ---
    // PAYMENT_FAILED is a distinct transactional WhatsApp event with no existing email flow.
    // Preserve existing email templates/recipients/event IDs/delivery behavior for all other events.
    if (event !== "PAYMENT_FAILED" && order.userId) {
      const customer = await User.findById(order.userId).select("name email emailVerified").lean();
      if (customer?.email && customer.emailVerified) {
        await sendCustomerOrderEmailOnce({
          recipient: customer.email,
          customerName: customer.name || order.customerName,
          orderNumber: order.orderNumber,
          event: event as CustomerOrderEmailInput["event"],
          status,
          details,
          eventId: `customer-order:${order._id}:${eventId}`,
        });
      }
    }

    // --- WhatsApp (durable outbox, best-effort) ---
    // WhatsApp only sends when: phone exists + consent is GRANTED +
    // API configured + template mapped. Enqueued to the outbox so delivery
    // failures never block the order action and survive restarts.
    await enqueueCustomerOrderWhatsApp(order, event, eventId, details, status);
  } catch {
    // Customer notifications must never affect the committed order/payment action.
  }
}

/**
 * Enqueues a best-effort WhatsApp order notification to the durable outbox.
 * Never throws: missing consent, missing config, or delivery failure all
 * silently return without affecting the order action.
 */
async function enqueueCustomerOrderWhatsApp(
  order: IOrder,
  event: CustomerOrderEvent,
  eventId: string,
  details: string,
  status: string,
): Promise<void> {
  const phone = order.phone?.trim();
  if (!phone) return;

  // WhatsApp notifications require explicit TRANSACTIONAL customer consent (PART 8.G / Phase A).
  // Check by normalized phone (consent records are stored normalized) with fallback to raw phone.
  const normalizedPhone = normalisePhone(phone);
  const consent = await WhatsAppConsent.findOne({
    phone: { $in: [phone, ...(normalizedPhone && normalizedPhone !== phone ? [normalizedPhone] : [])] },
    status: "GRANTED",
  }).lean();
  if (!consent) return;

  // Event-specific notification preference (default enabled when not configured).
  const preference = await WhatsAppNotificationPreference.findOne({ eventType: event }).lean();
  if (preference && preference.enabled === false) return;

  const template = whatsappTemplateFor(order, event, status);
  if (!template) return;

  const idempotencyKey = `whatsapp:${order._id}:${eventId}`;

  await enqueueNotification({
    idempotencyKey,
    channel: "WHATSAPP",
    recipient: phone,
    templateName: template.templateName,
    params: template.params,
    eventType: event,
    orderNumber: order.orderNumber,
  });
}

interface WhatsAppTemplate {
  templateName: string;
  params: string[];
}

/**
 * Maps an order event + status to a WhatsApp Cloud API template name and its
 * body parameters. Returns null when no WhatsApp notification should be sent
 * for the event.
 *
 * Template names are aspirational: they must be approved in Meta Business
 * Manager before delivery succeeds. Unapproved templates fail closed in the
 * registry/outbox validation and never block the order action.
 */
export function whatsappTemplateFor(
  order: IOrder,
  event: CustomerOrderEvent,
  status: string,
): WhatsAppTemplate | null {
  const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/track?order=${encodeURIComponent(order.orderNumber)}`;
  const customerName = order.customer?.name || order.customerName;

  switch (event) {
    case "ORDER_PLACED":
      return {
        templateName: "order_received",
        params: [
          customerName,
          order.orderNumber,
          order.totalAmount.toString(),
          status,
          trackingUrl,
        ],
      };
    case "PAYMENT_CONFIRMED":
      return {
        templateName: "payment_received",
        params: [
          customerName,
          order.orderNumber,
          order.totalAmount.toString(),
          trackingUrl,
        ],
      };
    case "STATUS_CHANGED":
      switch (status) {
        case "CONFIRMED":
          return {
            templateName: "order_confirmed",
            params: [customerName, order.orderNumber, status, trackingUrl],
          };
        case "PREPARING":
          return {
            templateName: "order_preparing",
            params: [customerName, order.orderNumber, trackingUrl],
          };
        case "READY":
        case "READY_FOR_PICKUP":
          return {
            templateName: "order_ready",
            params: [customerName, order.orderNumber, trackingUrl],
          };
        case "OUT_FOR_DELIVERY":
          return {
            templateName: "order_out_for_delivery",
            params: [customerName, order.orderNumber, trackingUrl],
          };
        case "DELIVERED":
        case "COLLECTED":
          return {
            templateName: "order_completed",
            params: [customerName, order.orderNumber, trackingUrl],
          };
        case "RESCHEDULE_PROPOSED": {
          // D20-08-A/B/C/D approved (direction only). D20-08-E exact wording NOT DECIDED.
          // Registry placeholder is NOT_SUBMITTED/enabled:false; outbox/registry fail closed.
          const proposed = order.proposedSlot?.time;
          const proposedSchedule = proposed
            ? `${formatSlotDate(new Date(proposed))} ${formatSlotTime(new Date(proposed))} IST`
            : "Schedule to be confirmed";
          return {
            templateName: "order_reschedule_proposed",
            params: [customerName, order.orderNumber, proposedSchedule, trackingUrl],
          };
        }
        default:
          return null;
      }
    case "CANCELLED":
      return {
        templateName: "order_cancelled",
        params: [customerName, order.orderNumber, trackingUrl],
      };
    case "PAYMENT_FAILED":
      return {
        templateName: "payment_failed",
        params: [customerName, order.orderNumber, trackingUrl],
      };
    case "RESCHEDULE_REQUESTED":
      return {
        templateName: "order_reschedule_requested",
        params: [customerName, order.orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl],
      };
    case "RESCHEDULE_ACCEPTED":
      return {
        templateName: "order_reschedule_accepted",
        params: [customerName, order.orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl],
      };
    case "RESCHEDULE_REJECTED":
      return {
        templateName: "order_reschedule_rejected",
        params: [customerName, order.orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl],
      };
    default:
      return null;
  }
}

export function orderEmailDetails(order: IOrder): string {
  const items = order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ");
  const trackingLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/track?order=${encodeURIComponent(order.orderNumber)}`;
  return `Order #${order.orderNumber} — ${items}; total ${order.totalAmount}; ${order.fulfillmentType.toLowerCase()} scheduled ${order.scheduledDate} at ${order.scheduledTime}. Track your order: ${trackingLink}`;
}
