/*
|--------------------------------------------------------------------------
| WHATSAPP EVENT TAXONOMY (Stage 5 Phase A)
|--------------------------------------------------------------------------
| Supported WhatsApp business events backed by existing, verified persisted
| triggers/states in the current codebase. Unsupported/deferred workflows are
| documented explicitly and must not be invented in implementation.
*/

export type SupportedWhatsAppEventCategory = "TRANSACTIONAL" | "MARKETING";

export interface SupportedWhatsAppEventDefinition {
  eventKey: string;
  internalEventType: string;
  category: SupportedWhatsAppEventCategory;
  triggerSource: string;
  persistedStateOrTrigger: string;
  templateName?: string;
  supported: true;
  notes?: string;
}

/**
 * Phase A supported taxonomy (verified existing triggers only).
 * - Order/customer WhatsApp notifications are transactional and consent-gated.
 * - Reschedule customer WhatsApp templates are not approved/supported yet (email-only today).
 */
export const SUPPORTED_WHATSAPP_EVENT_TAXONOMY: readonly SupportedWhatsAppEventDefinition[] = [
  {
    eventKey: "customer.order.placed",
    internalEventType: "ORDER_PLACED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Order created (PLACED) after successful order persistence; notifyCustomerOrder(..., 'ORDER_PLACED', ...)",
    templateName: "order_received",
    supported: true,
  },
  {
    eventKey: "customer.order.payment_confirmed",
    internalEventType: "PAYMENT_CONFIRMED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Verified payment confirmation / paid order transitions trigger notifyCustomerOrder(..., 'PAYMENT_CONFIRMED', ...)",
    templateName: "payment_received",
    supported: true,
  },
  {
    eventKey: "customer.order.status.confirmed",
    internalEventType: "STATUS_CHANGED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order status CONFIRMED in status update flow",
    templateName: "order_confirmed",
    supported: true,
  },
  {
    eventKey: "customer.order.status.preparing",
    internalEventType: "STATUS_CHANGED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order status PREPARING in status update flow",
    templateName: "order_preparing",
    supported: true,
  },
  {
    eventKey: "customer.order.status.ready",
    internalEventType: "STATUS_CHANGED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order status READY / READY_FOR_PICKUP in status update flow",
    templateName: "order_ready",
    supported: true,
  },
  {
    eventKey: "customer.order.status.out_for_delivery",
    internalEventType: "STATUS_CHANGED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order status OUT_FOR_DELIVERY in status update flow",
    templateName: "order_out_for_delivery",
    supported: true,
  },
  {
    eventKey: "customer.order.status.completed",
    internalEventType: "STATUS_CHANGED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order status DELIVERED / COLLECTED in status update flow",
    templateName: "order_completed",
    supported: true,
  },
  {
    eventKey: "customer.order.cancelled",
    internalEventType: "CANCELLED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/orderController.ts + backend/src/services/customerOrderNotifications.ts",
    persistedStateOrTrigger: "Persisted order cancellation triggers notifyCustomerOrder(..., 'CANCELLED', ...)",
    templateName: "order_cancelled",
    supported: true,
  },
  {
    eventKey: "customer.order.payment_failed",
    internalEventType: "PAYMENT_FAILED",
    category: "TRANSACTIONAL",
    triggerSource: "backend/src/controllers/paymentController.ts:markOrderPaymentFailed",
    persistedStateOrTrigger:
      "Current online Razorpay attempt genuinely transitions from PENDING to FAILED (persisted). Template disabled/fail-closed until Meta approval/configuration explicitly verified.",
    templateName: "payment_failed",
    supported: true,
    notes:
      "Never send for invalid signatures, superseded attempts, duplicate callbacks, already-paid orders, or no-op updates. Uses stable attempt-based idempotency.",
  },
] as const;

export const DEFERRED_WHATSAPP_EVENTS = [
  {
    eventKey: "customer.reschedule.requested.whatsapp",
    reason: "Existing flow sends email; WhatsApp template not approved/registered as supported in Phase A.",
  },
  {
    eventKey: "customer.reschedule.accepted.whatsapp",
    reason: "Existing flow sends email; WhatsApp template not approved/registered as supported in Phase A.",
  },
  {
    eventKey: "customer.reschedule.rejected.whatsapp",
    reason: "Existing flow sends email; WhatsApp template not approved/registered as supported in Phase A.",
  },
  {
    eventKey: "admin.reschedule.proposal_expired.whatsapp",
    reason: "Current implementation uses dedicated email alert flow with separate retry/lease state in proposalExpiry service; migration assessment required before unification.",
  },
  {
    eventKey: "custom_cake.lifecycle.whatsapp",
    reason: "No verified persisted custom-cake WhatsApp production/status notification workflow beyond consent capture in submission context.",
  },
  { eventKey: "refund.workflow", reason: "No verified persisted refund workflow/trigger in current implementation." },
  { eventKey: "invoice.generation", reason: "No verified invoice generation workflow/trigger in current implementation." },
  { eventKey: "order.rejection", reason: "No verified dedicated order rejection state/trigger in current implementation." },
  { eventKey: "stock.subscription.alerts", reason: "No verified stock subscription workflow/trigger in current implementation." },
  { eventKey: "marketing.campaign.send", reason: "Marketing sends/campaign launch explicitly out of scope for Phase A." },
] as const;

export function listSupportedWhatsAppEvents(): SupportedWhatsAppEventDefinition[] {
  return [...SUPPORTED_WHATSAPP_EVENT_TAXONOMY];
}
