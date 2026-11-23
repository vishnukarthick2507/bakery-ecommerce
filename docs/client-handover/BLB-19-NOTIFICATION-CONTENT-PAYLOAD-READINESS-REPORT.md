# BLB-19 — Notification Content & Payload Readiness Review

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Prepared:** 21 Nov 2026 (read-only inspection + documentation only)  
**Status:** **NOT READY / NO-GO — OWNER REVIEW & EXTERNAL APPROVALS REQUIRED**

---

## 1. Executive Summary

BLB-19 reviewed the 18 WhatsApp notification templates prepared in BLB-18 against actual source payloads, registry definitions, outbox validation, and relevant order/payment/custom-cake flows. No application source, tests, config, env, dependencies, DB, provider APIs, Meta submission, template enablement, or message sending were performed.

**Key outcomes:**
- **18 registered templates verified**; all remain `NOT_SUBMITTED` / `enabled:false` / fail-closed. No template is Meta-approved.
- **Custom-cake quote payload:** `proposeProposal` schema/controller requires `proposedPrice` (>0 number), `proposedDeliveryDate` (YYYY-MM-DD), `proposedDeliveryTime` (required string) and blocks past dates; quote notification is emitted only after successful CONTACTED update. However, notifier converts missing values to empty strings and relies on registry/outbox fail-closed validation. Content/operational readiness requires guaranteed complete, customer-friendly formatting.
- **Payment formatting:** `payment_received.amount` is `order.totalAmount.toFixed(2)` (no currency symbol); `paymentMethod` is internal enum (`COD | ONLINE | PAY_AT_STORE`). Draft/example may mislead without explicit currency and customer-friendly method label. Amount represents order total amount recorded on the order; this should be described carefully as “payment received for order total” unless owner/legal confirms gateway-captured amount semantics.
- **Order status wording:** `order_confirmed` passes raw `order.orderStatus` (internal enum, e.g. `CONFIRMED`) into template param `status`. Customer-facing copy should map to friendly labels.
- **Tracking URLs:** Order templates use `${NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app}/track?order=<orderNumber>`; custom-cake templates use `${...}/account/custom-cake-requests` (list page, not specific request). Frontend routes exist, but production domain confirmation is required and custom-cake URL specificity is a UX/content decision.
- **Reschedule semantics:** ACCEPTED updates confirmed schedule and notifies with updated `order.scheduledDate/scheduledTime` (correct). REJECTED restores previous status and keeps existing confirmed schedule; notification uses current `order.scheduledDate/scheduledTime` (retained schedule) — semantically consistent with draft. REQUESTED is currently emitted by customer alternative-slot request flow and uses `order.scheduledDate/scheduledTime` (current order schedule), while the event/detail concerns the alternative requested time — **semantic/payload mismatch risk**. `RESCHEDULE_PROPOSED` has no WhatsApp mapping; proposed draft included for owner review only.
- **Blockers unchanged:** W01 legal/compliance written validation NOT RECEIVED; Meta submission/approval not done; D-14/Group 5/D-16-D-18 unresolved; D-19 NO-GO.

---

## 2. Review of All 18 Templates

