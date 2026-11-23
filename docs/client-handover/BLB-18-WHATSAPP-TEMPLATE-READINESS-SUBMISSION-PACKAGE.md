# BLB-18 — WhatsApp Template Readiness & Submission Package

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Customer-facing brand:** S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Prepared:** 21 Nov 2026 (read-only inspection + documentation package)  
**Status:** **OWNER REVIEW / MANUAL META SUBMISSION REQUIRED — NOT APPROVED, NOT ENABLED FOR LIVE SEND, NOT SUBMITTED**

---

## 1. Executive Summary

This package prepares the WhatsApp Business template submission artifacts for the notification implementation verified in BLB-17. It is based on read-only inspection of the current registry, notification services, outbox validation, and consent/safeguard code paths.

**Verified outcome:**
- **18 transactional WhatsApp templates** are registered in `backend/src/services/whatsappTemplateRegistry.ts`.
- All 18 are currently **`approvalState: NOT_SUBMITTED`** and **`enabled: false`** (fail-closed).
- Message drafts below are **owner-reviewable submission drafts** only. They are **not** Meta-approved, **not** enabled, and **not** sent.
- **`RESCHEDULE_PROPOSED`** (admin proposes a new date/time; emitted as `STATUS_CHANGED/RESCHEDULE_PROPOSED` in order flow) has **no WhatsApp template/registry mapping**. A proposed draft is included for owner decision only; it is **not implemented, not mapped, not approved**.
- No application source, test, config, env, dependency, DB, provider, Meta submission, template enablement, message sending, deploy, or Git mutation was performed for BLB-18.

**Release/compliance posture remains unchanged:** W01 legal/compliance written validation/approval **NOT RECEIVED** (external). D-14 **NOT RECEIVED**. BLB-09B Group 5 **0/13 granted**. D-19 **NO-GO**. Dirty worktree/release boundary unresolved.

---

## 2. Verified Template Inventory

**Source of truth:** `backend/src/services/whatsappTemplateRegistry.ts` (`WHATSAPP_TEMPLATE_REGISTRY`, 18 entries). Cross-checked against `customerOrderNotifications.ts`, `customCakeNotifications.ts`, and `notificationOutboxService.ts`.

| # | Internal event | Template name | Category | Language | Required variables | Approval state | Enabled | Meta template ID |
|---:|---|---|---|---|---|---|---:|---|
| 1 | `ORDER_PLACED` | `order_received` | TRANSACTIONAL | `en` | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 2 | `PAYMENT_CONFIRMED` | `payment_received` | TRANSACTIONAL | `en` | `customerName, orderNumber, amount, paymentMethod, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 3 | `STATUS_CHANGED_CONFIRMED` | `order_confirmed` | TRANSACTIONAL | `en` | `customerName, orderNumber, status, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 4 | `STATUS_CHANGED_PREPARING` | `order_preparing` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 5 | `STATUS_CHANGED_READY` | `order_ready` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 6 | `STATUS_CHANGED_OUT_FOR_DELIVERY` | `order_out_for_delivery` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 7 | `STATUS_CHANGED_COMPLETED` | `order_completed` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 8 | `CANCELLED` | `order_cancelled` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 9 | `PAYMENT_FAILED` | `payment_failed` | TRANSACTIONAL | `en` | `customerName, orderNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 10 | `RESCHEDULE_REQUESTED` | `order_reschedule_requested` | TRANSACTIONAL | `en` | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 11 | `RESCHEDULE_ACCEPTED` | `order_reschedule_accepted` | TRANSACTIONAL | `en` | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 12 | `RESCHEDULE_REJECTED` | `order_reschedule_rejected` | TRANSACTIONAL | `en` | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 13 | `CUSTOM_CAKE_REQUEST_RECEIVED` | `custom_cake_request_received` | TRANSACTIONAL | `en` | `customerName, referenceNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 14 | `CUSTOM_CAKE_QUOTE_PREPARED` | `custom_cake_quote_prepared` | TRANSACTIONAL | `en` | `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 15 | `CUSTOM_CAKE_QUOTE_ACCEPTED` | `custom_cake_quote_accepted` | TRANSACTIONAL | `en` | `customerName, referenceNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 16 | `CUSTOM_CAKE_QUOTE_DECLINED` | `custom_cake_quote_declined` | TRANSACTIONAL | `en` | `customerName, referenceNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 17 | `CUSTOM_CAKE_REQUEST_CLOSED` | `custom_cake_request_closed` | TRANSACTIONAL | `en` | `customerName, referenceNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |
| 18 | `CUSTOM_CAKE_CONVERTED_TO_ORDER` | `custom_cake_converted_to_order` | TRANSACTIONAL | `en` | `customerName, referenceNumber, trackingUrl` | `NOT_SUBMITTED` | `false` | empty |

