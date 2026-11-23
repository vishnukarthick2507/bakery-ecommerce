import { describe, expect, it } from "vitest";

import {
  getTemplateDefinition,
  validateTemplateDefinition,
  validateTemplateForSend,
  WHATSAPP_TEMPLATE_REGISTRY,
  type WhatsAppTemplateDefinition,
  type MetaApprovalEvidence,
} from "../src/services/whatsappTemplateRegistry.js";

describe("whatsappTemplateRegistry (Phase A)", () => {
  const validEvidence = (def: Pick<WhatsAppTemplateDefinition, "templateName" | "language">): MetaApprovalEvidence => ({
    provider: "META",
    metaTemplateName: def.templateName,
    metaTemplateId: `meta-${def.templateName}`,
    metaLanguageCode: def.language || "en",
    approvalStatus: "APPROVED",
    evidenceRef: `test-evidence-${def.templateName}`,
    verifiedAt: "2026-11-22T00:00:00.000Z",
  });

  it("registers supported transactional templates explicitly", () => {
    expect(WHATSAPP_TEMPLATE_REGISTRY.length).toBeGreaterThan(0);
    expect(getTemplateDefinition("order_received", "ORDER_PLACED")).toBeTruthy();
  });

  it("keeps PAYMENT_FAILED template registered but disabled/fail-closed until explicitly approved/configured", () => {
    const def = getTemplateDefinition("payment_failed", "PAYMENT_FAILED");
    expect(def).toBeTruthy();
    expect(def?.enabled).toBe(false);
    expect(def?.approvalState).not.toBe("APPROVED");

    const result = validateTemplateForSend({
      templateName: "payment_failed",
      internalEvent: "PAYMENT_FAILED",
      params: ["Name", "SV-1", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["TEMPLATE_DISABLED", "TEMPLATE_NOT_APPROVED"]).toContain(result.reason);
    }
  });

  it("fails closed when template is missing/not registered", () => {
    const result = validateTemplateForSend({
      templateName: "unknown_template",
      params: ["a"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("TEMPLATE_NOT_FOUND");
  });

  it("fails closed when template is disabled or not confirmed approved", () => {
    const base = getTemplateDefinition("order_received", "ORDER_PLACED") as WhatsAppTemplateDefinition;
    const disabled: WhatsAppTemplateDefinition = { ...base, enabled: false, approvalState: "APPROVED" };
    const notApproved: WhatsAppTemplateDefinition = { ...base, enabled: true, approvalState: "PENDING" };

    const disabledResult = validateTemplateDefinition(disabled, {
      templateName: disabled.templateName,
      internalEvent: disabled.internalEvent,
      params: ["Name", "SV-1", "100", "PLACED", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(disabledResult.ok).toBe(false);
    if (!disabledResult.ok) expect(disabledResult.reason).toBe("TEMPLATE_DISABLED");

    const notApprovedResult = validateTemplateDefinition(notApproved, {
      templateName: notApproved.templateName,
      internalEvent: notApproved.internalEvent,
      params: ["Name", "SV-1", "100", "PLACED", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(notApprovedResult.ok).toBe(false);
    if (!notApprovedResult.ok) expect(notApprovedResult.reason).toBe("TEMPLATE_NOT_APPROVED");
  });

  it("fails closed on internal event mismatch, category mismatch, missing params, or empty required variables", () => {
    const orderReceivedBase = getTemplateDefinition("order_received", "ORDER_PLACED") as WhatsAppTemplateDefinition;
    const paymentReceivedBase = getTemplateDefinition("payment_received", "PAYMENT_CONFIRMED") as WhatsAppTemplateDefinition;
    const orderReceivedApproved: WhatsAppTemplateDefinition = {
      ...orderReceivedBase,
      enabled: true,
      approvalState: "APPROVED",
      metaApprovalEvidence: validEvidence(orderReceivedBase),
    };
    const paymentReceivedApproved: WhatsAppTemplateDefinition = {
      ...paymentReceivedBase,
      enabled: true,
      approvalState: "APPROVED",
      metaApprovalEvidence: validEvidence(paymentReceivedBase),
    };

    const mismatch = validateTemplateDefinition(orderReceivedApproved, {
      templateName: orderReceivedApproved.templateName,
      internalEvent: "PAYMENT_CONFIRMED",
      params: ["Name", "SV-1", "100", "PLACED", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.reason).toBe("TEMPLATE_NOT_FOUND");

    const wrongCategory = validateTemplateDefinition(orderReceivedApproved, {
      templateName: orderReceivedApproved.templateName,
      internalEvent: "ORDER_PLACED",
      params: ["Name", "SV-1", "100", "PLACED", "https://x.test/t"],
      expectedCategory: "MARKETING",
    });
    expect(wrongCategory.ok).toBe(false);
    if (!wrongCategory.ok) expect(wrongCategory.reason).toBe("CATEGORY_MISMATCH");

    const missing = validateTemplateDefinition(orderReceivedApproved, {
      templateName: orderReceivedApproved.templateName,
      internalEvent: "ORDER_PLACED",
      params: ["Name", "SV-1"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("MISSING_REQUIRED_VARIABLES");

    const empty = validateTemplateDefinition(paymentReceivedApproved, {
      templateName: paymentReceivedApproved.templateName,
      internalEvent: "PAYMENT_CONFIRMED",
      params: ["Name", "SV-1", "", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe("MISSING_REQUIRED_VARIABLES");
  });

  it("fail-closes for registered templates when Meta approval is unverified (BLB-21 safety reconciliation)", () => {
    const result = validateTemplateForSend({
      templateName: "order_ready",
      internalEvent: "STATUS_CHANGED_READY",
      params: ["Name", "SV-1", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["TEMPLATE_DISABLED", "TEMPLATE_NOT_APPROVED"]).toContain(result.reason);
    }
  });

  it("passes for a valid, enabled, approved template definition (synthetic defense-in-depth case)", () => {
    const base = getTemplateDefinition("order_ready", "STATUS_CHANGED_READY") as WhatsAppTemplateDefinition;
    const approved: WhatsAppTemplateDefinition = {
      ...base,
      enabled: true,
      approvalState: "APPROVED",
      metaApprovalEvidence: validEvidence(base),
    };
    const result = validateTemplateDefinition(approved, {
      templateName: approved.templateName,
      internalEvent: approved.internalEvent,
      params: ["Name", "SV-1", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.metaCategory).toBe("TRANSACTIONAL");
      expect(result.normalizedParams).toHaveLength(3);
    }
  });

  it("keeps RESCHEDULE_PROPOSED placeholder fail-closed (D20-08-E NOT DECIDED, no Meta approval)", () => {
    const def = getTemplateDefinition("order_reschedule_proposed", "STATUS_CHANGED_RESCHEDULE_PROPOSED");
    expect(def).toBeTruthy();
    expect(def?.enabled).toBe(false);
    expect(def?.approvalState).toBe("NOT_SUBMITTED");

    const result = validateTemplateForSend({
      templateName: "order_reschedule_proposed",
      internalEvent: "STATUS_CHANGED_RESCHEDULE_PROPOSED",
      params: ["Name", "SV-1", "22 Nov 2026 10:00 AM IST", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["TEMPLATE_DISABLED", "TEMPLATE_NOT_APPROVED"]).toContain(result.reason);
    }
  });

  it("fail-closes when internal APPROVED lacks verifiable Meta approval evidence (no implied Meta approval)", () => {
    const base = getTemplateDefinition("order_ready", "STATUS_CHANGED_READY") as WhatsAppTemplateDefinition;
    const approvedNoEvidence: WhatsAppTemplateDefinition = { ...base, enabled: true, approvalState: "APPROVED" };
    const result = validateTemplateDefinition(approvedNoEvidence, {
      templateName: approvedNoEvidence.templateName,
      internalEvent: approvedNoEvidence.internalEvent,
      params: ["Name", "SV-1", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("META_APPROVAL_EVIDENCE_MISSING");
  });

  it("fail-closes when Meta approval evidence identity mismatches template name/language", () => {
    const base = getTemplateDefinition("order_ready", "STATUS_CHANGED_READY") as WhatsAppTemplateDefinition;
    const mismatched: WhatsAppTemplateDefinition = {
      ...base,
      enabled: true,
      approvalState: "APPROVED",
      metaApprovalEvidence: { ...validEvidence(base), metaTemplateName: "wrong_name" },
    };
    const result = validateTemplateDefinition(mismatched, {
      templateName: mismatched.templateName,
      internalEvent: mismatched.internalEvent,
      params: ["Name", "SV-1", "https://x.test/t"],
      expectedCategory: "TRANSACTIONAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("META_TEMPLATE_IDENTITY_MISMATCH");
  });
});