| # | Template | Registry/event | Actual payload source | Content review | Readiness classification |
|---:|---|---|---|---|---|
| 1 | `order_received` | `ORDER_PLACED` / `order_received` | `customerOrderNotifications`: customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl | Transactional, clear. Date/time format raw; domain confirmation needed. | **CONTENT REVISION REQUIRED** (format/domain confirmation) + **EXTERNAL APPROVAL REQUIRED** |
| 2 | `payment_received` | `PAYMENT_CONFIRMED` / `payment_received` | `order.totalAmount.toFixed(2)`, `order.paymentMethod`, trackingUrl | Risk: no currency symbol; paymentMethod internal enum; amount semantics need careful wording. | **CONTENT REVISION REQUIRED** + **EXTERNAL APPROVAL REQUIRED** |
| 3 | `order_confirmed` | `STATUS_CHANGED_CONFIRMED` / `order_confirmed` | params `[customerName, orderNumber, status, trackingUrl]`, `status` defaults to `order.orderStatus` | Raw internal status enum exposed. | **CONTENT REVISION REQUIRED** + **EXTERNAL APPROVAL REQUIRED** |
| 4 | `order_preparing` | `STATUS_CHANGED_PREPARING` | name, orderNumber, trackingUrl | Clear transactional update. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 5 | `order_ready` | `STATUS_CHANGED_READY` | name, orderNumber, trackingUrl | Covers READY/READY_FOR_PICKUP; wording acceptable if owner confirms. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 6 | `order_out_for_delivery` | `STATUS_CHANGED_OUT_FOR_DELIVERY` | name, orderNumber, trackingUrl | Clear. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 7 | `order_completed` | `STATUS_CHANGED_COMPLETED` | name, orderNumber, trackingUrl | Polite closing; confirm non-promotional acceptability with Meta/legal. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 8 | `order_cancelled` | `CANCELLED` | name, orderNumber, trackingUrl | Clear; avoid implying refund timing/amount. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 9 | `payment_failed` | `PAYMENT_FAILED` | name, orderNumber, trackingUrl | Draft appropriately cautious. Trigger is committed current-attempt PENDING->FAILED only (BLB-17). | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 10 | `order_reschedule_requested` | `RESCHEDULE_REQUESTED` | name, orderNumber, **order.scheduledDate, order.scheduledTime**, trackingUrl | **Semantic mismatch risk:** emitted by customer alternative-slot request flow; template uses current order schedule fields, not requested alternative slot. | **CONTENT REVISION REQUIRED** + **SOURCE EVIDENCE INSUFFICIENT** (owner intent for event meaning/payload) |
| 11 | `order_reschedule_accepted` | `RESCHEDULE_ACCEPTED` | name, orderNumber, updated order.scheduledDate/time, trackingUrl | Matches updated schedule after acceptance. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 12 | `order_reschedule_rejected` | `RESCHEDULE_REJECTED` | name, orderNumber, current retained order.scheduledDate/time, trackingUrl | Matches retained schedule; copy should state “current schedule remains”. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 13 | `custom_cake_request_received` | `CUSTOM_CAKE_REQUEST_RECEIVED` | name, referenceNumber, trackingUrl (account list) | Clear. Tracking URL is list page, not specific request. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain/URL specificity decision) |
| 14 | `custom_cake_quote_prepared` | `CUSTOM_CAKE_QUOTE_PREPARED` | name, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl | Payload required by schema; notifier empty-string fallback + fail-closed validation. Formatting/currency/date/time need owner decision. | **CONTENT REVISION REQUIRED** + **EXTERNAL APPROVAL REQUIRED** |
| 15 | `custom_cake_quote_accepted` | `CUSTOM_CAKE_QUOTE_ACCEPTED` | name, referenceNumber, trackingUrl | Clear transactional. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 16 | `custom_cake_quote_declined` | `CUSTOM_CAKE_QUOTE_DECLINED` | name, referenceNumber, trackingUrl | Clear transactional. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 17 | `custom_cake_request_closed` | `CUSTOM_CAKE_REQUEST_CLOSED` | name, referenceNumber, trackingUrl | Clear; reason not included (acceptable minimal). | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |
| 18 | `custom_cake_converted_to_order` | `CUSTOM_CAKE_CONVERTED_TO_ORDER` | name, referenceNumber, trackingUrl | Clear; idempotent conversion guard exists. | **READY FOR OWNER REVIEW** (pending legal/Meta/domain) |

---

## 3. Quote Payload Findings (`custom_cake_quote_prepared`)