### Inventory discrepancy check
- **Expected vs registry:** No missing or renamed templates among the 18 expected names. All match exactly.
- **Note:** `STATUS_CHANGED` outbox jobs are resolved to internal events via template mapping (`order_confirmed`, `order_preparing`, `order_ready`, `order_out_for_delivery`, `order_completed`) in `notificationOutboxService.ts`; registry uses those internal event names. This is consistent.
- **Not in registry/mapping:** `RESCHEDULE_PROPOSED` (see Section 6).

---

## 3. Individual Message Drafts

> **Drafting rules:** concise professional English; S.V. Sweets & Bakers identity; transactional only; no marketing/promotional language; no real customer data. Examples are illustrative and clearly marked. Final Meta-submitted text may require formatting/variable adjustments to satisfy Meta template policies.

### 3.1 `order_received` (ORDER_PLACED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} has been received by S.V. Sweets & Bakers. Scheduled for {{3}} at {{4}}. You can view details here: {{5}}
- **Variables:**
  1. `customerName` — customer display name.
  2. `orderNumber` — internal order number.
  3. `scheduledDate` — scheduled fulfillment date.
  4. `scheduledTime` — scheduled fulfillment time.
  5. `trackingUrl` — order tracking/details URL.
- **Example (illustrative):** `Anita`, `SV-1042`, `22 Nov 2026`, `04:00 PM`, `https://<site>/track?order=SV-1042`
- **Buttons:** optional URL button “View order” using `{{5}}` if Meta category/policy allows.
- **Policy/approval notes:** Transactional order update only. Confirm URL domain is verified/accepted by Meta. Ensure date/time formatting is consistent.

### 3.2 `payment_received` (PAYMENT_CONFIRMED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, we have received your payment for order {{2}} at S.V. Sweets & Bakers. Amount: {{3}}. Payment method: {{4}}. View details: {{5}}
- **Variables:** `customerName`, `orderNumber`, `amount`, `paymentMethod`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `INR 1,250.00`, `Razorpay`, `https://<site>/track?order=SV-1042`
- **Buttons:** optional “View order”.
- **Notes:** Currency formatting should be consistent and human-readable; avoid misleading payment claims.

### 3.3 `order_confirmed` (STATUS_CHANGED_CONFIRMED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} has been confirmed by S.V. Sweets & Bakers. Current status: {{3}}. View details: {{4}}
- **Variables:** `customerName`, `orderNumber`, `status`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `Confirmed`, `https://<site>/track?order=SV-1042`
- **Notes:** `status` is currently passed from order status; keep wording clear and avoid internal enum leakage if possible during final copy review.

### 3.4 `order_preparing` (STATUS_CHANGED_PREPARING)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} is being prepared by S.V. Sweets & Bakers. We will notify you when there is an update. View details: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`

### 3.5 `order_ready` (STATUS_CHANGED_READY)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} is ready at S.V. Sweets & Bakers. Please check your order details for pickup or delivery information: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`
- **Notes:** Current mapping covers READY/READY_FOR_PICKUP; copy should remain accurate for both pickup and ready states.

