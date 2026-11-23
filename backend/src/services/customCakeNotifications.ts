import { WhatsAppConsent } from "../models/WhatsAppConsent.js";
import {
  WHATSAPP_NOTIFICATION_EVENT_TYPES,
  WhatsAppNotificationPreference,
  type WhatsAppNotificationEventType,
} from "../models/WhatsAppNotificationPreference.js";
import { enqueueNotification } from "./notificationOutboxService.js";
import { normalisePhone } from "./whatsappConsentService.js";
import { getTemplateDefinition, validateTemplateForSend } from "./whatsappTemplateRegistry.js";

export type CustomCakeEvent =
  | "CUSTOM_CAKE_REQUEST_RECEIVED"
  | "CUSTOM_CAKE_QUOTE_PREPARED"
  | "CUSTOM_CAKE_QUOTE_ACCEPTED"
  | "CUSTOM_CAKE_QUOTE_DECLINED"
  | "CUSTOM_CAKE_REQUEST_CLOSED"
  | "CUSTOM_CAKE_CONVERTED_TO_ORDER";

interface WhatsAppTemplate {
  templateName: string;
  params: string[];
}

function trackingUrl(referenceNumber: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app";
  return `${base}/account/custom-cake-requests`;
}

type CustomCakeNotificationRequest = {
  _id: unknown;
  name?: string | null;
  phone?: string | null;
  referenceNumber: string;
  proposedPrice?: number | null;
  proposedDeliveryDate?: string | null;
  proposedDeliveryTime?: string | null;
};

export function whatsappTemplateFor(
  request: CustomCakeNotificationRequest,
  event: CustomCakeEvent,
): WhatsAppTemplate | null {
  const customerName = request.name?.trim() || "Customer";
  const ref = request.referenceNumber;
  const url = trackingUrl(ref);

  switch (event) {
    case "CUSTOM_CAKE_REQUEST_RECEIVED":
      return {
        templateName: "custom_cake_request_received",
        params: [customerName, ref, url],
      };
    case "CUSTOM_CAKE_QUOTE_PREPARED":
      return {
        templateName: "custom_cake_quote_prepared",
        params: [
          customerName,
          ref,
          String(request.proposedPrice ?? ""),
          request.proposedDeliveryDate ?? "",
          request.proposedDeliveryTime ?? "",
          url,
        ],
      };
    case "CUSTOM_CAKE_QUOTE_ACCEPTED":
      return {
        templateName: "custom_cake_quote_accepted",
        params: [customerName, ref, url],
      };
    case "CUSTOM_CAKE_QUOTE_DECLINED":
      return {
        templateName: "custom_cake_quote_declined",
        params: [customerName, ref, url],
      };
    case "CUSTOM_CAKE_REQUEST_CLOSED":
      return {
        templateName: "custom_cake_request_closed",
        params: [customerName, ref, url],
      };
    case "CUSTOM_CAKE_CONVERTED_TO_ORDER":
      return {
        templateName: "custom_cake_converted_to_order",
        params: [customerName, ref, url],
      };
    default:
      return null;
  }
}

/**
 * Best-effort custom cake WhatsApp notification enqueue.
 * - Explicit transactional consent required (no inference).
 * - Idempotent by business event key.
 * - Missing/unapproved templates fail closed via registry/outbox validation.
 * - Never throws; never affects caller transaction/response.
 */
export async function notifyCustomerCustomCake(
  request: CustomCakeNotificationRequest,
  event: CustomCakeEvent,
  eventId: string,
): Promise<void> {
  try {
    const phone = request.phone?.trim();
    if (!phone) return;

    const normalizedPhone = normalisePhone(phone);
    const consent = await WhatsAppConsent.findOne({
      phone: { $in: [phone, ...(normalizedPhone && normalizedPhone !== phone ? [normalizedPhone] : [])] },
      status: "GRANTED",
    }).lean();
    if (!consent) return;

    if ((WHATSAPP_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(event)) {
      const preference = await WhatsAppNotificationPreference.findOne({
        eventType: event as WhatsAppNotificationEventType,
      }).lean();
      if (preference && preference.enabled === false) return;
    }

    const template = whatsappTemplateFor(request, event);
    if (!template) return;

    // Fail closed before enqueue using centralized registry validation.
    // This keeps WhatsApp sending disabled for events without Meta-approved templates/evidence.
    const validation = validateTemplateForSend({
      internalEvent: event,
      templateName: template.templateName,
      params: template.params,
      expectedCategory: "TRANSACTIONAL",
    });
    if (!validation.ok) {
      return;
    }

    await enqueueNotification({
      idempotencyKey: `whatsapp:custom-cake:${String(request._id)}:${eventId}`,
      channel: "WHATSAPP",
      recipient: phone,
      templateName: template.templateName,
      params: template.params,
      eventType: event,
      referenceNumber: request.referenceNumber,
    });
  } catch {
    // Best-effort: custom cake notifications must never affect request workflows.
  }
}
