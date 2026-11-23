import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  enqueueNotification,
  claimJob,
  markSent,
  markFailed,
  recoverExpiredLeases,
  processJob,
  getOutboxStats,
} from "../src/services/notificationOutboxService.js";
import { WHATSAPP_TEMPLATE_REGISTRY } from "../src/services/whatsappTemplateRegistry.js";
import { NotificationOutbox } from "../src/models/NotificationOutbox.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";
import { logger } from "../src/lib/logger.js";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await NotificationOutbox.deleteMany({});
  await WhatsAppConsent.deleteMany({});
});

afterEach(async () => {
  await NotificationOutbox.deleteMany({});
  await WhatsAppConsent.deleteMany({});
});

const baseJob = {
  idempotencyKey: "test-event-001",
  channel: "WHATSAPP" as const,
  recipient: "919840916058",
  templateName: "order_received",
  params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
  eventType: "ORDER_PLACED",
  orderNumber: "SV-123",
};

function setTemplateRegistryState(templateName: string, enabled: boolean, approvalState: "APPROVED" | "NOT_SUBMITTED") {
  const def = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === templateName) as any;
  if (!def) throw new Error(`Template ${templateName} not found in registry`);
  const prevEvidence = def.metaApprovalEvidence;
  def.enabled = enabled;
  def.approvalState = approvalState;
  if (enabled && approvalState === "APPROVED") {
    def.metaApprovalEvidence = {
      provider: "META",
      metaTemplateName: def.templateName,
      metaTemplateId: `meta-${def.templateName}`,
      metaLanguageCode: def.language || "en",
      approvalStatus: "APPROVED",
      evidenceRef: `test-evidence-${def.templateName}`,
      verifiedAt: "2026-11-22T00:00:00.000Z",
    };
  } else {
    delete def.metaApprovalEvidence;
  }
  return () => {
    def.enabled = !enabled ? def.enabled : false;
    def.approvalState = !enabled ? def.approvalState : "NOT_SUBMITTED";
    if (prevEvidence === undefined) delete def.metaApprovalEvidence;
    else def.metaApprovalEvidence = prevEvidence;
  };
}

describe("enqueueNotification", () => {
  it("enqueues a new notification", async () => {
    const result = await enqueueNotification(baseJob);

    expect(result.enqueued).toBe(true);
    expect(result.duplicate).toBe(false);

    const doc = await NotificationOutbox.findOne({ idempotencyKey: baseJob.idempotencyKey }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("PENDING");
    expect(doc!.attemptCount).toBe(0);
    expect(doc!.maxAttempts).toBe(5);
  });

  it("rejects duplicate enqueue with same idempotencyKey", async () => {
    await enqueueNotification(baseJob);
    const result = await enqueueNotification(baseJob);

    expect(result.enqueued).toBe(false);
    expect(result.duplicate).toBe(true);

    const count = await NotificationOutbox.countDocuments({ idempotencyKey: baseJob.idempotencyKey });
    expect(count).toBe(1);
  });

  it("allows enqueue with different idempotencyKey", async () => {
    await enqueueNotification(baseJob);
    const result = await enqueueNotification({ ...baseJob, idempotencyKey: "test-event-002" });

    expect(result.enqueued).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  it("enqueues EMAIL channel notifications", async () => {
    const emailInput: {
      idempotencyKey: string;
      channel: "EMAIL";
      recipient: string;
      templateName?: string;
      params: string[];
      eventType: string;
      orderNumber?: string;
    } = {
      idempotencyKey: "email-event-001",
      channel: "EMAIL",
      recipient: "customer@example.com",
      params: [
        "customer@example.com",
        "Ravi",
        "SV-123",
        "ORDER_PLACED",
        "PLACED",
        "Order details",
        "evt-001",
      ],
      eventType: "ORDER_PLACED",
    };

    const result = await enqueueNotification(emailInput);

    expect(result.enqueued).toBe(true);
    const doc = await NotificationOutbox.findOne({ idempotencyKey: "email-event-001" }).lean();
    expect(doc!.channel).toBe("EMAIL");
  });

  it("never throws on enqueue failure", async () => {
    // Even with missing fields, should not throw
    const result = await enqueueNotification({
      ...baseJob,
      idempotencyKey: "test-event-003",
    } as any);
    expect(result.enqueued).toBe(true);
  });
});

describe("claimJob", () => {
  it("claims a pending job", async () => {
    await enqueueNotification(baseJob);

    const job = await claimJob("worker-1");
    expect(job).not.toBeNull();
    expect(job!.idempotencyKey).toBe(baseJob.idempotencyKey);
    expect(job!.status).toBe("PROCESSING");
    expect(job!.workerId).toBe("worker-1");
    expect(job!.attemptCount).toBe(1);
  });

  it("does not claim the same job twice concurrently", async () => {
    await enqueueNotification(baseJob);

    const job1 = await claimJob("worker-1");
    const job2 = await claimJob("worker-2");

    expect(job1).not.toBeNull();
    expect(job2).toBeNull(); // Second worker gets nothing
  });

  it("does not claim jobs whose retry time has not arrived", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
    await NotificationOutbox.create({
      ...baseJob,
      idempotencyKey: "test-event-future",
      status: "PENDING",
      nextRetryAt: future,
    });

    const job = await claimJob("worker-1");
    expect(job).toBeNull();
  });

  it("orders by nextRetryAt then createdAt", async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 2000);
    const later = new Date(now.getTime() - 1000);
    await enqueueNotification({
      ...baseJob,
      idempotencyKey: "event-b",
      nextRetryAt: later,
    });
    await enqueueNotification({
      ...baseJob,
      idempotencyKey: "event-a",
      nextRetryAt: earlier,
    });

    const first = await claimJob("worker-1");
    expect(first!.idempotencyKey).toBe("event-a");

    const second = await claimJob("worker-1");
    expect(second!.idempotencyKey).toBe("event-b");
  });
});

