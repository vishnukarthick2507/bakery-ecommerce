# 01 — P0 WhatsApp Consent Remediation Specification

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — P0 Critical Remediation Preparation & Execution Authorization Readiness  
**Mode:** DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## 1. Status labels used

- **VERIFIED STATIC EVIDENCE** — observed in source/docs.
- **VERIFIED DOCUMENTARY EVIDENCE** — observed in BLB-04/05 docs.
- **NOT VERIFIED** — no runtime/provider evidence.
- **EXTERNAL EVIDENCE REQUIRED** — infra/provider/legal evidence outside repo.
- **BUSINESS/CLIENT DECISION REQUIRED**.
- **EXECUTION AUTHORIZATION REQUIRED**.
- **PROPOSED — NOT APPROVED**.

## 2. Current-state evidence (VERIFIED STATIC EVIDENCE)

| Area | Evidence | Observation |
|---|---|---|
| Checkout UI | `app/checkout/page.tsx` — searched for `whatsapp/consent/opt`; no consent capture field found; WhatsApp mentioned only in failure/recovery text (e.g. line ~349) | No explicit WhatsApp consent checkbox/disclosure in checkout flow |
| Custom cake UI | `components/custom-cake/custom-cake-form.tsx` — imports `whatsappLink` (line ~12); WhatsApp CTA after submit (lines ~387-395); no `whatsappConsent` capture; fields marked optional (lines ~676,693,725,776,800) | No explicit consent capture; WhatsApp continuation is user-initiated link, not automated notification consent capture |
| Frontend API/types | `lib/api/index.ts`, `lib/types.ts` reviewed in prior audits; no `whatsappConsent` UI wiring found by search | Contract gap between backend capability and frontend capture |
| Order controller | `backend/src/controllers/orderController.ts:81-84` accepts `whatsappConsent: z.boolean().optional()`; lines ~541-555 call `grantConsent` best-effort before `notifyCustomerOrder` when `whatsappConsent && phone`; source `CHECKOUT`; consent text hardcoded in controller | Backend can persist consent if field supplied; best-effort and non-fatal |
| Custom cake controller | `backend/src/controllers/customCakeController.ts:55-58,142,260-278,412+` accepts `whatsappConsent`; grants consent best-effort (`CUSTOM_CAKE` source); persists linkage before consent/completion in idempotent flow | Similar best-effort capture; no UI sends it |
| Consent service/model | `backend/src/models/WhatsAppConsent.ts` — transactional/marketing status, timestamps, source, withdrawalHistory, consentHistory (lines ~1-133 observed) | Data model supports consent lifecycle/audit fields; runtime behavior NOT VERIFIED |
| Consent service | `backend/src/services/whatsappConsentService.ts` exists (inventory) | Implementation present; runtime NOT VERIFIED |
| Outbox/notification | `backend/src/services/notificationOutboxService.ts`, `backend/src/models/NotificationOutbox.ts` exist | Outbox/eligibility/suppression logic requires runtime verification |
| Prior audit | BLB05A-W01 CRITICAL (VERIFIED static gap); BLB-04C/04D no decision evidence; BLB-05B R-001 P0 | Confirmed planning priority; no approvals |

## 3. Missing consent journey and affected workflows

| Workflow | Missing/at-risk element | Impact |
|---|---|---|
| Guest checkout | No explicit consent capture/disclosure before automated WhatsApp updates | Notifications may be unauthorized or never enqueued; compliance/operability risk |
| Authenticated checkout | Same as guest | Same |
| Custom cake request | No explicit consent capture; form has WhatsApp CTA after submit but no automated-notification consent | Same |
| Admin WhatsApp centre | Status visibility exists (per BLB-05A) but consent capture/audit trail linkage to UI unclear | Admin may misinterpret eligibility/suppression |
| Withdrawal/revocation | No customer-facing withdrawal journey observed in frontend; webhook STOP handling exists in backend (prior audit) | Incomplete lifecycle |
| Previously opted-in/unknown/revoked | No migration/legacy-state handling plan verified | Inconsistent treatment risk |

## 4. Proposed consent capture points (PROPOSED — NOT APPROVED)

| Point | Proposed behavior | Decision needed |
|---|---|---|
| Checkout payment/summary step | Unchecked explicit checkbox + disclosure + link to policy; required only if WhatsApp notifications are to be enabled for that order/contact | BUSINESS/CLIENT DECISION REQUIRED on wording, legal basis, required/optional |
| Custom cake request form | Separate explicit checkbox for automated WhatsApp updates; distinct from user-initiated WhatsApp CTA | BUSINESS/CLIENT DECISION REQUIRED |
| Account/notification preferences (future) | View/withdraw consent; audit trail | EXECUTION AUTHORIZATION REQUIRED |
| Admin-initiated contact | Manual wa.me remains manual; no auto-send without consent | Policy decision |

**Proposed disclosure wording placeholder (PROPOSED — NOT APPROVED, requires legal/business approval):**  
`[LEGAL-APPROVED TEXT REQUIRED] I agree to receive transactional WhatsApp messages about this order/request from Bluebell Bakehouse/S.V. Sweets & Bakers at the phone number provided. Message/data rates may apply. I can reply STOP to opt out.`  
*Do not use as-is without legal/compliance approval.*

## 5. Consent state model and lifecycle (PROPOSED — NOT APPROVED)

