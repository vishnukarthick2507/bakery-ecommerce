/*
|--------------------------------------------------------------------------
| WHATSAPP ADMIN RECIPIENT CONFIG (Stage 5 Phase A)
|--------------------------------------------------------------------------
| Explicit server-side env-configured administrator WhatsApp recipients.
|
| Requirements:
| - Validate phone numbers.
| - Never expose recipient numbers through customer-facing endpoints.
| - Do not automatically use all admin accounts.
| - No production environment changes in Phase A.
*/

import { normalisePhone } from "./whatsappConsentService.js";

export const ADMIN_WHATSAPP_RECIPIENTS_ENV = "ADMIN_WHATSAPP_RECIPIENTS";

export interface AdminRecipientValidationResult {
  configured: boolean;
  recipients: string[];
  invalid: string[];
  duplicatesRemoved: number;
}

/**
 * Parses and validates admin WhatsApp recipients from server-side env config.
 * Accepts comma/newline/semicolon-separated values.
 *
 * This is support/configuration logic for future admin notifications only;
 * it must never be exposed to customer-facing endpoints.
 */
export function getValidatedAdminWhatsAppRecipients(
  rawValue = process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV],
): AdminRecipientValidationResult {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return { configured: false, recipients: [], invalid: [], duplicatesRemoved: 0 };
  }

  const tokens = rawValue
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const recipients: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  for (const token of tokens) {
    const normalized = normalisePhone(token);
    if (!normalized) {
      invalid.push(token);
      continue;
    }
    if (seen.has(normalized)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(normalized);
    recipients.push(normalized);
  }

  return {
    configured: true,
    recipients,
    invalid,
    duplicatesRemoved,
  };
}

export function isAdminWhatsAppRecipientsConfigValid(
  rawValue = process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV],
): boolean {
  const result = getValidatedAdminWhatsAppRecipients(rawValue);
  return result.configured && result.invalid.length === 0;
}
