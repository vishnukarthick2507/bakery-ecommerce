import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  sendOtpEmail,
  sendCustomerOrderEmailOnce,
  sendAdminLoginAlertOnce,
  sendRescheduleExpiryAlert,
} from "../src/services/emailService.js";

const CANARIES = [
  "test.customer@example.invalid",
  "TEST_OTP_123456",
  "TEST_BREVO_API_KEY_SECRET",
  "TEST_CUSTOMER_MESSAGE_BODY",
  "TEST_ORDER_PRIVATE_DETAILS",
  "+15550001111",
];

function clearEnv() {
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_FROM_EMAIL;
  delete process.env.BREVO_FROM_NAME;
  delete process.env.ADMIN_NOTIFICATION_EMAIL;
  delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
  delete process.env.UAT_SAFE_MODE;
}

function getLoggedStrings(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((args: unknown[]) => args.map((a: unknown) => String(a)).join(" "));
}

function assertNoCanaries(logged: string[]) {
  const joined = logged.join("\n");
  for (const canary of CANARIES) {
    expect(joined).not.toContain(canary);
  }
}

describe("email safety suppression logging - PII safety (synthetic canaries only)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearEnv();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    process.env.BREVO_API_KEY = "TEST_BREVO_API_KEY_SECRET";
    process.env.BREVO_FROM_EMAIL = "from@example.com";
    process.env.BREVO_FROM_NAME = "Bluebell";
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.invalid";
    process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    clearEnv();
  });

  it("OTP suppression emits expected diagnostic fields and no canary PII/secrets", async () => {
    const result = await sendOtpEmail("test.customer@example.invalid", "TEST_OTP_123456", "LOGIN");
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const logs = getLoggedStrings(infoSpy);
    assertNoCanaries(logs);
    const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
    expect(suppression).toBeDefined();
    expect(suppression).toContain('"channel":"email"');
    expect(suppression).toContain('"reason":"EMAIL_EXTERNAL_DELIVERY_BLOCKED"');
    expect(suppression).toContain('"context":"otp"');
  });

  it("customer order suppression emits expected diagnostic fields and no canary PII/secrets", async () => {
    const result = await sendCustomerOrderEmailOnce({
      recipient: "test.customer@example.invalid",
      customerName: "TEST_ORDER_PRIVATE_DETAILS",
      orderNumber: "TEST_ORDER_PRIVATE_DETAILS",
      event: "ORDER_PLACED",
      status: "PENDING",
      details: "TEST_CUSTOMER_MESSAGE_BODY +15550001111",
      eventId: "evt-pii-test",
    });
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const logs = getLoggedStrings(infoSpy);
    assertNoCanaries(logs);
    const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
    expect(suppression).toBeDefined();
    expect(suppression).toContain('"context":"customer_order"');
  });

  it("admin login alert suppression emits expected diagnostic fields and no canary PII/secrets", async () => {
    const result = await sendAdminLoginAlertOnce("evt-admin-pii", {
      username: "TEST_ORDER_PRIVATE_DETAILS",
      occurredAt: new Date("2026-01-01T00:00:00Z"),
      ipAddress: "155.500.0.111",
      userAgent: "TEST_CUSTOMER_MESSAGE_BODY",
    });
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const logs = getLoggedStrings(infoSpy);
    // admin alert has its own structured diagnostics; ensure no canaries in any info log
    assertNoCanaries(logs);
    const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
    expect(suppression).toBeDefined();
    expect(suppression).toContain('"context":"admin_login_alert"');
  });

  it("reschedule expiry suppression emits expected diagnostic fields and no canary PII/secrets", async () => {
    const result = await sendRescheduleExpiryAlert({
      orderNumber: "TEST_ORDER_PRIVATE_DETAILS",
      customerName: "TEST_ORDER_PRIVATE_DETAILS",
      customerPhone: "+15550001111",
      customerEmail: "test.customer@example.invalid",
      proposedSlot: new Date("2026-01-02T10:00:00Z"),
      expiresAt: new Date("2026-01-01T10:00:00Z"),
    });
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const logs = getLoggedStrings(infoSpy);
    assertNoCanaries(logs);
    const suppression = logs.find((l) => l.includes("email.external_delivery.suppressed"));
    expect(suppression).toBeDefined();
    expect(suppression).toContain('"context":"reschedule_expiry_alert"');
  });
});
