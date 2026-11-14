import { OTP_EXPIRY_MINUTES } from "./otpService.js";
import { z } from "zod";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Brevo requires a verified sender address. The account's verified sender is
// used by default; BREVO_FROM_EMAIL / BREVO_FROM_NAME may override it.
const DEFAULT_SENDER_EMAIL = "vishnukarthick2507@gmail.com";
const DEFAULT_SENDER_NAME = "Bluebell Bakehouse";

const REQUEST_TIMEOUT_MS = 15_000;

interface BrevoConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

function getBrevoConfig(): BrevoConfig {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL?.trim() || DEFAULT_SENDER_EMAIL;
  const fromName =
    process.env.BREVO_FROM_NAME?.trim() || DEFAULT_SENDER_NAME;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "Brevo API is not configured. Set BREVO_API_KEY env var.",
    );
  }

  return { apiKey, from, fromName };
}

/**
 * Returns true only when the Brevo transactional email API is configured.
 * Used by the controller to distinguish a misconfigured service (503) from a
 * transient delivery failure (502). Never logs credential values.
 */
export function isBrevoConfigured(): boolean {
  const apiKey = process.env.BREVO_API_KEY;
  return Boolean(apiKey && apiKey.trim());
}

/**
 * Returns boolean presence checks for the Brevo API configuration.
 * Intended for the admin diagnostic endpoint.
 *
 * Never returns environment variable values, credential lengths, or partial
 * secrets. Empty strings and whitespace-only values are treated as not
 * present.
 */
export function getBrevoPresenceChecks(): {
  apiKeyPresent: boolean;
} {
  const apiKey = process.env.BREVO_API_KEY;

  const isPresent = (value: string | undefined): boolean =>
    Boolean(value && value.trim());

  return {
    apiKeyPresent: isPresent(apiKey),
  };
}

function otpPurposeLabel(
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET",
): string {
  if (purpose === "LOGIN") {
    return "sign in to your Bluebell Bakehouse account";
  }
  if (purpose === "REGISTER") {
    return "create your Bluebell Bakehouse account";
  }
  if (purpose === "GUEST_CHECKOUT") {
    return "confirm your guest checkout";
  }
  if (purpose === "PASSWORD_RESET") {
    return "reset your Bluebell Bakehouse account password";
  }
  return "complete your request";
}