### 3.6 `order_out_for_delivery` (STATUS_CHANGED_OUT_FOR_DELIVERY)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} is out for delivery from S.V. Sweets & Bakers. View details: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`

### 3.7 `order_completed` (STATUS_CHANGED_COMPLETED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} has been completed by S.V. Sweets & Bakers. Thank you for choosing us. View details: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`
- **Notes:** “Thank you for choosing us” is a polite transactional closing; confirm it remains acceptable as non-promotional in final Meta review.

### 3.8 `order_cancelled` (CANCELLED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your order {{2}} with S.V. Sweets & Bakers has been cancelled. If you need assistance, please contact us through the details on your order page: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`

### 3.9 `payment_failed` (PAYMENT_FAILED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, the payment for your order {{2}} with S.V. Sweets & Bakers could not be completed. Please check your order page for current payment options or details: {{3}}
- **Variables:** `customerName`, `orderNumber`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `https://<site>/track?order=SV-1042`
- **Notes:** Currently fail-closed (`NOT_SUBMITTED`, disabled). Do not imply funds were captured. Trigger only on committed payment failure per BLB-16/17 verification.

### 3.10 `order_reschedule_requested` (RESCHEDULE_REQUESTED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, we received your reschedule request for order {{2}} at S.V. Sweets & Bakers. Requested schedule: {{3}} at {{4}}. View details: {{5}}
- **Variables:** `customerName`, `orderNumber`, `scheduledDate`, `scheduledTime`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `23 Nov 2026`, `05:00 PM`, `https://<site>/track?order=SV-1042`

### 3.11 `order_reschedule_accepted` (RESCHEDULE_ACCEPTED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your reschedule request for order {{2}} has been accepted by S.V. Sweets & Bakers. Updated schedule: {{3}} at {{4}}. View details: {{5}}
- **Variables:** `customerName`, `orderNumber`, `scheduledDate`, `scheduledTime`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `23 Nov 2026`, `05:00 PM`, `https://<site>/track?order=SV-1042`

### 3.12 `order_reschedule_rejected` (RESCHEDULE_REJECTED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your reschedule request for order {{2}} could not be accepted by S.V. Sweets & Bakers. The current schedule remains {{3}} at {{4}}. View details: {{5}}
- **Variables:** `customerName`, `orderNumber`, `scheduledDate`, `scheduledTime`, `trackingUrl`.
- **Example:** `Anita`, `SV-1042`, `22 Nov 2026`, `04:00 PM`, `https://<site>/track?order=SV-1042`
- **Notes:** Copy assumes `scheduledDate/scheduledTime` reflect the schedule retained after rejection; confirm with owner/product before submission.

### 3.13 `custom_cake_request_received` (CUSTOM_CAKE_REQUEST_RECEIVED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, we have received your custom cake request {{2}} at S.V. Sweets & Bakers. Our team will review it and update you. View details: {{3}}
- **Variables:** `customerName`, `referenceNumber`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `https://<site>/account/custom-cake-requests`

### 3.14 `custom_cake_quote_prepared` (CUSTOM_CAKE_QUOTE_PREPARED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, a quote has been prepared for your custom cake request {{2}} at S.V. Sweets & Bakers. Proposed price: {{3}}. Proposed delivery: {{4}} at {{5}}. Please review and respond: {{6}}
- **Variables:** `customerName`, `referenceNumber`, `proposedPrice`, `proposedDeliveryDate`, `proposedDeliveryTime`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `INR 2,400.00`, `25 Nov 2026`, `03:00 PM`, `https://<site>/account/custom-cake-requests`
- **Notes:** Ensure price/date/time formatting is finalized before Meta submission; empty values should never be sent (registry/outbox fail closed on missing required params).

