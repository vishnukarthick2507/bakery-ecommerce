import { describe, expect, it } from "vitest";
import { whatsappTemplateFor as orderTemplateFor } from "../src/services/customerOrderNotifications.js";
import { whatsappTemplateFor as customCakeTemplateFor } from "../src/services/customCakeNotifications.js";
import { validateTemplateForSend } from "../src/services/whatsappTemplateRegistry.js";

const baseOrder: any = {
  _id: "order1",
  orderNumber: "SV-123",
  totalAmount: 499,
  orderStatus: "PLACED",
  customerName: "Ravi",
  customer: { name: "Ravi" },
  phone: "919840916058",
  scheduledDate: "15 Nov 2026",
  scheduledTime: "10:00 AM - 12:00 PM",
  fulfillmentType: "DELIVERY",
  items: [{ productName: "Cake", quantity: 1 }],
  proposedSlot: { time: new Date("2026-11-20T10:30:00.000Z") },
};

describe("notification mapping - order events (BLB32-04)", () => {
  const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/track?order=SV-123`;
  const cases: Array<{
    name: string;
    event: any;
    status: string;
    expected: { templateName: string; params: string[] } | null;
  }> = [
    {
      name: "ORDER_PLACED",
      event: "ORDER_PLACED",
      status: "PLACED",
      expected: { templateName: "order_received", params: ["Ravi", "SV-123", "499", "PLACED", trackingUrl] },
    },
    {
      name: "PAYMENT_CONFIRMED",
      event: "PAYMENT_CONFIRMED",
      status: "PAID",
      expected: { templateName: "payment_received", params: ["Ravi", "SV-123", "499", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED CONFIRMED",
      event: "STATUS_CHANGED",
      status: "CONFIRMED",
      expected: { templateName: "order_confirmed", params: ["Ravi", "SV-123", "CONFIRMED", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED PREPARING",
      event: "STATUS_CHANGED",
      status: "PREPARING",
      expected: { templateName: "order_preparing", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED READY",
      event: "STATUS_CHANGED",
      status: "READY",
      expected: { templateName: "order_ready", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED READY_FOR_PICKUP",
      event: "STATUS_CHANGED",
      status: "READY_FOR_PICKUP",
      expected: { templateName: "order_ready", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED OUT_FOR_DELIVERY",
      event: "STATUS_CHANGED",
      status: "OUT_FOR_DELIVERY",
      expected: { templateName: "order_out_for_delivery", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED DELIVERED",
      event: "STATUS_CHANGED",
      status: "DELIVERED",
      expected: { templateName: "order_completed", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "STATUS_CHANGED COLLECTED",
      event: "STATUS_CHANGED",
      status: "COLLECTED",
      expected: { templateName: "order_completed", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "CANCELLED",
      event: "CANCELLED",
      status: "CANCELLED",
      expected: { templateName: "order_cancelled", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "PAYMENT_FAILED",
      event: "PAYMENT_FAILED",
      status: "FAILED",
      expected: { templateName: "payment_failed", params: ["Ravi", "SV-123", trackingUrl] },
    },
    {
      name: "RESCHEDULE_REQUESTED",
      event: "RESCHEDULE_REQUESTED",
      status: "PENDING",
      expected: { templateName: "order_reschedule_requested", params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", trackingUrl] },
    },
    {
      name: "RESCHEDULE_ACCEPTED",
      event: "RESCHEDULE_ACCEPTED",
      status: "CONFIRMED",
      expected: { templateName: "order_reschedule_accepted", params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", trackingUrl] },
    },
    {
      name: "RESCHEDULE_REJECTED",
      event: "RESCHEDULE_REJECTED",
      status: "CONFIRMED",
      expected: { templateName: "order_reschedule_rejected", params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", trackingUrl] },
    },
  ];

  for (const c of cases) {
    it(`maps ${c.name}`, () => {
      expect(orderTemplateFor(baseOrder, c.event, c.status)).toEqual(c.expected);
    });
  }

  it("returns null for unknown STATUS_CHANGED status", () => {
    expect(orderTemplateFor(baseOrder, "STATUS_CHANGED", "UNKNOWN_STATUS" as any)).toBeNull();
  });

  it("returns null for unknown event", () => {
    expect(orderTemplateFor(baseOrder, "SOMETHING_ELSE" as any, "PLACED")).toBeNull();
  });

  it("maps RESCHEDULE_PROPOSED but registry remains fail-closed (D20-08-E/F unresolved)", () => {
    const mapped = orderTemplateFor(baseOrder, "STATUS_CHANGED", "RESCHEDULE_PROPOSED");
    expect(mapped?.templateName).toBe("order_reschedule_proposed");
    expect(mapped?.params[0]).toBe("Ravi");
    expect(mapped?.params[1]).toBe("SV-123");
    expect(typeof mapped?.params[2]).toBe("string");
    expect(mapped?.params[3]).toBe(trackingUrl);

    const validation = validateTemplateForSend({
      internalEvent: "STATUS_CHANGED_RESCHEDULE_PROPOSED",
      templateName: "order_reschedule_proposed",
      params: mapped?.params ?? [],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(["TEMPLATE_DISABLED", "TEMPLATE_NOT_APPROVED", "META_APPROVAL_EVIDENCE_MISSING"]).toContain(validation.reason);
    }
  });
});

describe("notification mapping - custom cake events (BLB32-04)", () => {
  const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/account/custom-cake-requests`;
  const baseReq: any = {
    _id: "req1",
    name: "Asha",
    phone: "919840916058",
    referenceNumber: "CC-123",
    proposedPrice: 1500,
    proposedDeliveryDate: "20 Nov 2026",
    proposedDeliveryTime: "02:00 PM - 04:00 PM",
  };

  const cases: Array<{ event: any; templateName: string; params: string[] }> = [
    { event: "CUSTOM_CAKE_REQUEST_RECEIVED", templateName: "custom_cake_request_received", params: ["Asha", "CC-123", trackingUrl] },
    { event: "CUSTOM_CAKE_QUOTE_PREPARED", templateName: "custom_cake_quote_prepared", params: ["Asha", "CC-123", "1500", "20 Nov 2026", "02:00 PM - 04:00 PM", trackingUrl] },
    { event: "CUSTOM_CAKE_QUOTE_ACCEPTED", templateName: "custom_cake_quote_accepted", params: ["Asha", "CC-123", trackingUrl] },
    { event: "CUSTOM_CAKE_QUOTE_DECLINED", templateName: "custom_cake_quote_declined", params: ["Asha", "CC-123", trackingUrl] },
    { event: "CUSTOM_CAKE_REQUEST_CLOSED", templateName: "custom_cake_request_closed", params: ["Asha", "CC-123", trackingUrl] },
    { event: "CUSTOM_CAKE_CONVERTED_TO_ORDER", templateName: "custom_cake_converted_to_order", params: ["Asha", "CC-123", trackingUrl] },
  ];

  for (const c of cases) {
    it(`maps ${c.event}`, () => {
      expect(customCakeTemplateFor(baseReq, c.event)).toEqual({ templateName: c.templateName, params: c.params });
    });
  }

  it("returns null for unknown custom cake event", () => {
    expect(customCakeTemplateFor(baseReq, "UNKNOWN" as any)).toBeNull();
  });

  it("fails closed for invalid/missing required params through registry validation", () => {
    const invalid = customCakeTemplateFor({ ...baseReq, proposedPrice: null, proposedDeliveryDate: "", proposedDeliveryTime: "" }, "CUSTOM_CAKE_QUOTE_PREPARED");
    expect(invalid?.templateName).toBe("custom_cake_quote_prepared");
    const validation = validateTemplateForSend({
      internalEvent: "CUSTOM_CAKE_QUOTE_PREPARED",
      templateName: invalid!.templateName,
      params: invalid!.params,
      expectedCategory: "TRANSACTIONAL",
    });
    expect(validation.ok).toBe(false);
  });
});