### Source evidence
- **Model (`backend/src/models/CustomCakeRequest.ts`):** `proposedPrice` Number/min 0/default null; `proposedDeliveryDate` String/default null; `proposedDeliveryTime` String/default null; `adminNotes` optional; `status` PENDING/CONTACTED/CONFIRMED/CLOSED; `customerConfirmed` PENDING/CONFIRMED/DECLINED.
- **Controller (`proposeProposal`, `customCakeController.ts`):** Zod schema requires `proposedPrice` positive number, `proposedDeliveryDate` `YYYY-MM-DD`, `proposedDeliveryTime` required string (1-50), `adminNotes` optional max 1000. Validates date parse and rejects past dates. Only `PENDING` requests can be proposed; returns 409 otherwise. On success sets proposal fields, `status=CONTACTED`, `adminContactedAt`, resets customer confirmation, saves, then `void notifyCustomerCustomCake(updated, "CUSTOM_CAKE_QUOTE_PREPARED", "quote-prepared")`.
- **Notifier (`customCakeNotifications.ts`):** builds params `[customerName, ref, String(request.proposedPrice ?? ""), request.proposedDeliveryDate ?? "", request.proposedDeliveryTime ?? "", url]`. Before enqueue, checks registry definition exists, `enabled`, and `approvalState === "APPROVED"`; returns if not approved/enabled (fail-closed). Enqueues with idempotency `whatsapp:custom-cake:${request._id}:${eventId}`.
- **Outbox/registry validation:** `validateTemplateForSend` fails closed on missing template, disabled/unapproved, category mismatch, missing/empty required variables, or length mismatch. Outbox marks permanent failure on validation failure.

### Findings
| Question | Finding | Evidence |
|---|---|---|
| Where values originate | Admin proposal payload via `PATCH /api/custom-cake-requests/:id/propose` | `proposeProposalSchema`, controller destructure/set |
| Missing values possible? | **At model level yes** (defaults null). **At successful propose API path unlikely** because schema requires all three; controller validates date. **At notifier level** empty-string fallback exists for null/undefined. | Model defaults; schema/controller; notifier `?? ""` |
| Can quote event emit with incomplete values? | **Notification enqueue/send should be blocked** by registry approval/enabled gate and/or outbox/template validation for empty required params; but notifier currently constructs empty strings rather than explicitly aborting on missing semantic values. Event hook itself fires after successful proposal save. | `customCakeNotifications.ts` pre-enqueue approval gate; `validateTemplateForSend` empty required var check |
| Outbox required-param validation | Fail-closed: missing/empty required variables cause validation failure; WhatsApp job marked failed/permanent as configured by outbox behavior. | `whatsappTemplateRegistry.ts` required variable checks; `notificationOutboxService.ts` validation failure handling |
| Draft accuracy | Draft is directionally accurate but should state “proposed price/date/time” clearly and use owner-approved currency/date/time formatting. | BLB-18 draft 3.14 |

### Safest content recommendation (no source change)
- Keep template **transactional and factual**: “A quote has been prepared…” with proposed price/date/time and review link.
- Do **not** submit/enable until owner confirms: currency display (`INR`/`Rs.`), date format, time format/timezone, and whether price is inclusive/exclusive of taxes/delivery (avoid ambiguity).
- Operational safeguard before enablement: only allow quote-prepared WhatsApp send when all three proposal fields are present and formatted; current fail-closed behavior is good but empty-string fallback should be treated as a readiness warning, not a content solution.
- Do not claim quote acceptance as order confirmation/payment completion.

---

## 4. Payment Formatting Findings

### Source evidence
- **Order model:** `paymentMethod: "COD" | "ONLINE" | "PAY_AT_STORE"`, `paymentStatus: PENDING/PAID/FAILED`, `totalAmount: number`.
- **Payment controller:** On successful verification/capture path, sets `paymentStatus="PAID"`, `paidAt`, stores Razorpay IDs, may set `PAYMENT_CONFIRMED`, then notifies `PAYMENT_CONFIRMED` with `orderEmailDetails(order)`. `markOrderPaymentFailed` emits `PAYMENT_FAILED` only for committed current-attempt PENDING->FAILED transition.
- **Customer notification payload (`customerOrderNotifications.ts`):** `payment_received` params `[customerName, order.orderNumber, order.totalAmount.toFixed(2), order.paymentMethod, trackingUrl]`.

