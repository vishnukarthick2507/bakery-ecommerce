import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendOtpEmail,
  sendAdminLoginAlertOnce,
  sendCustomerOrderEmailOnce,
  isBrevoConfigured,
  getBrevoPresenceChecks,
} from "../src/services/emailService.js";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const brevoEnvVars = ["BREVO_API_KEY", "BREVO_SMTP_HOST", "BREVO_SMTP_USER", "BREVO_SMTP_KEY", "BREVO_FROM_EMAIL", "BREVO_FROM_NAME", "ADMIN_NOTIFICATION_EMAIL"];

function setBrevoEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

function clearBrevoEnv() {
  for (const key of brevoEnvVars) {
    delete process.env[key];
  }
}

describe("sendOtpEmail (Brevo HTTPS transactional API)", () => {
  beforeEach(() => {
    clearBrevoEnv();
    fetchMock.mockReset();
    // Brevo returns 201 on successful acceptance.
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
  });

  afterEach(() => {
    clearBrevoEnv();
  });

  it("returns true and calls Brevo API when configured", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
      BREVO_FROM_EMAIL: "vishnukarthick2507@gmail.com",
      BREVO_FROM_NAME: "Bluebell Bakehouse",
    });

    const result = await sendOtpEmail(
      "customer@example.com",
      "123456",
      "LOGIN",
    );

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "api-key": "test-api-key",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({
      email: "vishnukarthick2507@gmail.com",
      name: "Bluebell Bakehouse",
    });
    expect(body.to).toEqual([{ email: "customer@example.com" }]);
    expect(body.subject).toContain("123456");
    expect(body.htmlContent).toContain("123456");
    expect(body.htmlContent).toContain("10 minutes");
    expect(body.htmlContent).toContain("Bluebell Bakehouse");
  });

  it("uses the verified sender by default when BREVO_FROM_* are unset", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
    });

    await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.sender.email).toBe("vishnukarthick2507@gmail.com");
    expect(body.sender.name).toBe("Bluebell Bakehouse");
  });

  it("returns false when Brevo API is not configured and does not call fetch", async () => {
    // Deliberately leave BREVO_API_KEY unset.
    const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false on Brevo API failure and does not throw", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
    });
    fetchMock.mockResolvedValue({ ok: false, status: 400 });

    const result = await sendOtpEmail("customer@example.com", "123456", "REGISTER");

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false on request timeout and does not throw", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
    });
    const abortError = Object.assign(
      new Error("The operation was aborted"),
      { name: "AbortError" },
    );
    fetchMock.mockRejectedValue(abortError);

    const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false on network error and does not throw", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
    });
    fetchMock.mockRejectedValue(new Error("Network failure"));

    const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(result).toBe(false);
  });

  it("applies a request timeout via AbortController", async () => {
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
    });
    await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.signal).toBeDefined();
  });
});

describe("isBrevoConfigured", () => {
  beforeEach(() => {
    clearBrevoEnv();
  });

  afterEach(() => {
    clearBrevoEnv();
  });

  it("returns true when BREVO_API_KEY is set", () => {
    setBrevoEnv({ BREVO_API_KEY: "test-api-key" });
    expect(isBrevoConfigured()).toBe(true);
  });

  it("returns false when BREVO_API_KEY is missing", () => {
    expect(isBrevoConfigured()).toBe(false);
  });

  it("returns false when BREVO_API_KEY is whitespace-only", () => {
    setBrevoEnv({ BREVO_API_KEY: "   \t " });
    expect(isBrevoConfigured()).toBe(false);
  });
});

describe("getBrevoPresenceChecks", () => {
  beforeEach(() => {
    clearBrevoEnv();
  });

  afterEach(() => {
    clearBrevoEnv();
  });

  it("returns apiKeyPresent true when BREVO_API_KEY is set", () => {
    setBrevoEnv({ BREVO_API_KEY: "test-api-key" });
    expect(getBrevoPresenceChecks()).toEqual({ apiKeyPresent: true });
  });

  it("returns apiKeyPresent false when BREVO_API_KEY is missing", () => {
    expect(getBrevoPresenceChecks()).toEqual({ apiKeyPresent: false });
  });

  it("treats whitespace-only API key as not present", () => {
    setBrevoEnv({ BREVO_API_KEY: "   " });
    expect(getBrevoPresenceChecks()).toEqual({ apiKeyPresent: false });
  });

  it("never returns environment variable values or credential hints", () => {
    setBrevoEnv({
      BREVO_API_KEY: "super-secret-api-key-value",
    });
    const checks = getBrevoPresenceChecks();
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toContain("super-secret-api-key-value");
    expect(Object.values(checks).every((value) => typeof value === "boolean")).toBe(true);
  });
});

