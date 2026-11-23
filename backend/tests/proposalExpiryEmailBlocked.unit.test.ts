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
vi.mock("../src/services/emailService.js", () => ({
  sendRescheduleExpiryAlert: (...args: unknown[]) => sendRescheduleExpiryAlertMock(...args),
  isBrevoConfigured: (...args: unknown[]) => isBrevoConfiguredMock(...args),
  emitEmailSuppressionDiagnostic: vi.fn(),
}));

vi.mock("../src/config/uatSafeMode.js", () => ({
  isUatExternalSideEffectsBlocked: () => false,
}));

let emailBlocked = false;
vi.mock("../src/config/emailDeliverySafety.js", () => ({
  isExternalEmailDeliveryBlocked: () => emailBlocked,
}));

vi.mock("../src/services/uatSafetyLog.js", () => ({
  logUatSuppressed: vi.fn(),
}));

import { processPendingExpiryNotifications } from "../src/services/proposalExpiry.js";

describe("proposal expiry email suppression (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailBlocked = false;
    isBrevoConfiguredMock.mockReturnValue(true);
    sendRescheduleExpiryAlertMock.mockResolvedValue(true);
  });

  it("does not send or consume attempts when EMAIL_EXTERNAL_DELIVERY_BLOCKED=true", async () => {
    emailBlocked = true;
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
                  expiryNotificationStatus: "PENDING",
                  expiryNotificationAttempts: 0,
                },
              ],
            },
          ],
        }),
      }),
    });
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
});
