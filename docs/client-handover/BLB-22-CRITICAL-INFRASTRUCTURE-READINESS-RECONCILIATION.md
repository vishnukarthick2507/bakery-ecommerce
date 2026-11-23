# BLB-22 — Critical WhatsApp Infrastructure Readiness Reconciliation

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD (expected/observed):** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Audit date:** 2026-11-22  
**Scope:** READ-ONLY technical reconciliation (G-01, G-02, G-04, G-03) + owner-decision compliance cross-check  
**Project status:** **NOT READY / NO-GO**  
**BLB-21:** **NOT AUTHORIZED**

---

## 1. Executive Summary

This read-only audit reconciles critical Phase 0 WhatsApp infrastructure findings against current source code and handover documentation. No source, test, config, env, dependency, database, provider, deployment, or Git mutation actions were performed. Exactly one new report was created.

| Finding | Classification | Risk | Key evidence |
|---|---|---|---|
| **G-01 Outbox worker runtime** | **IMPLEMENTED BUT NOT STARTED** | Critical | `server.ts` starts inventory/proposal expiry workers only; no outbox worker import/start/stop. `notificationOutboxService.ts` exports `claimJob`/`processJob`/`recoverExpiredLeases`/`mark*` but no worker loop/start function. No other src references invoke claim/process/recover. |
| **G-02 RESCHEDULE_PROPOSED notification path** | **PARTIALLY IMPLEMENTED / MISSING LINKS** | Critical | `proposeSlot` sets `RESCHEDULE_PROPOSED` and calls `notifyCustomerOrder(...,"STATUS_CHANGED",..., "RESCHEDULE_PROPOSED")`; `customerOrderNotifications.whatsappTemplateFor` returns `null` for `STATUS_CHANGED` + `RESCHEDULE_PROPOSED` (no WhatsApp enqueue). No registry template, no outbox event mapping, no `proposedSchedule` variable. D20-08-C approved instruction not represented in implementation (no implementation authorized). |
| **G-04 Template registry/doc reconciliation** | **REGISTRY/DOCUMENTATION DRIFT CONFIRMED; META APPROVAL UNVERIFIED** | High | Registry has 18 entries: 8 `APPROVED`/`enabled:true`, 10 `NOT_SUBMITTED`/`enabled:false`; no `metaTemplateId` field in schema. BLB-18/19 report all 18 `NOT_SUBMITTED`/`enabled:false`. No repo evidence of Meta submission/approval. Internal APPROVED != Meta approval. |
| **G-03 D20-06-F date/time formatting prerequisite** | **CONFIRMED RISK / IMPLEMENTATION PREREQUISITE** | High | `acceptProposal` writes `scheduledDate`/`scheduledTime` using UTC `toISOString()` split (`orderController.ts` L1556-1561). Reschedule WhatsApp templates use raw `order.scheduledDate`/`order.scheduledTime`. D20-06 display convention not implemented in notification formatting; storage-change risk exists. |

**Authorization boundary:** D20-08-C remains approved and captured. D20-08-D/E/F and D20-05-B/E/F remain undecided. BLB-21 remains NOT AUTHORIZED. No source implementation, template activation, Meta submission, or message sending was authorized or performed by this task.

---

## 2. Repository Baseline and Worktree Preservation Evidence