describe("admin login email alerts", () => {
  beforeEach(() => {
    clearBrevoEnv();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    setBrevoEnv({
      BREVO_API_KEY: "test-api-key",
      ADMIN_NOTIFICATION_EMAIL: "security@example.com",
    });
  });

  afterEach(() => clearBrevoEnv());

  it("sends a branded, escaped alert using only approved security context", async () => {
    const result = await sendAdminLoginAlertOnce("event-unique-001", {
      username: "admin<script>",
      occurredAt: new Date("2026-11-10T12:34:56.000Z"),
      ipAddress: "192.0.2.10",
      userAgent: "TestBrowser/1.0",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([{ email: "security@example.com" }]);
    expect(body.subject).toContain("Admin sign-in alert");
    expect(body.htmlContent).toContain("&lt;script&gt;");
    expect(body.htmlContent).toContain("192.0.2.10");
    expect(body.htmlContent).toContain("TestBrowser/1.0");
    expect(body.htmlContent).not.toMatch(/password|otp|jwt|cookie|token|secret/i);
  });

  it("suppresses a duplicate request event", async () => {
    await sendAdminLoginAlertOnce("event-unique-duplicate", {
      username: "admin",
      occurredAt: new Date(),
    });
    const duplicate = await sendAdminLoginAlertOnce("event-unique-duplicate", {
      username: "admin",
      occurredAt: new Date(),
    });

    expect(duplicate).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false without sending when notification destination is missing", async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const sent = await sendAdminLoginAlertOnce("event-no-recipient", {
      username: "admin",
      occurredAt: new Date(),
    });

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false and does not throw when Brevo delivery fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    await expect(sendAdminLoginAlertOnce("event-network-failure", {
      username: "admin",
      occurredAt: new Date(),
    })).resolves.toBe(false);
  });
});

describe("customer order email notifications", () => {
  beforeEach(() => {
    clearBrevoEnv();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    setBrevoEnv({ BREVO_API_KEY: "test-api-key" });
  });
  afterEach(() => clearBrevoEnv());

  const notification = (eventId: string) => ({
    recipient: "verified@example.com",
    customerName: "A <b>Customer</b>",
    orderNumber: "BB-123",
    event: "ORDER_PLACED" as const,
    status: "PLACED",
    details: "Cake <script>alert(1)</script> × 2; total 500",
    eventId,
  });

  it("sends a branded escaped notice to the provided customer address without secrets", async () => {
    await expect(sendCustomerOrderEmailOnce(notification("customer-test-order"))).resolves.toBe(true);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([{ email: "verified@example.com" }]);
    expect(body.subject).toContain("BB-123");
    expect(body.htmlContent).toContain("&lt;b&gt;Customer&lt;/b&gt;");
    expect(body.htmlContent).toContain("&lt;script&gt;");
    expect(body.htmlContent).not.toContain("<script>");
    expect(body.htmlContent).not.toMatch(/otp|password|token|credential|razorpay_payment_id/i);
  });

  it("suppresses duplicate event delivery in this process", async () => {
    await sendCustomerOrderEmailOnce(notification("customer-test-duplicate"));
    await expect(sendCustomerOrderEmailOnce(notification("customer-test-duplicate"))).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed delivery and safely handles invalid addresses", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    await expect(sendCustomerOrderEmailOnce(notification("customer-test-retry"))).resolves.toBe(false);
    await expect(sendCustomerOrderEmailOnce(notification("customer-test-retry"))).resolves.toBe(true);
    await expect(sendCustomerOrderEmailOnce({ ...notification("customer-test-invalid"), recipient: "invalid" })).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