### Findings
| Variable | Actual value | Customer-facing risk | Recommendation |
|---|---|---|---|
| `amount` | `order.totalAmount.toFixed(2)` e.g. `1250.00` | No currency symbol/code; could be ambiguous internationally; example in BLB-18 used `INR 1,250.00` but actual payload is not that format | Before submission/enablement, decide formatted display. Prefer explicit currency in template/content convention, e.g. `INR {{3}}` or preformatted `₹1,250.00` by code change (requires separate authorization). Document as content/formatting decision. |
| `paymentMethod` | Raw enum `COD`, `ONLINE`, `PAY_AT_STORE` | `ONLINE`/`PAY_AT_STORE` are internal labels; `ONLINE` may be unclear (Razorpay/card/UPI/netbanking). | Map to customer-friendly labels: `ONLINE` -> “Online payment”, `PAY_AT_STORE` -> “Pay at store”, `COD` -> “Cash on delivery”, subject to owner approval. Requires source change if done in payload; otherwise draft must not expose raw enum. |
| Amount semantics | Uses `order.totalAmount` (order total) on PAYMENT_CONFIRMED notification | Could mislead if partial payments/adjustments ever exist; currently flow appears full order total. | Draft should say “payment received for order {{2}}…” and include amount as order payment amount context; avoid claiming settlement/gateway capture details. Owner/legal confirm wording. |

**Recommended customer-facing draft (owner review):**
> Hello {{1}}, we have received your payment for order {{2}} at S.V. Sweets & Bakers. Amount received: INR {{3}}. Payment method: {{4}}. View details: {{5}}

*Note:* This draft assumes INR and friendly payment method labels; actual payload currently sends `toFixed(2)` and raw enum. Do not submit without resolving formatting/mapping.

---

## 5. Order Status Wording Recommendations

### Source evidence
- **Order model status enum:** `PLACED, PAYMENT_CONFIRMED, CONFIRMED, PREPARING, READY, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED, COLLECTED, CANCELLED, RESCHEDULE_PROPOSED`.
- **customerOrderNotifications.ts:** `STATUS_CHANGED` + `CONFIRMED` maps to `order_confirmed` with params `[customerName, order.orderNumber, status, trackingUrl]`.
- **orderController.ts update status:** emits `STATUS_CHANGED` with `eventId=status:${order.updatedAt?.toISOString() ?? order.orderStatus}` and 4 args; `status` defaults to `order.orderStatus` in notifier.

### Findings
- Actual `status` param for `order_confirmed` will be raw internal enum, typically `CONFIRMED`.
- Exposing raw enums is not customer-friendly and may be confusing if future statuses are passed.

### Recommended wording
- **Preferred:** remove status variable from customer-facing text if not needed: “Hello {{1}}, your order {{2}} has been confirmed by S.V. Sweets & Bakers. View details: {{3}}”. This requires registry/payload alignment change (separate authorization) because registry currently requires `status`.
- **If variable retained:** map internal status to friendly label before sending, e.g. `CONFIRMED` -> “Confirmed”, `PAYMENT_CONFIRMED` -> “Payment confirmed”. Do not send raw enum strings.
- **Template draft recommendation (owner review):** keep transactional confirmation clear; avoid internal enum names in Meta-submitted sample/body.

---

## 6. Tracking URL Findings

### Source evidence
- **Order/customer notifications:** `trackingUrl = ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/track?order=${encodeURIComponent(order.orderNumber)}`. Used by all order templates.
- **Custom-cake notifications:** `trackingUrl = ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/account/custom-cake-requests` (no request-specific ID).
- **Frontend routes present:** `app/track/page.tsx`, `app/account/custom-cake-requests/page.tsx`, `app/account/custom-cake-requests/[orderId]/page.tsx` (detail route exists, but notification URL does not include it).
- **No external website access performed.**

