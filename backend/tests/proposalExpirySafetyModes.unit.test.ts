import { beforeEach, describe, expect, it, vi } from "vitest";

const updateOneMock = vi.fn();
const findMock = vi.fn();

vi.mock("../src/models/Order.js", () => ({
  Order: {
    updateOne: (...args: unknown[]) => updateOneMock(...args),
    find: (...args: unknown[]) => findMock(...args),
  },
}));

const sendRescheduleExpiryAlertMock = vi.fn();
const isBrevoConfiguredMock = vi.fn();
const emitEmailSuppressionDiagnosticMock = vi.fn((context: string) => {
  console.info(JSON.stringify({ event: "email.external_delivery.suppressed", channel: "email", context, reason: "EMAIL_EXTERNAL_DELIVERY_BLOCKED" }));
});
vi.mock("../src/services/emailService.js", () => ({
  sendRescheduleExpiryAlert: (...args: unknown[]) => sendRescheduleExpiryAlertMock(...args),
  isBrevoConfigured: (...args: unknown[]) => isBrevoConfiguredMock(...args),
  emitEmailSuppressionDiagnostic: (context: string) => emitEmailSuppressionDiagnosticMock(context),
}));

let uatBlocked = false;
vi.mock("../src/config/uatSafeMode.js", () => ({
  isUatExternalSideEffectsBlocked: () => uatBlocked,
}));

let emailBlocked = false;
vi.mock("../src/config/emailDeliverySafety.js", () => ({
  isExternalEmailDeliveryBlocked: () => emailBlocked,
}));

const logUatSuppressedMock = vi.fn();
vi.mock("../src/services/uatSafetyLog.js", () => ({
  logUatSuppressed: (...args: unknown[]) => logUatSuppressedMock(...args),
}));

import { processPendingExpiryNotifications } from "../src/services/proposalExpiry.js";

function mockOrderWithProposal(status: "PENDING" | "FAILED", attempts = 2) {
  const now = new Date("2026-01-01T00:00:00Z");
  findMock.mockReturnValue({
    select: () => ({
      limit: () => ({
        lean: async () => [
          {
            _id: "order-1",
            orderNumber: "SV-1",
            customerName: "Ravi",
            rescheduleProposals: [
              {
                proposalId: "p1",
                status: "EXPIRED",
                proposedSlot: now,
                expiresAt: now,
                expiryNotificationStatus: status,
                expiryNotificationAttempts: attempts,
              },
            ],
          },
        ],
      }),
    }),
  });
  return now;
}

