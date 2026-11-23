# 02 — WhatsApp Consent W01 Legal / Compliance Approval Request

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-07A — Stakeholder Decision Collection & Approval Request Pack  
**Date prepared:** 2026-11-21  
**Status:** DRAFT REQUEST — NOT SENT — NO APPROVALS RECEIVED

## 1. Purpose

Request explicit legal/compliance decisions and approval for the WhatsApp consent workflow (BLB05A-W01, P0). Implementation cannot close this item without approved wording/policy and separate execution authorization.

## 2. Known technical context (from BLB-05A/05C/06A)

- Frontend consent capture is currently missing in checkout/custom-cake flows (static evidence).
- Backend consent/notification infrastructure exists (models/services/outbox/webhook paths), but runtime/provider behavior is not verified.
- Backend capability does **not** establish customer consent.
- The workflow must not send notifications merely because a phone number exists.
- Suppressed/withdrawn/denied/unknown contacts must not be shown as sent/delivered.

## 3. Decisions requested

| # | Decision required | Requested response | Approver role | Date | Conditions/notes |
|---:|---|---|---|---|---|
| 1 | Consent wording | Provide final approved wording (versioned) or approve draft after legal review | Legal/Compliance | `[PLACEHOLDER]` | No wording invented/assumed approved by project team |
| 2 | Consent capture timing | Approve when consent is captured (checkout, custom-cake, account, other) | Legal/Compliance + Business Owner | `[PLACEHOLDER]` | Must be explicit, not pre-checked |
| 3 | Consent purpose and scope | Approve purposes (order updates, custom-cake updates, etc.) | Legal/Compliance + Business Owner | `[PLACEHOLDER]` | Scope-limited |
| 4 | Transactional vs marketing | Approve distinction and whether marketing is in scope | Legal/Compliance | `[PLACEHOLDER]` | Default recommendation: marketing out of scope unless explicitly approved |
| 5 | Consent withdrawal and revocation | Approve STOP/withdrawal channels, SLA, process | Legal/Compliance + Ops | `[PLACEHOLDER]` | Must be auditable |
| 6 | Existing customers with unknown consent | Approve fail-closed/re-consent policy | Legal/Compliance | `[PLACEHOLDER]` | No automated send on unknown |
| 7 | Previously opted-in customers | Approve migration/revalidation policy | Legal/Compliance | `[PLACEHOLDER]` | Evidence/auditability required |
| 8 | Previously opted-out customers | Approve suppression/re-opt-in policy | Legal/Compliance | `[PLACEHOLDER]` | No send until explicit re-opt-in as approved |
| 9 | Consent evidence retention | Approve retention period, storage, access, deletion/export handling | Legal/Compliance + Ops | `[PLACEHOLDER]` | PII handling requirements |
| 10 | Approved legal/compliance authority | Name responsible approver and authority scope | Legal/Compliance lead | `[PLACEHOLDER]` | Required for verification |

## 4. Required approval statement (to be completed by approver)

> I, `[NAME / ROLE]`, confirm that the WhatsApp consent wording/policy identified as `[VERSION/REFERENCE]` is approved for scope `[SCOPE]` on `[DATE]`, subject to conditions `[CONDITIONS / NONE]`. This approval does not authorize production deployment or provider messaging without separate operational authorization.

**Signature / written evidence reference:** `[PLACEHOLDER]`

## 5. Boundaries

- This is a request draft only; not sent.
- No legal compliance is claimed by this document.
- Technical implementation, provider sandbox testing, and production messaging require separate authorizations.