### Findings
| Area | Finding | Risk | Recommendation |
|---|---|---|---|
| Production domain confirmation | Code falls back to `https://bakery-ecommerce-topaz.vercel.app` when `NEXT_PUBLIC_SITE_URL` unset | **High for submission readiness** - wrong domain in approved template can misroute customers | Confirm canonical production domain before Meta submission; ensure env is set in all environments; consider removing hardcoded fallback by separate authorized change. |
| Order tracking destination | `/track?order=<orderNumber>` route exists | Medium - customer can reach track page; query-param behavior not externally validated here | Owner/UAT confirm order lookup works for customer-facing access pattern. |
| Custom-cake tracking destination | Links to list page `/account/custom-cake-requests`, not detail `/account/custom-cake-requests/[orderId]` | **Medium** - customer can reach list but may need extra step to find specific request; less specific than possible | Owner decision: acceptable for v1 or revise URL to specific request detail (requires code/template variable review and separate authorization). |
| URL assumptions blocking submission | Domain not owner-confirmed; custom-cake specificity is product decision | Blocks “ready for submission” confidence | Resolve domain and URL specificity before final Meta submission. |

---

## 7. Reschedule Semantics

### Source evidence
- **Order model:** `RESCHEDULE_PROPOSED` status exists; reschedule proposals hold `proposedSlot`, previous confirmed slot/history, status, expiry, customer response.
- **Admin propose slot (`proposeSlot`):** sets order to `RESCHEDULE_PROPOSED`, stores proposal/history; emits `notifyCustomerOrder(..., "STATUS_CHANGED", ..., "A new time was proposed...", "RESCHEDULE_PROPOSED")`. No WhatsApp mapping for this status/template.
- **Customer accept (`acceptProposal`):** requires active proposal; if expired returns 400. Updates `confirmedSlot` to `proposal.proposedSlot`, updates `scheduledDate/scheduledTime` from confirmed slot, sets status based on previous status (PLACED->CONFIRMED, PAYMENT_CONFIRMED->PAYMENT_CONFIRMED, else CONFIRMED), clears `reschedulePreviousStatus`, saves. Notifies `RESCHEDULE_ACCEPTED` with idempotency `proposal:${id}:accepted` and details containing new scheduled time. Template uses `order.scheduledDate, order.scheduledTime` after update — **communicates new confirmed schedule**.
- **Customer decline (`declineProposal`):** marks proposal DECLINED, restores `order.orderStatus = reschedulePreviousStatus ?? CONFIRMED`, clears `reschedulePreviousStatus`, does **not** change `confirmedSlot/scheduledDate/scheduledTime`; saves. Notifies `RESCHEDULE_REJECTED` with `proposal:${id}:declined`. Template uses current `order.scheduledDate/scheduledTime` — **communicates retained existing schedule**. This matches BLB-18 draft assumption.
- **Customer alternative request (`requestAlternativeSlot`):** for pending proposal, sets proposal `ALTERNATIVE_REQUESTED`, stores `customerAlternativeSlot/note`, restores previous order status, clears `reschedulePreviousStatus`; does not set order scheduledDate/time to alternative. Notifies `RESCHEDULE_REQUESTED` with detail `Your requested alternative time is ...`. Template params, however, are `[customerName, orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl]` from current order schedule — **semantic mismatch**.

### Semantics table
| Event | Who/what triggers | Schedule communicated by payload | Actual business meaning | Risk |
|---|---|---|---|---|
| `RESCHEDULE_PROPOSED` | Admin proposes new slot | N/A (no WhatsApp mapping) | Admin proposed a new schedule; awaiting customer response | No customer WhatsApp notification; owner decision needed |
| `RESCHEDULE_REQUESTED` | Customer requests alternative slot | Current `order.scheduledDate/scheduledTime` | Customer requested a different alternative time; details contain alternative time text but template variables do not | **High content/payload mismatch** - template says “Requested schedule…” but variables are current schedule, not requested alternative |
| `RESCHEDULE_ACCEPTED` | Customer accepts proposal | Updated confirmed `order.scheduledDate/scheduledTime` | New schedule accepted and applied | Low; aligns |
| `RESCHEDULE_REJECTED` | Customer declines proposal | Retained current `order.scheduledDate/scheduledTime` | Proposed schedule declined; existing schedule remains | Low; aligns with draft if copy states retained schedule |

