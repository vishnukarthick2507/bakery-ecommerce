import { OTP_EXPIRY_MINUTES } from "./otpService.js";
import { z } from "zod";
import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "./uatSafetyLog.js";
import { isExternalEmailDeliveryBlocked } from "../config/emailDeliverySafety.js";

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

type BrevoSendResult = {
  ok: boolean;
  suppressed: boolean;
  exception?: boolean;
};

export function emitEmailSuppressionDiagnostic(context: string): void {
  try {
    console.info(
      JSON.stringify({
        event: "email.external_delivery.suppressed",
        channel: "email",
        context,
        reason: "EMAIL_EXTERNAL_DELIVERY_BLOCKED",
      }),
    );
  } catch {
    // Diagnostics must never affect email delivery control flow.
  }
}

/**
 * Central Brevo provider boundary. All external email HTTP calls must go through this helper.
 * When EMAIL_EXTERNAL_DELIVERY_BLOCKED=true, no provider call is made and suppression is returned.
 */
async function postBrevoTransactionalEmail(
  payload: Record<string, unknown>,
  context: string,
): Promise<BrevoSendResult> {
  if (isExternalEmailDeliveryBlocked()) {
    emitEmailSuppressionDiagnostic(context);
    return { ok: false, suppressed: true };
  }

  const { apiKey } = getBrevoConfig();
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
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: response.ok, suppressed: false };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Email delivery failed: Brevo API request timed out");
    } else {
      console.error(
        `Email delivery failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return { ok: false, suppressed: false, exception: true };
  } finally {
    clearTimeout(timeoutId);
  }
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
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("email.otp", { purpose });
    // Suppressed (not delivered to provider). Return non-success so callers do not
    // treat as successful external delivery; UAT-aware callers may proceed safely.
    return false;
  }

  if (!isBrevoConfigured()) {
    console.error(
      "OTP email delivery failed: Brevo API is not configured. Set BREVO_API_KEY env var.",
    );
    return false;
  }

  const { from, fromName } = getBrevoConfig();

  const subject = `Your Bluebell Bakehouse OTP Code: ${otp}`;
  const htmlContent = buildOtpHtml(otp, purpose);

  const result = await postBrevoTransactionalEmail(
    {
      sender: { email: from, name: fromName },
      to: [{ email: to }],
      subject,
      htmlContent,
    },
    "otp",
  );

  if (result.suppressed) {
    return false;
  }

  if (!result.ok) {
    console.error("OTP email delivery failed: Brevo API did not accept the message.");
    return false;
  }

  return true;
}
type AdminLoginAlertInput = {
  username: string;
  occurredAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

type AdminLoginAlertOutcome =
  | "attempted"
  | "sent"
  | "suppressed"
  | "failed"
  | "configuration_missing"
  | "uat_suppressed";

const ADMIN_LOGIN_ALERT_EVENT_PREFIX = "admin_login_alert";
const ADMIN_ALERT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_ALERT_DEDUPE_MAX_ENTRIES = 1_000;

type AdminLoginAlertClaim = { claimedAt: number; expiresAt: number; claimToken: string };
const adminLoginAlertClaims = new Map<string, AdminLoginAlertClaim>();

function createAdminLoginAlertClaimToken(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();
  return `claim_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function releaseAdminLoginAlertClaimIfOwned(eventId: string, claimToken: string): boolean {
  const current = adminLoginAlertClaims.get(eventId);
  if (!current) return false;
  if (current.claimToken !== claimToken) return false;
  adminLoginAlertClaims.delete(eventId);
  return true;
}

function emitAdminLoginAlertDiagnostic(
  outcome: AdminLoginAlertOutcome,
  reason?: string,
): void {
  try {
    const payload: Record<string, string> = {
      event: `${ADMIN_LOGIN_ALERT_EVENT_PREFIX}.${outcome}`,
      outcome,
      channel: "email",
    };
    if (reason) payload.reason = reason;
    // Structured, privacy-safe diagnostic only (no usernames/IPs/recipients/UA/tokens/secrets).
    console.info(JSON.stringify(payload));
  } catch {
    // Diagnostics must never affect login or alert best-effort behavior.
  }
}

function escapeAlertHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

function maskAdminUsername(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "***";
  const chars = Array.from(normalized);
  if (chars.length <= 2) return "***";
  return `${chars[0]}***${chars[chars.length - 1]}`;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function maskIpv4(value: string): string | null {
  if (!isValidIpv4(value)) return null;
  const parts = value.split(".");
  parts[3] = "xxx";
  return parts.join(".");
}

function maskIpv6(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw || !raw.includes(":")) return null;
  // Reject obviously invalid characters to avoid emitting raw/unparsed addresses.
  if (!/^[0-9a-f:.]+$/.test(raw)) return null;

  const hasIpv4Tail = raw.includes(".");
  const [head, tail = ""] = raw.split("::");
  const headParts = head ? head.split(":").filter((p) => p.length > 0) : [];
  const tailParts = !hasIpv4Tail && tail ? tail.split(":").filter((p) => p.length > 0) : [];

  const expand = (parts: string[]): string[] | null => {
    const out: string[] = [];
    for (const part of parts) {
      if (part.length === 0 || part.length > 4 || !/^[0-9a-f]+$/.test(part)) return null;
      out.push(part);
    }
    return out;
  };

  const left = expand(headParts);
  if (!left) return null;
  let right: string[] = [];
  if (hasIpv4Tail) {
    // Treat IPv4-mapped/embedded tail conservatively as masked groups.
    right = [];
  } else {
    const expandedRight = expand(tailParts);
    if (!expandedRight) return null;
    right = expandedRight;
  }

  let groups: string[];
  if (raw.includes("::")) {
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  } else {
    groups = left;
  }

  if (groups.length !== 8) return null;
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;

  const masked = groups.map((g, index) => (index < 3 ? g : "xxxx"));
  return masked.join(":");
}

function coarsenIpAddress(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "Unavailable";
  // Strip common IPv4-mapped IPv6 prefix for masking purposes.
  const v4Mapped = normalized.toLowerCase().startsWith("::ffff:")
    ? normalized.slice(7)
    : normalized;
  return maskIpv4(v4Mapped) ?? maskIpv6(normalized) ?? "Unavailable";
}

function coarseUserAgent(value: string | undefined): string | null {
  const ua = value?.trim();
  if (!ua) return null;

  const lower = ua.toLowerCase();
  const has = (token: string) => lower.includes(token);

  // Very lightweight, conservative heuristics. If not reliably classifiable, omit.
  const isBot = has("bot") || has("spider") || has("crawl");
  if (isBot) return null;

  const isMobile =
    has("iphone") ||
    has("ipad") ||
    has("ipod") ||
    has("android") ||
    has("mobile");

  let browser: string | null = null;
  if (has("edg/") || has("edge/") || has("edga/") || has("edgios/")) browser = "Edge";
  else if (has("opr/") || has("opera")) browser = "Opera";
  else if (has("chrome/") && !has("chromium") && !has("edg/") && !has("opr/")) browser = "Chrome";
  else if (has("firefox/") || has("fxios/")) browser = "Firefox";
  else if ((has("safari/") || has("version/")) && !has("chrome/") && !has("chromium") && !has("crios/") && !has("fxios/") && !has("edgios/")) browser = "Safari";

  let device: string | null = null;
  if (has("iphone") || has("ipad") || has("ipod") || has("ios")) device = "iOS";
  else if (has("android")) device = "Android";
  else if (has("windows")) device = "Windows";
  else if (has("mac os x") || has("macintosh")) device = "macOS";
  else if (has("linux")) device = "Linux";

  if (browser && device) return `${browser} on ${device}`;
  if (browser) return `${browser} on ${isMobile ? "mobile device" : "desktop device"}`;
  if (device) return `Unknown browser on ${device}`;
  return null;
}

function purgeAdminLoginAlertClaims(now: number): void {
  // Expired-first cleanup.
  for (const [id, claim] of adminLoginAlertClaims.entries()) {
    if (claim.expiresAt <= now) adminLoginAlertClaims.delete(id);
  }
  // Enforce hard cap with oldest-entry eviction.
  if (adminLoginAlertClaims.size <= ADMIN_ALERT_DEDUPE_MAX_ENTRIES) return;
  const entries = [...adminLoginAlertClaims.entries()].sort((a, b) => a[1].claimedAt - b[1].claimedAt);
  const overflow = adminLoginAlertClaims.size - ADMIN_ALERT_DEDUPE_MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    const key = entries[i]?.[0];
    if (key) adminLoginAlertClaims.delete(key);
  }
}

function getAdminAlertConfigState(): { ok: true; recipient: string } | { ok: false; reason: "recipient_unavailable" | "recipient_invalid" | "brevo_unconfigured" } {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!recipient) return { ok: false, reason: "recipient_unavailable" };
  const parsedRecipient = z.string().email().safeParse(recipient);
  if (!parsedRecipient.success) return { ok: false, reason: "recipient_invalid" };
  if (!isBrevoConfigured()) return { ok: false, reason: "brevo_unconfigured" };
  return { ok: true, recipient: parsedRecipient.data };
}

