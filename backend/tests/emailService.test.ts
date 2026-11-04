import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendOtpEmail,
  isBrevoSmtpConfigured,
  verifyBrevoSmtpConnection,
  getBrevoSmtpPresenceChecks,
} from "../src/services/emailService.js";

const sendMailMock = vi.fn();
const verifyMock = vi.fn().mockResolvedValue(true);

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
      verify: verifyMock,
    })),
  },
}));

const brevoEnvVars = [
  "BREVO_SMTP_HOST",
  "BREVO_SMTP_PORT",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_KEY",
  "BREVO_FROM_EMAIL",
  "BREVO_FROM_NAME",
];

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

describe("sendOtpEmail (Brevo SMTP via Nodemailer)", () => {
  beforeEach(() => {
    clearBrevoEnv();
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({});
  });

  afterEach(() => {
    clearBrevoEnv();
    vi.restoreAllMocks();
  });

  it("returns true and sends mail when Brevo SMTP is configured", async () => {
    setBrevoEnv({
      BREVO_SMTP_HOST: "smtp-relay.brevo.com",
      BREVO_SMTP_PORT: "587",
      BREVO_SMTP_USER: "user@smtp-brevo.com",
      BREVO_SMTP_KEY: "smtp-key",
      BREVO_FROM_EMAIL: "noreply@example.com",
      BREVO_FROM_NAME: "S.V. Sweets & Bakers",
    });

    const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(result).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailOptions = sendMailMock.mock.calls[0]![0]!;
    expect(mailOptions.from).toBe('"S.V. Sweets & Bakers" <noreply@example.com>');
    expect(mailOptions.to).toBe("customer@example.com");
    expect(mailOptions.subject).toContain("123456");
    expect(mailOptions.html).toContain("123456");
    expect(mailOptions.html).toContain("10 minutes");
  });

  it("returns false when Brevo SMTP configuration is incomplete", async () => {
    // Deliberately leave all Brevo vars unset.
    const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(result).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("returns false on email delivery failure and does not throw", async () => {
    setBrevoEnv({
      BREVO_SMTP_HOST: "smtp-relay.brevo.com",
      BREVO_SMTP_PORT: "587",
      BREVO_SMTP_USER: "user@smtp-brevo.com",
      BREVO_SMTP_KEY: "smtp-key",
      BREVO_FROM_EMAIL: "noreply@example.com",
      BREVO_FROM_NAME: "S.V. Sweets & Bakers",
    });
    sendMailMock.mockRejectedValue(new Error("SMTP connection failed"));

    const result = await sendOtpEmail("customer@example.com", "123456", "REGISTER");

    expect(result).toBe(false);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("uses port 465 as secure when configured", async () => {
    setBrevoEnv({
      BREVO_SMTP_HOST: "smtp-relay.brevo.com",
      BREVO_SMTP_PORT: "465",
      BREVO_SMTP_USER: "user@smtp-brevo.com",
      BREVO_SMTP_KEY: "smtp-key",
      BREVO_FROM_EMAIL: "noreply@example.com",
    });
    await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("includes OTP expiry information in the email body", async () => {
    setBrevoEnv({
      BREVO_SMTP_HOST: "smtp-relay.brevo.com",
      BREVO_SMTP_PORT: "587",
      BREVO_SMTP_USER: "user@smtp-brevo.com",
      BREVO_SMTP_KEY: "smtp-key",
      BREVO_FROM_EMAIL: "noreply@example.com",
    });
    await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    const html = sendMailMock.mock.calls[0]![0]!.html as string;
    expect(html).toContain("123456");
    expect(html).toContain("minutes");
    expect(html).toContain("S.V. Sweets & Bakers");
  });

  it("never exposes SMTP credentials in the email", async () => {
    setBrevoEnv({
      BREVO_SMTP_HOST: "smtp-relay.brevo.com",
      BREVO_SMTP_PORT: "587",
      BREVO_SMTP_USER: "user@smtp-brevo.com",
      BREVO_SMTP_KEY: "secret-key",
      BREVO_FROM_EMAIL: "noreply@example.com",
    });
    await sendOtpEmail("customer@example.com", "123456", "LOGIN");

    const html = sendMailMock.mock.calls[0]![0]!.html as string;
    expect(html).not.toContain("secret-key");
    expect(html).not.toContain("user@smtp-brevo.com");
  });

  describe("verifyBrevoSmtpConnection", () => {
    it("returns true when SMTP verify succeeds", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      verifyMock.mockResolvedValue(true);
      const result = await verifyBrevoSmtpConnection();
      expect(result.ok).toBe(true);
    });

    it("returns false when not configured", async () => {
      clearBrevoEnv();
      const result = await verifyBrevoSmtpConnection();
      expect(result.ok).toBe(false);
      expect(result.detail).toBe("Brevo SMTP is not configured");
    });

    it("returns false when transporter.verify rejects (auth/connection failure)", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "wrong-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      verifyMock.mockRejectedValue(new Error("Invalid login"));
      const result = await verifyBrevoSmtpConnection();
      expect(result.ok).toBe(false);
      expect(verifyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendOtpEmail failure modes", () => {
    it("returns false on SMTP authentication failure", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "wrong-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      sendMailMock.mockRejectedValue(
        Object.assign(new Error("Invalid login"), { code: "AUTHENTICATION_FAILED" }),
      );

      const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");
      expect(result).toBe(false);
    });

    it("returns false on SMTP connection failure", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      sendMailMock.mockRejectedValue(
        Object.assign(new Error("Connection timed out"), { code: "ECONNREFUSED" }),
      );

      const result = await sendOtpEmail("customer@example.com", "123456", "LOGIN");
      expect(result).toBe(false);
    });
  });

  describe("isBrevoSmtpConfigured", () => {
    it("returns true when all Brevo SMTP vars are set", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(isBrevoSmtpConfigured()).toBe(true);
    });

    it("returns false when BREVO_SMTP_HOST is missing", async () => {
      setBrevoEnv({
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(isBrevoSmtpConfigured()).toBe(false);
    });

    it("returns false when BREVO_SMTP_KEY is missing", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(isBrevoSmtpConfigured()).toBe(false);
    });

    it("returns false when BREVO_FROM_EMAIL is missing", async () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_PORT: "587",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
      });
      expect(isBrevoSmtpConfigured()).toBe(false);
    });

    it("returns false when no Brevo vars are set", async () => {
      expect(isBrevoSmtpConfigured()).toBe(false);
    });
  });

  describe("getBrevoSmtpPresenceChecks", () => {
    it("returns true for all checks when all Brevo SMTP vars are set", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      const checks = getBrevoSmtpPresenceChecks();
      expect(checks).toEqual({
        hostPresent: true,
        userPresent: true,
        keyPresent: true,
        fromEmailPresent: true,
      });
    });

    it("returns hostPresent false when BREVO_SMTP_HOST is missing", () => {
      setBrevoEnv({
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(getBrevoSmtpPresenceChecks().hostPresent).toBe(false);
    });

    it("returns userPresent false when BREVO_SMTP_USER is missing", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(getBrevoSmtpPresenceChecks().userPresent).toBe(false);
    });

    it("returns keyPresent false when BREVO_SMTP_KEY is missing", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      expect(getBrevoSmtpPresenceChecks().keyPresent).toBe(false);
    });

    it("returns fromEmailPresent false when BREVO_FROM_EMAIL is missing", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "smtp-key",
      });
      expect(getBrevoSmtpPresenceChecks().fromEmailPresent).toBe(false);
    });

    it("returns all checks false when no Brevo vars are set", () => {
      clearBrevoEnv();
      expect(getBrevoSmtpPresenceChecks()).toEqual({
        hostPresent: false,
        userPresent: false,
        keyPresent: false,
        fromEmailPresent: false,
      });
    });

    it("treats whitespace-only values as not present", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "   ",
        BREVO_SMTP_USER: "\t",
        BREVO_SMTP_KEY: "\n ",
        BREVO_FROM_EMAIL: "  ",
      });
      expect(getBrevoSmtpPresenceChecks()).toEqual({
        hostPresent: false,
        userPresent: false,
        keyPresent: false,
        fromEmailPresent: false,
      });
    });

    it("never returns environment variable values or credential hints", () => {
      setBrevoEnv({
        BREVO_SMTP_HOST: "smtp-relay.brevo.com",
        BREVO_SMTP_USER: "user@smtp-brevo.com",
        BREVO_SMTP_KEY: "super-secret-key-value",
        BREVO_FROM_EMAIL: "noreply@example.com",
      });
      const checks = getBrevoSmtpPresenceChecks();
      const serialized = JSON.stringify(checks);
      expect(serialized).not.toContain("smtp-relay.brevo.com");
      expect(serialized).not.toContain("user@smtp-brevo.com");
      expect(serialized).not.toContain("super-secret-key-value");
      expect(serialized).not.toContain("noreply@example.com");
      expect(Object.values(checks).every((value) => typeof value === "boolean")).toBe(true);
    });
  });
});
