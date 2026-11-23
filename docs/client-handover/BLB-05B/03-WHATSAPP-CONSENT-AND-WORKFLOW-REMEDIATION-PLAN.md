# 03 — WhatsApp Consent & Workflow Remediation Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Scope and control

This plan addresses **BLB05A-W01** (CRITICAL, P0) and related WhatsApp findings W02-W05, A02, F01. It is planning only. No provider calls, no message delivery, no code/config changes, no legal approval invented.

## 2. Finding validation

| BLB-05A ID | Validation | Evidence | Notes |
|---|---|---|---|
| W01 | VERIFIED (static gap) | No `whatsappConsent` found in `app/components/lib`; backend has consent/outbox/webhook/template models/services/tests | Runtime behavior unverified; legal wording requires client/legal decision |
| W02 | VERIFIED (evidence gap) | No runtime provider verification evidence in audit | Requires separate sandbox/provider authorization |
| W03 | PARTIALLY VERIFIED | Admin WhatsApp centre exists; status mapping clarity needs review | Requires UI/contract review and tests |
| W04 | VERIFIED | Public consent endpoints 410; no frontend consent journey | Intentional API design possible but end-user journey incomplete |
| W05 | VERIFIED (positive control) | Outbox/webhook/consent hardening present in code | Not production proof |

## 3. Business-policy decisions vs technical implementation

| Area | Business-policy / client decision | Technical implementation (authorized later) |
|---|---|---|
| Consent wording/disclosure | Legal/compliance-approved text, languages, purpose, frequency, opt-out method, retention notice | Render approved text; store version/timestamp; prevent submission without required consent where policy requires |
| Consent scope | Which events require transactional consent; whether marketing is in scope (default out of scope unless explicitly approved) | Enforce per eventType/template category; fail closed |
| Withdrawal/suppression | STOP/withdrawal channels, SLA, customer support process | Webhook STOP handling, preference update, audit log, suppression before enqueue/send |
| Admin notifications | Which admin events permitted; recipient policy | Template registry/prefs/admin recipient config; audit trail |
| Retention/legal basis | Retention period, deletion/export process, jurisdictional requirements | Data model/retention jobs/docs - only with authorization |

**No consent wording invented. No legal compliance claimed without appropriate review.**

## 4. Remediation work packages

| WP | Description | Priority | Dependencies | Owner role | Acceptance criteria | Verification | Authorization |
|---|---|---|---|---|---|---|---|
| WP-W1 | Consent UX/design spec: capture point(s) in checkout/custom-cake/account as applicable; explicit checkbox/action; disclosure text placeholder requiring legal approval; no pre-checked consent | P0 | R-016 legal input, AP-10 | Product/UX + Legal | Spec identifies exact screens, state model, copy placeholders, error states, accessibility | Design review | Legal/product approval |
| WP-W2 | Consent persistence & audit: store consent status/source/timestamp/version/template/category/actor; immutable audit events for grant/withdraw/change | P0 | WP-W1, DB model review | Backend + Security | Consent changes auditable; cannot infer consent from phone number existence | Unit/integration tests, DB audit record review | Implementation auth |
| WP-W3 | Eligibility enforcement: outbox/send path checks valid consent/suppression/template eligibility before enqueue or send; fail closed | P0 | WP-W2, existing outbox | Backend | No message enqueued/sent without eligible consent/policy; suppression wins | Unit/integration tests, negative cases | Implementation auth |
| WP-W4 | Status model clarity: distinct states `NOT_ELIGIBLE`, `SUPPRESSED`, `PENDING`, `RETRYING`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `DEAD_LETTER` as applicable; order status separate from notification status | P1 | WP-W3 | Backend + Frontend | UI/API never display suppressed as sent/delivered; order != notification status | Contract tests, UI E2E | Implementation auth |
| WP-W5 | Withdrawal/STOP/suppression: handle provider STOP/webhook, admin/manual suppression if policy allows, customer preference updates | P1 | AP-10, WP-W2 | Backend | Withdrawn/suppressed contacts receive no further ineligible messages; auditable | Integration tests, sandbox webhook tests (authorized) | Implementation + sandbox auth |
| WP-W6 | Duplicate/retry/delivery accuracy: idempotency keys, provider message correlation, retry caps, dead-letter visibility | P1 | existing outbox/webhook | Backend | No duplicate sends for same idempotency event; retries bounded; delivery status based on provider evidence only | Tests, log review | Implementation auth |
| WP-W7 | Admin visibility: WhatsApp centre shows consent/suppression/delivery states accurately; manual wa.me actions clearly labeled non-sending | P1 | WP-W4 | Frontend + Backend | Admin can distinguish not eligible/suppressed/failed/sent/delivered | UI tests, manual review | Implementation auth |
| WP-W8 | Provider sandbox verification: templates, send, webhook status, STOP, failures | P1 | WP-W1-W7, R-006 auth | QA + Backend + Ops | Evidence for authorized scenarios only; no real customer messages | Sandbox test report | Separate provider/sandbox authorization |
| WP-W9 | Documentation/compliance pack: consent policy, template registry, ops runbook, troubleshooting, known limits | P1 | WP-W1-W8 | Tech Writer + Legal + Ops | Docs reflect approved behavior and limits | Doc review | Client/legal input |

## 5. Mandatory acceptance criteria (must pass before closure)

- A notification cannot be treated as authorized merely because a phone number exists.
- Suppressed notifications are not displayed as sent or delivered.
- Customer order status and notification status remain distinct.
- Consent changes are auditable (who/when/source/what/old-new state).
- Existing security controls are preserved (no S02 weakening, no secret exposure, no auth bypass).
- Failure to persist consent or enqueue notification must not create false "sent" state.

## 6. Test scenarios (planning only - no execution)

| Scenario | Type | Expected |
|---|---|---|
| Checkout/custom-cake without consent | Negative | No transactional WhatsApp enqueue unless policy explicitly allows separate lawful basis; UI indicates ineligible/not opted in |
| Explicit consent granted | Positive | Consent persisted with audit; eligible notification may enqueue |
| Consent withdrawn/STOP | Negative | Future notifications suppressed; audit recorded; UI shows suppressed/not eligible |
| Duplicate event | Negative | Same idempotency key does not send twice |
| Provider failure | Failure | Status FAILED/RETRYING/DEAD_LETTER as applicable; no "sent/delivered" false positive |
| Admin manual wa.me | Control | No auto-send; audit/UI label clear |

## 7. Risks and open decisions

- **Legal wording/policy:** REQUIRES CLIENT DECISION / legal review. Blocking for R-001 closure.
- **Template approval/provider configuration:** REQUIRES EXTERNAL PROVIDER ACCESS - not authorized.
- **Existing data migration:** REQUIRES TECHNICAL INVESTIGATION; any migration needs separate authorization.
- **Marketing consent:** out of scope unless explicitly decided and legally approved.