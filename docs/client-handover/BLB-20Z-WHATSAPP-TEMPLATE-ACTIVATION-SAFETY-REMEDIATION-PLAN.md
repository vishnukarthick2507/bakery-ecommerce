# BLB-20Z — WhatsApp Template Activation Safety Remediation Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Documentation-only remediation plan (read-only inspection; no implementation)  
**Status:** **PLAN ONLY — NOT AUTHORIZED FOR IMPLEMENTATION**  
**BLB-21:** **NOT AUTHORIZED**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

This plan addresses BLB-20Y findings: 8 WhatsApp templates are internally `APPROVED`/`enabled:true` in `backend/src/services/whatsappTemplateRegistry.ts` while Meta approval is **UNVERIFIED**; the registry has no `metaTemplateId` field; `whatsappService.sendWhatsAppTemplate()` does not enforce registry eligibility; and no outbox worker is started in runtime (`backend/src/server.ts`). 

**Safety objective:** No WhatsApp template may be delivered merely because an internal registry entry says `APPROVED` and `enabled:true`. Delivery must require layered runtime enforcement, verified external Meta approval evidence, owner/legal/technical readiness, and explicit activation authorization.

**No changes made.** This document is a remediation plan only.

---

## 2. Evidence Baseline (BLB-20Y + Current Source)

| Evidence | Location | Finding |
|---|---|---|
| Template registry | `backend/src/services/whatsappTemplateRegistry.ts` L21-31,63-255,278-389 | 8 APPROVED/enabled:true; 10 NOT_SUBMITTED/enabled:false; no `metaTemplateId`; fail-closed validation exists but passes for enabled+APPROVED+valid vars. |
| Outbox processing | `backend/src/services/notificationOutboxService.ts` L417-582 | Validates template/consent/config/UAT; calls `sendWhatsAppTemplate`; no runtime worker started. |
| Send service | `backend/src/services/whatsappService.ts` L120-188 | Checks UAT/config/phone only; **no registry/approval/Meta ID check**. |
| Runtime startup | `backend/src/server.ts` L238,249,278-279 | Starts inventory/proposal expiry workers; no outbox worker; no outbox shutdown. |
| Admin controls | `backend/src/routes/adminWhatsAppRoutes.ts`, `backend/src/controllers/adminWhatsAppController.ts` | No template enable/disable/approval endpoints; retry requeues only. |
| BLB-20Y | `docs/client-handover/BLB-20Y-WHATSAPP-TEMPLATE-REGISTRY-RECONCILIATION-REPORT.md` | Confirms drift, no Meta evidence, no worker, latent risk. |

---

## 3. Eight Internally Enabled Templates — Reconciliation & Safe Interim Plan

**Meta approval status for all 8: UNVERIFIED (no repository/external evidence).** Internal `APPROVED` is **not** Meta approval.

