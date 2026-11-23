/*
|--------------------------------------------------------------------------
| WHATSAPP CONSENT SERVICE
|--------------------------------------------------------------------------
| Manages customer WhatsApp communication consent: grant, withdraw, and
| query. All operations are idempotent and safe to retry.
|
| Phase A: supports separate TRANSACTIONAL and MARKETING consent categories
| with independent status/history while preserving existing transactional APIs
| and behavior for backward compatibility.
*/

import { WhatsAppConsent } from "../models/WhatsAppConsent.js";

export type WhatsAppConsentStatus = "GRANTED" | "DENIED" | "WITHDRAWN";
export type WhatsAppConsentCategory = "TRANSACTIONAL" | "MARKETING";

const DEFAULT_TRANSACTIONAL_CONSENT_TEXT =
  "I agree to receive WhatsApp order notifications from Bluebell Bakehouse.";
const DEFAULT_MARKETING_CONSENT_TEXT =
  "I agree to receive promotional WhatsApp messages from Bluebell Bakehouse.";

/**
 * Result of granting consent.
 */
export interface ConsentGrantResult {
  granted: boolean;
  alreadyConsented: boolean;
  phone: string;
  category?: WhatsAppConsentCategory;
}

/**
 * Result of withdrawing consent.
 */
export interface ConsentWithdrawResult {
  withdrawn: boolean;
  wasConsented: boolean;
  phone: string;
  category?: WhatsAppConsentCategory;
}

/**
 * Consent status for a phone number (backward-compatible transactional view by default).
 */
export interface ConsentStatus {
  phone: string;
  status: WhatsAppConsentStatus;
  hasConsent: boolean;
  consentTimestamp: Date | undefined;
  optOutTimestamp: Date | undefined;
  source: string | undefined;
  category?: WhatsAppConsentCategory;
  transactional?: {
    status: WhatsAppConsentStatus;
    hasConsent: boolean;
    consentTimestamp: Date | undefined;
    optOutTimestamp: Date | undefined;
    source: string | undefined;
  };
  marketing?: {
    status: WhatsAppConsentStatus;
    hasConsent: boolean;
    consentTimestamp: Date | undefined;
    optOutTimestamp: Date | undefined;
    source: string | undefined;
  };
}

/**
 * Normalises and validates a WhatsApp phone number (10-digit Indian mobile
 * or international format). Returns the normalised number or null.
 */
export function normalisePhone(phone: string): string | null {
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

  return null;
}

function resolveCategory(category?: WhatsAppConsentCategory): WhatsAppConsentCategory {
  return category === "MARKETING" ? "MARKETING" : "TRANSACTIONAL";
}

function toDate(value: unknown): Date | undefined {
  return value instanceof Date ? value : value ? new Date(value as any) : undefined;
}

function categorySnapshot(record: any, category: WhatsAppConsentCategory) {
  if (category === "MARKETING") {
    const status = (record.marketingStatus ?? "DENIED") as WhatsAppConsentStatus;
    return {
      status,
      hasConsent: status === "GRANTED",
      consentTimestamp: toDate(record.marketingConsentTimestamp),
      optOutTimestamp: toDate(record.marketingOptOutTimestamp),
      source: (record.marketingSource ?? undefined) as string | undefined,
    };
  }
  const status = (record.status ?? "DENIED") as WhatsAppConsentStatus;
  return {
    status,
    hasConsent: status === "GRANTED",
    consentTimestamp: toDate(record.consentTimestamp),
    optOutTimestamp: toDate(record.optOutTimestamp),
    source: (record.source ?? undefined) as string | undefined,
  };
}

/**
 * Grants WhatsApp consent for a phone number/category. Idempotent.
 * Default category is TRANSACTIONAL to preserve existing behavior.
 */
