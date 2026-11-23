/*
|--------------------------------------------------------------------------
| WHATSAPP TEMPLATE REGISTRY (Stage 5 Phase A)
|--------------------------------------------------------------------------
| Central, explicit registry for WhatsApp templates. Validation must fail
| closed when a template is missing, disabled, or not confirmed approved.
|
| Phase A note: entries below explicitly declare approval/configuration state
| for currently supported transactional templates. Approval is not assumed from
| code paths; it is a registry configuration artifact and must be kept in sync
| with Meta Business Manager / environment readiness.
*/

export type WhatsAppTemplateCategory = "TRANSACTIONAL" | "MARKETING";
export type WhatsAppTemplateApprovalState =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "NOT_SUBMITTED";

/**
 * Independently verifiable Meta approval evidence. All fields are required when
 * present. Absence/mismatch => fail closed. Do not invent values.
 */
export interface MetaApprovalEvidence {
  provider: "META";
  /** Meta-approved template name (must match registry/template send name). */
  metaTemplateName: string;
  /** Meta template ID from the approved template record. */
  metaTemplateId: string;
  /** Meta language code (e.g. "en"). */
  metaLanguageCode: string;
  /** Must be APPROVED; any other value is rejected. */
  approvalStatus: "APPROVED";
  /** External evidence reference (approval artifact/ticket/audit ref). */
  evidenceRef: string;
  /** ISO timestamp when evidence was verified/recorded. */
  verifiedAt: string;
}

export interface WhatsAppTemplateDefinition {
  internalEvent: string;
  templateName: string;
  metaCategory: WhatsAppTemplateCategory;
  requiredVariables: string[];
  language: string;
  approvalState: WhatsAppTemplateApprovalState;
  enabled: boolean;
  /**
   * Verifiable Meta approval evidence. REQUIRED for external delivery eligibility.
   * Internal approvalState alone never implies Meta approval. Missing/invalid => fail closed.
   */
  metaApprovalEvidence?: MetaApprovalEvidence;
  /** Optional notes for operators (e.g. Meta submission status context). */
  notes?: string;
}

export interface TemplateValidationInput {
  internalEvent?: string;
  templateName: string;
  params?: string[];
  expectedCategory?: WhatsAppTemplateCategory;
}

export type TemplateValidationResult =
  | {
      ok: true;
      definition: WhatsAppTemplateDefinition;
      normalizedParams: string[];
    }
  | {
      ok: false;
      reason:
        | "TEMPLATE_NOT_FOUND"
        | "TEMPLATE_DISABLED"
        | "TEMPLATE_NOT_APPROVED"
        | "META_APPROVAL_EVIDENCE_MISSING"
        | "META_TEMPLATE_IDENTITY_MISMATCH"
        | "CATEGORY_MISMATCH"
        | "MISSING_REQUIRED_VARIABLES"
        | "INVALID_PARAMS";
      message: string;
      definition?: WhatsAppTemplateDefinition;
    };

/**
 * Explicit registry of supported WhatsApp templates.
 * Keep this list limited to templates/events backed by verified triggers.
 */
