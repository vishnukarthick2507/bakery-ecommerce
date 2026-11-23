# BLB-20Y — WhatsApp Template Registry Reconciliation Report

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Expected/observed HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Read-only safety investigation + documentation-only report creation  
**Project status:** **NOT READY / NO-GO**  
**BLB-21:** **NOT AUTHORIZED**

---

## 1. Executive Summary

This investigation reconciles the discrepancy between BLB-18/BLB-19 documentation (reported all 18 WhatsApp templates as `NOT_SUBMITTED`, `enabled:false`, empty `metaTemplateId`) and the current `backend/src/services/whatsappTemplateRegistry.ts`, which currently contains **8 `APPROVED` / `enabled:true` templates and 10 `NOT_SUBMITTED` / `enabled:false` templates**.

**Critical findings:**
- **Registry/doc drift confirmed.** Current code registry differs materially from BLB-18/19. 8 templates are internally marked `APPROVED` and `enabled:true`; 10 remain `NOT_SUBMITTED` and `enabled:false`. `metaTemplateId` is **not present** in the registry schema/code at all (no field in `WhatsAppTemplateDefinition`).
- **No Meta approval evidence found in repository.** Internal registry `APPROVED` must **not** be treated as Meta submission/approval. All 18 templates are recorded as **Meta approval: UNVERIFIED** (no evidence of Meta submission/approval).
- **No runtime outbox worker is started.** `backend/src/server.ts` starts inventory and proposal expiry workers only; no outbox worker/scheduler calls `claimJob`, `processJob`, or `recoverExpiredLeases`. Enqueue can occur, but no runtime processor is wired.
- **Current runtime delivery path for enqueued outbox jobs is effectively inert without a worker.** However, this is **not a safety control**. If a worker were added/configured, or jobs processed by another authorized runtime path, the 8 enabled/APPROVED registry templates would pass registry validation (subject to consent/config/UAT/provider checks).
- **Sending service does not independently enforce registry eligibility.** `whatsappService.sendWhatsAppTemplate()` checks UAT/config/phone/HTTP only; it does not check registry approval/enabled. Registry validation is enforced in `notificationOutboxService.processJob()` and pre-enqueue in `customCakeNotifications.ts`. No direct `sendWhatsAppTemplate()` call exists in `backend/src` outside `notificationOutboxService.ts`.
- **No admin template enable/disable/approval endpoint found.** Admin WhatsApp routes/controllers expose stats/messages/retry/consents/preferences only.

**No changes were made** to source, tests, config, env, dependencies, docs/registers, templates, DB, providers, or Git history.

---

## 2. 18-Template Reconciliation Table

Legend: **Internal** = current code registry state. **Meta approval** = UNVERIFIED unless actual external Meta approval evidence exists (none found). **Can send now?** = can be delivered by currently wired runtime path as-is.

