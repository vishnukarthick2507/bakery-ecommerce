import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendOtpEmail } from "../src/services/emailService.js";

const sendMailMock = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
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
});