### 3.15 `custom_cake_quote_accepted` (CUSTOM_CAKE_QUOTE_ACCEPTED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your quote for custom cake request {{2}} has been accepted at S.V. Sweets & Bakers. We will share next steps on your request page: {{3}}
- **Variables:** `customerName`, `referenceNumber`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `https://<site>/account/custom-cake-requests`

### 3.16 `custom_cake_quote_declined` (CUSTOM_CAKE_QUOTE_DECLINED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, the quote for your custom cake request {{2}} was declined at S.V. Sweets & Bakers. If you need help, please check your request page: {{3}}
- **Variables:** `customerName`, `referenceNumber`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `https://<site>/account/custom-cake-requests`

### 3.17 `custom_cake_request_closed` (CUSTOM_CAKE_REQUEST_CLOSED)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your custom cake request {{2}} has been closed by S.V. Sweets & Bakers. You can view details here: {{3}}
- **Variables:** `customerName`, `referenceNumber`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `https://<site>/account/custom-cake-requests`

### 3.18 `custom_cake_converted_to_order` (CUSTOM_CAKE_CONVERTED_TO_ORDER)
- **Category:** TRANSACTIONAL | **Language:** `en`
- **Body draft:**
  > Hello {{1}}, your custom cake request {{2}} has been converted to an order at S.V. Sweets & Bakers. View details: {{3}}
- **Variables:** `customerName`, `referenceNumber`, `trackingUrl`.
- **Example:** `Anita`, `CCR-2048`, `https://<site>/account/custom-cake-requests`
- **Notes:** Conversion notification is idempotent and should not duplicate order-received notification (verified in BLB-17).

---

## 4. Variable Mapping Table

| Template | Variable | Source (code-inspected) | Required by registry | Format / notes | Risk / action |
|---|---|---|---:|---|---|
| `order_received` | `customerName` | `order.customerName || "Customer"` | Yes | Plain text | Low; ensure no sensitive data injected. |
| `order_received` | `orderNumber` | `order.orderNumber` | Yes | Plain text | Low. |
| `order_received` | `scheduledDate` | `order.scheduledDate` | Yes | String as stored; may need human-friendly format before submission | **Medium:** normalize date format for customer readability and Meta sample consistency. |
| `order_received` | `scheduledTime` | `order.scheduledTime` | Yes | String as stored | **Medium:** normalize time format/timezone clarity. |
| `order_received` | `trackingUrl` | `${NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app}/track?order=<orderNumber>` | Yes | Absolute URL | **Medium:** confirm production domain/URL policy; fallback domain in code is env/default, not owner-approved production domain evidence. |
| `payment_received` | `amount` | `order.totalAmount.toFixed(2)` | Yes | Numeric string with 2 decimals, no currency symbol in code | **Medium:** consider explicit currency formatting (`INR`) in final template/sample; ensure consistency. |
| `payment_received` | `paymentMethod` | `order.paymentMethod` | Yes | Internal enum/string | **Medium:** may be internal value; map to customer-friendly label before final submission if needed. |
| `order_confirmed` | `status` | passed `status`/`order.orderStatus` | Yes | Internal status string | **Medium:** avoid exposing raw internal enum if unfriendly. |
| `payment_failed` | `trackingUrl` | order tracking URL | Yes | Absolute URL | Low/Medium; ensure page gives safe next steps. |
| `order_reschedule_*` | `scheduledDate`, `scheduledTime` | `order.scheduledDate`, `order.scheduledTime` at notification time | Yes | Stored schedule strings | **Medium:** confirm semantics for rejected request (current schedule retained) are owner-approved. |
| All order templates | `trackingUrl` | order track URL built in `customerOrderNotifications.ts` | Yes | Absolute URL | **Medium:** verify domain, HTTPS, and Meta button/link compatibility. |
| `custom_cake_*` | `customerName` | `request.name?.trim() || "Customer"` | Yes | Plain text | Low. |
| `custom_cake_*` | `referenceNumber` | `request.referenceNumber` | Yes | Plain text | Low. |
| `custom_cake_*` | `trackingUrl` | `${NEXT_PUBLIC_SITE_URL ?? default}/account/custom-cake-requests` in `customCakeNotifications.ts` | Yes | Absolute URL | **Medium:** points to account list, not specific request detail; confirm acceptable UX/copy. |
| `custom_cake_quote_prepared` | `proposedPrice` | `String(request.proposedPrice ?? "")` | Yes | Raw string conversion | **High:** empty/undefined becomes empty string before gate; registry/outbox will fail closed on missing required params. Ensure quote-prepared notification is only emitted when price/date/time are present and formatted. |
| `custom_cake_quote_prepared` | `proposedDeliveryDate` | `request.proposedDeliveryDate ?? ""` | Yes | String | **High:** empty value fail-closed; format consistency needed. |
| `custom_cake_quote_prepared` | `proposedDeliveryTime` | `request.proposedDeliveryTime ?? ""` | Yes | String | **High:** empty value fail-closed; format consistency needed. |