function buildOtpHtml(
  otp: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET",
): string {
  const label = otpPurposeLabel(purpose);
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
            <tr>
              <td align="center" style="padding: 28px 24px; background-color: #7B4B1E; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px;">Bluebell Bakehouse</h1>
                <p style="color: #f3e5d8; margin: 6px 0 0; font-size: 14px;">Freshly Baked. Made With Love.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 36px 24px; background-color: #ffffff; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1f2937; margin: 0 0 12px; font-size: 22px; font-weight: bold;">Your One-Time Password (OTP)</h2>
                <p style="color: #4b5563; margin: 0 0 26px; font-size: 16px; line-height: 1.5;">
                  Use the code below to ${label}.<br>
                  Please do not share this code with anyone.
                </p>
                <div style="display: inline-block; padding: 20px 36px; background-color: #7B4B1E; border-radius: 8px; font-size: 36px; font-weight: bold; color: #ffffff; letter-spacing: 10px; font-variant-numeric: tabular-nums;">
                  ${otp}
                </div>
                <p style="color: #6b7280; margin: 28px 0 0; font-size: 14px; line-height: 1.5;">
                  This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. If you did not request this code, please ignore this email and contact us if you suspect unauthorised access to your account.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">
                  Bluebell Bakehouse<br>
                  Freshly Baked. Made With Love.<br>
                  This is an automated transactional email. Please do not reply to this message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/**
 * Sends a 6-digit OTP to the customer's email address via the Brevo
 * transactional email API (HTTPS), replacing the previous Nodemailer SMTP
 * transport that was blocked on Render Free (outbound SMTP ports are
 * blocked, causing ETIMEDOUT).
 *
 * @param to - Recipient email address.
 * @param otp - The 6-digit OTP value already generated by the caller.
 * @param purpose - Purpose of the OTP (login / registration / auth / guest checkout).
 * @returns true only when the email was accepted for delivery by Brevo.
 *
 * Authentication uses the server-side BREVO_API_KEY environment variable,
 * which is never logged or exposed to the frontend. Delivery failures
 * (network, auth, timeout, incomplete config) fail closed: false is
 * returned and no OTP session is created by the caller. The OTP value, API
 * key, and recipient address are never written to application logs.
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET" = "LOGIN",
): Promise<boolean> {
  if (!isBrevoConfigured()) {
    console.error(
      "OTP email delivery failed: Brevo API is not configured. Set BREVO_API_KEY env var.",
    );
    return false;
  }

  const { apiKey, from, fromName } = getBrevoConfig();

  const subject = `Your Bluebell Bakehouse OTP Code: ${otp}`;
  const htmlContent = buildOtpHtml(otp, purpose);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
      signal: controller.signal,
    });

    // Brevo returns 201 on successful acceptance. Any other status is a
    // delivery failure; fail closed without logging the response body.
    if (!response.ok) {
      console.error(
        `OTP email delivery failed: Brevo API returned HTTP ${response.status}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("OTP email delivery failed: Brevo API request timed out");
    } else {
      console.error(
        `OTP email delivery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
/**
 * Sends a secret-free alert after a successful administrator login.
 * The recipient must be explicitly configured; the verified sender is never
 * treated as the notification destination.
 */
export async function sendAdminLoginAlert(input: {
  username: string;
  occurredAt: Date;
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!recipient) return false;

  const parsedRecipient = z.string().email().safeParse(recipient);
  if (!parsedRecipient.success || !isBrevoConfigured()) return false;

  const { apiKey, from, fromName } = getBrevoConfig();
  const safeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
  const dateTime = input.occurredAt.toISOString();
  const ipAddress = input.ipAddress?.trim() || "Unavailable";
  const userAgent = input.userAgent?.trim() || "Unavailable";
  const subject = "Admin sign-in alert — Bluebell Bakehouse";
  const htmlContent = `
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f1ea;font-family:Arial,Helvetica,sans-serif;color:#342719">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e6d9c7;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px;background:#70451f;color:#fff;text-align:center"><h1 style="margin:0;font-size:24px">Bluebell Bakehouse</h1><p style="margin:8px 0 0">Admin security alert</p></td></tr>
      <tr><td style="padding:24px"><h2 style="margin-top:0;font-size:20px">Successful administrator sign-in</h2>
        <p>A successful admin login was recorded. If this was not you, secure the administrator account immediately.</p>
        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;overflow-wrap:anywhere">
          <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Username</td><td style="border-bottom:1px solid #eee">${safeText(input.username)}</td></tr>
          <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Date and time (UTC)</td><td style="border-bottom:1px solid #eee">${safeText(dateTime)}</td></tr>
          <tr><td style="font-weight:bold;border-bottom:1px solid #eee">IP address</td><td style="border-bottom:1px solid #eee">${safeText(ipAddress)}</td></tr>
          <tr><td style="font-weight:bold">Browser/device</td><td>${safeText(userAgent)}</td></tr>
        </table>
        <p style="margin:24px 0 0;color:#786c5e;font-size:12px">Automated security notification from Bluebell Bakehouse. This email does not contain credentials or session information.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: fromName },
        to: [{ email: parsedRecipient.data }],
        subject,
        htmlContent,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    // Security alerts are best-effort and must not change login success.
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
const sentAdminLoginAlertEvents = new Set<string>();
const ADMIN_ALERT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Suppresses repeated dispatch of the same request event within this process.
 * This is intentionally best-effort; durable cross-process delivery guarantees
 * require a persisted notification ledger/outbox.
 */
export async function sendAdminLoginAlertOnce(
  eventId: string,
  input: Parameters<typeof sendAdminLoginAlert>[0],
): Promise<boolean> {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId || sentAdminLoginAlertEvents.has(normalizedEventId)) {
    return false;
  }

  try {
    const sent = await sendAdminLoginAlert(input);
    if (sent) {
      sentAdminLoginAlertEvents.add(normalizedEventId);
      setTimeout(() => sentAdminLoginAlertEvents.delete(normalizedEventId), ADMIN_ALERT_DEDUPE_WINDOW_MS).unref?.();
    }
    return sent;
  } catch {
    // Defensive boundary: notification delivery cannot affect authentication.
    return false;
  }
}

export interface CustomerOrderEmailInput {
  recipient: string;
  customerName: string;
  orderNumber: string;
  event: "ORDER_PLACED" | "PAYMENT_CONFIRMED" | "STATUS_CHANGED" | "CANCELLED" | "RESCHEDULE_REQUESTED" | "RESCHEDULE_ACCEPTED" | "RESCHEDULE_REJECTED";
  status: string;
  details: string;
  eventId: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

const customerOrderEmailEvents = new Set<string>();
const CUSTOMER_ORDER_EMAIL_DEDUPE_MS = 15 * 60 * 1000;

/** Sends a best-effort order update; suppression is process-local, not durable. */
export async function sendCustomerOrderEmailOnce(
  input: CustomerOrderEmailInput,
): Promise<boolean> {
  const eventId = input.eventId.trim();
  if (!eventId || customerOrderEmailEvents.has(eventId)) return false;

  const recipient = z.string().trim().email().safeParse(input.recipient);
  if (!recipient.success) return false;

  const labels: Record<CustomerOrderEmailInput["event"], { subject: string; heading: string }> = {
    ORDER_PLACED: { subject: "Order received", heading: "Thank you for your order" },
    PAYMENT_CONFIRMED: { subject: "Payment confirmed", heading: "Your payment is confirmed" },
    STATUS_CHANGED: { subject: "Order update", heading: "Your order status has changed" },
    CANCELLED: { subject: "Order cancelled", heading: "Your order has been cancelled" },
    RESCHEDULE_REQUESTED: { subject: "Rescheduling request received", heading: "We received your timing request" },
    RESCHEDULE_ACCEPTED: { subject: "New order time confirmed", heading: "Your new time is confirmed" },
    RESCHEDULE_REJECTED: { subject: "Rescheduling update", heading: "Your rescheduling request was declined" },
  };

  const label = labels[input.event];
  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f1ea;color:#342719;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e6d9c7;border-radius:12px"><tr><td style="padding:24px;background:#70451f;color:#fff;text-align:center"><h1 style="margin:0;font-size:24px">Bluebell Bakehouse</h1></td></tr><tr><td style="padding:24px"><h2 style="margin-top:0;font-size:20px">${escapeHtml(label.heading)}</h2><p>Hello ${escapeHtml(input.customerName)},</p><p>Here are the latest details for your order.</p><table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;overflow-wrap:anywhere"><tr><td style="font-weight:bold;border-bottom:1px solid #eee">Order</td><td style="border-bottom:1px solid #eee">${escapeHtml(input.orderNumber)}</td></tr><tr><td style="font-weight:bold;border-bottom:1px solid #eee">Status</td><td style="border-bottom:1px solid #eee">${escapeHtml(input.status)}</td></tr><tr><td style="font-weight:bold">Details</td><td>${escapeHtml(input.details)}</td></tr></table><p style="margin:24px 0 0;color:#786c5e;font-size:12px">Automated order update from Bluebell Bakehouse.</p></td></tr></table></td></tr></table></body></html>`;

  try {
    const { apiKey, from, fromName } = getBrevoConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let sent = false;
    try {
      const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: fromName },
          to: [{ email: recipient.data }],
          subject: `Bluebell Bakehouse — ${label.subject} ${input.orderNumber}`,
          htmlContent,
        }),
        signal: controller.signal,
      });
      sent = response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
    if (sent) {
      customerOrderEmailEvents.add(eventId);
      setTimeout(() => customerOrderEmailEvents.delete(eventId), CUSTOMER_ORDER_EMAIL_DEDUPE_MS).unref?.();
    }
    return sent;
  } catch {
    return false;
  }
}

