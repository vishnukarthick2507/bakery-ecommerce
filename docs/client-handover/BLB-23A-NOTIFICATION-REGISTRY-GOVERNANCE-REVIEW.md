# BLB-23A — Notification Registry Governance Review

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Type:** READ-ONLY source inspection + documentation-only governance review  
**Status:** **REVIEW ONLY — NOT IMPLEMENTED / NOT AUTHORIZED**  
**BLB-21:** **NOT AUTHORIZED**

---

## 1. Executive Summary

This review reconciles all 18 WhatsApp template registry entries, inspects notification send paths, and provides a fail-closed interim safety recommendation. No code/config/registry/template/provider changes were made.

**Key findings:**
- **18 templates confirmed** in `backend/src/services/whatsappTemplateRegistry.ts` (L63-255). **8 are `APPROVED`/`enabled:true`** (L65-137); **10 are `NOT_SUBMITTED`/`enabled:false`** (L138-254). This confirms BLB-22/G-04 drift against BLB-18/19 (which reported all 18 NOT_SUBMITTED/enabled:false).
- **Meta approval: NOT VERIFIED for all 18.** Registry schema has **no `metaTemplateId` field** (L21-31). Internal `APPROVED` must not be treated as Meta approval.
- **Send-path gap:** `whatsappService.sendWhatsAppTemplate()` (L120-188) performs UAT/config/phone/HTTP checks but **no registry/approval/Meta-ID/required-variable/consent enforcement**. Current src caller is `notificationOutboxService.processJob` only (grep evidence), which does validate registry and consent — but the service itself is not a centralized fail-closed gate.
- **Outbox worker not started** (`server.ts` L238,249,278-279; no outbox worker). This reduces immediate runtime risk but is not a safety control.
- **Fail-closed interim recommendation:** keep all templates blocked from actual external sending until verified Meta approval evidence, centralized send eligibility, consent/opt-out enforcement on all paths, UAT/prod guards, and explicit BLB-21 authorization exist. Do not activate templates solely because internal status is APPROVED.

---

## 2. Current Registry Inventory (All 18 Templates)