| # | Internal event | Template name | Internal approvalState | enabled | metaTemplateId field/value | Mapped to actual event? | Payload/validation | Sending service can use? | Meta approval evidence | Runtime path could send now? | Classification | Diff vs BLB-18/19 |
|---:|---|---|---|---:|---|---|---|---|---|---|---|---|
| 1 | `ORDER_PLACED` | `order_received` | `APPROVED` | `true` | **Field not present in schema** | Yes — `customerOrderNotifications.ts` maps ORDER_PLACED; outbox direct mapping allows ORDER_PLACED | Passes registry validation if 5 required vars non-empty: `customerName, orderNumber, totalAmount, status, trackingUrl` | Yes, via outbox `processJob` if worker ran and checks pass; `sendWhatsAppTemplate` itself does not check registry | **UNVERIFIED** | **No (no outbox worker started)**; would be eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** (BLB-18/19 reported NOT_SUBMITTED/false/empty) |
| 2 | `PAYMENT_CONFIRMED` | `payment_received` | `APPROVED` | `true` | Field not present | Yes — mapped in `customerOrderNotifications.ts`; outbox direct mapping | Requires 4 vars: `customerName, orderNumber, totalAmount, trackingUrl` | Yes via outbox path if worker ran/checks pass | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 3 | `STATUS_CHANGED_CONFIRMED` | `order_confirmed` | `APPROVED` | `true` | Field not present | Yes — STATUS_CHANGED+CONFIRMED maps to `order_confirmed`; outbox STATUS_CHANGED mapping includes it | Requires 4 vars: `customerName, orderNumber, status, trackingUrl` | Yes via outbox path if worker ran/checks pass | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 4 | `STATUS_CHANGED_PREPARING` | `order_preparing` | `APPROVED` | `true` | Field not present | Yes — STATUS_CHANGED+PREPARING | Requires 3 vars | Yes via outbox path | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 5 | `STATUS_CHANGED_READY` | `order_ready` | `APPROVED` | `true` | Field not present | Yes — STATUS_CHANGED+READY/READY_FOR_PICKUP | Requires 3 vars | Yes via outbox path | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 6 | `STATUS_CHANGED_OUT_FOR_DELIVERY` | `order_out_for_delivery` | `APPROVED` | `true` | Field not present | Yes — STATUS_CHANGED+OUT_FOR_DELIVERY | Requires 3 vars | Yes via outbox path | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 7 | `STATUS_CHANGED_COMPLETED` | `order_completed` | `APPROVED` | `true` | Field not present | Yes — STATUS_CHANGED+DELIVERED/COLLECTED | Requires 3 vars | Yes via outbox path | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 8 | `CANCELLED` | `order_cancelled` | `APPROVED` | `true` | Field not present | Yes — CANCELLED mapping in customerOrderNotifications/outbox direct mapping | Requires 3 vars | Yes via outbox path | **UNVERIFIED** | **No (no worker)**; eligible if worker/config/consent/UAT/provider pass | Transactional, customer-facing | **Differs** |
| 9 | `PAYMENT_FAILED` | `payment_failed` | `NOT_SUBMITTED` | `false` | Field not present | Yes — mapped in customerOrderNotifications/outbox direct mapping | Registry validation fail-closed while disabled/not approved | No, blocked by registry validation in outbox; also not sendable unless registry changed | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches BLB-18/19 status** |
| 10 | `CUSTOM_CAKE_REQUEST_RECEIVED` | `custom_cake_request_received` | `NOT_SUBMITTED` | `false` | Field not present | Yes — customCakeNotifications maps event; outbox direct mapping includes event | Fail-closed; customCakeNotifications also prechecks definition enabled/APPROVED before enqueue | No (pre-enqueue and outbox validation block) | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 11 | `CUSTOM_CAKE_QUOTE_PREPARED` | `custom_cake_quote_prepared` | `NOT_SUBMITTED` | `false` | Field not present | Yes — mapped; outbox direct mapping includes event | Fail-closed; requires 6 vars; notifier builds empty-string fallback but precheck blocks disabled/unapproved | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 12 | `CUSTOM_CAKE_QUOTE_ACCEPTED` | `custom_cake_quote_accepted` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 13 | `CUSTOM_CAKE_QUOTE_DECLINED` | `custom_cake_quote_declined` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 14 | `CUSTOM_CAKE_REQUEST_CLOSED` | `custom_cake_request_closed` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 15 | `CUSTOM_CAKE_CONVERTED_TO_ORDER` | `custom_cake_converted_to_order` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 16 | `RESCHEDULE_REQUESTED` | `order_reschedule_requested` | `NOT_SUBMITTED` | `false` | Field not present | Yes — mapped in customerOrderNotifications/outbox direct mapping | Fail-closed; requires 5 vars | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 17 | `RESCHEDULE_ACCEPTED` | `order_reschedule_accepted` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |
| 18 | `RESCHEDULE_REJECTED` | `order_reschedule_rejected` | `NOT_SUBMITTED` | `false` | Field not present | Yes | Fail-closed | No | **UNVERIFIED** | **No** | Transactional, customer-facing | **Matches** |

**Not in registry (gap):** `RESCHEDULE_PROPOSED` / admin reschedule proposal has no registry entry, no outbox mapping, and `customerOrderNotifications.whatsappTemplateFor` returns null for `STATUS_CHANGED` + `RESCHEDULE_PROPOSED`. This is consistent with BLB-18/19/20R-20X findings.

---

## 3. Evidence and Exact Source Locations

### 3.1 Template registry (current state)
- `backend/src/services/whatsappTemplateRegistry.ts`
  - `WhatsAppTemplateDefinition` (L21-31): fields include `approvalState`, `enabled`; **no `metaTemplateId` field**.
  - `WHATSAPP_TEMPLATE_REGISTRY` (L63-255): 18 entries.
  - Entries 1-8 `APPROVED`, `enabled:true`: `order_received` L65-73, `payment_received` L74-83, `order_confirmed` L84-92, `order_preparing` L93-101, `order_ready` L102-110, `order_out_for_delivery` L111-119, `order_completed` L120-128, `order_cancelled` L129-137.
  - Entries 9-18 `NOT_SUBMITTED`, `enabled:false`: `payment_failed` L138-148, custom cake 6 L149-221, reschedule requested/accepted/rejected L222-254.
  - `validateTemplateForSend`/`validateDefinitionForSend` (L278-389): fail-closed on missing/disabled/not approved/category mismatch/invalid params/missing required vars.