**Mapping issues / observations:**
- No invented variables in registry. All drafted variables exist in registry definitions and inspected notification payload builders.
- `custom_cake_quote_prepared` has the highest formatting/completeness risk because code converts possibly missing values to empty strings; delivery is correctly fail-closed by validation, but operational/template readiness requires guaranteed populated, formatted values.
- `payment_received.amount` and `paymentMethod` may need customer-facing formatting decisions before Meta submission.
- Tracking URL defaults to `https://bakery-ecommerce-topaz.vercel.app` when `NEXT_PUBLIC_SITE_URL` is unset; confirm final production domain before submission.

---

## 5. Example Values (Illustrative Only)

| Template | Example values (illustrative, not real customer data) |
|---|---|
| `order_received` | `Anita`, `SV-1042`, `22 Nov 2026`, `04:00 PM`, `https://example.com/track?order=SV-1042` |
| `payment_received` | `Anita`, `SV-1042`, `1250.00`, `UPI`, `https://example.com/track?order=SV-1042` |
| `order_confirmed` | `Anita`, `SV-1042`, `Confirmed`, `https://example.com/track?order=SV-1042` |
| `order_preparing` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `order_ready` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `order_out_for_delivery` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `order_completed` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `order_cancelled` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `payment_failed` | `Anita`, `SV-1042`, `https://example.com/track?order=SV-1042` |
| `order_reschedule_requested` | `Anita`, `SV-1042`, `23 Nov 2026`, `05:00 PM`, `https://example.com/track?order=SV-1042` |
| `order_reschedule_accepted` | `Anita`, `SV-1042`, `23 Nov 2026`, `05:00 PM`, `https://example.com/track?order=SV-1042` |
| `order_reschedule_rejected` | `Anita`, `SV-1042`, `22 Nov 2026`, `04:00 PM`, `https://example.com/track?order=SV-1042` |
| `custom_cake_request_received` | `Anita`, `CCR-2048`, `https://example.com/account/custom-cake-requests` |
| `custom_cake_quote_prepared` | `Anita`, `CCR-2048`, `2400.00`, `25 Nov 2026`, `03:00 PM`, `https://example.com/account/custom-cake-requests` |
| `custom_cake_quote_accepted` | `Anita`, `CCR-2048`, `https://example.com/account/custom-cake-requests` |
| `custom_cake_quote_declined` | `Anita`, `CCR-2048`, `https://example.com/account/custom-cake-requests` |
| `custom_cake_request_closed` | `Anita`, `CCR-2048`, `https://example.com/account/custom-cake-requests` |
| `custom_cake_converted_to_order` | `Anita`, `CCR-2048`, `https://example.com/account/custom-cake-requests` |

---