---

## 8. Proposed `order_reschedule_proposed` Draft (Owner Review Only — NOT IMPLEMENTED)

**Status:** NOT IN REGISTRY / NOT MAPPED / NOT SUBMITTED / NOT APPROVED / NOT ENABLED.

- **Suggested internal event:** `RESCHEDULE_PROPOSED` (STATUS_CHANGED-compatible mapping decision required)
- **Suggested template name:** `order_reschedule_proposed`
- **Category/language:** TRANSACTIONAL / `en`
- **Business meaning:** S.V. Sweets & Bakers has proposed a new delivery/pickup date and time for the customer’s order. Customer review/response is needed.
- **Draft body:**
  > Hello {{1}}, S.V. Sweets & Bakers has proposed a new schedule for your order {{2}}: {{3}} at {{4}}. Please review and respond on your order page: {{5}}
- **Suggested variables:** `customerName`, `orderNumber`, `proposedDate`, `proposedTime`, `trackingUrl`.
- **Payload caution:** Current `notifyCustomerOrder` STATUS_CHANGED call passes `status="RESCHEDULE_PROPOSED"` and detail text; it does not currently supply proposed slot as template params. Implementation would require separate authorized payload/registry/outbox mapping work.
- **Owner decisions:** approve/defer; confirm trigger point (admin proposal only?); confirm proposed date/time source/format; confirm CTA (view order only vs quick reply); legal/compliance review.

---

## 9. Template-by-Template Readiness Classification

| Template | Classification | Rationale |
|---|---|---|
| `order_received` | **CONTENT REVISION REQUIRED; EXTERNAL APPROVAL REQUIRED** | Date/time formatting and production domain confirmation needed; Meta/legal approval required. |
| `payment_received` | **CONTENT REVISION REQUIRED; EXTERNAL APPROVAL REQUIRED** | Currency symbol/format missing in payload; `paymentMethod` raw enum; amount semantics wording needs owner/legal confirmation. |
| `order_confirmed` | **CONTENT REVISION REQUIRED; EXTERNAL APPROVAL REQUIRED** | `status` param exposes raw internal enum; needs friendly mapping or template redesign. |
| `order_preparing` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Content clear/transactional; still needs domain/legal/Meta approval. |
| `order_ready` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear; covers ready/pickup semantics reasonably. |
| `order_out_for_delivery` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear. |
| `order_completed` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Polite closing; confirm non-promotional acceptability. |
| `order_cancelled` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear; avoid refund promises. |
| `payment_failed` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Cautious wording aligns with committed-failure trigger. |
| `order_reschedule_requested` | **CONTENT REVISION REQUIRED; SOURCE EVIDENCE INSUFFICIENT** | Payload/template semantic mismatch: event from alternative-slot request but params use current order schedule, not requested alternative. Owner must define intended meaning before submission. |
| `order_reschedule_accepted` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Updated schedule communicated correctly. |
| `order_reschedule_rejected` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Retained schedule communicated correctly; confirm copy. |
| `custom_cake_request_received` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear; URL specificity decision noted. |
| `custom_cake_quote_prepared` | **CONTENT REVISION REQUIRED; EXTERNAL APPROVAL REQUIRED** | Price/date/time formatting and completeness/wording decisions needed; empty-string fallback is fail-closed but readiness risk remains. |
| `custom_cake_quote_accepted` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear. |
| `custom_cake_quote_declined` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear. |
| `custom_cake_request_closed` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear minimal closure message. |
| `custom_cake_converted_to_order` | **READY FOR OWNER REVIEW; EXTERNAL APPROVAL REQUIRED** | Clear; idempotent/no duplicate order-received behavior previously verified. |

*No template is classified as Meta-approved or send-ready.*