/**
 * Sends an admin notification when a reschedule proposal expires.
 * Reuses ADMIN_NOTIFICATION_EMAIL and Brevo infrastructure.
 * Best-effort: failures are logged but never prevent proposal expiry.
 */
export async function sendRescheduleExpiryAlert(input: {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  originalSlot?: Date | null;
  proposedSlot: Date;
  expiresAt: Date;
}): Promise<boolean> {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!recipient) {
    console.warn(
      "Reschedule expiry notification skipped: ADMIN_NOTIFICATION_EMAIL is not configured.",
    );
    return false;
  }

  const parsedRecipient = z.string().email().safeParse(recipient);
  if (!parsedRecipient.success || !isBrevoConfigured()) {
    console.warn(
      "Reschedule expiry notification skipped: Brevo is not configured or admin email is invalid.",
    );
    return false;
  }

  const { apiKey, from, fromName } = getBrevoConfig();
  const safeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
  const orderLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/admin/orders`;
  const expiresAtStr = input.expiresAt.toISOString();
  const proposedSlotStr = input.proposedSlot.toISOString();
  const originalSlotStr = input.originalSlot
    ? new Date(input.originalSlot).toISOString()
    : "Not set";
  const customerEmailSafe = input.customerEmail
    ? safeText(input.customerEmail)
    : "Not provided";
  const customerPhoneSafe = input.customerPhone
    ? safeText(input.customerPhone)
    : "Not provided";
  const subject = "Reschedule proposal expired — Bluebell Bakehouse";
  const htmlContent = `
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f1ea;color:#342719;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e6d9c7;border-radius:12px;overflow:hidden">
    <tr><td style="padding:24px;background:#70451f;color:#fff;text-align:center"><h1 style="margin:0;font-size:24px">Bluebell Bakehouse</h1></td></tr>
    <tr><td style="padding:24px"><h2 style="margin-top:0;font-size:20px">Reschedule Proposal Expired</h2>
      <p>The customer did not respond to a reschedule proposal before it expired. The original confirmed slot has been restored.</p>
      <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;overflow-wrap:anywhere">
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Order Number</td><td style="border-bottom:1px solid #eee">${safeText(input.orderNumber)}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Customer Name</td><td style="border-bottom:1px solid #eee">${safeText(input.customerName)}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Customer Email</td><td style="border-bottom:1px solid #eee">${customerEmailSafe}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Customer Phone</td><td style="border-bottom:1px solid #eee">${customerPhoneSafe}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Original Confirmed Slot</td><td style="border-bottom:1px solid #eee">${originalSlotStr}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Proposed Slot</td><td style="border-bottom:1px solid #eee">${proposedSlotStr}</td></tr>
        <tr><td style="font-weight:bold;border-bottom:1px solid #eee">Proposal Expired At</td><td style="border-bottom:1px solid #eee">${expiresAtStr}</td></tr>
      </table>
      <p style="margin:24px 0 0">Review and manage this order: <a href="${safeText(orderLink)}" style="color:#70451f">View Order in Admin</a></p>
      <p style="margin:24px 0 0;color:#786c5e;font-size:12px">Automated notification from Bluebell Bakehouse.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: fromName },
        to: [{ email: parsedRecipient.data }],
        subject,
        htmlContent,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
