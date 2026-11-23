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
vi.mock("../src/services/emailService.js", () => ({
  sendCustomerOrderEmailOnce: (...args: unknown[]) => sendCustomerOrderEmailOnceMock(...args),
  emitEmailSuppressionDiagnostic: vi.fn(),
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
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { processJob } from "../src/services/notificationOutboxService.js";

const baseEmailJob = {
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

const baseWhatsAppJob = {
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

describe("notification outbox - EMAIL block does not affect WhatsApp (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uatBlocked = false;
    emailDeliveryBlocked = false;
    isWhatsAppConfiguredMock.mockReturnValue(true);
    hasValidTransactionalConsentMock.mockResolvedValue(true);
    validateTemplateForSendMock.mockReturnValue({
      ok: true,
      definition: { templateName: "order_received", language: "en" },
      normalizedParams: baseWhatsAppJob.params,
    });
    sendWhatsAppTemplateMock.mockResolvedValue({ accepted: true, providerMessageId: "wamid.test" });
  });

  it("suppresses EMAIL and still processes valid WhatsApp in the same processing cycle", async () => {
    // Note: This test validates processJob orchestration independence only.
    // It uses an isolated template-validation mock for a "valid approved template" response
    // and does NOT establish Meta approval. Production registry/template gates remain fail-closed.
    emailDeliveryBlocked = true;
    updateOneMock
      .mockResolvedValueOnce({ modifiedCount: 1 }) // EMAIL releaseSuppressedJob
      .mockResolvedValueOnce({ modifiedCount: 1 }); // WhatsApp markSent

    await processJob(baseEmailJob as any);

    expect(sendCustomerOrderEmailOnceMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![0]).toEqual({
      _id: "email-job-1",
      status: "PROCESSING",
      workerId: "worker-1",
    });
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: { status: "PENDING" },
      $inc: { attemptCount: -1 },
      $unset: { workerId: "", leaseExpiresAt: "" },
    });
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).toContain(
      "EMAIL_EXTERNAL_DELIVERY_BLOCKED=true",
    );
    expect((updateOneMock.mock.calls[0]![1] as any).$set.status).not.toBe("SENT");
    expect((updateOneMock.mock.calls[0]![1] as any).$set.status).not.toBe("DEAD_LETTER");
    expect((updateOneMock.mock.calls[0]![1] as any).$set.status).not.toBe("SKIPPED");

    await processJob(baseWhatsAppJob as any);

    expect(isWhatsAppConfiguredMock).toHaveBeenCalled();
    expect(hasValidTransactionalConsentMock).toHaveBeenCalled();
    expect(validateTemplateForSendMock).toHaveBeenCalled();
    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplateMock).toHaveBeenCalledWith({
      to: baseWhatsAppJob.recipient,
      templateName: "order_received",
      params: baseWhatsAppJob.params,
    });
    expect(sendCustomerOrderEmailOnceMock).not.toHaveBeenCalled();

    // Second update is WhatsApp markSent
    expect(updateOneMock).toHaveBeenCalledTimes(2);
    expect(updateOneMock.mock.calls[1]![0]).toEqual({
      _id: "wa-job-1",
      status: "PROCESSING",
      workerId: "worker-1",
    });
    expect(updateOneMock.mock.calls[1]![1]).toMatchObject({
      $set: { status: "SENT", metaMessageId: "wamid.test" },
      $unset: { workerId: "", leaseExpiresAt: "" },
    });
  });
});