### 3.2 Registry consumers / validation / send path
- `backend/src/services/notificationOutboxService.ts`
  - Imports `validateTemplateForSend` (L27) and `isWhatsAppConfigured`, `sendWhatsAppTemplate` (L24-26).
  - `processJob` (L417+): UAT block (L425-439); WhatsApp config check, permanent fail if missing (L442-452); transactional consent check (L454-460); final consent check before send (L468-473); resolves internal event and validates template via `validateTemplateForSend` (L475-501); sends via `sendWhatsAppTemplate` (L502-527); marks sent/failed with stale-worker protections.
  - No worker loop/scheduler in file; exports `claimJob`, `markSent/Skipped/Failed`, `releaseSuppressedJob`, `recoverExpiredLeases`, `processJob`, `getOutboxStats`.
- `backend/src/services/customCakeNotifications.ts`
  - Imports `getTemplateDefinition` (L9), `enqueueNotification` (L7).
  - Pre-enqueue fail-closed: `if (!definition || !definition.enabled || definition.approvalState !== "APPROVED") return;` (L125-128).
- `backend/src/services/whatsappService.ts`
  - `isWhatsAppConfigured` / `getWhatsAppPresenceChecks` (L39-59).
  - `sendWhatsAppTemplate` (L120-188): checks UAT, config, normalized phone; sends to Meta Graph API; **no registry approval/enabled check**. Returns accepted/providerMessageId or false. Never throws.
- `backend/src/services/customerOrderNotifications.ts`
  - Maps order events to template names/params and enqueues via `enqueueNotification` (L77-93). No pre-enqueue registry approval check in this file; outbox validates on processing.
  - RESCHEDULE_PROPOSED not mapped in `whatsappTemplateFor` (switch L117-199 has no RESCHEDULE_PROPOSED case).

### 3.3 Outbox worker / runtime
- `backend/src/server.ts`
  - Starts `startInventoryExpiryWorker()` (L238) and `startProposalExpiryWorker()` (L249). No outbox worker import/start. Graceful shutdown stops inventory/proposal workers only (L278-279).
- Grep evidence: `claimJob`/`recoverExpiredLeases` defined in `notificationOutboxService.ts`; `recoverExpiredLeases` called in `backend/tests/notificationOutbox.test.ts` only. No `processJob(...)` call in src. No outbox worker startup found.

### 3.4 Admin routes/controllers (template management?)
- `backend/src/routes/adminWhatsAppRoutes.ts`: `/stats`, `/messages`, `/messages/:id`, `/messages/:id/retry`, `/consents`, `/preferences` GET/PATCH. **No template enable/disable/approval routes.**
- `backend/src/controllers/adminWhatsAppController.ts`: handles stats/messages/retry/consents/preferences. Retry resets job to PENDING with attemptCount 0 (L374-389) — requeues existing outbox record; still requires worker. **No template registry mutation.**

### 3.5 Webhook
- `backend/src/controllers/whatsappWebhookController.ts`: GET verify, POST receive, signature verification (`WHATSAPP_APP_SECRET`), idempotent event recording, STOP withdraw-all consent, TRACK/HELP internal only, status callback correlation to outbox by exact `metaMessageId`. UAT-safe blocked. No outbound template sending.
- `backend/src/routes/whatsappWebhookRoutes.ts`: GET `/webhook/verify`, POST `/webhook`.
- `backend/src/server.ts`: raw body mounted for `/api/whatsapp/webhook` before JSON parser.

### 3.6 Consent / public endpoints
- `backend/src/routes/whatsappRoutes.ts`: public consent endpoints return 410 `CONSENT_ENDPOINT_DISABLED`.
- `backend/src/services/whatsappConsentService.ts`: transactional/marketing separation, grant/withdraw/withdrawAll, `hasValidTransactionalConsent` used by outbox.

