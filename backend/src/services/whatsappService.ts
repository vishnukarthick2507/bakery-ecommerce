/*
|--------------------------------------------------------------------------
| WHATSAPP CLOUD API SERVICE
|--------------------------------------------------------------------------
| Sends templated WhatsApp messages via the Meta WhatsApp Business Platform
| Cloud API (HTTPS). All configuration is read from server-side environment
| variables only. Access tokens and phone numbers are never logged.
|
| WhatsApp messages are best-effort: a failure must never block the
| underlying business operation (checkout, order creation, status change).
|
| In UAT_SAFE_MODE all outbound Meta Cloud API requests are blocked centrally.
*/

import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "./uatSafetyLog.js";
import { validateTemplateForSend } from "./whatsappTemplateRegistry.js";

const REQUEST_TIMEOUT_MS = 15_000;

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() ?? "v18.0";
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId, apiVersion };
}

/**
 * Returns true only when the WhatsApp Cloud API is configured.
 * Used to distinguish a misconfigured service from a transient failure.
 * Never logs credential values.
 */
export function isWhatsAppConfigured(): boolean {
  return getWhatsAppConfig() !== null;
}

/**
 * Returns boolean presence checks for WhatsApp configuration.
 * Intended for admin diagnostic endpoints. Never returns secret values.
 */
export function getWhatsAppPresenceChecks(): {
  accessTokenPresent: boolean;
  phoneNumberIdPresent: boolean;
} {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const isPresent = (value: string | undefined): boolean =>
    Boolean(value && value.trim());
  return {
    accessTokenPresent: isPresent(accessToken),
    phoneNumberIdPresent: isPresent(phoneNumberId),
  };
}

/**
 * Normalises a customer phone number to WhatsApp international format
 * (digits only, country code included, no leading "+").
 *
 * Accepts:
 *   - 10-digit Indian mobile (e.g. "9840916058") -> "919840916058"
 *   - E.164 with leading "+" (e.g. "+919840916058") -> "919840916058"
 *   - Already-normalised 12-digit (e.g. "919840916058") -> unchanged
 *   - Leading-zero national format (e.g. "09840916058") -> "919840916058"
 *
 * Returns an empty string when the number cannot be normalised.
 */
export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");

  // 10-digit Indian mobile: 9xxxxxxxxx -> 919xxxxxxxxx
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return "91" + digits;
  }

  // Already in international format without +: 919xxxxxxxxx
  if (
    digits.length === 12 &&
    digits.startsWith("91") &&
    /^[6-9]/.test(digits.slice(2))
  ) {
    return digits;
  }

  // Leading-zero national format: 09xxxxxxxxx -> 919xxxxxxxxx
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    return "91" + digits.slice(1);
  }

  return "";
}

interface SendTemplateInput {
  to: string; // raw phone number as stored on the order
  templateName: string;
  params: string[];
  /** Optional internal event for defense-in-depth registry validation. */
  internalEvent?: string;
}

export interface SendWhatsAppTemplateResult {
  accepted: boolean;
  providerMessageId?: string;
  rejected?: string;
}

/**
 * Sends a WhatsApp template message via the Meta Cloud API.
 * Returns provider acceptance and Meta message ID (when available) only when
 * Meta accepts the message for delivery. Never throws: delivery failures
 * (network, auth, timeout, unconfigured, template not approved, invalid
 * response parsing) return { accepted: false }.
 *
 * The access token is sent in the Authorization header and is never written
 * to application logs. The recipient phone number is treated as PII and is
 * not logged.
 */
export async function sendWhatsAppTemplate(
  input: SendTemplateInput,
): Promise<SendWhatsAppTemplateResult> {
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("whatsapp.send_template", { templateName: input.templateName });
    return { accepted: false };
  }

  const config = getWhatsAppConfig();
  if (!config) return { accepted: false, rejected: "WHATSAPP_NOT_CONFIGURED" };

  const to = normalizeWhatsAppPhone(input.to);
  if (!to) return { accepted: false, rejected: "INVALID_RECIPIENT" };

  // Centralized fail-closed gate: registry + Meta approval evidence + identity + params.
  // No caller may bypass this validation.
  let templateName = input.templateName;
  let languageCode = "en";
  let params = Array.isArray(input.params) ? input.params.map((p) => String(p ?? "")) : [];

  const validation = validateTemplateForSend({
    templateName: input.templateName,
    ...(input.internalEvent ? { internalEvent: input.internalEvent } : {}),
    params,
    expectedCategory: "TRANSACTIONAL",
  });
  if (!validation.ok) {
    return { accepted: false, rejected: `REGISTRY_${validation.reason}` };
  }
  templateName = validation.definition.templateName;
  languageCode = validation.definition.language || "en";
  params = validation.normalizedParams;

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: p })),
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) return { accepted: false };

    // Best-effort extraction of Meta provider message ID from successful response.
    // Expected shape: { messages: [{ id: "wamid..." }] }
    try {
      const data = (await response.json()) as unknown;
      const firstMessageId = (data as { messages?: Array<{ id?: unknown }> } | null | undefined)
        ?.messages?.[0]?.id;
      if (typeof firstMessageId === "string" && firstMessageId.trim()) {
        return { accepted: true, providerMessageId: firstMessageId.trim() };
      }
    } catch {
      // Provider accepted delivery but response body could not be parsed/read as expected.
      // Do not invent an ID; caller handles missing ID explicitly.
    }

    return { accepted: true };
  } catch {
    return { accepted: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