async function sendTransformedAdminLoginAlert(
  input: AdminLoginAlertInput,
  recipient: string,
): Promise<BrevoSendResult> {
  const { apiKey, from, fromName } = getBrevoConfig();
  const dateTime = input.occurredAt.toISOString();
  const username = maskAdminUsername(input.username);
  const ipAddress = coarsenIpAddress(input.ipAddress);
  const userAgent = coarseUserAgent(input.userAgent);

  const rows = [
    { label: "Username", value: username },
    { label: "Date and time (UTC)", value: dateTime },
    { label: "IP address", value: ipAddress },
    ...(userAgent ? [{ label: "Browser/device", value: userAgent }] : []),
  ];

  const rowsHtml = rows
    .map((row, index) => {
      const border = index < rows.length - 1 ? "border-bottom:1px solid #eee" : "";
      return `<tr><td style="font-weight:bold;${border}">${escapeAlertHtml(row.label)}</td><td style="${border}">${escapeAlertHtml(row.value)}</td></tr>`;
    })
    .join("");

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
        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;overflow-wrap:anywhere">${rowsHtml}</table>
        <p style="margin:24px 0 0;color:#786c5e;font-size:12px">Automated security notification from Bluebell Bakehouse. This email does not contain credentials or session information.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const result = await postBrevoTransactionalEmail(
    {
      sender: { email: from, name: fromName },
      to: [{ email: recipient }],
      subject,
      htmlContent,
    },
    "admin_login_alert",
  );
  return result;
}

