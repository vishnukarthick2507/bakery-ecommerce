import { beforeEach, describe, expect, it, vi } from "vitest";
import { WHATSAPP_TEMPLATE_REGISTRY } from "../src/services/whatsappTemplateRegistry.js";

const enqueueNotificationMock = vi.fn().mockResolvedValue({ enqueued: true, duplicate: false });
vi.mock("../src/services/notificationOutboxService.js", () => ({
  enqueueNotification: (...args: unknown[]) => enqueueNotificationMock(...args),
}));

const findConsentMock = vi.fn();
vi.mock("../src/models/WhatsAppConsent.js", () => ({
  WhatsAppConsent: { findOne: (...args: unknown[]) => ({ lean: () => findConsentMock(...args) }) },
}));

const findPreferenceMock = vi.fn();
vi.mock("../src/models/WhatsAppNotificationPreference.js", () => ({
  WHATSAPP_NOTIFICATION_EVENT_TYPES: ["CUSTOM_CAKE_REQUEST_RECEIVED"],
  WhatsAppNotificationPreference: { findOne: (...args: unknown[]) => ({ lean: () => findPreferenceMock(...args) }) },
}));

vi.mock("../src/services/whatsappConsentService.js", () => ({
  normalisePhone: (p: string) => p,
}));

import { notifyCustomerCustomCake } from "../src/services/customCakeNotifications.js";

function setTemplateState(templateName: string, enabled: boolean, approvalState: "APPROVED" | "NOT_SUBMITTED", withEvidence = false) {
  const def = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === templateName) as any;
  if (!def) throw new Error(`Template ${templateName} not found`);
  const prev = { enabled: def.enabled, approvalState: def.approvalState, metaApprovalEvidence: def.metaApprovalEvidence };
  def.enabled = enabled;
  def.approvalState = approvalState;
  def.metaApprovalEvidence = withEvidence ? {
    provider: "META",
    metaTemplateName: def.templateName,
    metaLanguageCode: def.language,
    metaTemplateId: "meta-test-id",
    approvalStatus: "APPROVED",
    evidenceRef: "BLB32-test",
    verifiedAt: new Date().toISOString(),
  } : undefined;
  return () => {
    def.enabled = prev.enabled;
    def.approvalState = prev.approvalState;
    def.metaApprovalEvidence = prev.metaApprovalEvidence;
  };
}

const req = { _id: "req1", name: "Asha", phone: "919840916058", referenceNumber: "CC-123" };

describe("customCakeNotifications validation consistency (BLB32-03)", () => {
  beforeEach(() => {
    enqueueNotificationMock.mockClear();
    findConsentMock.mockReset().mockResolvedValue({ status: "GRANTED" });
    findPreferenceMock.mockReset().mockResolvedValue(null);
  });

  it("does not enqueue when template is disabled/unapproved", async () => {
    const restore = setTemplateState("custom_cake_request_received", false, "NOT_SUBMITTED", false);
    try {
      await notifyCustomerCustomCake(req, "CUSTOM_CAKE_REQUEST_RECEIVED", "evt-1");
      expect(enqueueNotificationMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("does not enqueue when template lacks Meta approval evidence (fail-closed)", async () => {
    const restore = setTemplateState("custom_cake_request_received", true, "APPROVED", false);
    try {
      await notifyCustomerCustomCake(req, "CUSTOM_CAKE_REQUEST_RECEIVED", "evt-2");
      expect(enqueueNotificationMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("does not enqueue when Meta evidence identity mismatches", async () => {
    const def = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === "custom_cake_request_received") as any;
    const prev = { enabled: def.enabled, approvalState: def.approvalState, metaApprovalEvidence: def.metaApprovalEvidence };
    def.enabled = true;
    def.approvalState = "APPROVED";
    def.metaApprovalEvidence = {
      provider: "META",
      metaTemplateName: "wrong_name",
      metaLanguageCode: def.language,
      metaTemplateId: "meta-test-id",
      approvalStatus: "APPROVED",
      evidenceRef: "BLB32-test",
      verifiedAt: new Date().toISOString(),
    };
    try {
      await notifyCustomerCustomCake(req, "CUSTOM_CAKE_REQUEST_RECEIVED", "evt-3");
      expect(enqueueNotificationMock).not.toHaveBeenCalled();
    } finally {
      def.enabled = prev.enabled;
      def.approvalState = prev.approvalState;
      def.metaApprovalEvidence = prev.metaApprovalEvidence;
    }
  });
});