| Item | Observed | Evidence |
|---|---|---|
| Current branch | `feature/whatsapp-business-automation` | `git rev-parse --abbrev-ref HEAD` |
| Current HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` | `git rev-parse HEAD` |
| Expected baseline match | **YES** | Branch and HEAD match expected values |
| Git status counts (initial/final) | `TOTAL=107 / TRACKED=58 / UNTRACKED=49` | `git status --short` count before and after report creation; counts unchanged because `docs/client-handover/` was already untracked |
| Existing staged files | None observed | `git status --short` showed no `A ` staged entries |
| Existing modified tracked files | 58 tracked modified files (pre-existing) | `git status --short` (` M ...`) |
| Existing untracked files/dirs | 49 untracked entries including `docs/client-handover/`, `docs/uat/`, `docs/release/`, WhatsApp backend/frontend/test files (pre-existing) | `git status --short` (`?? ...`) |
| Worktree preserved | **YES** | No file edits/deletes/renames/formatting; only one new report added under already-untracked `docs/client-handover/` |

**Commands used (read-only):** `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git status --short` with PowerShell counts. No Git mutations.

---

## 3. G-01 — Outbox Worker Runtime Verification (CRITICAL)

### 3.1 Status classification
**IMPLEMENTED BUT NOT STARTED** (runtime processing loop not wired into backend startup). 

### 3.2 Evidence

| Check | Finding | Evidence (source) |
|---|---|---|
| Worker/scheduler exists? | **No dedicated outbox worker/scheduler loop found.** Service functions exist. | `backend/src/services/notificationOutboxService.ts` exports `enqueueNotification` (L77), `claimJob` (L147), `markSent` (L197), `markSkipped` (L224), `markFailed` (L250), `releaseSuppressedJob` (L303), `recoverExpiredLeases` (L330), `processJob` (L417), `getOutboxStats` (L587). No `start*Worker`/loop/interval/scheduler in file. |
| Imported/started by production backend startup? | **No.** | `backend/src/server.ts`: imports only `startInventoryExpiryWorker/stopInventoryExpiryWorker` (L26) and `startProposalExpiryWorker/stopProposalExpiryWorker` (L27). Startup starts inventory worker (L238) and proposal expiry worker (L249). Graceful shutdown stops only those two (L278-279). No notification outbox import/start/stop. |
| Started only in tests/scripts/manual? | **No start function found.** Claim/process/recover exported for direct use/tests; no runtime worker entrypoint. | Grep `startNotificationOutboxWorker|processOutbox|claimJob|recoverExpiredLeases|processJob|outboxWorker|notificationOutbox` in `backend/src`: definitions in `notificationOutboxService.ts`; imports/usages in `customCakeNotifications.ts` L7 (`enqueueNotification`) and `customerOrderNotifications.ts` L9 (`enqueueNotification`) only. No caller for claim/process/recover/start. |
| Claim/process/recovery actually invoked at runtime? | **Not by server startup path.** | No runtime invocation found outside service definitions. `processJob` handles delivery; `claimJob` atomically claims; `recoverExpiredLeases` resets expired leases (L330-354) — but no scheduler invokes them. |
| Conditional env/feature flags? | **No worker gating exists because no worker exists.** UAT safe mode is enforced inside `processJob`/send path (L425, `isUatExternalSideEffectsBlocked`). | `notificationOutboxService.ts` L425-439 suppresses external delivery in UAT; `whatsappService.ts` L123-126 also blocks. |
| Multiple workers/duplicate processing risk? | **Worker concurrency risk not present because no worker; duplicate-send protection exists in design primitives.** | Atomic claim via `findOneAndUpdate` with PROCESSING lease (L151-168). `markSent` enforces worker ownership (L213-217). Idempotency key unique on enqueue (model/index not fully read; service checks existing by idempotencyKey L103-107). |
| Failures/retries/stale claims/recovery handled? | **Partially in service primitives; no runtime driver.** | `markFailed` retries with exponential backoff/jitter and dead-letters on exhaustion/permanent (L250-296, `computeBackoffMs` L61-66). `recoverExpiredLeases` resets expired PROCESSING leases to PENDING (L330-354). `releaseSuppressedJob` releases UAT-suppressed jobs without consuming attempt (L303-324). |
| Can job remain queued indefinitely when no worker running? | **Yes.** | Enqueue writes PENDING (L109-127). No server startup worker claims/processes. Recovery exists but is not scheduled. |

### 3.3 Risk
**Critical.** Notifications can be durably enqueued but never delivered, creating silent operational failure. Conversely, if a worker were later started without reconciling registry/safety gates, the 8 internally enabled/APPROVED templates could become send-eligible when config/UAT/consent conditions permit.

### 3.4 Missing prerequisites
- Explicit BLB-21 implementation authorization for worker design/startup/shutdown.
- Registry reconciliation and defense-in-depth (G-04/BLB-20Z).
- UAT-safe isolated environment and authorization before any real processing tests.
- Idempotency/lease/recovery/monitoring/alerting/runbook validation.
- Legal/compliance/Meta/external approvals before production delivery.

---

## 4. G-02 — RESCHEDULE_PROPOSED Notification Path (CRITICAL)

### 4.1 Status classification
**PARTIALLY IMPLEMENTED / MISSING LINKS** (event emitted; WhatsApp template/mapping/registry/outbox path incomplete).

### 4.2 End-to-end trace

| Step | Expected | Observed | Evidence |
|---|---|---|---|
| Admin endpoint | Admin proposes reschedule | `POST /api/admin/orders/:id/propose-slot` -> `authenticateAdmin`, `proposeSlot` | `backend/src/routes/adminOrderRoutes.ts` L1-15 (`router.post("/:id/propose-slot", authenticateAdmin, proposeSlot)`) |
| Controller emits event | RESCHEDULE_PROPOSED emitted/stored | `proposeSlot` sets `order.orderStatus = "RESCHEDULE_PROPOSED"` (L1385), saves, then calls `notifyCustomerOrder(order, "STATUS_CHANGED", \`proposal:${proposal.proposalId}\`, \`A new time was proposed: ${proposal.proposedSlot.toISOString()}. ${proposal.reason}\`, "RESCHEDULE_PROPOSED")` (L1418-1424) | `backend/src/controllers/orderController.ts` L1355-1443 |
| Reaches outbox? | WhatsApp outbox job enqueued | **No WhatsApp enqueue for this path.** `notifyCustomerOrder` handles email for verified registered users (except PAYMENT_FAILED) and then calls `enqueueCustomerOrderWhatsApp` (L15-46). `enqueueCustomerOrderWhatsApp` gets template via `whatsappTemplateFor`; if null returns (L79-81). | `backend/src/services/customerOrderNotifications.ts` L15-93 |
| Template mapping exists? | STATUS_CHANGED + RESCHEDULE_PROPOSED maps to template | **No.** `whatsappTemplateFor` STATUS_CHANGED handles CONFIRMED/PREPARING/READY/READY_FOR_PICKUP/OUT_FOR_DELIVERY/DELIVERED/COLLECTED only; `default: return null` (L139-170). No case for `RESCHEDULE_PROPOSED`. | `customerOrderNotifications.ts` L139-170 |
| Registry contains template? | RESCHEDULE_PROPOSED template registered | **No.** Registry has RESCHEDULE_REQUESTED/ACCEPTED/REJECTED (L222-254) but no `RESCHEDULE_PROPOSED`/admin proposal template. 18 entries total. | `backend/src/services/whatsappTemplateRegistry.ts` L63-255 |
| Outbox internal-event mapping? | Outbox validation resolves event | **No direct/proposed mapping.** `DIRECT_EVENT_TYPE_TO_INTERNAL_EVENT` includes RESCHEDULE_REQUESTED/ACCEPTED/REJECTED (L369-371) but not RESCHEDULE_PROPOSED. STATUS_CHANGED resolution maps by `templateName` to CONFIRMED/PREPARING/READY/OUT_FOR_DELIVERY/COMPLETED only (L356-362); unknown/missing template -> permanent failure (L395-409). | `backend/src/services/notificationOutboxService.ts` L356-409 |
| Required params available/populated? | Proposed schedule + approved vars available | **Not applicable / missing.** No template/mapping. Controller has `proposal.proposedSlot` and `reason`; D20-08-B approved `{{proposedSchedule}}` (proposed/not registered/mapped). | `orderController.ts` L1373-1394,1416-1424; decision register D20-08-B |
| Proposed schedule (not old schedule) supplied? | Proposed slot used | **No WhatsApp payload constructed.** Email/detail string includes proposed ISO timestamp (`proposal.proposedSlot.toISOString()` L1422) — internal detail, not D20-08 WhatsApp content. Existing reschedule WhatsApp templates (requested/accepted/rejected) use `order.scheduledDate/order.scheduledTime` (L182-195). | `orderController.ts` L1422; `customerOrderNotifications.ts` L181-195 |
| D20-08 approved wording reflected? | Exact approved wording | **No. D20-08-E NOT DECIDED.** No exact customer-facing wording approved for implementation. | Decision register D20-08-E |
| D20-08-C generic contact instruction accurately represented? | Generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link | **Not represented in WhatsApp implementation (no WhatsApp path).** The proposeSlot detail text says "A new time was proposed..." but does not include approved D20-08-C contact instruction; there is no WhatsApp template. No button/direct acceptance link/tracking response mechanism is added by this code path. | `orderController.ts` L1422; no template/mapping exists |
| Incorrect public tracking/WhatsApp button/direct acceptance link implied? | Must not imply | **No such mechanism added in this path.** However, absence of approved instruction means implementation is incomplete, not compliant. | Source absence; BLB-20W/20X |

### 4.3 Missing links (every identified gap)
1. **No WhatsApp template definition** for RESCHEDULE_PROPOSED/admin reschedule proposal in `whatsappTemplateRegistry.ts`.
2. **No event->template mapping** in `customerOrderNotifications.whatsappTemplateFor` for `STATUS_CHANGED` + `RESCHEDULE_PROPOSED`.
3. **No outbox internal-event resolution** for RESCHEDULE_PROPOSED (neither direct event nor STATUS_CHANGED template map). If a job were enqueued as STATUS_CHANGED/RESCHEDULE_PROPOSED without a mapped template, `resolveWhatsAppInternalEventForValidation` would reject as unknown/unsupported STATUS_CHANGED template mapping (permanent failure).
4. **No `{{proposedSchedule}}` variable contract implementation** (D20-08-B approved as decision only; proposed/not registered/mapped).
5. **No D20-08-E approved exact wording** (NOT DECIDED).
6. **No D20-08-D expiry/deadline decision** (NOT DECIDED).
7. **No D20-08-F prerequisites acknowledgement/execution authorization** (NOT DECIDED; BLB-21 NOT AUTHORIZED).
8. **No worker runtime** to process outbox even if mapping existed (G-01).
9. **Registry/doc/safety reconciliation required** before any activation (G-04/BLB-20Z).
10. **D20-06 formatting prerequisite** for proposed schedule display (D20-06-F and display convention).

### 4.4 Risk
**Critical.** Admin-initiated reschedule proposals do not trigger a compliant WhatsApp notification. Customers may miss proposals; operational process relies on non-WhatsApp/manual channels. Any future implementation without D20-08-E/D/F, BLB-21, registry safety, and Meta/legal gates would be non-compliant.

### 4.5 Missing prerequisite
- Owner decisions D20-08-D/E/F; confirm D20-08-C captured (done) remains unchanged.
- BLB-21 explicit implementation authorization.
- Registry schema/mapping/design including `proposedSchedule` variable and D20-06 formatting.
- Outbox worker + defense-in-depth + UAT-safe testing.
- Meta template submission/approval, legal/compliance evidence, production authorization.

---

## 5. G-04 — WhatsApp Template Registry and Documentation Reconciliation (HIGH)

### 5.1 Status classification
**REGISTRY/DOCUMENTATION DRIFT CONFIRMED; META APPROVAL UNVERIFIED.** Current source is internally inconsistent with BLB-18/19 historical documentation claims. No evidence of documented authorization for the 8 internally APPROVED/enabled entries was found in inspected repo docs; classification is **undocumented source change / registry-documentation drift** (INCONCLUSIVE on who authorized code state absent external evidence).

### 5.2 Source of truth (current code)

- Registry: `backend/src/services/whatsappTemplateRegistry.ts`
- Schema: `WhatsAppTemplateDefinition` has `internalEvent, templateName, metaCategory, requiredVariables, language, approvalState, enabled, notes?` (L21-31). **No `metaTemplateId` field present.**
- Validation: `validateTemplateForSend` fail-closed on missing/disabled/not-approved/category mismatch/missing vars (L278-381). Passes when enabled + APPROVED + valid params.
- Consumers: `notificationOutboxService.ts` L27,486 uses `validateTemplateForSend`; `customCakeNotifications.ts` L9,125 uses `getTemplateDefinition` pre-enqueue check. `whatsappService.ts` has **no registry import/enforcement** (L1-188 inspected).
- Counts: 8 APPROVED/enabled:true (L65-137), 10 NOT_SUBMITTED/enabled:false (L138-254).

### 5.3 Documentation claims (historical)

- BLB-18 `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md` L304: "All 18 registry entries `NOT_SUBMITTED`, `enabled:false`; `validateTemplateForSend` fail-closed..." Tracking table header at L329 includes "Meta submitted / Meta template ID / Meta approval status" (documentation process fields, not code schema).
- BLB-19 `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md` L17: "**18 registered templates verified**; all remain `NOT_SUBMITTED` / `enabled:false` / fail-closed. No template is Meta-approved."
- Master baseline/BLB-20Y/BLB-20Z already record drift; this audit reconfirms from current source.

### 5.4 Complete 18-template reconciliation table

| # | Template key (templateName) | Internal status (source) | Enabled (source) | Meta template ID (source field) | Required parameters | Event mapping (actual source) | Outbox eligibility (current path) | Documentation status (BLB-18/19/latest) | Meta approval evidence | Discrepancy |
|---:|---|---|---:|---|---|---|---|---|---|---|
| 1 | `order_received` | `APPROVED` (`whatsappTemplateRegistry.ts` L70) | `true` (L71) | **No field in schema**; not populated/verifiable in code | `customerName, orderNumber, totalAmount, status, trackingUrl` (L68) | `ORDER_PLACED` -> `order_received` (`customerOrderNotifications.ts` L118-128; outbox direct map L365) | Eligible by registry validation when enabled/APPROVED/vars valid and consent/config/UAT allow; **no runtime worker started** (G-01) | BLB-18/19 reported NOT_SUBMITTED/enabled:false; BLB-20Y/20Z/master note drift | **NOT VERIFIED** | **Drift:** code APPROVED/enabled:true vs BLB-18/19 NOT_SUBMITTED/enabled:false; Meta approval unverified |
| 2 | `payment_received` | `APPROVED` (L80) | `true` (L81) | No field in schema | `customerName, orderNumber, totalAmount, trackingUrl` (L78) | `PAYMENT_CONFIRMED` -> `payment_received` (L129-138; outbox L366) | Same as above | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 3 | `order_confirmed` | `APPROVED` (L90) | `true` (L91) | No field in schema | `customerName, orderNumber, status, trackingUrl` (L88) | `STATUS_CHANGED_CONFIRMED` / STATUS_CHANGED+CONFIRMED -> `order_confirmed` (L141-145; outbox STATUS_CHANGED map L357) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 4 | `order_preparing` | `APPROVED` (L99) | `true` (L100) | No field in schema | `customerName, orderNumber, trackingUrl` (L97) | `STATUS_CHANGED_PREPARING` / PREPARING -> `order_preparing` (L146-150; L358) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 5 | `order_ready` | `APPROVED` (L108) | `true` (L109) | No field in schema | `customerName, orderNumber, trackingUrl` (L106) | `STATUS_CHANGED_READY` / READY,READY_FOR_PICKUP -> `order_ready` (L151-156; L359) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 6 | `order_out_for_delivery` | `APPROVED` (L117) | `true` (L118) | No field in schema | `customerName, orderNumber, trackingUrl` (L115) | `STATUS_CHANGED_OUT_FOR_DELIVERY` / OUT_FOR_DELIVERY -> `order_out_for_delivery` (L157-161; L360) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 7 | `order_completed` | `APPROVED` (L126) | `true` (L127) | No field in schema | `customerName, orderNumber, trackingUrl` (L124) | `STATUS_CHANGED_COMPLETED` / DELIVERED,COLLECTED -> `order_completed` (L162-167; L361) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 8 | `order_cancelled` | `APPROVED` (L135) | `true` (L136) | No field in schema | `customerName, orderNumber, trackingUrl` (L133) | `CANCELLED` -> `order_cancelled` (L171-175; outbox direct L367) | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | Drift + unverified Meta approval |
| 9 | `payment_failed` | `NOT_SUBMITTED` (L144) | `false` (L145) | No field in schema | `customerName, orderNumber, trackingUrl` (L142) | `PAYMENT_FAILED` -> `payment_failed` (L176-180; outbox direct L368) | **Blocked by registry fail-closed** (disabled/not approved) even if enqueued | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift from BLB-18/19 state; still not Meta-approved |
| 10 | `custom_cake_request_received` | `NOT_SUBMITTED` (L155) | `false` (L156) | No field in schema | `customerName, referenceNumber, trackingUrl` (L153) | `CUSTOM_CAKE_REQUEST_RECEIVED` -> `custom_cake_request_received` (`customCakeNotifications.ts` L22-42; outbox direct L372) | Blocked fail-closed by registry; custom-cake notifier also checks enabled+APPROVED (L125-130) | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 11 | `custom_cake_quote_prepared` | `NOT_SUBMITTED` (L173) | `false` (L174) | No field in schema | `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl` (L164-171) | `CUSTOM_CAKE_QUOTE_PREPARED` -> `custom_cake_quote_prepared` (customCakeNotifications L43-71; outbox L373) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 12 | `custom_cake_quote_accepted` | `NOT_SUBMITTED` (L184) | `false` (L185) | No field in schema | `customerName, referenceNumber, trackingUrl` (L182) | `CUSTOM_CAKE_QUOTE_ACCEPTED` -> `custom_cake_quote_accepted` (L72-82; outbox L374) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 13 | `custom_cake_quote_declined` | `NOT_SUBMITTED` (L195) | `false` (L196) | No field in schema | `customerName, referenceNumber, trackingUrl` (L193) | `CUSTOM_CAKE_QUOTE_DECLINED` -> `custom_cake_quote_declined` (L83-93; outbox L375) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 14 | `custom_cake_request_closed` | `NOT_SUBMITTED` (L206) | `false` (L207) | No field in schema | `customerName, referenceNumber, trackingUrl` (L204) | `CUSTOM_CAKE_REQUEST_CLOSED` -> `custom_cake_request_closed` (L94-104; outbox L376) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 15 | `custom_cake_converted_to_order` | `NOT_SUBMITTED` (L217) | `false` (L218) | No field in schema | `customerName, referenceNumber, trackingUrl` (L215) | `CUSTOM_CAKE_CONVERTED_TO_ORDER` -> `custom_cake_converted_to_order` (L105-116; outbox L377) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |
| 16 | `order_reschedule_requested` | `NOT_SUBMITTED` (L228) | `false` (L229) | No field in schema | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` (L226) | `RESCHEDULE_REQUESTED` -> `order_reschedule_requested` (customerOrderNotifications L181-185; outbox L369) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved; payload/semantics have known D20-07 concerns (separately documented) |
| 17 | `order_reschedule_accepted` | `NOT_SUBMITTED` (L239) | `false` (L240) | No field in schema | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` (L237) | `RESCHEDULE_ACCEPTED` -> `order_reschedule_accepted` (L186-190; outbox L370) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved; D20-06-F UTC write risk affects scheduled fields |
| 18 | `order_reschedule_rejected` | `NOT_SUBMITTED` (L250) | `false` (L251) | No field in schema | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` (L248) | `RESCHEDULE_REJECTED` -> `order_reschedule_rejected` (L191-195; outbox L371) | Blocked fail-closed | BLB-18/19 NOT_SUBMITTED/enabled:false | **NOT VERIFIED** | No drift; not Meta-approved |

### 5.5 Reconciliation determination

- **Observed fact:** 8 entries internally APPROVED/enabled:true; 10 NOT_SUBMITTED/enabled:false. `metaTemplateId` absent from code schema.
- **Documentation fact:** BLB-18/19 report all 18 NOT_SUBMITTED/enabled:false. BLB-20Y previously recorded this drift.
- **Meta approval:** **NOT VERIFIED** for all 18 (no repository evidence of Meta submission/approval IDs/status). Internal `APPROVED` must not be interpreted as Meta approval.
- **Authorization evidence:** **INCONCLUSIVE.** I found no inspected in-repo record authorizing the 8-entry code-state change. This is an undocumented source change / governance drift unless external evidence exists.
- **Effective delivery today:** **No runtime outbox worker started** (G-01), so registry-enabled templates are not currently being processed by a startup worker path. This reduces immediate runtime risk but does not resolve governance/drift or future activation risk.

### 5.6 Risk
**High.** Governance drift can cause false confidence, accidental enablement, or unsafe activation if a worker/config is added. Missing `metaTemplateId` and missing defense-in-depth in `whatsappService` weaken safeguards.

### 5.7 Missing prerequisite
- Owner-authorized registry reconciliation decision (fail-closed interim vs evidence-backed activation).
- BLB-21 implementation authorization for schema/defense-in-depth changes.
- Verified Meta submission/approval evidence per template before any activation.
- Update control docs only through authorized documentation process (no silent edits).

---

## 6. G-03 — D20-06-F Date/Time Formatting Prerequisite (HIGH)

### 6.1 Status classification
**CONFIRMED RISK — IMPLEMENTATION PREREQUISITE / PARTIALLY INCONSISTENT.**

### 6.2 Evidence

| Check | Finding | Evidence |
|---|---|---|
| Accepted proposal timestamps persisted how? | `acceptProposal` sets `confirmedSlot` from proposal and writes `scheduledDate`/`scheduledTime` as UTC-derived strings from `toISOString()` | `backend/src/controllers/orderController.ts` L1525-1564: `confirmedSlotTime = proposal.proposedSlot`; `order.confirmedSlot = confirmedSlotTime`; `order.scheduledDate = confirmedSlotTime.toISOString().split("T")[0] ?? ""` (L1556-1557); `order.scheduledTime = confirmedSlotTime.toISOString().split("T")[1]?.split(".")[0] ?? "10:00:00"` (L1559-1561). |
| UTC conversion used? | **Yes, for persisted display strings in acceptance path.** | Same lines use `toISOString()` (UTC). |
| Schedule fields written in UTC-derived date/time strings? | **Yes, in acceptProposal.** | L1556-1561. |
| Existing checkout schedule values represent IST? | **INCONCLUSIVE from code alone in this audit; risk flagged.** Order model stores `scheduledDate: string`, `scheduledTime: string`, `requestedSlot?: Date`, `confirmedSlot?: Date` (`backend/src/models/Order.ts` L102-105,283-359). Prior decision docs state IST display/checkout semantics; this audit did not re-prove checkout persistence format beyond model/controller snippets. | `models/Order.ts` L102-105; D20-06 decision register/history. |
| Customer-facing notification formatting follows D20-06? | **No evidence of D20-06 formatting in WhatsApp reschedule templates.** | `customerOrderNotifications.ts` L181-195 passes raw `order.scheduledDate, order.scheduledTime` to reschedule templates. L114 uses tracking URL default; no DD MMM YYYY / 12-hour AM/PM / IST formatter. |
| DD MMM YYYY? | **Not implemented for WhatsApp schedule params.** | Raw string params in `customerOrderNotifications.ts` L184,189,194. |
| 12-hour AM/PM? | **Not implemented.** | Same. |
| IST displayed exactly once? | **Not implemented/unknown in template rendering.** | No formatting utility used; templates not Meta-approved. |
| Time ranges preserved when source value is a range? | **Not applicable to current reschedule accepted/rejected/requested params (single date/time fields). D20-08-B proposedSchedule requires range preservation when implemented.** | Decision register D20-08-B/D20-06; no proposedSchedule implementation. |
| Other order/custom cake notification paths inconsistent formatting? | **Potentially yes / INCONCLUSIVE for full coverage.** | Order notifications use raw `status`, `totalAmount.toString()`, raw schedule strings; custom cake uses raw proposal fields in notifications/services; PDF/email utilities have different formatting (`pdfReportService.ts` has `formatDate`, INR formatting). No unified D20-06 WhatsApp formatter found in `backend/src/services`. |

### 6.3 Risk
**High.** UTC-derived schedule strings can misrepresent IST customer schedules in notifications/UI-facing stored values, causing customer confusion, missed pickups/deliveries, and trust/compliance issues. Fixing requires careful authorization because it touches schedule semantics.

### 6.4 Missing prerequisite (separate implementation authorization required)
- Explicit BLB-21-scoped authorization for D20-06-F remediation design.
- Decision on storage semantics: keep storage unchanged and convert display only, or migrate stored schedule fields with backward compatibility; do not assume.
- Shared D20-06 formatter for customer-facing WhatsApp content (DD MMM YYYY, 12-hour AM/PM, IST once, preserve ranges).
- Regression tests for checkout IST, reschedule propose/accept/reject/request flows, timezone boundaries, and existing orders.
- Owner review where behavior changes customer-visible schedule text.

---

## 7. Owner-Decision Compliance Cross-Check

| Decision | Approved state (register) | Audit compliance | Evidence/Note |
|---|---|---|---|
| D20-02 | Approved (₹, Indian grouping, 2 decimals, order amount semantics) | **Respected — no implementation change made.** | Observed current code still uses `order.totalAmount.toString()` in WhatsApp params (`customerOrderNotifications.ts` L124,135) — existing fact, not modified. |
| D20-03 | Approved (COD→Cash on delivery, ONLINE→Online payment, PAY_AT_STORE→Pay at store) | **Respected — no change made.** | Code currently passes raw `status` in some places and payment method not directly in WhatsApp params except templates; no changes. |
| D20-04 | Approved (remove `{{status}}`, approved confirmation wording/emojis; retain `{{customerName}}/{{orderNumber}}`) | **Respected — no change made.** | `order_confirmed` still passes raw status in current code (`customerOrderNotifications.ts` L144) — known gap; not modified. |
| D20-05 | Partially approved; B/E/F undecided | **Respected.** No quote wording/URL/semantics decision invented. | D20-05-B/E/F treated as NOT DECIDED. |
| D20-06 | Approved display convention; D20-06-F implementation prerequisite | **Respected.** Audit identified UTC write risk; no fix applied. | `orderController.ts` L1556-1561. |
| D20-07 | Approved requested-alternative wording as content decision; implementation NOT GRANTED | **Respected.** No implementation/mapping change made. | RESCHEDULE_REQUESTED mapping still uses existing schedule fields (L181-185) — known gap; not modified. |
| D20-08-A/B/C | Approved | **Respected/captured.** D20-08-C confirmed approved Option B 2026-11-22; no implementation inferred. | Decision register and BLB-20X. |
| D20-08-D/E/F | Not decided | **Respected.** No wording/expiry/prerequisite acknowledgement invented. | Register shows NOT DECIDED. |
| BLB-21 | NOT AUTHORIZED | **Respected.** No source/test/config/env/dependency/DB/provider changes. | Entire task read-only. |

**No decisions reopened or duplicated.** Owner approval was not treated as implementation authorization.

---

## 8. Risk Register

| ID | Severity | Risk | Evidence | Impact | Status |
|---|---|---|---|---|---|
| R-01 | **Critical** | Outbox jobs never processed at runtime | G-01: no worker start/loop in `server.ts`; claim/process/recover unused at runtime | Silent notification non-delivery | Open |
| R-02 | **Critical** | RESCHEDULE_PROPOSED has no WhatsApp template/mapping/outbox path | G-02: proposeSlot emits STATUS_CHANGED+RESCHEDULE_PROPOSED; template resolver returns null; no registry/outbox mapping | Admin reschedule proposal cannot notify customer by WhatsApp | Open |
| R-03 | **High** | Registry/doc drift: 8 templates internally APPROVED/enabled:true vs BLB-18/19 all NOT_SUBMITTED/enabled:false | G-04 table; `whatsappTemplateRegistry.ts` L65-137 | Governance confusion; accidental send risk if worker/config enabled | Open |
| R-04 | **High** | Meta approval unverified for all 18 templates | No `metaTemplateId` field; no repo Meta approval evidence | External compliance/delivery failure; false readiness assumption | Open |
| R-05 | **High** | `whatsappService.sendWhatsAppTemplate` lacks registry/approval/Meta evidence defense-in-depth | `whatsappService.ts` L120-188 | Future caller could bypass registry checks | Open |
| R-06 | **High** | D20-06-F UTC schedule write in reschedule acceptance | `orderController.ts` L1556-1561 | Incorrect customer-facing schedule; IST/UTC mismatch | Open |
| R-07 | **Medium** | D20-08-C approved instruction not represented in any WhatsApp implementation (because no implementation exists) | G-02 | Future implementation may drift without explicit D20-08-E/D/F capture | Open/blocked |
| R-08 | **Medium** | Raw schedule/status/amount formatting in WhatsApp params may conflict with approved D20-02/03/04/06 | `customerOrderNotifications.ts` L124,135,144,184,189,194 | Content/policy mismatch when templates activated | Open |
| R-09 | **Medium** | Outbox admin retry can requeue jobs but no worker processes them | `notificationOutboxService.ts` has retry/reset model patterns; no worker | Operational confusion | Open |
| R-10 | **Low** | Documentation sprawl / stale historical claims | BLB-18/19 vs current registry | Audit/operator confusion | Open (control-doc discipline needed) |

---

## 9. Exact Source Files and Line References

| Area | File | Key lines/evidence |
|---|---|---|
| Server startup/workers | `backend/src/server.ts` | L26-27 imports expiry workers; L88-91 WhatsApp webhook raw; L123-125 routes; L238,249 start inventory/proposal expiry workers; L278-279 stop only those two; no outbox worker |
| Outbox service | `backend/src/services/notificationOutboxService.ts` | L77 enqueue; L147 claimJob; L197 markSent; L224 markSkipped; L250 markFailed; L303 releaseSuppressedJob; L330 recoverExpiredLeases; L356-409 event/template validation mapping; L417 processJob; L587 stats; no start/loop |
| WhatsApp send | `backend/src/services/whatsappService.ts` | L39-41 configured check; L120-188 sendWhatsAppTemplate (UAT/config/phone/HTTP only; no registry enforcement) |
| Template registry | `backend/src/services/whatsappTemplateRegistry.ts` | L21-31 schema (no metaTemplateId); L63-255 18 entries; L278-381 fail-closed validation |
| Customer notifications | `backend/src/services/customerOrderNotifications.ts` | L15-49 notifyCustomerOrder; L56-93 enqueueCustomerOrderWhatsApp; L109-199 whatsappTemplateFor; L181-195 reschedule requested/accepted/rejected use raw scheduledDate/scheduledTime |
| Custom cake notifications | `backend/src/services/customCakeNotifications.ts` | L9 getTemplateDefinition; L125-130 pre-enqueue enabled+APPROVED check |
| Admin reschedule route | `backend/src/routes/adminOrderRoutes.ts` | L10-13 POST `/:id/propose-slot` -> authenticateAdmin, proposeSlot |
| Reschedule propose/accept | `backend/src/controllers/orderController.ts` | L1371-1395 proposal creation/status RESCHEDULE_PROPOSED; L1418-1424 notify STATUS_CHANGED/RESCHEDULE_PROPOSED detail; L1445 acceptProposal; L1517/1692 status checks include RESCHEDULE_PROPOSED; L1556-1561 UTC scheduledDate/scheduledTime write |
| Order model | `backend/src/models/Order.ts` | L102-105 scheduledDate/scheduledTime/requestedSlot/confirmedSlot; L283-359 schema fields |
| Package scripts | `backend/package.json` | L7-14 scripts: dev/start/seed/seed-admin/typecheck/test only; no worker script |
| BLB-18 doc claim | `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md` | L304 all 18 NOT_SUBMITTED/enabled:false; L329 tracking table includes Meta ID/status columns |
| BLB-19 doc claim | `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md` | L17 all 18 NOT_SUBMITTED/enabled:false/fail-closed; no Meta-approved |
| Decision register | `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md` | D20-08-C approved Option B 2026-11-22; D20-08-D/E/F NOT DECIDED; BLB-21 NOT AUTHORIZED |

---

## 10. Missing Evidence and Unresolved Questions

| ID | Missing evidence / unresolved question | Why it matters |
|---|---|---|
| ME-01 | Any documented authorization/change record for switching 8 templates to APPROVED/enabled:true in code | Determines whether G-04 is authorized evolution or undocumented drift |
| ME-02 | Meta Business Manager submission/approval evidence for any template (IDs, status, approved body/variables) | Required before any activation; all currently NOT VERIFIED |
| ME-03 | W01 written legal/compliance validation | Required for production-facing WhatsApp content/consent |
| ME-04 | Production domain confirmation (D20-01) | Affects tracking URLs/template content |
| ME-05 | D20-08-D/E/F owner decisions | Required before D20-08 implementation/content |
| ME-06 | D20-05-B/E/F, D20-09 owner decisions | Required before custom-cake quote/tracking implementation |
| ME-07 | Checkout/order schedule persistence semantics confirmation across all flows (IST intent vs stored strings) | Needed for safe D20-06-F remediation |
| ME-08 | BLB-11A OD-01–OD-05, D-14, D-16-D-18 evidence | External gate completeness |
| ME-09 | Authorized UAT environment/plan evidence | Required before any runtime WhatsApp/UAT validation |
| ME-10 | Whether any non-repo deployment/runtime has an outbox worker process | This audit inspected repo only; runtime deployment state is INCONCLUSIVE |

---

## 11. Recommended Remediation Sequence (No Implementation)

> **No implementation authorized.** Sequence below is planning guidance only; each milestone requires explicit authorization.

1. **Owner decisions & control reconciliation (docs-only first):** Capture D20-08-D/E/F, D20-05-B/E/F, D20-01, D20-09. Reconcile G-04 governance drift in control docs with explicit owner-authorized posture.
2. **Registry safety decision (BLB-21 planning, then separate auth):** Decide fail-closed interim for 8 internally enabled templates until Meta approval evidence exists; design `metaTemplateId`/evidence fields. Do not enable/send.
3. **Defense-in-depth (BLB-21 authorized):** Add registry/approval/Meta-ID/evidence/required-var enforcement in shared send gate/`whatsappService`; keep outbox validation.
4. **Outbox worker design (BLB-21 authorized):** Startup/shutdown lifecycle, UAT-safe guard, idempotency, lease recovery, retries/DLQ, consent checks, template eligibility, audit logging, no accidental prod startup.
5. **D20-06-F remediation (separately authorized):** Fix UTC schedule write/formatting with migration-safe design and tests; align D20-06 display formatter.
6. **D20-08 implementation (only after D/E/F + BLB-21 + prerequisites):** Add RESCHEDULE_PROPOSED template/registry/outbox mapping/`{{proposedSchedule}}` formatting; include D20-08-C instruction; no unverified channel/button/link.
7. **UAT-safe validation (separate UAT auth):** Isolated `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`, no real customer/provider sends.
8. **External approvals:** W01 legal/compliance, Meta app/credentials, template submission/approval evidence per template.
9. **Production readiness:** security review, monitoring, rollback, explicit production authorization, D-19 clearance.

---

## 12. Explicit Authorization Boundary

- This task was **READ-ONLY audit/documentation only**. It **does not authorize** implementation, remediation, template activation/disablement, registry edits, worker creation/startup, Meta submission/approval actions, provider integration, database changes, UAT execution, deployment, or production release.
- **D20-08-C remains APPROVED and captured** (Option B, 2026-11-22).
- **D20-08-D/E/F remain NOT DECIDED.**
- **D20-05-B/E/F remain NOT DECIDED.**
- **BLB-21 remains NOT AUTHORIZED.**
- **No source implementation, template activation, Meta submission, or message sending was authorized by this task.**

*End of BLB-22 — Critical WhatsApp Infrastructure Readiness Reconciliation (READ-ONLY).*