## 6. Reschedule-Proposal Owner Decision (NOT IMPLEMENTED)

### Current state (code-inspected)
- `backend/src/controllers/orderController.ts` sets/emits `RESCHEDULE_PROPOSED` in admin/customer reschedule workflow (e.g., order status transitions around lines inspected by grep; `STATUS_CHANGED` with status `RESCHEDULE_PROPOSED`).
- `backend/src/models/Order.ts` includes `RESCHEDULE_PROPOSED` in order status enum.
- `backend/src/services/customerOrderNotifications.ts` has **no** WhatsApp mapping for `RESCHEDULE_PROPOSED`.
- `backend/src/services/notificationOutboxService.ts` has **no** direct event mapping for `RESCHEDULE_PROPOSED`; `STATUS_CHANGED` is only mapped for specific template names (`order_confirmed/preparing/ready/out_for_delivery/completed`).
- `backend/src/services/whatsappTemplateRegistry.ts` has **no** `order_reschedule_proposed` (or equivalent) template.

**Conclusion:** `RESCHEDULE_PROPOSED` WhatsApp notification is currently **unsupported/unmapped**. This is an owner/product decision, not an implementation change in BLB-18.

### Proposed draft (owner decision only — DO NOT TREAT AS APPROVED/IMPLEMENTED)
- **Suggested internal event:** `RESCHEDULE_PROPOSED` (or `STATUS_CHANGED_RESCHEDULE_PROPOSED` - owner/implementation decision)
- **Suggested template name:** `order_reschedule_proposed`
- **Suggested category/language:** TRANSACTIONAL / `en`
- **Business meaning:** S.V. Sweets & Bakers has proposed a new delivery/pickup date and time for the customer’s order; customer action may be required to accept or reject the proposal.
- **Draft body:**
  > Hello {{1}}, S.V. Sweets & Bakers has proposed a new schedule for your order {{2}}: {{3}} at {{4}}. Please review and respond on your order page: {{5}}
- **Suggested variables:** `customerName`, `orderNumber`, `proposedDate`, `proposedTime`, `trackingUrl` (confirm actual payload fields before implementation).
- **Buttons (optional):** “View order” URL; quick-reply accept/reject only if product/legal/Meta and backend flows support it.

### Required distinction (must be preserved)
| State | Meaning | Current WhatsApp state |
|---|---|---|
| Admin proposes a new date/time | Business proposes alternative schedule; awaiting customer response | **No WhatsApp mapping/template (unsupported)** |
| Customer accepts/rejects | Customer responds to proposal | **Mapped:** `order_reschedule_accepted` / `order_reschedule_rejected` (`NOT_SUBMITTED`, disabled) |
| Admin confirms resulting schedule | Order schedule/status confirmed after workflow outcome | Existing order confirmation/status templates may apply depending on flow; do not conflate with proposal |

**Owner decision required before any implementation:** approve/decline this template, confirm exact trigger, variable names, CTA/buttons, and legal/compliance wording; then separately authorize implementation + Meta submission.

---

## 7. Consent and Compliance Checklist