| State | Meaning | Entry | Exit | Audit |
|---|---|---|---|---|
| UNKNOWN | No explicit consent record for purpose/category | Default/legacy | GRANTED/DENIED/WITHDRAWN | Record discovery/migration event if any |
| GRANTED | Explicit opt-in recorded | Checkbox/form/API with approved disclosure | WITHDRAWN/DENIED | timestamp, source, actor, version, purpose, text ref |
| DENIED | Explicit refusal | User declines | GRANTED | audit |
| WITHDRAWN | Previously granted, later revoked (STOP/customer/admin policy action) | STOP webhook, customer action, admin authorized action | GRANTED (new explicit opt-in) | timestamp, source, reason |
| SUPPRESSED | Operational/compliance suppression overriding send | Policy/failure/compliance rule | Policy review | audit |

Lifecycle rules (PROPOSED): no send on UNKNOWN/DENIED/WITHDRAWN/SUPPRESSED; new GRANTED requires explicit action; withdrawal wins over stale grant.

## 6. Audit evidence requirements (PROPOSED — NOT APPROVED)

| Field | Requirement |
|---|---|
| `phone` / contact identifier | Normalized; PII handling per policy |
| `category/purpose` | TRANSACTIONAL/MARKETING separated (model already has fields) |
| `status` | GRANTED/DENIED/WITHDRAWN/SUPPRESSED as applicable |
| `timestamp` | Server UTC timestamp |
| `source` | CHECKOUT/CUSTOM_CAKE/ACCOUNT/STOP_WEBHOOK/ADMIN/etc. |
| `consentVersion` | Versioned disclosure/policy identifier |
| `consentTextRef` or hash | Reference to approved text version (avoid storing full mutable legal text without policy) |
| `actor` | customer/admin/system/webhook |
| `evidenceRef` | request/order/reference/outbox IDs |
| `transition` | old->new state |

## 7. Notification eligibility rules (PROPOSED — NOT APPROVED)

- Phone number existence alone **must not** authorize notification.
- Eligible only when: valid GRANTED consent for purpose/category + not suppressed + template/policy allowed + channel configured + UAT-safe constraints satisfied.
- Suppressed/withdrawn/denied/unknown => no automated send; UI shows not eligible/suppressed.
- Order status != notification status.
- User-initiated manual wa.me links remain manual and clearly labeled.

## 8. Previously opted-in / opted-out / unknown / revoked handling (PROPOSED — NOT APPROVED)

| Existing state | Proposed handling | Risk | Decision |
|---|---|---|---|
| UNKNOWN/legacy | Treat as ineligible until explicit opt-in captured under approved wording | May reduce notifications | BUSINESS/CLIENT DECISION REQUIRED |
| GRANTED (old) | Validate source/version/auditability; consider re-consent if evidence insufficient | Compliance risk if migrated blindly | LEGAL/BUSINESS DECISION REQUIRED |
| WITHDRAWN/DENIED | Preserve suppression; no re-opt-in without explicit action | None if preserved | — |
| Missing audit fields | Mark NOT VERIFIED; block automated sends until remediated | Operational impact | TECHNICAL INVESTIGATION + AUTH REQUIRED |

## 9. Failure handling and retry safeguards (PROPOSED — NOT APPROVED)

- Consent persistence failure: fail closed for notification eligibility; do not block order creation unless business decides otherwise; never mark notification sent.
- Outbox enqueue failure: log/audit; no false sent/delivered.
- Provider failure: retry with cap/backoff; dead-letter; admin visibility.
- Duplicate webhook/event: idempotent by provider/event/message IDs.

## 10. Security and privacy considerations

- Consent records contain PII (phone) - apply redaction in logs, least privilege, retention policy.
- No S02/OTP weakening.
- CSRF/authz required for any future consent mutation endpoints.
- Audit log tamper-resistance considerations - EXECUTION AUTHORIZATION REQUIRED for implementation.

## 11. Proposed API/UI impact map (PROPOSED — NOT APPROVED)

| Layer | Change | Auth |
|---|---|---|
| `app/checkout/page.tsx` | Add consent checkbox/disclosure/state/validation; send `whatsappConsent` only on explicit action | Implementation auth |
| `components/custom-cake/custom-cake-form.tsx` | Add consent checkbox/disclosure; send `whatsappConsent` | Implementation auth |
| `lib/api/index.ts`, `lib/types.ts` | Add typed consent fields/response contracts | Implementation auth |
| `backend/src/controllers/orderController.ts` | Replace hardcoded consent text with versioned/policy-driven reference; fail-closed eligibility | Implementation auth |
| `backend/src/controllers/customCakeController.ts` | Same | Implementation auth |
| `backend/src/services/whatsappConsentService.ts` | Add consentVersion/textRef/actor/evidence fields as needed | Implementation auth |
| `backend/src/services/notificationOutboxService.ts` | Enforce eligibility gate before enqueue/send | Implementation auth |
| Admin UI | Show consent/suppression/audit status clearly | Implementation auth |

## 12. Negative test scenarios and acceptance criteria (PROPOSED — NOT APPROVED)

| Scenario | Expected | Type |
|---|---|---|
| No consent checkbox selected | No automated WhatsApp notification enqueued; order/request may proceed per business rule | Negative |
| Phone number present, no consent record | Not eligible; no send | Negative |
| WITHDRAWN/STOP | No further sends; audit recorded | Negative |
| Consent persistence fails | No false sent; fail closed for eligibility | Failure |
| Duplicate order/request replay | No duplicate consent grant/notification | Idempotency |
| Suppressed notification | Never displayed as sent/delivered | UI/contract |
| Order status update vs notification failure | Statuses remain distinct | UI/contract |

## 13. Business/legal decisions still required

- Approved consent wording, language, legal basis, and disclosure placement.
- Whether consent is required or optional for checkout/custom-cake submission.
- Marketing scope (default out unless explicitly approved).
- Retention/deletion/export policy for consent/PII.
- Legacy/unknown consent migration policy.
- Admin/customer withdrawal channels and SLA.