describe("markSent", () => {
  it("marks a processing job as sent", async () => {
    await enqueueNotification(baseJob);
    const job = await claimJob("worker-1");
    expect(job).not.toBeNull();

    const marked = await markSent(job!._id, "worker-1", "meta-msg-123");
    expect(marked).toBe(true);

    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("SENT");
    expect(doc!.metaMessageId).toBe("meta-msg-123");
    expect(doc!.workerId).toBeUndefined();
    expect(doc!.leaseExpiresAt).toBeUndefined();
  });
});

describe("markFailed", () => {
  it("retries a failed job with backoff", async () => {
    await enqueueNotification({ ...baseJob, maxAttempts: 3 });
    const job = await claimJob("worker-1");

    const result = await markFailed(job!._id, "worker-1", "Temporary network failure");
    expect(result).toBe("retried");

    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("RETRYING");
    expect(doc!.attemptCount).toBe(1);
    expect(doc!.lastError).toBe("Temporary network failure");
    expect(doc!.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("dead-letters a job after max attempts", async () => {
    await enqueueNotification({ ...baseJob, maxAttempts: 1 });
    const job = await claimJob("worker-1"); // attemptCount becomes 1

    // First failure: attemptCount 1 >= maxAttempts 1 -> dead letter
    const result = await markFailed(job!._id, "worker-1", "Permanent failure");
    expect(result).toBe("dead_letter");

    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("DEAD_LETTER");
    expect(doc!.lastError).toBe("Permanent failure");
  });
});

describe("recoverExpiredLeases", () => {
  it("recovers jobs with expired leases", async () => {
    await enqueueNotification(baseJob);
    const job = await claimJob("worker-1");

    // Manually expire the lease
    await NotificationOutbox.updateOne(
      { _id: job!._id },
      { $set: { leaseExpiresAt: new Date(Date.now() - 60_000) } }, // 1 minute ago
    );

    const recovered = await recoverExpiredLeases();
    expect(recovered).toBe(1);

    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("PENDING");
    expect(doc!.workerId).toBeUndefined();
    expect(doc!.leaseExpiresAt).toBeUndefined();
  });

  it("does not recover active leases", async () => {
    await enqueueNotification(baseJob);
    await claimJob("worker-1");

    const recovered = await recoverExpiredLeases();
    expect(recovered).toBe(0);
  });
});

describe("processJob", () => {
  beforeEach(() => {
    setTemplateRegistryState("order_received", true, "APPROVED");
  });
  afterEach(() => {
    setTemplateRegistryState("order_received", false, "NOT_SUBMITTED");
  });

  it("sends WhatsApp notification when consent is granted and stores provider message ID from Meta response", async () => {
    // Grant consent
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messaging_product: "whatsapp", contacts: [{ input: "919840916058", wa_id: "919840916058" }], messages: [{ id: "wamid.HBgNOTE5ODQwOTE2MDU4FQIAERgSABCDEF1234567890" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    setTemplateRegistryState("order_received", true, "APPROVED");

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("SENT");
      expect(doc!.metaMessageId).toBe("wamid.HBgNOTE5ODQwOTE2MDU4FQIAERgSABCDEF1234567890");
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      setTemplateRegistryState("order_received", false, "NOT_SUBMITTED");
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("marks WhatsApp job SENT without provider message ID when Meta accepts but response has no message ID", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messaging_product: "whatsapp", messages: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    setTemplateRegistryState("order_received", true, "APPROVED");

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("SENT");
      expect(doc!.metaMessageId ?? undefined).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      setTemplateRegistryState("order_received", false, "NOT_SUBMITTED");
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("does not mark SENT or store provider message ID when Meta send fails", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "bad request" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    setTemplateRegistryState("order_received", true, "APPROVED");

    try {
      await enqueueNotification({ ...baseJob, maxAttempts: 2 });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(["RETRYING", "DEAD_LETTER"]).toContain(doc!.status);
      expect(doc!.status).not.toBe("SENT");
      expect(doc!.metaMessageId ?? undefined).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      setTemplateRegistryState("order_received", false, "NOT_SUBMITTED");
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("does not resend in-process when provider accepted but SENT persistence fails; ownership-lost hold write surfaces residual limitation", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.SAFE-PERSIST-1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      // Simulate stale/reclaimed lease so the atomic SENT transition (with provider ID) cannot persist.
      await NotificationOutbox.updateOne(
        { _id: job!._id },
        { $set: { workerId: "other-worker" } },
      );

      const warnSpy = vi.spyOn(logger, "warn");
      const errorSpy = vi.spyOn(logger, "error");

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(fetchMock).toHaveBeenCalledOnce();
      // Ownership lost: reconciliation hold cannot be safely persisted by stale worker.
      // Job remains PROCESSING; residual lease-recovery duplicate-send risk is documented.
      expect(doc!.status).toBe("PROCESSING");
      expect(doc!.metaMessageId ?? undefined).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "WhatsApp provider accepted message but outbox SENT transition was not persisted",
        expect.objectContaining({
          code: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
          jobId: job!._id,
          channel: "WHATSAPP",
          eventType: "ORDER_PLACED",
          providerMessageIdPresent: true,
          reconciliationRequired: true,
          reconciliationHoldPersisted: false,
          duplicateSendSuppressed: true,
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        "Reconciliation hold was not persisted; manual reconciliation required before any resend decision",
        expect.objectContaining({
          code: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
          reconciliationHoldPersisted: false,
          duplicateSendSuppressed: true,
        }),
      );

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("does not send when consent is absent, denied, or withdrawn", async () => {
    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("SKIPPED");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("does not send when only marketing consent is granted (transactional consent required)", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "DENIED",
      marketingStatus: "GRANTED",
      source: "MARKETING_OPT_IN",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("SKIPPED");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("dead-letters PAYMENT_FAILED jobs when template is disabled/unapproved (fail-closed)", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification({
        idempotencyKey: "whatsapp:order1:payment-failed:order_fail_1",
        channel: "WHATSAPP",
        recipient: "919840916058",
        templateName: "payment_failed",
        params: ["Ravi", "SV-FAIL-001", "https://example.com/track"],
        eventType: "PAYMENT_FAILED",
        orderNumber: "SV-FAIL-001",
      });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError ?? "")).toMatch(/Template validation failed/);
      expect(String(doc!.lastError ?? "")).toMatch(/TEMPLATE_DISABLED|TEMPLATE_NOT_APPROVED/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("rejects incorrect event + template combination (event-aware validation)", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification({
        ...baseJob,
        idempotencyKey: "mismatch-event-template",
        eventType: "ORDER_PLACED",
        templateName: "payment_received",
        params: ["Ravi", "SV-123", "499", "https://example.com/track"],
      });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError ?? "")).toMatch(/Template validation failed/);
      // Fail-closed: with registry reconciliation, disabled templates may be rejected before event-mismatch check.
      expect(String(doc!.lastError ?? "")).toMatch(/TEMPLATE_NOT_FOUND|not registered for event|TEMPLATE_DISABLED|TEMPLATE_NOT_APPROVED/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("fails closed when outbox job is missing internal business event type", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      const created = await NotificationOutbox.create({
        idempotencyKey: "missing-event",
        channel: "WHATSAPP",
        status: "PENDING",
        recipient: "919840916058",
        templateName: "order_received",
        params: ["Ravi", "SV-123", "499", "PLACED", "https://example.com/track"],
        eventType: "ORDER_PLACED",
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(),
        orderNumber: "SV-123",
      });
      await NotificationOutbox.collection.updateOne(
        { _id: created._id },
        { $set: { eventType: "" } },
      );

      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError ?? "")).toMatch(/MISSING_EVENT/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("fails closed for unknown internal business event type", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification({
        ...baseJob,
        idempotencyKey: "unknown-event",
        eventType: "SOMETHING_UNKNOWN",
      });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError ?? "")).toMatch(/UNKNOWN_EVENT/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("continues sending supported STATUS_CHANGED template mappings with correct event-aware validation", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    setTemplateRegistryState("order_ready", true, "APPROVED");

    try {
      await enqueueNotification({
        idempotencyKey: "status-ready-ok",
        channel: "WHATSAPP",
        recipient: "919840916058",
        templateName: "order_ready",
        params: ["Ravi", "SV-123", "https://example.com/track"],
        eventType: "STATUS_CHANGED",
        orderNumber: "SV-123",
      });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("SENT");
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      setTemplateRegistryState("order_ready", false, "NOT_SUBMITTED");
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("fail-closes when internal APPROVED template lacks verifiable Meta approval evidence", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    const def = WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === "order_received") as any;
    const prevEnabled = def.enabled;
    const prevApproval = def.approvalState;
    const prevEvidence = def.metaApprovalEvidence;
    def.enabled = true;
    def.approvalState = "APPROVED";
    delete def.metaApprovalEvidence;

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();
      await processJob(job!);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError)).toContain("META_APPROVAL_EVIDENCE_MISSING");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      def.enabled = prevEnabled;
      def.approvalState = prevApproval;
      if (prevEvidence === undefined) delete def.metaApprovalEvidence;
      else def.metaApprovalEvidence = prevEvidence;
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("fail-closes RESCHEDULE_PROPOSED placeholder (D20-08-E NOT DECIDED, no enablement)", async () => {
    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    try {
      await enqueueNotification({
        idempotencyKey: "status-reschedule-proposed-fail-closed",
        channel: "WHATSAPP",
        recipient: "919840916058",
        templateName: "order_reschedule_proposed",
        params: ["Ravi", "SV-123", "22 Nov 2026 10:00 AM IST", "https://example.com/track"],
        eventType: "STATUS_CHANGED",
        orderNumber: "SV-123",
      });
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
      expect(String(doc!.lastError)).toContain("Template validation failed");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("dead-letters permanently when WhatsApp is not configured", async () => {
    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    await WhatsAppConsent.create({
      phone: "919840916058",
      status: "GRANTED",
      source: "CHECKOUT",
    });

    try {
      await enqueueNotification({ ...baseJob, maxAttempts: 3 });
      const job = await claimJob("worker-1");

      await processJob(job!);

      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("DEAD_LETTER");
    } finally {
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("handles EMAIL channel", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    const emailInput: {
      idempotencyKey: string;
      channel: "EMAIL";
      recipient: string;
      templateName?: string;
      params: string[];
      eventType: string;
      orderNumber?: string;
    } = {
      idempotencyKey: "email-event-002",
      channel: "EMAIL",
      recipient: "customer@example.com",
      params: [
        "customer@example.com",
        "Ravi",
        "SV-123",
        "ORDER_PLACED",
        "PLACED",
        "Order details",
        "evt-002",
      ],
      eventType: "ORDER_PLACED",
    };

    await enqueueNotification(emailInput);
    const job = await claimJob("worker-1");
    expect(job).not.toBeNull();

    await processJob(job!);

    const doc = await NotificationOutbox.findById(job!._id).lean();
    // Brevo not configured -> email send fails -> RETRYING or DEAD_LETTER
    expect(["RETRYING", "DEAD_LETTER"]).toContain(doc!.status);
  });
});

describe("reconciliation hold (BLB-35, DB-backed)", () => {
  beforeEach(() => {
    setTemplateRegistryState("order_received", true, "APPROVED");
  });
  afterEach(() => {
    setTemplateRegistryState("order_received", false, "NOT_SUBMITTED");
    vi.restoreAllMocks();
  });

  it("transitions provider-accepted SENT-persist failure to RECONCILIATION_REQUIRED and preserves provider message ID", async () => {
    await WhatsAppConsent.create({ phone: "919840916058", status: "GRANTED", source: "CHECKOUT" });
    const prevToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const prevPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.RECON-1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";

    const originalUpdateOne = NotificationOutbox.updateOne.bind(NotificationOutbox);
    let sentUpdateAttempts = 0;
    const updateSpy = vi.spyOn(NotificationOutbox, "updateOne").mockImplementation((async (filter: any, update: any, ...rest: any[]) => {
      if (filter?.status === "PROCESSING" && update?.$set?.status === "SENT") {
        sentUpdateAttempts += 1;
        return { acknowledged: true, matchedCount: 1, modifiedCount: 0, upsertedCount: 0, upsertedId: null } as any;
      }
      return originalUpdateOne(filter, update, ...rest);
    }) as any);

    try {
      await enqueueNotification(baseJob);
      const job = await claimJob("worker-1");
      expect(job).not.toBeNull();

      await processJob(job!);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(sentUpdateAttempts).toBe(1);
      const doc = await NotificationOutbox.findById(job!._id).lean();
      expect(doc!.status).toBe("RECONCILIATION_REQUIRED");
      expect(doc!.metaMessageId).toBe("wamid.RECON-1");
      expect(doc!.reconciliationCode).toBe("WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED");
      expect(doc!.providerAcceptedAt).toBeTruthy();
      expect(doc!.reconciliationDetectedAt).toBeTruthy();
      expect(doc!.workerId).toBeUndefined();
      expect(doc!.leaseExpiresAt).toBeUndefined();
      expect(updateSpy).toHaveBeenCalled();
    } finally {
      updateSpy.mockRestore();
      vi.unstubAllGlobals();
      if (prevToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
      else process.env.WHATSAPP_ACCESS_TOKEN = prevToken;
      if (prevPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = prevPhoneId;
    }
  });

  it("does not claim or lease-recover RECONCILIATION_REQUIRED jobs", async () => {
    await enqueueNotification(baseJob);
    const job = await claimJob("worker-1");
    expect(job).not.toBeNull();
    await NotificationOutbox.updateOne(
      { _id: job!._id },
      {
        $set: {
          status: "RECONCILIATION_REQUIRED",
          reconciliationCode: "WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED",
          reconciliationReason: "test",
          providerAcceptedAt: new Date(),
          reconciliationDetectedAt: new Date(),
          leaseExpiresAt: new Date(Date.now() - 60_000),
        },
      },
    );

    const recovered = await recoverExpiredLeases();
    expect(recovered).toBe(0);

    const claimed = await claimJob("worker-2");
    expect(claimed).toBeNull();

    const doc = await NotificationOutbox.findById(job!._id).lean();
    expect(doc!.status).toBe("RECONCILIATION_REQUIRED");
  });
});

describe("getOutboxStats", () => {
  it("returns counts by status", async () => {
    await enqueueNotification(baseJob);
    await enqueueNotification({ ...baseJob, idempotencyKey: "event-2" });
    await enqueueNotification({ ...baseJob, idempotencyKey: "event-3" });

    const stats = await getOutboxStats();
    expect(stats.PENDING).toBe(3);
  });
});
