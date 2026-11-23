import { beforeEach, describe, expect, it, vi } from "vitest";

const updateOneMock = vi.fn();
const findOneMock = vi.fn();
const findOneAndUpdateMock = vi.fn();
const createMock = vi.fn();
const aggregateMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("../src/models/NotificationOutbox.js", () => ({
  NotificationOutbox: {
    updateOne: (...args: unknown[]) => updateOneMock(...args),
    findOne: (...args: unknown[]) => findOneMock(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    aggregate: (...args: unknown[]) => aggregateMock(...args),
    updateMany: (...args: unknown[]) => updateManyMock(...args),
  },
}));

const sendWhatsAppTemplateMock = vi.fn();
const isWhatsAppConfiguredMock = vi.fn();
vi.mock("../src/services/whatsappService.js", () => ({
  sendWhatsAppTemplate: (...args: unknown[]) => sendWhatsAppTemplateMock(...args),
  isWhatsAppConfigured: (...args: unknown[]) => isWhatsAppConfiguredMock(...args),
}));

const hasValidTransactionalConsentMock = vi.fn();
vi.mock("../src/services/whatsappConsentService.js", () => ({
  hasValidTransactionalConsent: (...args: unknown[]) => hasValidTransactionalConsentMock(...args),
}));

const validateTemplateForSendMock = vi.fn();
vi.mock("../src/services/whatsappTemplateRegistry.js", () => ({
  validateTemplateForSend: (...args: unknown[]) => validateTemplateForSendMock(...args),
}));

const sendCustomerOrderEmailOnceMock = vi.fn();
const emitEmailSuppressionDiagnosticMock = vi.fn((context: string) => {
  console.info(JSON.stringify({ event: "email.external_delivery.suppressed", channel: "email", context, reason: "EMAIL_EXTERNAL_DELIVERY_BLOCKED" }));
});
vi.mock("../src/services/emailService.js", () => ({
  sendCustomerOrderEmailOnce: (...args: unknown[]) => sendCustomerOrderEmailOnceMock(...args),
  emitEmailSuppressionDiagnostic: (context: string) => emitEmailSuppressionDiagnosticMock(context),
}));

const logUatSuppressedMock = vi.fn();
vi.mock("../src/services/uatSafetyLog.js", () => ({
  logUatSuppressed: (...args: unknown[]) => logUatSuppressedMock(...args),
}));

let uatBlocked = false;
vi.mock("../src/config/uatSafeMode.js", () => ({
  isUatExternalSideEffectsBlocked: () => uatBlocked,
}));

let emailDeliveryBlocked = false;
vi.mock("../src/config/emailDeliverySafety.js", () => ({
  isExternalEmailDeliveryBlocked: () => emailDeliveryBlocked,
}));

vi.mock("../src/lib/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { processJob } from "../src/services/notificationOutboxService.js";

const emailJob = {
  _id: "email-job-1",
  idempotencyKey: "idem-email-1",
  channel: "EMAIL" as const,
  status: "PROCESSING" as const,
  recipient: "customer@example.com",
  templateName: undefined,
  params: ["customer@example.com", "Ravi", "SV-123", "ORDER_PLACED", "PENDING", "details", "event-1"],
  eventType: "ORDER_PLACED",
  attemptCount: 1,
  maxAttempts: 5,
  nextRetryAt: new Date(),
  lastError: undefined,
  metaMessageId: undefined,
  workerId: "worker-1",
  leaseExpiresAt: new Date(Date.now() + 60_000),
  orderNumber: "SV-123",
  referenceNumber: undefined,
};

const waJob = {
  _id: "wa-job-1",
  idempotencyKey: "idem-wa-1",
  channel: "WHATSAPP" as const,
  status: "PROCESSING" as const,
  recipient: "919840916058",
  templateName: "order_received",
  params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
  eventType: "ORDER_PLACED",
  attemptCount: 1,
  maxAttempts: 5,
  nextRetryAt: new Date(),
  lastError: undefined,
  metaMessageId: undefined,
  workerId: "worker-1",
  leaseExpiresAt: new Date(Date.now() + 60_000),
  orderNumber: "SV-123",
  referenceNumber: undefined,
};

describe("notification outbox UAT/email safety mode interactions (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uatBlocked = false;
    emailDeliveryBlocked = false;
    isWhatsAppConfiguredMock.mockReturnValue(true);
    hasValidTransactionalConsentMock.mockResolvedValue(true);
    validateTemplateForSendMock.mockReturnValue({
      ok: true,
      definition: { templateName: "order_received", language: "en" },
      normalizedParams: waJob.params,
    });
    sendWhatsAppTemplateMock.mockResolvedValue({ accepted: true, providerMessageId: "wamid.test" });
    sendCustomerOrderEmailOnceMock.mockResolvedValue(true);
  });

  it("Case 1: UAT true + email block true - UAT suppression takes precedence for EMAIL", async () => {
    uatBlocked = true;
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    await processJob(emailJob as any);

    expect(sendCustomerOrderEmailOnceMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![0]).toEqual({ _id: "email-job-1", status: "PROCESSING", workerId: "worker-1" });
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: { status: "PENDING" },
      $inc: { attemptCount: -1 },
      $unset: { workerId: "", leaseExpiresAt: "" },
    });
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).toContain("Suppressed in UAT_SAFE_MODE");
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).not.toContain("EMAIL_EXTERNAL_DELIVERY_BLOCKED=true");
  });

  it("Case 2: UAT true + email block true - WhatsApp remains UAT-suppressed", async () => {
    uatBlocked = true;
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    await processJob(waJob as any);

    expect(sendWhatsAppTemplateMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).toContain("Suppressed in UAT_SAFE_MODE");
  });

  it("Case 3: UAT false + email block true - EMAIL suppressed by email safety", async () => {
    uatBlocked = false;
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });

    await processJob(emailJob as any);

    expect(sendCustomerOrderEmailOnceMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).toContain("EMAIL_EXTERNAL_DELIVERY_BLOCKED=true");
  });

  it("Case 4: UAT false + email block true - valid WhatsApp job processes normally", async () => {
    // Orchestration-only: mock satisfies all WA gates; does not establish Meta approval.
    uatBlocked = false;
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 }); // markSent

    await processJob(waJob as any);

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: { status: "SENT", metaMessageId: "wamid.test" },
    });
  });

  it("Case 5: UAT false + email block false - existing EMAIL processing remains unchanged", async () => {
    uatBlocked = false;
    emailDeliveryBlocked = false;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 }); // markSent

    await processJob(emailJob as any);

    expect(sendCustomerOrderEmailOnceMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: { status: "SENT" },
    });
  });

  it("Decision C: EMAIL block emits PII-safe suppression diagnostic when UAT=false", async () => {
    uatBlocked = false;
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      await processJob(emailJob as any);

      const logs = infoSpy.mock.calls.map((args: unknown[]) => args.map((a: unknown) => String(a)).join(" "));
      const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
      expect(suppression).toBeDefined();
      expect(suppression).toContain('"channel":"email"');
      expect(suppression).toContain('"reason":"EMAIL_EXTERNAL_DELIVERY_BLOCKED"');
      const joined = logs.join("\n");
      expect(joined).not.toContain("customer@example.com");
      expect(joined).not.toContain("SV-123");
      expect(joined).not.toContain("Ravi");
      expect(joined).not.toContain("+1555");
    } finally {
      infoSpy.mockRestore();
    }
  });
});