| # | Template key | Internal status | Enabled | Meta approval | Meta template ID | Event mapping | Required variables | Payload source | Outbox eligibility | Direct send eligibility | Consent enforcement | Documentation status | Discrepancy | Risk |
|---:|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `order_received` | `APPROVED` (registry L70) | `true` (L71) | **NOT VERIFIED** | Schema field absent (L21-31); no value | `ORDER_PLACED` -> `order_received` (`customerOrderNotifications.ts` L118-128; outbox direct map L365) | `customerName, orderNumber, totalAmount, status, trackingUrl` | `customerOrderNotifications.ts` L119-127 | Registry validation passes if enabled/APPROVED/vars valid; consent/config/UAT checked in outbox; **no worker started** | **No registry gate in whatsappService**; direct call path currently unused by src except outbox | Outbox checks transactional consent (L455-459,468-473); notifier checks consent (L66-74) | BLB-18/19: NOT_SUBMITTED/enabled:false | **Code/doc drift; Meta unverified** | **High** |
| 2 | `payment_received` | `APPROVED` (L80) | `true` (L81) | **NOT VERIFIED** | Absent | `PAYMENT_CONFIRMED` (L129-138; L366) | `customerName, orderNumber, totalAmount, trackingUrl` | L130-137 | Same as #1 | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 3 | `order_confirmed` | `APPROVED` (L90) | `true` (L91) | **NOT VERIFIED** | Absent | `STATUS_CHANGED_CONFIRMED` / CONFIRMED (L141-145; L357) | `customerName, orderNumber, status, trackingUrl` | L142-144 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 4 | `order_preparing` | `APPROVED` (L99) | `true` (L100) | **NOT VERIFIED** | Absent | `STATUS_CHANGED_PREPARING` / PREPARING (L146-150; L358) | `customerName, orderNumber, trackingUrl` | L147-149 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 5 | `order_ready` | `APPROVED` (L108) | `true` (L109) | **NOT VERIFIED** | Absent | `STATUS_CHANGED_READY` / READY,READY_FOR_PICKUP (L151-156; L359) | `customerName, orderNumber, trackingUrl` | L152-155 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 6 | `order_out_for_delivery` | `APPROVED` (L117) | `true` (L118) | **NOT VERIFIED** | Absent | `STATUS_CHANGED_OUT_FOR_DELIVERY` (L157-161; L360) | `customerName, orderNumber, trackingUrl` | L158-160 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 7 | `order_completed` | `APPROVED` (L126) | `true` (L127) | **NOT VERIFIED** | Absent | `STATUS_CHANGED_COMPLETED` / DELIVERED,COLLECTED (L162-167; L361) | `customerName, orderNumber, trackingUrl` | L163-166 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 8 | `order_cancelled` | `APPROVED` (L135) | `true` (L136) | **NOT VERIFIED** | Absent | `CANCELLED` (L171-175; L367) | `customerName, orderNumber, trackingUrl` | L172-174 | Same | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | Drift; Meta unverified | High |
| 9 | `payment_failed` | `NOT_SUBMITTED` (L144) | `false` (L145) | **NOT VERIFIED** | Absent | `PAYMENT_FAILED` (L176-180; L368) | `customerName, orderNumber, trackingUrl` | L177-179 | **Blocked fail-closed** by registry validation (disabled/not approved) | Same whatsappService gap (if called directly) | Outbox consent checks apply | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 10 | `custom_cake_request_received` | `NOT_SUBMITTED` (L155) | `false` (L156) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_REQUEST_RECEIVED` (customCakeNotifications L22-42; outbox L372) | `customerName, referenceNumber, trackingUrl` | customCakeNotifications L31-41 | Blocked fail-closed; custom-cake notifier also pre-checks definition enabled+APPROVED (L125-130) | Same gap | Notifier/outbox checks present | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 11 | `custom_cake_quote_prepared` | `NOT_SUBMITTED` (L173) | `false` (L174) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_QUOTE_PREPARED` (L43-71; L373) | `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl` | L52-70 | Blocked fail-closed; pre-check in notifier | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 12 | `custom_cake_quote_accepted` | `NOT_SUBMITTED` (L184) | `false` (L185) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_QUOTE_ACCEPTED` (L72-82; L374) | `customerName, referenceNumber, trackingUrl` | L78-82 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 13 | `custom_cake_quote_declined` | `NOT_SUBMITTED` (L195) | `false` (L196) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_QUOTE_DECLINED` (L83-93; L375) | `customerName, referenceNumber, trackingUrl` | L89-93 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 14 | `custom_cake_request_closed` | `NOT_SUBMITTED` (L206) | `false` (L207) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_REQUEST_CLOSED` (L94-104; L376) | `customerName, referenceNumber, trackingUrl` | L100-104 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 15 | `custom_cake_converted_to_order` | `NOT_SUBMITTED` (L217) | `false` (L218) | **NOT VERIFIED** | Absent | `CUSTOM_CAKE_CONVERTED_TO_ORDER` (L105-116; L377) | `customerName, referenceNumber, trackingUrl` | L111-116 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |
| 16 | `order_reschedule_requested` | `NOT_SUBMITTED` (L228) | `false` (L229) | **NOT VERIFIED** | Absent | `RESCHEDULE_REQUESTED` (customerOrderNotifications L181-185; outbox L369) | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | L182-184 | Blocked fail-closed | Same gap | Outbox/notifier consent checks | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved; D20-07 semantic/payload gap noted in prior docs | Medium |
| 17 | `order_reschedule_accepted` | `NOT_SUBMITTED` (L239) | `false` (L240) | **NOT VERIFIED** | Absent | `RESCHEDULE_ACCEPTED` (L186-190; L370) | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | L187-189 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved; D20-06-F UTC write risk | Medium |
| 18 | `order_reschedule_rejected` | `NOT_SUBMITTED` (L250) | `false` (L251) | **NOT VERIFIED** | Absent | `RESCHEDULE_REJECTED` (L191-195; L371) | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | L192-194 | Blocked fail-closed | Same gap | Same | BLB-18/19 NOT_SUBMITTED/enabled:false | No drift; not Meta-approved | Medium |

---

## 3. BLB-18/19 Documentation Discrepancy Analysis

| Source | Claim | Current source fact | Assessment |
|---|---|---|---|
| BLB-18 `BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md` L304 | "All 18 registry entries `NOT_SUBMITTED`, `enabled:false`; `validateTemplateForSend` fail-closed..." | Registry currently has 8 APPROVED/enabled:true, 10 NOT_SUBMITTED/enabled:false | **Historical claim no longer matches current source** |
| BLB-19 `BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md` L17 | "18 registered templates verified; all remain `NOT_SUBMITTED` / `enabled:false` / fail-closed. No template is Meta-approved." | Same mismatch; Meta approval still unverified | **Historical claim partially stale (counts/status drift), Meta-unapproved statement remains unverified/consistent with no evidence** |
| BLB-22 | Reported same drift and recommended reconciliation | Still confirmed by this audit | **Consistent** |

**Conclusion:** Documentation drift is real and unresolved. No in-repo authorization evidence was found for changing 8 entries to APPROVED/enabled:true (INCONCLUSIVE). Historical docs should not be silently rewritten; a reconciliation note and authorized control update are needed.

---

## 4. Meta Approval Evidence Status

- **Verified Meta approval evidence in repo:** **NONE FOUND** during read-only inspection.
- **Registry schema support for Meta template ID:** **ABSENT** (`WhatsAppTemplateDefinition` has no `metaTemplateId`, L21-31).
- **Operational consequence:** Internal `APPROVED` cannot be treated as Meta-approved. Enabling/send eligibility must require verified external approval evidence and correct Meta template identifier before any external send.

---

## 5. Notification Send-Path Analysis

| Path | Entry points | Registry validation | Consent/opt-out | UAT/env guard | Direct Meta send? | Audit/suppression | Finding |
|---|---|---|---|---|---|---|---|
| Outbox/worker processing | `notificationOutboxService.processJob` (L417-582) | **Yes** - resolves internal event and calls `validateTemplateForSend` (L474-501) | **Yes** - transactional consent checked before and immediately before send (L455-459,468-473) | **Yes** - `isUatExternalSideEffectsBlocked` suppresses/release (L425-439) | Calls `sendWhatsAppTemplate` | markSent/Failed/Skipped/releaseSuppressed; logs | Strongest path, but **no worker started** |
| whatsappService direct | `sendWhatsAppTemplate` (L120-188) | **No** | **No** (no consent check) | **Yes** UAT blocked; config/phone checks | **Yes** Meta HTTPS | Returns accepted false; logs suppression; no outbox audit record | **Gap: no centralized fail-closed eligibility** |
| Customer order notifier | `customerOrderNotifications.ts` L15-93,109-199 | Selects template; relies on outbox validation later | Checks consent and preference before enqueue (L66-77) | Outbox/process path enforces UAT at process time | No direct send; enqueues | enqueue only | Reasonable, but depends on outbox/worker |
| Custom cake notifier | `customCakeNotifications.ts` L22-145 | Pre-checks `getTemplateDefinition` enabled+APPROVED (L125-130) before enqueue; outbox validates later | Relies on outbox consent check; notifier does not itself check WhatsApp consent (read-only observation) | Outbox process enforces UAT | No direct send; enqueues | enqueue only | Partial pre-check; consent centralization should be verified |
| Admin-triggered | Admin routes/controllers trigger order/custom-cake flows that enqueue via notifiers | Indirect | Indirect | Indirect | No | Via outbox/admin actions | No direct bypass found; depends on notifier/outbox |
| Webhook-triggered outbound | `whatsappWebhookController.ts` handles inbound status/STOP/HELP/TRACK; no outbound template send observed | N/A | STOP updates consent | N/A | No outbound template path observed | Webhook event records | No outbound send path observed |
| Retry/resend | `adminWhatsAppController` retry/requeue endpoints (pre-existing) reset/requeue outbox jobs | Outbox validation on process | Outbox checks on process | Outbox UAT check on process | No direct send | Admin action + outbox | No worker means retries not processed; when processed, must pass checks |

**Can a message bypass registry?** **Yes, via direct `sendWhatsAppTemplate` if called by future code**; current src usage appears limited to outbox processJob.  
**Can disabled template be sent?** Blocked in outbox validation; **not blocked by whatsappService itself**.  
**Can internally APPROVED be sent without Meta approval evidence?** Registry has no Meta evidence field; outbox allows enabled+APPROVED+valid vars; whatsappService has no such check. **Yes, governance gap.**  
**Consent checked centrally?** **No.** Checked in outbox and partially in notifiers; not in whatsappService.  
**Opt-out checked every path?** Outbox checks transactional consent; STOP handled in webhook/consent service. Direct service path would not check.  
**Single central send-eligibility gate?** **No.**  
**Failed/suppressed attempts auditable?** Outbox has status/error/lease fields; whatsappService direct path returns boolean/accepted result only, limited auditability.

---

## 6. Consent and Opt-out Enforcement Analysis

- `notificationOutboxService.ts` requires valid transactional consent before WhatsApp send and rechecks immediately before send (L455-459,468-473). Missing/denied/withdrawn => SKIPPED.
- `customerOrderNotifications.ts` checks `WhatsAppConsent` GRANTED and notification preference before enqueue (L66-77).
- `customCakeNotifications.ts` enqueues WhatsApp jobs but read-only inspection did not show an explicit consent check before enqueue; it relies on outbox consent enforcement (INCONCLUSIVE for complete custom-cake consent UX/flow in this pass).
- `whatsappService.ts` does **not** check consent or opt-out.
- STOP/opt-out handling exists in consent/webhook services (not fully re-inspected here; prior audits indicate present). Any production claim requires fresh end-to-end evidence.

---

## 7. Direct-Send vs Outbox Differences

| Aspect | Outbox path | Direct whatsappService path |
|---|---|---|
| Registry validation | Yes (`validateTemplateForSend`) | No |
| Consent enforcement | Yes | No |
| Idempotency/job state | Yes (NotificationOutbox) | No |
| Retry/backoff/DLQ | Yes (service primitives) | No |
| UAT suppression | Yes (release suppressed job) | Yes (returns false) |
| Provider ID capture | Yes, best effort | Yes, returns providerMessageId when parsed |
| Audit trail | Stronger | Weak |
| Current runtime use | Intended path; worker missing | Only called by outbox processJob in src |

---

## 8. Fail-Closed Interim Recommendation (Recommendation Only — NOT IMPLEMENTED)

1. **Keep all external WhatsApp sending blocked** until explicit BLB-21 implementation authorization, verified Meta approval evidence, legal/compliance evidence, and production/UAT authorization gates are satisfied.
2. **Treat all 8 internally APPROVED/enabled:true templates as NOT externally send-eligible** until per-template Meta approval evidence is verified. Consider interim fail-closed registry posture (set NOT_SUBMITTED/enabled:false or add hard external-approval gate) under authorized change control.
3. **Add a single centralized send-eligibility gate** used by outbox, direct service, retries, admin tools, and any future path. Gate must fail closed on: unknown template, disabled, not internally approved, no verified Meta approval evidence/ID, missing/invalid vars, missing consent, opt-out, invalid recipient, UAT/prod policy violation.
4. **Add `metaTemplateId` and external-approval evidence fields** to registry/schema/design under authorized implementation; never expose secret values.
5. **Do not start outbox worker** until centralized gate, audit logging, idempotency, DLQ, lease recovery, UAT/prod safety, and monitoring are in place.
6. **Do not submit/activate templates** without explicit owner authorization and evidence capture.

---

## 9. Proposed Centralized Eligibility Policy (Design Only)

A template send may proceed only when all are true:
- `UAT_SAFE_MODE`/environment policy allows external send for that environment.
- Template exists in registry for the exact internal event/template mapping.
- `enabled === true` and internal approval state is approved by policy.
- Verified external Meta approval evidence exists and required Meta template identifier is present.
- Required variables are present, non-empty, correctly ordered/formatted.
- Recipient is valid/normalized.
- Transactional consent is GRANTED and not withdrawn/opted-out.
- Event is eligible (not marketing, not unknown, not suppressed).
- Idempotency key/outbox state allows send.
- Audit record is written for attempt/suppression/failure/success.

Any unknown/ambiguous state => **suppress/fail closed** with auditable reason.

---

## 10. Implementation Prerequisites

- Explicit BLB-21 scope authorization.
- Owner decisions D20-08-D/E/F and other blocking D20 decisions as relevant.
- W01/legal/compliance evidence.
- Meta app/WABA/credentials/webhook configuration and template approval evidence.
- Isolated UAT authorization and environment.
- Test plan covering bypass attempts, consent/opt-out, registry disablement, missing Meta evidence, duplicate delivery, lease recovery.
- Rollback/fail-closed kill switch.

---

## 11. Owner Decisions Required

- **D20-08-D/E/F** — D20-08 content/expiry/prereqs (D20-08-C already approved).
- **D20-05-B/E/F** — custom-cake quote remaining.
- **D20-01** — production domain/canonical URL (external confirmation).
- **D20-09** — custom-cake tracking destination.
- **Registry posture decision** — whether to keep 8 internally APPROVED/enabled templates as-is in code pending evidence or move to fail-closed interim (requires BLB-21 implementation auth to change code).
- **BLB-21 scope authorization** — required before any implementation.

---

## 12. Explicit NOT IMPLEMENTED / NOT AUTHORIZED Statement

This document is **read-only review and recommendation only**. It **does not implement** any fix, does **not** change registry/template states, does **not** activate/submit templates, does **not** start workers, does **not** authorize BLB-21 implementation, UAT/DB writes, Meta/provider actions, deployment, or real message sending. 

**BLB-21 remains NOT AUTHORIZED.**

*End of BLB-23A Notification Registry Governance Review — documentation-only, NOT IMPLEMENTED / NOT AUTHORIZED.*