---

## 10. Owner Decisions Required

1. **W01 legal/compliance written validation/approval** for all WhatsApp consent/notification wording and scope (external blocker).
2. **Production domain / tracking URL policy:** confirm canonical `NEXT_PUBLIC_SITE_URL`; accept or replace fallback domain; confirm order track and custom-cake destination behavior.
3. **Custom-cake tracking URL specificity:** keep list page `/account/custom-cake-requests` or use specific request detail route (requires separate authorized implementation if changed).
4. **Payment amount formatting:** include currency symbol/code (`INR`/`₹`)? Where formatted (template text vs payload)?
5. **Payment method labels:** map `ONLINE/PAY_AT_STORE/COD` to customer-friendly labels before submission/enablement?
6. **`order_confirmed.status` handling:** remove status variable/revise template, or map internal enums to friendly labels?
7. **`order_reschedule_requested` meaning:** should it represent customer alternative-time request (needs payload/template redesign) or another reschedule-requested business event? Current payload is semantically mismatched.
8. **`RESCHEDULE_PROPOSED` WhatsApp template:** approve/defer; if approved, define trigger, variables, and authorize implementation/mapping.
9. **Date/time formatting standard:** ISO/raw vs customer-friendly format; timezone display; consistent across order/custom-cake/reschedule templates.
10. **Quote-prepared price formatting:** currency, decimals, tax/delivery inclusiveness wording.

---

## 11. Legal/Compliance Blockers

- **W01 written legal/compliance validation/approval: NOT RECEIVED** (external). Project-owner policy approval is not legal approval.
- **Meta template approval: NOT RECEIVED.** No templates submitted/approved/enabled.
- **Consent/compliance evidence:** code safeguards present (optional/unchecked default, explicit transactional consent, no inference, STOP/withdrawal path, fail-closed unapproved templates, UAT suppression), but legal/compliance sign-off remains pending.
- **D-14, D-16-D-18, Group 5 (0/13 granted):** unresolved/not authorized.
- **Release status:** D-19 NO-GO; dirty worktree/release boundary unresolved.

---

## 12. Recommended Next Milestone

**BLB-20 (Owner Decision + Content Finalization Package, docs/read-only unless separately authorized):** resolve owner decisions from Section 10, obtain W01 legal/compliance written approval, confirm production domain/URL behavior, and finalize customer-facing formatting rules (currency, payment method labels, status labels, date/time). 

After BLB-20 decisions are documented, any required **source/payload/template-registry changes** must be handled as a separately authorized implementation milestone with explicit scope, followed by fresh verification (BLB-style), then manual Meta submission and approval tracking, then separately authorized UAT/provider validation. No production enablement/release without required approvals and D-19 gate clearance.

---

## Appendix A — Files Inspected (Read-Only)

- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md`
- `backend/src/services/whatsappTemplateRegistry.ts`
- `backend/src/services/customerOrderNotifications.ts`
- `backend/src/services/customCakeNotifications.ts`
- `backend/src/services/notificationOutboxService.ts`
- `backend/src/controllers/customCakeController.ts` (proposeProposal, convert/notification hooks, quote fields)
- `backend/src/controllers/orderController.ts` (status change notification, reschedule propose/accept/decline/alternative request)
- `backend/src/controllers/paymentController.ts` (PAYMENT_CONFIRMED / PAYMENT_FAILED notification paths)
- `backend/src/models/CustomCakeRequest.ts`
- `backend/src/models/Order.ts`
- Frontend route presence check: `app/track/page.tsx`, `app/account/custom-cake-requests/page.tsx`, `app/account/custom-cake-requests/[orderId]/page.tsx`

## Appendix B — Execution Confirmation

- **No source/test/config/env/dependency files modified.**
- **No DB/provider/API/external website/Meta/WhatsApp/email/SMS/OTP/Razorpay operations performed.**
- **No template enablement or message sending performed.**
- **No Git mutations performed.**
- **No Meta approval or actual WhatsApp delivery claimed.**