### 3.7 Env/config names (names only; values not read)
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (`whatsappService.ts`, `whatsappWebhookController.ts`, `notificationOutboxService.ts` error string).
- URL: `NEXT_PUBLIC_SITE_URL` (tracking/custom-cake/email links).
- Safety: `UAT_SAFE_MODE`, `MONGODB_URI`.

### 3.8 Documentation compared
- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md`: states 18 templates registered, all `NOT_SUBMITTED`, `enabled:false`, empty Meta template ID; fail-closed.
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md`: same registry-state assumption; no Meta approval.
- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md`, `BLB-20W`, `BLB-20X`, `MASTER-WHATSAPP-PROJECT-BASELINE.md`, `MASTER-WHATSAPP-PROJECT-ROADMAP-TRACKER.md`: decision/gate state; baseline notes registry drift.

---

## 4. Differences Between BLB-18/19 and Current Code

| Area | BLB-18/19 documented state | Current code observed | Severity |
|---|---|---|---|
| Registry approvalState/enabled | All 18 `NOT_SUBMITTED`, `enabled:false` | 8 `APPROVED`, `enabled:true`; 10 `NOT_SUBMITTED`, `enabled:false` | **High** governance/safety drift |
| metaTemplateId | Reported as empty | **No `metaTemplateId` field exists in registry schema/code** | **Medium** documentation/schema mismatch |
| Fail-closed behavior | Described as fail-closed | Still fail-closed in validation code; but 8 entries now pass approval/enabled checks if processed | **High** if worker/configured |
| Runtime delivery | Not deliverable as approved/enabled | Still not deliverable by currently wired runtime because no outbox worker started; but registry state is no longer uniformly disabled | **High** latent risk |
| RESCHEDULE_PROPOSED | Not in registry/mapped | Still not in registry/mapped (unchanged gap) | **Critical/High** known gap |

**Conclusion:** BLB-18/19 are stale relative to current registry state. They must not be treated as accurate current-state evidence without reconciliation.

---

## 5. Runtime Delivery-Path Findings

1. **Enqueue path exists.** `customerOrderNotifications.ts` and `customCakeNotifications.ts` enqueue WhatsApp jobs into `NotificationOutbox` when consent/mapping/prechecks pass.
2. **Processing path exists in code but is not wired.** `notificationOutboxService.ts` has `processJob`, `claimJob`, `recoverExpiredLeases`, but `server.ts` does not start any outbox worker/scheduler. No other src caller invokes `processJob/claimJob/recoverExpiredLeases`.
3. **Admin retry does not process jobs.** `/api/admin/whatsapp/messages/:id/retry` resets an eligible DEAD_LETTER/RETRYING job to PENDING; it does not process it.
4. **Webhook does not send WhatsApp template replies.** STOP/HELP/TRACK handled internally; no outbound send. Status callbacks only update correlation/status.
5. **sendWhatsAppTemplate is only called by outbox processJob in src.** Direct bypass not observed in src.
6. **UAT_SAFE_MODE blocks external side effects** in outbox processJob, whatsappService, webhook verify/receive when enabled.
7. **Consent gates exist** in notification enqueue paths and outbox processJob final check.
8. **Template validation exists** in outbox processJob and customCake pre-enqueue; **not in whatsappService.sendWhatsAppTemplate**.

**Net:** With current wiring, enqueued outbox jobs are **not processed by runtime**. This prevents delivery now, but is an operational defect, not an approval/safety guarantee.

---

## 6. Outbox Worker Findings

| Check | Finding | Evidence |
|---|---|---|
| Outbox worker started at runtime? | **No** | `server.ts` imports/starts inventory and proposal expiry workers only; no notification outbox worker. |
| Scheduler/worker initialized elsewhere? | **No evidence found in src** | Grep for `processJob(`, `claimJob(`, `recoverExpiredLeases(` shows definitions and tests only. |
| Enqueue possible without processor? | **Yes** | `enqueueNotification` writes to `NotificationOutbox`; no processor required to enqueue. |
| Retry/recovery process exists? | **Code exists, not scheduled** | `markFailed` sets RETRYING/backoff; `recoverExpiredLeases` exists; admin retry endpoint exists; no runtime scheduler/worker consumes them. |
| Template marked enabled can bypass another safety check? | **Registry check can be passed by 8 enabled/APPROVED entries; other checks still apply in outbox path** | Outbox `processJob` still requires UAT not blocked, WhatsApp configured, transactional consent granted, template validation pass. `whatsappService` itself has no registry check. |
| Sending service independently enforces template eligibility? | **No** | `whatsappService.sendWhatsAppTemplate` only checks UAT/config/phone and sends. |
| Admin endpoint can enable a template? | **No evidence found** | Admin WhatsApp routes/controllers have no template mutation endpoints. |
| Production config could accidentally activate unapproved templates? | **Risk exists if worker/config added** | 8 templates are already enabled/APPROVED in registry code. If WhatsApp credentials configured and worker started, those could send to consented recipients subject to provider acceptance. Meta approval is UNVERIFIED. |

---

## 7. Security Risks and Severity

| Risk | Severity | Rationale | Evidence |
|---|---|---|---|
| R-01 Registry/doc drift: 8 templates internally APPROVED/enabled | **High** | Creates latent send risk if worker/credentials/config become active; contradicts governance docs | `whatsappTemplateRegistry.ts` L65-137; BLB-18/19 docs |
| R-02 No outbox worker running | **Critical (operational)** / **High (control)** | Notifications enqueued but not delivered; admin retry gives false expectation; recovery not running | `server.ts`, `notificationOutboxService.ts` |
| R-03 sendWhatsAppTemplate lacks registry enforcement | **Medium** | Defense-in-depth gap; current src has no direct bypass call, but future code could misuse it | `whatsappService.ts` L120-188 |
| R-04 No Meta approval evidence for any template | **Critical for release** | Internal APPROVED != Meta approval; sending unapproved templates risks policy/non-delivery/compliance issues | No repo evidence; external status unverified |
| R-05 RESCHEDULE_PROPOSED unmapped | **High** | Admin-initiated reschedule proposal has no WhatsApp template/registry/outbox mapping | `customerOrderNotifications.ts`, `notificationOutboxService.ts`, `whatsappTemplateRegistry.ts` |
| R-06 Consent/legal evidence incomplete | **High** | W01 not received; cannot treat as compliant production messaging | Decision register / prior gates |
| R-07 Admin retry/reset semantics depend on missing worker | **Medium** | Retry requeues but no processor; may confuse ops | `adminWhatsAppController.ts` L335-412 |

---

## 8. Recommended Remediation (NOT AUTHORIZED / NO CHANGES MADE)

1. **Governance reconciliation (authorized docs/control first):** Reconcile BLB-18/19/baseline/register statements with actual registry state. Mark internal registry status clearly separate from Meta status.
2. **Registry safety posture (BLB-21-authorized code change):** Decide whether 8 internally APPROVED/enabled templates should be reverted to fail-closed NOT_SUBMITTED/enabled:false until Meta submission/approval and explicit release authorization exist. Add `metaTemplateId`/submission metadata only under authorized design.
3. **Outbox worker (BLB-21-authorized):** Implement/start a supervised outbox worker with lease recovery, backoff, observability, and UAT-safe behavior; add tests.
4. **Defense in depth (BLB-21-authorized):** Consider requiring registry validation in a shared send gate or enforcing caller contract; at minimum document and test.
5. **D20-08 implementation (BLB-21-authorized after owner decisions):** Add RESCHEDULE_PROPOSED mapping/template/registry/outbox only after D20-08-C/D/E/F resolved and explicit authorization.
6. **Meta/legal/external gates:** Obtain W01, Meta credentials/app setup, template submission/approval evidence before any live send enablement.

---

## 9. Required Owner Decisions / Implementation Authorizations

- **Owner decisions pending:** D20-08-C/D/E/F, D20-05-B/E/F, D20-01, D20-09 (D20-08-C first).
- **BLB-21 implementation authorization:** REQUIRED before any source/test/config/registry/worker changes.
- **Meta/legal/external:** W01, D-14/D-16-D-18/OD evidence, Meta app/business/credentials/template submission/approval, production authorization.
- **UAT authorization:** separate explicit authorization with UAT_SAFE_MODE and 127.0.0.1:27018/bluebell_whatsapp_uat constraints.

---

## 10. Explicit NO-CHANGE Confirmation

- **No application source files changed.**
- **No tests/fixtures/config/env/dependency files changed.**
- **No existing documentation/decision registers modified.**
- **No WhatsApp template enabled, disabled, submitted, deleted, or modified.**
- **No MongoDB or external provider access.**
- **No Meta APIs called.**
- **No WhatsApp messages sent.**
- **No tests/builds run.**
- **No Git mutations/operations performed.**
- **BLB-21 remains NOT AUTHORIZED.**

---

*End of BLB-20Y report (read-only investigation; documentation-only new file).*