| Check | Status | Evidence (read-only inspection) | Notes |
|---|---|---|---|
| Transactional WhatsApp consent is optional | **PASS (code/policy intent)** | Checkout/custom-cake UI send `whatsappConsent` boolean; notifier/outbox require explicit GRANTED transactional consent | W01 legal validation still required. |
| Consent defaults to unchecked | **PASS** | `app/checkout/page.tsx` `useState(false)`; `components/custom-cake/custom-cake-form.tsx` initial state `whatsappConsent: false`, checkbox bound to state | UI default only; no legal approval implied. |
| Marketing consent remains separate | **PASS** | Consent model/service has separate marketing fields; outbox enforces `hasValidTransactionalConsent`; no marketing templates/events added | Marketing remains disabled/separate. |
| Historical/unknown consent not treated as granted | **PASS** | Notifiers query for `status: "GRANTED"`; absence returns no send | No inference from missing records. |
| STOP/withdrawal respected | **PASS (code path present)** | `whatsappConsentService.ts` supports `WITHDRAWN`, `withdrawAllConsent`/STOP behavior; outbox rechecks transactional consent before send | End-to-end provider webhook/ops behavior needs authorized UAT/provider validation. |
| Unapproved templates remain disabled | **PASS** | All 18 registry entries `NOT_SUBMITTED`, `enabled:false`; `validateTemplateForSend` fail-closed; custom-cake notifier pre-enqueue checks definition enabled/APPROVED | No template can be sent until explicitly approved/enabled. |
| UAT suppression remains unchanged | **PASS** | `notificationOutboxService.ts` checks `isUatExternalSideEffectsBlocked()` and releases suppressed jobs via `logUatSuppressed` | No external sends in UAT-safe mode. |
| Legal/compliance review | **PENDING / NOT RECEIVED** | BLB-10A/BLB-13A records indicate no written legal/compliance validation found | **Do not treat project-owner policy approval as formal legal approval.** |

---

## 8. Meta Submission Checklist (Manual, Owner/Authorized Operator)

- [ ] **Legal/compliance approval received in writing** for W01 wording/consent/notification scope (blocker).
- [ ] Confirm business identity in Meta Business Manager: **S.V. Sweets & Bakers**.
- [ ] Confirm WhatsApp Business Account, phone number, display name, and domain verification status.
- [ ] Confirm final production `NEXT_PUBLIC_SITE_URL`/tracking domain; ensure URLs in templates are allowed and stable.
- [ ] Review each draft for Meta WhatsApp template policy compliance (transactional, no promotional content, clear variables, correct category).
- [ ] Finalize variable formatting: dates, times, currency, payment method labels, status labels.
- [ ] Confirm `custom_cake_quote_prepared` is only triggered with complete non-empty quote fields.
- [ ] Decide `RESCHEDULE_PROPOSED` template: approve/defer; if approved, authorize implementation before submission.
- [ ] Submit templates manually in Meta Business Manager (no API submission performed by this milestone).
- [ ] Record Meta template IDs, approval states, rejection reasons, and timestamps in tracking table.
- [ ] After approval, separately authorize code/config update to set `metaTemplateId`, `approvalState`, `enabled` only for approved templates, with evidence.
- [ ] Run authorized UAT/provider validation before any production enablement.

---

## 9. Template Approval Tracking Table

| Template name | Internal event | Registry approval | Registry enabled | Meta submitted | Meta template ID | Meta approval status | Approved by | Date | Notes |
|---|---|---|---:|---|---|---|---|---|---|
| `order_received` | `ORDER_PLACED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `payment_received` | `PAYMENT_CONFIRMED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_confirmed` | `STATUS_CHANGED_CONFIRMED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_preparing` | `STATUS_CHANGED_PREPARING` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_ready` | `STATUS_CHANGED_READY` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_out_for_delivery` | `STATUS_CHANGED_OUT_FOR_DELIVERY` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_completed` | `STATUS_CHANGED_COMPLETED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_cancelled` | `CANCELLED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `payment_failed` | `PAYMENT_FAILED` | NOT_SUBMITTED | false | No |  | Pending |  |  | Fail-closed; committed failure only. |
| `order_reschedule_requested` | `RESCHEDULE_REQUESTED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_reschedule_accepted` | `RESCHEDULE_ACCEPTED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_reschedule_rejected` | `RESCHEDULE_REJECTED` | NOT_SUBMITTED | false | No |  | Pending |  |  | Confirm rejected-schedule semantics. |
| `custom_cake_request_received` | `CUSTOM_CAKE_REQUEST_RECEIVED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `custom_cake_quote_prepared` | `CUSTOM_CAKE_QUOTE_PREPARED` | NOT_SUBMITTED | false | No |  | Pending |  |  | Validate non-empty price/date/time formatting. |
| `custom_cake_quote_accepted` | `CUSTOM_CAKE_QUOTE_ACCEPTED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `custom_cake_quote_declined` | `CUSTOM_CAKE_QUOTE_DECLINED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `custom_cake_request_closed` | `CUSTOM_CAKE_REQUEST_CLOSED` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `custom_cake_converted_to_order` | `CUSTOM_CAKE_CONVERTED_TO_ORDER` | NOT_SUBMITTED | false | No |  | Pending |  |  |  |
| `order_reschedule_proposed` *(proposed, not in registry)* | `RESCHEDULE_PROPOSED` | **NOT IN REGISTRY** | N/A | No |  | Owner decision required |  |  | Do not implement/map/submit without authorization. |