| # | Internal event | Template | Current internal status | Current enabled | Required vars (registry) | Meta approval | Recommended safe interim state | Evidence required before activation | Activation prerequisites |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `ORDER_PLACED` | `order_received` | `APPROVED` | `true` | `customerName, orderNumber, totalAmount, status, trackingUrl` | **UNVERIFIED** | **Fail-closed:** set `approvalState=NOT_SUBMITTED` (or `PENDING` until evidence), `enabled=false`, add `metaTemplateId=""`/null field when schema authorized; block send until external evidence recorded | Meta template name/language/category, Meta approval status + template ID (if supplied), exact approved body/variable positions/sample values, owner wording approval, legal/compliance review, payload/rendering validation, production domain confirmation | BLB-21 auth; registry schema migration/design; D20-02/03/04/06 alignment; outbox worker; defense-in-depth; UAT/sandbox evidence; explicit activation authorization |
| 2 | `PAYMENT_CONFIRMED` | `payment_received` | `APPROVED` | `true` | `customerName, orderNumber, totalAmount, trackingUrl` | **UNVERIFIED** | Fail-closed interim (same as above) | Same evidence set + D20-02 amount semantics/currency and D20-03 payment method label confirmation | Same prerequisites; D20-02/03 implemented/verified as authorized |
| 3 | `STATUS_CHANGED_CONFIRMED` | `order_confirmed` | `APPROVED` | `true` | `customerName, orderNumber, status, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Same evidence set + D20-04 approved wording (no raw `{{status}}`) and registry/payload alignment evidence | Same prerequisites; D20-04 implementation/mapping verification |
| 4 | `STATUS_CHANGED_PREPARING` | `order_preparing` | `APPROVED` | `true` | `customerName, orderNumber, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Standard evidence set | Standard prerequisites |
| 5 | `STATUS_CHANGED_READY` | `order_ready` | `APPROVED` | `true` | `customerName, orderNumber, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Standard evidence set; confirm READY/READY_FOR_PICKUP semantics | Standard prerequisites |
| 6 | `STATUS_CHANGED_OUT_FOR_DELIVERY` | `order_out_for_delivery` | `APPROVED` | `true` | `customerName, orderNumber, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Standard evidence set | Standard prerequisites |
| 7 | `STATUS_CHANGED_COMPLETED` | `order_completed` | `APPROVED` | `true` | `customerName, orderNumber, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Standard evidence set; confirm non-promotional closing acceptable | Standard prerequisites |
| 8 | `CANCELLED` | `order_cancelled` | `APPROVED` | `true` | `customerName, orderNumber, trackingUrl` | **UNVERIFIED** | Fail-closed interim | Standard evidence set | Standard prerequisites |

**No registry modification performed.** Any interim-state change requires BLB-21 implementation authorization, code review, tests, and documented rollback.

---

## 4. Defense-in-Depth Sending Service Plan

### 4.1 Principle
Registry validation in outbox is necessary but insufficient. `whatsappService.sendWhatsAppTemplate()` must independently reject ineligible sends before making any Meta API call. Administrative workflow and external approval evidence must be tracked outside the runtime send path, but runtime must enforce their required technical markers.

### 4.2 Runtime enforcement (sending service / shared send gate)

`sendWhatsAppTemplate` (or a new shared `sendApprovedWhatsAppTemplate` gate used by all callers) should reject when:

| Check | Reject condition | Proposed error/result | Notes |
|---|---|---|---|
| UAT safe mode | External side effects blocked | `{ accepted:false, rejected:"UAT_SAFE_MODE" }` | Already exists. |
| Config | Missing/invalid WhatsApp config | existing config rejection | Already exists. |
| Template identity | Missing templateName/internalEvent mapping | reject | Require explicit template definition lookup. |
| Registry disabled | `definition.enabled !== true` | reject | **New defense-in-depth**. |
| Internal approval | `definition.approvalState !== "APPROVED"` | reject | **New defense-in-depth**. |
| Meta template identifier | `metaTemplateId` missing/empty/invalid format | reject | Requires schema addition; do not send by internal name alone if Meta ID required by design. |
| External approval evidence marker | No verified external-approval evidence reference/state in registry/admin record | reject | Runtime should check a machine-readable evidence marker; actual documents remain external. |
| Required vars | Missing/empty required variables or count mismatch | reject | Reuse `validateTemplateForSend`. |
| Recipient/consent | Invalid phone or missing transactional consent | reject | Consent currently checked in outbox; keep in outbox and consider gate-level check. |
| Category/policy | Category mismatch or marketing blocked | reject | Existing registry/category checks. |

### 4.3 Administrative workflow (not runtime send proof)
- Maintain a template submission/approval register: owner wording approval, legal review, Meta submission date, Meta template name/ID/language/category, approval/rejection evidence, approver, activation date.
- Admin UI may display status but must not bypass runtime checks.
- Any enable action requires explicit authorization, audit log, and evidence attachment/reference.

### 4.4 External approval evidence (not assumed)
- Runtime may require a reference ID/status flag, but **must not treat flag presence as Meta approval without verified external evidence captured through controlled process**.
- Evidence storage must not contain secrets/tokens.

---

## 5. Outbox Worker — Safe Future Architecture (Plan Only)

> **NOT IMPLEMENTED / NOT AUTHORIZED.** No worker created or started.

### 5.1 Lifecycle
- **Startup:** explicit `startNotificationOutboxWorker()` called from server bootstrap only after DB connected, UAT-safe checks pass, and feature flag/env guard allows. Default disabled in production until authorized.
- **Shutdown:** `stopNotificationOutboxWorker()` on SIGTERM/SIGINT; await in-flight job completion with timeout; release/renew leases safely.
- **Health:** expose internal metrics (queue depth, oldest pending, dead letters, processing count, last run, last error) via admin/authenticated endpoint.

### 5.2 UAT-safe-mode enforcement
- Worker must refuse to send external WhatsApp/email when `isUatExternalSideEffectsBlocked()` is true.
- In UAT mode, process jobs as suppressed/released per existing outbox pattern; never call Meta.
- UAT DB target validation remains mandatory (`127.0.0.1:27018/bluebell_whatsapp_uat`).

### 5.3 Idempotency / duplicate-send protection
- Preserve outbox `idempotencyKey` unique constraint.
- Atomic claim with `findOneAndUpdate` and lease ownership.
- Mark SENT only on provider acceptance; keep stale-worker update guard.
- On provider-accepted but SENT persistence failure, do not re-send blindly; log for reconciliation (existing pattern).
- Webhook status correlation by exact `metaMessageId` only.

### 5.4 Retry limits and dead-letter
- Exponential backoff with jitter, max attempts, max backoff cap.
- Classify permanent failures (validation, missing consent, disabled template, unapproved template, missing config as configured policy, invalid recipient, permanent provider 4xx where safe).
- Dead-letter after max attempts or permanent failure; admin retry creates auditable manual retry path without duplicating idempotency key.

### 5.5 Lease recovery
- Periodic `recoverExpiredLeases()` sweep.
- Lease TTL > max expected send time; renew lease for long-running jobs if needed.
- Recovery must be idempotent and logged.

### 5.6 Consent checks
- Pre-send transactional consent check; final check immediately before provider call (existing).
- STOP/withdrawAll must prevent future sends; audit consent history.

### 5.7 Template eligibility checks
- Resolve internal event -> template definition.
- Validate enabled, internal approval state, category, required vars, Meta template ID/evidence marker as designed.
- Reject unknown STATUS_CHANGED mappings (already present).
- Fail closed on any ambiguity.

### 5.8 Structured audit logging
- Log jobId, idempotencyKey, eventType, templateName, channel, status, attempt, workerId, error class (no secrets/PII/body content/tokens).
- Audit admin retries, suppressions, dead-letter transitions, and activation/config changes.

### 5.9 No accidental production startup
- Feature flag default off. 
- Require explicit env/config + deployment authorization.
- Startup logs must clearly state worker enabled/disabled.
- Do not enable in production until all activation gates pass.

---

## 6. Approval Evidence Required Before Any Template Activation

| Evidence | Required | Owner | Runtime/admin use |
|---|---:|---|---|
| Actual Meta template name & language | Yes | Meta/ops | Admin record; runtime may validate name/language match |
| Meta approval status & identifier (if supplied) | Yes | Meta/ops | Admin record; runtime requires verified ID/marker before send |
| Exact approved body & variable positions | Yes | Meta/owner/legal | Admin evidence; used for payload/rendering validation tests |
| Category & restrictions | Yes | Meta/legal | Registry/admin metadata; runtime category checks |
| Owner wording approval | Yes | Project Owner | Decision register/evidence reference |
| Legal/compliance review evidence | Yes | Legal/compliance | External evidence reference; W01 gate |
| Technical payload/rendering validation | Yes | Engineering QA | Test evidence; required before activation |
| Consent/opt-out compliance evidence | Yes | Legal/ops/engineering | Required for transactional messaging |
| Activation authorization | Yes | Project Owner | Explicit BLB-21/release authorization record |

**No evidence above is claimed to exist.** Missing evidence = not activatable.

---

## 7. Implementation Sequencing (Separate Authorizations)

| Milestone | Scope | Preconditions | Authorization | Acceptance criteria | Rollback |
|---|---|---|---|---|---|
| M1 Registry reconciliation | Reconcile registry schema/state/docs; add metaTemplateId/evidence fields; decide interim fail-closed for 8 templates | BLB-20Y accepted; owner decision on interim posture | **Separate BLB-21 auth** | Registry state matches approved governance; no unintended sends; tests pass | Revert schema/code changes via reviewed rollback; keep fail-closed |
| M2 Sending-service defense-in-depth | Shared send gate/registry enforcement in whatsappService or wrapper; reject disabled/unapproved/missing Meta ID/missing evidence/invalid vars | M1 design; BLB-21 auth | **Separate BLB-21 auth** | All send paths pass gate; unit/integration tests prove bypass prevention | Disable new gate by feature flag only if safe; prefer fail-closed revert |
| M3 Outbox worker implementation | Worker lifecycle, lease recovery, metrics, shutdown, UAT-safe; no production enablement by default | M1-M2; BLB-21 auth | **Separate BLB-21 auth** | Jobs processed in dev/test; idempotent; retries/DLQ/recovery verified | Stop worker; leave enqueue fail-safe; jobs remain in outbox |
| M4 UAT-only testing | Isolated UAT DB `127.0.0.1:27018/bluebell_whatsapp_uat`, UAT_SAFE_MODE, no real customers/providers | M3; separate UAT auth | **Separate UAT auth** | End-to-end simulated flows verified; no external side effects | Stop UAT, preserve evidence, no prod impact |
| M5 Meta integration & webhook validation | Sandbox/test Meta app, webhook verification, status callbacks, credentials in secure env | M4; Meta setup; auth | **Separate auth** | Verify webhook, auth, template rendering in sandbox; no production sends | Disable webhook/config; rotate test credentials |
| M6 Template submission & external approval | Submit approved templates; capture Meta IDs/approval evidence; legal/W01 complete | Owner decisions, W01, Meta business setup | **Separate owner+external auth** | Per-template evidence complete; registry updated only through controlled process | Keep template disabled/not activated |
| M7 Production readiness & deployment | Security review, monitoring, rollback, runbooks, staged enablement | M1-M6 complete; D-19 cleared | **Separate production auth** | Checklist complete; explicit go-live approval | Disable worker/templates; rollback deployment/config |

---

## 8. Risks, Dependencies, Acceptance Criteria, Rollback

### 8.1 Risks
- **Latent send risk (High):** 8 templates already enabled/APPROVED in code; accidental worker/config activation could send before Meta approval.
- **Operational non-delivery (Critical ops):** No outbox worker means queued notifications not delivered.
- **Compliance risk (High):** Missing W01/legal/Meta approval evidence.
- **Registry drift (High):** Docs and code disagree; operators may assume fail-closed.
- **Bypass risk (Medium):** `whatsappService` lacks registry enforcement.

### 8.2 Dependencies
- BLB-20Y findings; decision register state.
- Owner decisions D20-08-C/D/E/F, D20-05-B/E/F, D20-01, D20-09.
- BLB-21 implementation authorization per milestone.
- W01 legal/compliance, Meta business/app/credentials/approval.
- UAT-safe isolated environment and authorization.

### 8.3 Acceptance criteria (for future authorized implementation)
- No template send possible unless: enabled, internally approved, Meta-approved evidence marker/ID present, consent valid, UAT-safe allows, config valid, payload valid, worker authorized.
- `sendWhatsAppTemplate`/shared gate rejects ineligible sends independently.
- Outbox worker has lifecycle, lease recovery, idempotency, retries/DLQ, audit logs.
- All 8 currently enabled templates moved to safe interim state until evidence complete, or explicitly justified and authorized with evidence.
- Tests cover bypass attempts, disabled/unapproved/missing Meta ID/missing vars/consent withdrawal/UAT suppression.

### 8.4 Rollback considerations
- Default rollback posture is **fail-closed**: disable worker, disable templates, revoke activation flags.
- Keep registry changes reversible and audited.
- Do not delete outbox records needed for reconciliation; use status transitions.
- Any production rollback requires preserving evidence and notifying owner/operators.

---

## 9. Unresolved Owner Decisions / Gates

- D20-08-C/D/E/F, D20-05-B/E/F, D20-01, D20-09 — **NOT DECIDED**.
- BLB-21 — **NOT AUTHORIZED**.
- W01 legal/compliance — **NOT RECEIVED**.
- Meta setup/credentials/template submission/approval — **NOT COMPLETE/UNVERIFIED**.
- D-14, D-16/D-17/D-18, BLB-11A OD-01–OD-05, Group 5 0/13 granted, D-19 NO-GO — **UNRESOLVED**.

---

## 10. Explicit NO-CHANGE Confirmation

- Read-only inspection only. No source/test/config/env/dependency/DB/provider/Meta/Git changes.
- No templates enabled/disabled/submitted/deleted/modified.
- No WhatsApp messages sent. No tests/builds run.
- Existing worktree preserved. **BLB-21 remains NOT AUTHORIZED.**

*End of BLB-20Z remediation plan (documentation-only, no implementation).*