export async function grantConsent(input: {
  phone: string;
  source?: string;
  consentText?: string;
  category?: WhatsAppConsentCategory;
}): Promise<ConsentGrantResult> {
  const phone = normalisePhone(input.phone);
  const category = resolveCategory(input.category);
  if (!phone) {
    return { granted: false, alreadyConsented: false, phone: input.phone, category };
  }

  const existing = await WhatsAppConsent.findOne({ phone }).lean();
  const now = new Date();
  const source = input.source ?? "CHECKOUT";

  if (category === "MARKETING") {
    // Marketing opt-in must be explicit; callers must choose MARKETING category.
    const consentText = input.consentText ?? DEFAULT_MARKETING_CONSENT_TEXT;
    const currentStatus = (existing?.marketingStatus ?? "DENIED") as WhatsAppConsentStatus;
    if (existing && currentStatus === "GRANTED") {
      return { granted: true, alreadyConsented: true, phone, category };
    }

    if (existing) {
      await WhatsAppConsent.updateOne(
        { phone },
        {
          $set: {
            marketingStatus: "GRANTED",
            marketingSource: source,
            marketingConsentText: consentText,
            marketingConsentTimestamp: now,
            marketingOptOutTimestamp: null,
            marketingWithdrawalReason: null,
            marketingWithdrawalHistory: [],
          },
          $push: {
            consentHistory: {
              category: "MARKETING",
              action: "GRANT",
              source,
              occurredAt: now,
            },
          },
        },
      );
    } else {
      await WhatsAppConsent.create({
        phone,
        // Transactional defaults preserved: do not imply transactional consent.
        status: "DENIED",
        marketingStatus: "GRANTED",
        marketingSource: source,
        marketingConsentText: consentText,
        marketingConsentTimestamp: now,
        marketingWithdrawalHistory: [],
        withdrawalHistory: [],
        consentHistory: [
          {
            category: "MARKETING",
            action: "GRANT",
            source,
            occurredAt: now,
          },
        ],
      });
    }

    return { granted: true, alreadyConsented: false, phone, category };
  }

  const consentText = input.consentText ?? DEFAULT_TRANSACTIONAL_CONSENT_TEXT;

  if (existing) {
    if (existing.status === "GRANTED") {
      return {
        granted: true,
        alreadyConsented: true,
        phone,
        category,
      };
    }

    // Re-granting transactional consent after DENIED or WITHDRAWN.
    await WhatsAppConsent.updateOne(
      { phone },
      {
        $set: {
          status: "GRANTED",
          source,
          consentText,
          consentTimestamp: now,
          optOutTimestamp: null,
          withdrawalReason: null,
          withdrawalHistory: [],
        },
        $push: {
          consentHistory: {
            category: "TRANSACTIONAL",
            action: "GRANT",
            source,
            occurredAt: now,
          },
        },
      },
    );

    return { granted: true, alreadyConsented: false, phone, category };
  }

  await WhatsAppConsent.create({
    phone,
    status: "GRANTED",
    source,
    consentText,
    consentTimestamp: now,
    withdrawalHistory: [],
    // Marketing remains separate and not granted by default.
    marketingStatus: "DENIED",
    marketingWithdrawalHistory: [],
    consentHistory: [
      {
        category: "TRANSACTIONAL",
        action: "GRANT",
        source,
        occurredAt: now,
      },
    ],
  });

  return { granted: true, alreadyConsented: false, phone, category };
}

/**
 * Withdraws WhatsApp consent for a phone number/category. Idempotent.
 * Default category is TRANSACTIONAL to preserve existing behavior.
 */