---

## 10. Remaining Blockers and Next Steps

### Blockers
1. **W01 legal/compliance written validation/approval NOT RECEIVED** (external). Provisional wording not legally approved.
2. **Meta template submission/approval not done**; all 18 registered templates remain `NOT_SUBMITTED`/disabled.
3. **D-14 evidence NOT RECEIVED**; BLB-09B Group 5 **0/13 granted**; D-16/D-17/D-18 unresolved.
4. **RESCHEDULE_PROPOSED WhatsApp mapping absent** - owner decision required.
5. **Variable formatting/domain decisions pending** (date/time/currency/payment method/status labels, production tracking domain).
6. **No real WhatsApp delivery/UAT provider validation** performed or authorized.
7. **Release boundary dirty/uncommitted/unpushed**; D-19 NO-GO.

### Next steps (owner-authorized sequence)
1. Obtain written W01 legal/compliance validation for consent/notification wording and scope.
2. Owner review this package; resolve RESCHEDULE_PROPOSED decision and formatting/domain choices.
3. After approval, manually submit templates in Meta Business Manager; capture IDs/approval evidence.
4. Separately authorize code/config updates to mark approved templates enabled with Meta IDs; do not enable unapproved templates.
5. Separately authorize UAT-safe/provider validation as applicable; preserve UAT suppression and fail-closed behavior.
6. Resolve OD-01–OD-05, D-14, D-16–D-18, and Group 5 execution authorizations before any production release.

---

## Appendix A — Inspection Evidence (Read-Only)

- `backend/src/services/whatsappTemplateRegistry.ts`: 18 entries, all `NOT_SUBMITTED`, `enabled:false`, empty `metaTemplateId`.
- `backend/src/services/customerOrderNotifications.ts`: order/payment/reschedule/cancel WhatsApp mappings; tracking URL `NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app`; explicit transactional consent check; preference/event-aware behavior.
- `backend/src/services/customCakeNotifications.ts`: 6 custom-cake events; tracking URL to `/account/custom-cake-requests`; explicit GRANTED consent lookup; fail-closed pre-enqueue on missing/disabled/unapproved template; idempotency key `whatsapp:custom-cake:<id>:<eventId>`.
- `backend/src/services/notificationOutboxService.ts`: direct event mappings include reschedule/custom-cake/payment-failed; STATUS_CHANGED mapping excludes RESCHEDULE_PROPOSED; UAT suppression releases jobs without consuming retry; transactional consent rechecked before send; template validation fail-closed.
- `backend/src/controllers/orderController.ts` / `backend/src/models/Order.ts`: `RESCHEDULE_PROPOSED` exists in business flow/model; no WhatsApp mapping.
- `app/checkout/page.tsx`, `components/custom-cake/custom-cake-form.tsx`: `whatsappConsent` defaults `false`, explicit checkbox.
- `backend/src/services/whatsappConsentService.ts`: GRANTED/DENIED/WITHDRAWN, withdrawal/STOP handling, transactional consent checks.

**No external submission or message sending occurred. No Meta approval or actual WhatsApp delivery is claimed.**
