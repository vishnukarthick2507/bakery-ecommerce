import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WHATSAPP_TEMPLATE_REGISTRY } from "../src/services/whatsappTemplateRegistry.js";
import { sendWhatsAppTemplate } from "../src/services/whatsappService.js";

function setTemplateApproved(templateName: string) {
  const def = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === templateName) as any;
  if (!def) throw new Error(`Template ${templateName} not found`);
  const prev = {
    enabled: def.enabled,
    approvalState: def.approvalState,
    metaApprovalEvidence: def.metaApprovalEvidence,
  };
  def.enabled = true;
  def.approvalState = "APPROVED";
  def.metaApprovalEvidence = {
    provider: "META",
    metaTemplateName: def.templateName,
    metaLanguageCode: def.language,
    metaTemplateId: "meta-test-id",
    approvalStatus: "APPROVED",
    evidenceRef: "BLB32-test",
    verifiedAt: new Date().toISOString(),
  };
  return () => {
    def.enabled = prev.enabled;
    def.approvalState = prev.approvalState;
    def.metaApprovalEvidence = prev.metaApprovalEvidence;
  };
}

describe("whatsappService provider failure handling (BLB32-02, unit)", () => {
  const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let restoreTemplate: (() => void) | undefined;

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    restoreTemplate = setTemplateApproved("order_received");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    restoreTemplate?.();
    if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
    if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
  });

  it("returns accepted false on HTTP 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const result = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", "https://example.com/track"],
      internalEvent: "ORDER_PLACED",
    });
    expect(result).toEqual({ accepted: false });
  });

  it("returns accepted false on HTTP 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const result = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", "https://example.com/track"],
      internalEvent: "ORDER_PLACED",
    });
    expect(result).toEqual({ accepted: false });
  });

  it("returns accepted true without providerMessageId when response JSON is malformed/missing id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    }));
    const result = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", "https://example.com/track"],
      internalEvent: "ORDER_PLACED",
    });
    expect(result).toEqual({ accepted: true });
  });

  it("returns accepted true without providerMessageId when response JSON parsing throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error("bad json"); },
    }));
    const result = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", "https://example.com/track"],
      internalEvent: "ORDER_PLACED",
    });
    expect(result).toEqual({ accepted: true });
  });

  it("returns accepted false on aborted/timeout fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })));
    const result = await sendWhatsAppTemplate({
      to: "919840916058",
      templateName: "order_received",
      params: ["Ravi", "SV-123", "15 Nov 2026", "10:00 AM - 12:00 PM", "https://example.com/track"],
      internalEvent: "ORDER_PLACED",
    });
    expect(result).toEqual({ accepted: false });
  });
});