export async function withdrawConsent(input: {
  phone: string;
  reason?: string;
  source?: string;
  category?: WhatsAppConsentCategory;
}): Promise<ConsentWithdrawResult> {
  const phone = normalisePhone(input.phone);
  const category = resolveCategory(input.category);
  if (!phone) {
    return { withdrawn: false, wasConsented: false, phone: input.phone, category };
  }

  const existing = await WhatsAppConsent.findOne({ phone }).lean();
  const now = new Date();
  const reason = input.reason ?? "Customer opted out";
  const source = input.source ?? "CHECKOUT";

  if (category === "MARKETING") {
    const currentStatus = (existing?.marketingStatus ?? "DENIED") as WhatsAppConsentStatus;
    if (!existing) {
      await WhatsAppConsent.create({
        phone,
        // Preserve transactional semantics: no prior transactional consent record created as granted.
        status: "DENIED",
        marketingStatus: "WITHDRAWN",
        marketingOptOutTimestamp: now,
        marketingWithdrawalReason: reason,
        marketingWithdrawalHistory: [{ reason, withdrawnAt: now, source }],
        withdrawalHistory: [],
        consentHistory: [
          {
            category: "MARKETING",
            action: "WITHDRAW",
            reason,
            source,
            occurredAt: now,
          },
        ],
      });
      return { withdrawn: true, wasConsented: false, phone, category };
    }

    if (currentStatus === "WITHDRAWN") {
      return { withdrawn: false, wasConsented: false, phone, category };
    }

    const wasConsented = currentStatus === "GRANTED";
    await WhatsAppConsent.updateOne(
      { phone },
      {
        $set: {
          marketingStatus: "WITHDRAWN",
          marketingOptOutTimestamp: now,
          marketingWithdrawalReason: reason,
        },
        $push: {
          marketingWithdrawalHistory: { reason, withdrawnAt: now, source },
          consentHistory: {
            category: "MARKETING",
            action: "WITHDRAW",
            reason,
            source,
            occurredAt: now,
          },
        },
      },
    );
    return { withdrawn: true, wasConsented, phone, category };
  }

  if (!existing) {
    // No consent record exists; record an explicit denial for transactional (legacy behavior).
    await WhatsAppConsent.create({
      phone,
      status: "DENIED",
      source,
      consentTimestamp: null,
      optOutTimestamp: now,
      withdrawalReason: input.reason ?? "No prior consent",
      withdrawalHistory: [],
      marketingStatus: "DENIED",
      marketingWithdrawalHistory: [],
      consentHistory: [
        {
          category: "TRANSACTIONAL",
          action: "DENY",
          reason: input.reason ?? "No prior consent",
          source,
          occurredAt: now,
        },
      ],
    });

    return { withdrawn: false, wasConsented: false, phone, category };
  }

  if (existing.status === "WITHDRAWN") {
    return { withdrawn: false, wasConsented: false, phone, category };
  }

  const wasConsented = existing.status === "GRANTED";

  const historyEntry = {
    reason,
    withdrawnAt: now,
    source: input.source ?? existing.source ?? "CHECKOUT",
  };

  await WhatsAppConsent.updateOne(
    { phone },
    {
      $set: {
        status: "WITHDRAWN",
        optOutTimestamp: now,
        withdrawalReason: reason,
      },
      $push: {
        withdrawalHistory: historyEntry,
        consentHistory: {
          category: "TRANSACTIONAL",
          action: "WITHDRAW",
          reason,
          source: input.source ?? existing.source ?? "CHECKOUT",
          occurredAt: now,
        },
      },
    },
  );

  return { withdrawn: true, wasConsented, phone, category };
}

/**
 * Withdraws all WhatsApp consent categories for STOP/opt-out flows.
 * Ensures subsequent marketing and transactional WhatsApp messages are prevented.
 */
export async function withdrawAllConsent(input: {
  phone: string;
  reason?: string;
  source?: string;
}): Promise<{ phone: string; transactional: ConsentWithdrawResult; marketing: ConsentWithdrawResult }> {
  const transactional = await withdrawConsent({ ...input, category: "TRANSACTIONAL" });
  const marketing = await withdrawConsent({ ...input, category: "MARKETING" });
  return { phone: transactional.phone, transactional, marketing };
}

/**
 * Returns the current consent status for a phone number/category.
 * Default category is TRANSACTIONAL and response remains backward-compatible.
 */
export async function getConsentStatus(
  phone: string,
  category?: WhatsAppConsentCategory,
): Promise<ConsentStatus | null> {
  const normalised = normalisePhone(phone);
  const resolvedCategory = resolveCategory(category);
  if (!normalised) return null;

  const record = await WhatsAppConsent.findOne({ phone: normalised }).lean();
  if (!record) return null;

  const transactional = categorySnapshot(record, "TRANSACTIONAL");
  const marketing = categorySnapshot(record, "MARKETING");
  const selected = resolvedCategory === "MARKETING" ? marketing : transactional;

  return {
    phone: normalised,
    status: selected.status,
    hasConsent: selected.hasConsent,
    consentTimestamp: selected.consentTimestamp,
    optOutTimestamp: selected.optOutTimestamp,
    source: selected.source,
    category: resolvedCategory,
    transactional,
    marketing,
  };
}

/**
 * Returns true only when the customer has active GRANTED TRANSACTIONAL consent.
 * Backward-compatible alias used by existing transactional notification paths.
 */
export async function hasValidConsent(phone: string): Promise<boolean> {
  return hasValidTransactionalConsent(phone);
}

export async function hasValidTransactionalConsent(phone: string): Promise<boolean> {
  const normalised = normalisePhone(phone);
  if (!normalised) return false;

  const record = await WhatsAppConsent.findOne({
    phone: normalised,
    status: "GRANTED",
  }).lean();

  return Boolean(record);
}

export async function hasValidMarketingConsent(phone: string): Promise<boolean> {
  const normalised = normalisePhone(phone);
  if (!normalised) return false;

  const record = await WhatsAppConsent.findOne({
    phone: normalised,
    marketingStatus: "GRANTED",
  }).lean();

  return Boolean(record);
}