/**
 * Sends a privacy-minimized, best-effort alert after a successful administrator login.
 * Recipient must be explicitly configured; no secrets/credentials/tokens are included.
 */
export async function sendAdminLoginAlert(input: AdminLoginAlertInput): Promise<boolean> {
  try {
    if (isUatExternalSideEffectsBlocked()) {
      // Gating/diagnostics are orchestrated by sendAdminLoginAlertOnce for event-scoped flows.
      return false;
    }
    const config = getAdminAlertConfigState();
    if (!config.ok) return false;
    const result = await sendTransformedAdminLoginAlert(input, config.recipient);
    return result.ok;
  } catch {
    return false;
  }
}

/**
 * Event-scoped, bounded, concurrency-safe, process-local in-memory deduplication
 * for admin login alerts. Claims the event before asynchronous delivery work and
 * retains the claim through TTL on success, failure, missing configuration, or
 * UAT suppression to prevent duplicate processing of the same event ID.
 * Distinct successful login events use distinct event IDs and are not suppressed.
 * No cross-process/instance guarantees; state resets on restart.
 */
export async function sendAdminLoginAlertOnce(
  eventId: string,
  input: AdminLoginAlertInput,
): Promise<boolean> {
  try {
    const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";
    if (!normalizedEventId) {
      emitAdminLoginAlertDiagnostic("suppressed", "event_id_unavailable");
      return false;
    }

    const now = Date.now();
    purgeAdminLoginAlertClaims(now);
    const existing = adminLoginAlertClaims.get(normalizedEventId);
    if (existing && existing.expiresAt > now) {
      emitAdminLoginAlertDiagnostic("suppressed", "duplicate_event");
      return false;
    }

    // Synchronous check-and-claim before any asynchronous delivery work.
    const claimToken = createAdminLoginAlertClaimToken();
    adminLoginAlertClaims.set(normalizedEventId, {
      claimedAt: now,
      expiresAt: now + ADMIN_ALERT_DEDUPE_WINDOW_MS,
      claimToken,
    });
    purgeAdminLoginAlertClaims(now);

    if (isUatExternalSideEffectsBlocked()) {
      emitAdminLoginAlertDiagnostic("uat_suppressed", "uat_safe_mode");
      return false;
    }

    const config = getAdminAlertConfigState();
    if (!config.ok) {
      emitAdminLoginAlertDiagnostic("configuration_missing", config.reason);
      return false;
    }

    emitAdminLoginAlertDiagnostic("attempted", "delivery_started");
    try {
      const result = await sendTransformedAdminLoginAlert(input, config.recipient);
      if (result.suppressed) {
        // Decision B: EMAIL_EXTERNAL_DELIVERY_BLOCKED suppression is operational, not delivery.
        // Release only this attempt's claim so the same eventId can be retried after unblock.
        // Ownership check prevents deleting a newer concurrent claim for the same eventId.
        releaseAdminLoginAlertClaimIfOwned(normalizedEventId, claimToken);
        emitAdminLoginAlertDiagnostic("suppressed", "email_external_delivery_blocked");
        return false;
      }
      if (result.ok) {
        emitAdminLoginAlertDiagnostic("sent", "delivery_accepted");
        return true;
      }
      emitAdminLoginAlertDiagnostic(
        "failed",
        result.exception ? "delivery_exception" : "delivery_not_accepted",
      );
      return false;
    } catch {
      emitAdminLoginAlertDiagnostic("failed", "delivery_exception");
      return false;
    }
  } catch {
    // Defensive boundary: notification delivery/deduplication cannot affect authentication.
    try {
      emitAdminLoginAlertDiagnostic("failed", "internal_error");
    } catch {
      // ignore
    }
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
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("email.customer_order", { event: input.event });
    return false;
  }

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
    const { from, fromName } = getBrevoConfig();
    const result = await postBrevoTransactionalEmail(
      {
        sender: { email: from, name: fromName },
        to: [{ email: recipient.data }],
        subject: `Bluebell Bakehouse — ${label.subject} ${input.orderNumber}`,
        htmlContent,
      },
      "customer_order",
    );

    if (result.suppressed) {
      return false;
    }

    if (result.ok) {
      customerOrderEmailEvents.add(eventId);
      setTimeout(() => customerOrderEmailEvents.delete(eventId), CUSTOMER_ORDER_EMAIL_DEDUPE_MS).unref?.();
    }
    return result.ok;
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
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("email.reschedule_expiry_alert");
    return false;
  }

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

  const result = await postBrevoTransactionalEmail(
    {
      sender: { email: from, name: fromName },
      to: [{ email: parsedRecipient.data }],
      subject,
      htmlContent,
    },
    "reschedule_expiry_alert",
  );
  return result.ok;
}