export const WHATSAPP_TEMPLATE_REGISTRY: readonly WhatsAppTemplateDefinition[] = [
  {
    internalEvent: "ORDER_PLACED",
    templateName: "order_received",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "totalAmount", "status", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "PAYMENT_CONFIRMED",
    templateName: "payment_received",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "totalAmount", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "STATUS_CHANGED_CONFIRMED",
    templateName: "order_confirmed",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "status", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "STATUS_CHANGED_PREPARING",
    templateName: "order_preparing",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "STATUS_CHANGED_READY",
    templateName: "order_ready",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "STATUS_CHANGED_RESCHEDULE_PROPOSED",
    templateName: "order_reschedule_proposed",
    metaCategory: "TRANSACTIONAL",
    // D20-08-A/B approved direction (dedicated template, single proposedSchedule variable concept).
    // D20-08-E exact customer-facing wording is NOT DECIDED. No Meta approval. Do not enable.
    requiredVariables: ["customerName", "orderNumber", "proposedSchedule", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "BLB-21 fail-closed placeholder: D20-08-E wording NOT DECIDED; Meta approval UNVERIFIED/NOT_SUBMITTED. Do not enable, submit, or send without explicit owner wording approval, Meta approval evidence, and BLB-21 safety gates.",
  },
  {
    internalEvent: "STATUS_CHANGED_OUT_FOR_DELIVERY",
    templateName: "order_out_for_delivery",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "STATUS_CHANGED_COMPLETED",
    templateName: "order_completed",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "CANCELLED",
    templateName: "order_cancelled",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes: "Fail-closed: Meta approval UNVERIFIED. Internal status reconciled by BLB-21 safety control; do not enable without verified Meta approval evidence and explicit authorization.",
  },
  {
    internalEvent: "PAYMENT_FAILED",
    templateName: "payment_failed",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. For genuine current-attempt online payment failures (PENDING -> FAILED) only.",
  },
  {
    internalEvent: "CUSTOM_CAKE_REQUEST_RECEIVED",
    templateName: "custom_cake_request_received",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "referenceNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Customer opt-in required; no marketing.",
  },
  {
    internalEvent: "CUSTOM_CAKE_QUOTE_PREPARED",
    templateName: "custom_cake_quote_prepared",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: [
      "customerName",
      "referenceNumber",
      "proposedPrice",
      "proposedDeliveryDate",
      "proposedDeliveryTime",
      "trackingUrl",
    ],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when admin prepares/shares quote/proposal.",
  },
  {
    internalEvent: "CUSTOM_CAKE_QUOTE_ACCEPTED",
    templateName: "custom_cake_quote_accepted",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "referenceNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when customer accepts quote/proposal.",
  },
  {
    internalEvent: "CUSTOM_CAKE_QUOTE_DECLINED",
    templateName: "custom_cake_quote_declined",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "referenceNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when customer declines quote/proposal.",
  },
  {
    internalEvent: "CUSTOM_CAKE_REQUEST_CLOSED",
    templateName: "custom_cake_request_closed",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "referenceNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when admin closes/rejects request.",
  },
  {
    internalEvent: "CUSTOM_CAKE_CONVERTED_TO_ORDER",
    templateName: "custom_cake_converted_to_order",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "referenceNumber", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Fire once on successful conversion; do not duplicate order-received notification.",
  },
  {
    internalEvent: "RESCHEDULE_REQUESTED",
    templateName: "order_reschedule_requested",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "scheduledDate", "scheduledTime", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent for committed customer/admin reschedule request events only.",
  },
  {
    internalEvent: "RESCHEDULE_ACCEPTED",
    templateName: "order_reschedule_accepted",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "scheduledDate", "scheduledTime", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when reschedule proposal is accepted and schedule is committed.",
  },
  {
    internalEvent: "RESCHEDULE_REJECTED",
    templateName: "order_reschedule_rejected",
    metaCategory: "TRANSACTIONAL",
    requiredVariables: ["customerName", "orderNumber", "scheduledDate", "scheduledTime", "trackingUrl"],
    language: "en",
    approvalState: "NOT_SUBMITTED",
    enabled: false,
    notes:
      "Disabled fail-closed until Meta template approval/configuration is explicitly verified. Sent when reschedule proposal is rejected and prior schedule remains committed.",
  },
] as const;

export function getTemplateDefinition(
  templateName: string,
  internalEvent?: string,
): WhatsAppTemplateDefinition | undefined {
  const normalizedName = templateName.trim();
  if (!normalizedName) return undefined;

  if (internalEvent) {
    const exact = WHATSAPP_TEMPLATE_REGISTRY.find(
      (t) => t.templateName === normalizedName && t.internalEvent === internalEvent,
    );
    if (exact) return exact;
  }

  return WHATSAPP_TEMPLATE_REGISTRY.find((t) => t.templateName === normalizedName);
}

export function listTemplateDefinitions(): WhatsAppTemplateDefinition[] {
  return [...WHATSAPP_TEMPLATE_REGISTRY];
}

function validateDefinitionForSend(
  definition: WhatsAppTemplateDefinition | undefined,
  input: TemplateValidationInput,
): TemplateValidationResult {
  const templateName = input.templateName?.trim();
  if (!templateName) {
    return {
      ok: false,
      reason: "TEMPLATE_NOT_FOUND",
      message: "Template name is required",
    };
  }

  if (!definition) {
    return {
      ok: false,
      reason: "TEMPLATE_NOT_FOUND",
      message: `Template '${templateName}' is not registered`,
    };
  }

  if (!definition.enabled) {
    return {
      ok: false,
      reason: "TEMPLATE_DISABLED",
      message: `Template '${templateName}' is disabled`,
      definition,
    };
  }

  if (definition.approvalState !== "APPROVED") {
    return {
      ok: false,
      reason: "TEMPLATE_NOT_APPROVED",
      message: `Template '${templateName}' is not confirmed approved`,
      definition,
    };
  }

  // Fail-closed: internal approvalState alone never implies Meta approval.
  // Verifiable Meta approval evidence and matching template identity are required.
  const evidence = definition.metaApprovalEvidence;
  if (
    !evidence ||
    evidence.provider !== "META" ||
    evidence.approvalStatus !== "APPROVED" ||
    typeof evidence.metaTemplateId !== "string" || !evidence.metaTemplateId.trim() ||
    typeof evidence.metaTemplateName !== "string" || !evidence.metaTemplateName.trim() ||
    typeof evidence.metaLanguageCode !== "string" || !evidence.metaLanguageCode.trim() ||
    typeof evidence.evidenceRef !== "string" || !evidence.evidenceRef.trim() ||
    typeof evidence.verifiedAt !== "string" || !evidence.verifiedAt.trim() ||
    Number.isNaN(Date.parse(evidence.verifiedAt))
  ) {
    return {
      ok: false,
      reason: "META_APPROVAL_EVIDENCE_MISSING",
      message: `Template '${templateName}' is missing verifiable Meta approval evidence`,
      definition,
    };
  }

  if (
    evidence.metaTemplateName.trim() !== definition.templateName.trim() ||
    evidence.metaLanguageCode.trim().toLowerCase() !== definition.language.trim().toLowerCase()
  ) {
    return {
      ok: false,
      reason: "META_TEMPLATE_IDENTITY_MISMATCH",
      message: `Template '${templateName}' Meta approval identity mismatch`,
      definition,
    };
  }

  if (input.expectedCategory && definition.metaCategory !== input.expectedCategory) {
    return {
      ok: false,
      reason: "CATEGORY_MISMATCH",
      message: `Template '${templateName}' category mismatch`,
      definition,
    };
  }

  if (input.internalEvent && definition.internalEvent !== input.internalEvent) {
    return {
      ok: false,
      reason: "TEMPLATE_NOT_FOUND",
      message: `Template '${templateName}' is not registered for event '${input.internalEvent}'`,
      definition,
    };
  }

  const params = Array.isArray(input.params) ? input.params.map((p) => String(p ?? "")) : [];
  if (!Array.isArray(input.params)) {
    return {
      ok: false,
      reason: "INVALID_PARAMS",
      message: `Template '${templateName}' params must be an array`,
      definition,
    };
  }

  if (params.length < definition.requiredVariables.length) {
    return {
      ok: false,
      reason: "MISSING_REQUIRED_VARIABLES",
      message: `Template '${templateName}' requires ${definition.requiredVariables.length} variables`,
      definition,
    };
  }

  const missingIndex = definition.requiredVariables.findIndex((_, idx) => !String(params[idx] ?? "").trim());
  if (missingIndex >= 0) {
    return {
      ok: false,
      reason: "MISSING_REQUIRED_VARIABLES",
      message: `Template '${templateName}' is missing required variable '${definition.requiredVariables[missingIndex]}'`,
      definition,
    };
  }

  return {
    ok: true,
    definition,
    normalizedParams: params,
  };
}

/**
 * Fail-closed template validation against registry.
 * Never assumes approval based on source code.
 */
export function validateTemplateForSend(
  input: TemplateValidationInput,
): TemplateValidationResult {
  const templateName = input.templateName?.trim() ?? "";
  const definition = templateName ? getTemplateDefinition(templateName, input.internalEvent) : undefined;
  return validateDefinitionForSend(definition, { ...input, templateName });
}

/** Exported for deterministic fail-closed validation tests and explicit checks. */
export function validateTemplateDefinition(
  definition: WhatsAppTemplateDefinition | undefined,
  input: TemplateValidationInput,
): TemplateValidationResult {
  return validateDefinitionForSend(definition, input);
}