describe("proposal expiry UAT/email safety interaction (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uatBlocked = false;
    emailBlocked = false;
    isBrevoConfiguredMock.mockReturnValue(true);
    sendRescheduleExpiryAlertMock.mockResolvedValue(true);
  });

  it("UAT true + email block true: UAT suppression takes precedence", async () => {
    uatBlocked = true;
    emailBlocked = true;
    const now = mockOrderWithProposal("PENDING", 1);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    const result = await processPendingExpiryNotifications(now);

    expect(sendRescheduleExpiryAlertMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: {
        "rescheduleProposals.$[p].expiryNotificationStatus": "PENDING",
        "rescheduleProposals.$[p].expiryNotificationNextRetryAt": new Date(now.getTime() + 60_000),
      },
    });
    expect(String(updateOneMock.mock.calls[0]![1].$set["rescheduleProposals.$[p].expiryNotificationLastError"])).toContain(
      "Suppressed in UAT_SAFE_MODE",
    );
    expect(String(updateOneMock.mock.calls[0]![1].$set["rescheduleProposals.$[p].expiryNotificationLastError"])).not.toContain(
      "EMAIL_EXTERNAL_DELIVERY_BLOCKED=true",
    );
    expect(result.skippedCount).toBe(1);
  });

  it("UAT false + email block true: email-specific suppression applies", async () => {
    uatBlocked = false;
    emailBlocked = true;
    const now = mockOrderWithProposal("PENDING", 1);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    const result = await processPendingExpiryNotifications(now);

    expect(sendRescheduleExpiryAlertMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: {
        "rescheduleProposals.$[p].expiryNotificationStatus": "PENDING",
        "rescheduleProposals.$[p].expiryNotificationNextRetryAt": new Date(now.getTime() + 60_000),
      },
    });
    expect(String(updateOneMock.mock.calls[0]![1].$set["rescheduleProposals.$[p].expiryNotificationLastError"])).toContain(
      "EMAIL_EXTERNAL_DELIVERY_BLOCKED=true",
    );
    expect(result.skippedCount).toBe(1);
  });

  it("FAILED proposal notification remains FAILED when suppressed; retry count unchanged", async () => {
    uatBlocked = false;
    emailBlocked = true;
    const now = mockOrderWithProposal("FAILED", 3);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await processPendingExpiryNotifications(now);

    expect(sendRescheduleExpiryAlertMock).not.toHaveBeenCalled();
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: {
        "rescheduleProposals.$[p].expiryNotificationStatus": "FAILED",
      },
    });
    // No attempt increment in suppression update
    expect(updateOneMock.mock.calls[0]![1].$set["rescheduleProposals.$[p].expiryNotificationAttempts"]).toBeUndefined();
  });

  it("PENDING proposal notification remains PENDING when suppressed; retry count unchanged", async () => {
    uatBlocked = false;
    emailBlocked = true;
    const now = mockOrderWithProposal("PENDING", 0);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await processPendingExpiryNotifications(now);

    expect(sendRescheduleExpiryAlertMock).not.toHaveBeenCalled();
    expect(updateOneMock.mock.calls[0]![1]).toMatchObject({
      $set: {
        "rescheduleProposals.$[p].expiryNotificationStatus": "PENDING",
      },
    });
    expect(updateOneMock.mock.calls[0]![1].$set["rescheduleProposals.$[p].expiryNotificationAttempts"]).toBeUndefined();
  });

  it("Decision A: email-block suppression does not pass raw orderNumber to logUatSuppressed", async () => {
    uatBlocked = false;
    emailBlocked = true;
    const now = mockOrderWithProposal("PENDING", 1);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await processPendingExpiryNotifications(now);

    expect(logUatSuppressedMock).toHaveBeenCalled();
    const call = logUatSuppressedMock.mock.calls.find(
      (c) => c[0] === "proposal_expiry.admin_notification.email_delivery_blocked",
    );
    expect(call).toBeDefined();
    const ctx = (call?.[1] ?? {}) as Record<string, unknown>;
    expect(ctx.orderNumber).toBeUndefined();
    expect(JSON.stringify(ctx)).not.toContain("SV-1");
  });

  it("Decision A: UAT suppression does not pass raw orderNumber to logUatSuppressed", async () => {
    uatBlocked = true;
    emailBlocked = false;
    const now = mockOrderWithProposal("PENDING", 1);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await processPendingExpiryNotifications(now);

    const call = logUatSuppressedMock.mock.calls.find(
      (c) => c[0] === "proposal_expiry.admin_notification",
    );
    expect(call).toBeDefined();
    const ctx = (call?.[1] ?? {}) as Record<string, unknown>;
    expect(ctx.orderNumber).toBeUndefined();
    expect(JSON.stringify(ctx)).not.toContain("SV-1");
  });

  it("Decision C: emits PII-safe email suppression diagnostic when UAT=false and EMAIL_EXTERNAL_DELIVERY_BLOCKED=true", async () => {
    uatBlocked = false;
    emailBlocked = true;
    const now = mockOrderWithProposal("PENDING", 1);
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      await processPendingExpiryNotifications(now);

      const logs = infoSpy.mock.calls.map((args: unknown[]) => args.map((a: unknown) => String(a)).join(" "));
      const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
      expect(suppression).toBeDefined();
      expect(suppression).toContain('"channel":"email"');
      expect(suppression).toContain('"reason":"EMAIL_EXTERNAL_DELIVERY_BLOCKED"');
      // PII canaries / sensitive fields must not appear
      const joined = logs.join("\n");
      expect(joined).not.toContain("SV-1");
      expect(joined).not.toContain("Ravi");
      expect(joined).not.toContain("order-1");
      expect(joined).not.toContain("p1");
    } finally {
      infoSpy.mockRestore();
    }
  });
});
