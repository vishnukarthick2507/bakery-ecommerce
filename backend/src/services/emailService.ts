import { OTP_EXPIRY_MINUTES } from "./otpService.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Brevo requires a verified sender address. The account's verified sender is
// used by default; BREVO_FROM_EMAIL / BREVO_FROM_NAME may override it.
const DEFAULT_SENDER_EMAIL = "vishnukarthick2507@gmail.com";
const DEFAULT_SENDER_NAME = "S.V. Sweets & Bakers";

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
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT",
): string {
  if (purpose === "LOGIN") {
    return "sign in to your S.V. Sweets & Bakers account";
  }
  if (purpose === "REGISTER") {
    return "create your S.V. Sweets & Bakers account";
  }
  if (purpose === "GUEST_CHECKOUT") {
    return "confirm your guest checkout";
  }
  return "complete your request";
}

function buildOtpHtml(
  otp: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT",
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
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px;">S.V. Sweets &amp; Bakers</h1>
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
                  S.V. Sweets &amp; Bakers<br>
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
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" = "LOGIN",
): Promise<boolean> {
  if (!isBrevoConfigured()) {
    console.error(
      "OTP email delivery failed: Brevo API is not configured. Set BREVO_API_KEY env var.",
    );
    return false;
  }

  const { apiKey, from, fromName } = getBrevoConfig();

  const subject = `Your S.V. Sweets & Bakers OTP Code: ${otp}`;
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
