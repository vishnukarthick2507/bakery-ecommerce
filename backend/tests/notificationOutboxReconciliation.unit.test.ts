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

vi.mock("../src/config/uatSafeMode.js", () => ({
  isUatExternalSideEffectsBlocked: () => false,
}));

let emailDeliveryBlocked = false;
vi.mock("../src/config/emailDeliverySafety.js", () => ({
  isExternalEmailDeliveryBlocked: () => emailDeliveryBlocked,
}));

const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
vi.mock("../src/lib/logger.js", () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

import { processJob, recoverExpiredLeases, claimJob } from "../src/services/notificationOutboxService.js";

const baseJob = {
  _id: "job-1",
  idempotencyKey: "idem-1",
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

describe("notification outbox reconciliation hold (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailDeliveryBlocked = false;
    isWhatsAppConfiguredMock.mockReturnValue(true);
    hasValidTransactionalConsentMock.mockResolvedValue(true);
    validateTemplateForSendMock.mockReturnValue({
      ok: true,
      definition: { templateName: "order_received", language: "en" },
      normalizedParams: baseJob.params,
    });
  });

  it("transitions to RECONCILIATION_REQUIRED when provider accepted but SENT persistence fails", async () => {
    sendWhatsAppTemplateMock.mockResolvedValue({ accepted: true, providerMessageId: "wamid.123" });
    // markSent fails
    updateOneMock
      .mockResolvedValueOnce({ modifiedCount: 0 })
      // markReconciliationRequired succeeds
      .mockResolvedValueOnce({ modifiedCount: 1 });

    await processJob(baseJob);

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledTimes(2);
    expect(updateOneMock.mock.calls[0]![0]).toMatchObject({ _id: "job-1", status: "PROCESSING", workerId: "worker-1" });
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({ $set: { status: "SENT", metaMessageId: "wamid.123" } });

    expect(updateOneMock.mock.calls[1]![0]).toMatchObject({ _id: "job-1", status: "PROCESSING", workerId: "worker-1" });
    expect((updateOneMock.mock.calls[1]![1] as any).$set).toMatchObject({
      status: "RECONCILIATION_REQUIRED",
      reconciliationCode: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
      metaMessageId: "wamid.123",
    });
    expect((updateOneMock.mock.calls[1]![1] as any).$set.providerAcceptedAt).toBeInstanceOf(Date);
    expect((updateOneMock.mock.calls[1]![1] as any).$set.reconciliationDetectedAt).toBeInstanceOf(Date);
    expect((updateOneMock.mock.calls[1]![1] as any).$unset).toMatchObject({ workerId: "", leaseExpiresAt: "" });

    expect(loggerWarnMock).toHaveBeenCalledWith(
      "WhatsApp provider accepted message but outbox SENT transition was not persisted",
      expect.objectContaining({
        code: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
        jobId: "job-1",
        idempotencyKey: "idem-1",
        reconciliationRequired: true,
        reconciliationHoldPersisted: true,
        duplicateSendSuppressed: true,
      }),
    );
  });

  it("does not claim hold persisted when reconciliation-hold write fails; no resend", async () => {
    sendWhatsAppTemplateMock.mockResolvedValue({ accepted: true, providerMessageId: "wamid.456" });
    updateOneMock
      .mockResolvedValueOnce({ modifiedCount: 0 }) // markSent fails
      .mockRejectedValueOnce(new Error("db down")); // reconciliation hold write throws

    await processJob(baseJob);

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to persist reconciliation hold after provider-accepted SENT persistence failure",
      expect.objectContaining({
        code: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
        reconciliationHoldPersisted: false,
        duplicateSendSuppressed: true,
      }),
    );
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "WhatsApp provider accepted message but outbox SENT transition was not persisted",
      expect.objectContaining({
        reconciliationHoldPersisted: false,
        duplicateSendSuppressed: true,
      }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Reconciliation hold was not persisted; manual reconciliation required before any resend decision",
      expect.objectContaining({
        reconciliationHoldPersisted: false,
        duplicateSendSuppressed: true,
      }),
    );
  });

  it("does not claim hold persisted when reconciliation-hold update returns modifiedCount 0; no resend", async () => {
    sendWhatsAppTemplateMock.mockResolvedValue({ accepted: true, providerMessageId: "wamid.789" });
    updateOneMock
      .mockResolvedValueOnce({ modifiedCount: 0 }) // markSent fails
      .mockResolvedValueOnce({ modifiedCount: 0 }); // reconciliation hold not persisted

    await processJob(baseJob);

    expect(sendWhatsAppTemplateMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "WhatsApp provider accepted message but outbox SENT transition was not persisted",
      expect.objectContaining({ reconciliationHoldPersisted: false, duplicateSendSuppressed: true }),
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Reconciliation hold was not persisted; manual reconciliation required before any resend decision",
      expect.objectContaining({ reconciliationHoldPersisted: false, duplicateSendSuppressed: true }),
    );
  });

  it("claimJob only targets PENDING/RETRYING (RECONCILIATION_REQUIRED excluded by query)", async () => {
    findOneAndUpdateMock.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await claimJob("worker-1");
    expect(findOneAndUpdateMock).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdateMock.mock.calls[0]![0]).toEqual({
      status: { $in: ["PENDING", "RETRYING"] },
      nextRetryAt: { $lte: expect.any(Date) },
    });
  });

  it("recoverExpiredLeases only recovers PROCESSING leases (RECONCILIATION_REQUIRED excluded by query)", async () => {
    updateManyMock.mockResolvedValue({ modifiedCount: 0 });
    await recoverExpiredLeases();
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock.mock.calls[0]![0]).toEqual({
      status: "PROCESSING",
      leaseExpiresAt: { $lt: expect.any(Date) },
    });
    expect(updateManyMock.mock.calls[0]![1]).toMatchObject({
      $set: { status: "PENDING" },
      $unset: { workerId: "", leaseExpiresAt: "" },
    });
  });
  it("releases EMAIL outbox jobs without sending or consuming attempts when EMAIL_EXTERNAL_DELIVERY_BLOCKED=true", async () => {
    emailDeliveryBlocked = true;
    updateOneMock.mockResolvedValueOnce({ modifiedCount: 1 }); // releaseSuppressedJob

    await processJob({
      ...baseJob,
      channel: "EMAIL",
      templateName: undefined,
      params: ["customer@example.com", "Ravi", "SV-123", "ORDER_PLACED", "PENDING", "details", "event-1"],
      eventType: "ORDER_PLACED",
    } as any);

    expect(sendCustomerOrderEmailOnceMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![0]).toEqual({ _id: "job-1", status: "PROCESSING", workerId: "worker-1" });
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: {
        status: "PENDING",
        nextRetryAt: expect.any(Date),
      },
      $inc: { attemptCount: -1 },
      $unset: { workerId: "", leaseExpiresAt: "" },
    });
    expect(String((updateOneMock.mock.calls[0]![1] as any).$set.lastError)).toContain("EMAIL_EXTERNAL_DELIVERY_BLOCKED=true");
  });

});
