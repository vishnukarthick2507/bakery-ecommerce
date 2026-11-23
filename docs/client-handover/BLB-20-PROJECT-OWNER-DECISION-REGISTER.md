# BLB-20 — Project Owner Decisions & Notification Content Finalization

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Baseline:** BLB-19 complete  
**Date:** 21 Nov 2026  
**Mode:** Documentation-only (read-only inspection + new register)  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

BLB-20 consolidates outstanding WhatsApp notification content, payload, formatting, and business-semantic decisions identified in BLB-18/BLB-19 into a project-owner decision register. No decisions have been implemented. No application source, test, config, env, dependency, DB, provider, Meta, or deployment changes were made.

**Current posture:** All 18 registered WhatsApp templates remain `NOT_SUBMITTED` / `enabled:false` / fail-closed. No Meta template approval, no legal/compliance written approval, no real WhatsApp delivery, and no production release authorization exists. BLB-09B recorded W01 as a project-owner business-policy decision (APPROVE WITH CONDITIONS) only; BLB-10A confirmed legal/compliance evidence is NOT RECEIVED. BLB-11A OD-01–OD-05 remain unresolved.

**Decision outcome:** **D20-02**, **D20-03**, **D20-04**, **D20-06**, and **D20-07** are **APPROVED BY PROJECT OWNER** (documentation/wording/formatting decisions only; not implemented, not enabled, not Meta-approved, not live). **D20-05** is **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-05-A and D20-05-C approved by Project Owner 2026-11-21, BLB-20L; D20-05-D resolved through approved D20-06 convention, BLB-20N 2026-11-22; D20-05-B/E/F NOT DECIDED). **D20-08** is **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-08-A approved by Project Owner 2026-11-22, BLB-20U; D20-08-B approved by Project Owner 2026-11-22, BLB-20V; D20-08-C approved by Project Owner 2026-11-22, Option B, generic contact S.V. Sweets & Bakers / no tracking-page response mechanism/button/direct acceptance link; D20-08-D approved by Project Owner 2026-11-22, Option C, no expiry/deadline/countdown/response-window wording in WhatsApp notification / existing expiry enforcement unchanged; D20-08-E/F NOT DECIDED). The remaining two decisions (D20-01, D20-09) remain **NOT DECIDED** / **EXTERNAL CONFIRMATION REQUIRED** as applicable. **Overall count: 5 fully approved / 2 partially approved / 2 not decided.** No other recommendation in this register is recorded as approval.

---

## 2. Nine Owner Decision Records

### D20-01 — Production Domain

| Field | Record |
|---|---|
| **Decision** | Determine canonical customer-facing production domain and preferred custom-cake destination. |
| **Status** | **NOT DECIDED / EXTERNAL CONFIRMATION REQUIRED** |
| **Current evidence** | No written evidence confirming a canonical production domain was found in inspected BLB-18/19/09B/10A/11A artifacts or current repo docs. Code fallback/default in `customerOrderNotifications.ts` and `customCakeNotifications.ts`: `NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"`. |
| **Existing fallback domain** | `https://bakery-ecommerce-topaz.vercel.app` (code default/fallback only; **not owner-confirmed production domain**). |
| **Order tracking destination** | `${base}/track?order=<encoded orderNumber>`; frontend route exists at `app/track/page.tsx`. |
| **Custom-cake destination options** | (A) Existing list page: `${base}/account/custom-cake-requests` (`app/account/custom-cake-requests/page.tsx`) — currently used by notifications. (B) Specific request detail: `${base}/account/custom-cake-requests/[orderId]` exists in frontend, but notification payload currently does not include request-specific detail URL/id parameter. |
| **Recommendation** | Owner confirms canonical production domain in writing; confirm HTTPS/domain verification for Meta; decide list vs specific detail page for custom-cake notifications. Do not submit templates with unconfirmed domain. |
| **Approval recorded?** | No. No explicit owner decision/evidence supplied. |

### D20-02 — Payment Amount Formatting

| Field | Record |
|---|---|
| **Decision** | Choose payment amount display convention and confirm amount semantics. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Approver** | Project Owner (explicit approval in BLB-20C conversation) |
| **Evidence reference** | BLB-20C conversation decision capture (2026-11-21); this register update is documentation-only. |
| **Current evidence** | `payment_received` payload currently uses `order.totalAmount.toFixed(2)` (no currency symbol) in `customerOrderNotifications.ts`. Order model stores `totalAmount: number`. Payment confirmation path marks order paid/confirmed based on order payment flow; no separate independently verified gateway-captured amount field is used in the WhatsApp template payload. |
| **Approved customer-facing message format** | **Payment received successfully**<br><br>Hello {{customerName}},<br><br>Thank you for your payment! We have successfully received your payment for your order.<br><br>**Payment details**<br>- Order number: {{orderNumber}}<br>- Amount paid: **₹{{amount}}**<br>- Payment method: {{paymentMethod}}<br><br>Your order is now being processed. We'll keep you updated on its progress.<br><br>Thank you for choosing **S.V. Sweets & Bakers!** |
| **Approved formatting rules** | 1) Display currency as Indian Rupees (₹). 2) Use Indian number grouping, e.g. `₹1,25,000.00`. 3) Display two decimal places consistently. 4) Use customer-friendly payment method labels: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`. 5) Keep message concise, professional, and customer-friendly. |
| **Amount accuracy requirement** | Existing implementation uses `order.totalAmount.toFixed(2)`. The approved message must describe this value as the **order amount**. Do **not** claim it represents the actual gateway-captured or settled amount unless separately verified. |
| **Boundaries / non-approval** | Documentation/format decision only. **Not** an implementation authorization, **not** Meta approval, **not** template submission/enablement/send authorization, **not** legal/compliance approval. D20-03 is now separately recorded as **APPROVED BY PROJECT OWNER** (BLB-20F, 2026-11-21); no other decision status is changed by this entry. BLB-21 remains **NOT AUTHORIZED**. |

### D20-03 — Customer-Friendly Payment Methods

| Field | Record |
|---|---|
| **Decision** | Approve customer-facing payment method labels. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Approver** | Project Owner (explicit approval in BLB-20F conversation) |
| **Evidence reference** | BLB-20F conversation — project owner explicitly replied "yes giveee" (2026-11-21) in direct response to the question asking whether all three proposed payment method labels were approved; recorded as explicit approval of all three labels. |
| **Current evidence** | `Order.paymentMethod` enum is `COD | ONLINE | PAY_AT_STORE` (`backend/src/models/Order.ts`). `customerOrderNotifications.ts` currently passes raw `order.paymentMethod` to `payment_received`. |
| **Approved customer-facing labels** | `COD` → `Cash on delivery`; `ONLINE` → `Online payment`; `PAY_AT_STORE` → `Pay at store`. |
| **Boundaries / non-approval** | Documentation/wording decision only. Labels are intended for customer-facing WhatsApp notifications and do **not** change internal payment values, payment processing, or business logic. **Not** an implementation authorization, **not** Meta approval, **not** template submission/enablement/send authorization, **not** legal/compliance approval. BLB-21 remains **NOT AUTHORIZED**. |

### D20-04 — Order Confirmation Wording

| Field | Record |
|---|---|
| **Decision** | Remove raw internal status variable from customer-facing order confirmation or map it to a friendly label. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Approver** | Project Owner (explicit approval in BLB-20I conversation) |
| **Evidence reference** | BLB-20I conversation — project owner explicitly replied "approved add emoji" (2026-11-21), in direct response to the proposal to remove the internal `{{status}}` variable and use the customer-friendly order confirmation message. |
| **Current evidence** | Registry `order_confirmed` requires `customerName, orderNumber, status, trackingUrl`. `customerOrderNotifications.ts` passes `status` defaulting to `order.orderStatus`. `orderController.ts` STATUS_CHANGED notification passes 4 args, so raw `order.orderStatus` (internal enum) is used. |
| **Approved customer-facing message** | 🎉 **Your order is confirmed!**<br><br>Hello {{customerName}},<br><br>Great news! Your order **#{{orderNumber}}** has been confirmed. ✅<br><br>📦 We'll keep you updated as your order progresses.<br><br>Thank you for choosing **S.V. Sweets & Bakers!** ❤️ |
| **Approved content decisions** | 1) Remove the internal `{{status}}` variable completely from the order confirmation template. 2) Use the approved customer-friendly wording above. 3) Include the approved emojis: 🎉, ✅, 📦 and ❤️. 4) Retain `{{customerName}}` and `{{orderNumber}}` as message variables. |
| **Boundaries / non-approval** | Documentation/wording decision only. **Not** an implementation authorization, **not** Meta approval, **not** template submission/enablement/send authorization, **not** legal/compliance approval. Any registry/template/payload change requires separate BLB-21 authorization. BLB-21 remains **NOT AUTHORIZED**. |

### D20-05 — Custom-Cake Quote Formatting

| Field | Record |
|---|---|
| **Decision** | Finalize custom-cake quote display/wording rules. |
| **Status** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** |
| **Approval date** | 2026-11-21 |
| **Approver** | Project Owner (explicit approval in BLB-20L conversation) |
| **Evidence reference** | BLB-20L conversation decision capture (2026-11-21); this register update is documentation-only. |
| **Current evidence** | `custom_cake_quote_prepared` registry requires `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl`. `proposeProposalSchema` requires positive numeric `proposedPrice`, `YYYY-MM-DD` `proposedDeliveryDate`, required `proposedDeliveryTime`. Notifier converts possible missing values to empty strings but pre-enqueue/outbox validation is fail-closed. Tracking URL currently points to custom-cake request list page. |
| **Proposal package** | `docs/client-handover/BLB-20K-D20-05-CUSTOM-CAKE-QUOTE-DECISION-PROPOSAL.md` (owner review/proposal; D20-05-A/C approved by BLB-20L, remaining sub-decisions NOT DECIDED). |
| **D20-05-A — Currency and price formatting** | **APPROVED BY PROJECT OWNER** (2026-11-21). Currency: Indian Rupees (₹). Two decimal places. Indian number grouping. Example: `₹1,25,000.00`. Customer-facing quote line: `Proposed quote: ₹{{proposedPrice}}`. Formatting decision only; source-code formatting not implemented. |
| **D20-05-C — Customer-facing quote wording** | **APPROVED BY PROJECT OWNER** (2026-11-21). Approved wording (preserve exactly):<br><br>“Your custom cake quote is ready! 🎂<br><br>Hello {{customerName}},<br><br>We've prepared a quote for your custom cake request.<br><br>Request reference: {{referenceNumber}}<br><br>Proposed quote: ₹{{proposedPrice}}<br><br>Proposed delivery date: {{proposedDeliveryDate}}<br><br>Proposed delivery time: {{proposedDeliveryTime}}<br><br>Please review your quote and contact us if you would like to proceed or discuss any changes.<br><br>Thank you for choosing S.V. Sweets & Bakers! ❤️”<br><br>Preserve wording, emojis, and variable names exactly. |
| **D20-05-B — Tax and delivery charges** | **NOT DECIDED**. No assumption that either is included or excluded. |
| **D20-05-D — Date/time display and timezone** | **RESOLVED THROUGH APPROVED D20-06 CONVENTION** (BLB-20N, 2026-11-22). Applicable convention: Date `DD MMM YYYY` (e.g., `25 Dec 2026`); Time 12-hour AM/PM (e.g., `04:30 PM`); Timezone IST (India Standard Time) when displayed time represents IST; preserve delivery time ranges where the underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. Display convention only; storage unchanged; no implementation authorized. |
| **D20-05-E — Tracking URL placement and destination** | **NOT DECIDED**. Depends on D20-01/D20-09 and actual route confirmation. **Important:** The approved wording does not resolve the required `{{trackingUrl}}` variable. Do not silently remove that variable, invent a tracking URL, or claim the displayed draft is ready for Meta submission. Tracking-link placement and destination remain unresolved under D20-05-E. |
| **D20-05-F — Customer acceptance/proceeding semantics** | **NOT DECIDED**. Do not invent a new acceptance workflow. |
| **Boundaries / non-approval** | Documentation/wording/formatting decision capture only. **Not** an implementation authorization, **not** Meta approval, **not** template submission/enablement/send authorization, **not** legal/compliance approval. D20-05 is **not fully approved**; B/D/E/F remain NOT DECIDED. Any registry/template/payload change requires separate BLB-21 authorization. BLB-21 remains **NOT AUTHORIZED**. |

### D20-06 — Date/Time Display Convention

| Field | Record |
|---|---|
| **Decision** | Adopt one consistent customer-facing date/time convention. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Approver** | Project Owner (explicit approval in BLB-20N conversation) |
| **Evidence reference** | BLB-20N conversation decision capture (2026-11-22); BLB-20M proposal/evidence (`docs/client-handover/BLB-20M-D20-06-DATE-TIME-TIMEZONE-DECISION-PROPOSAL.md`); this register update is documentation-only. |
| **D20-06-A — Date format** | **APPROVED:** `DD MMM YYYY`. Example: `25 Dec 2026`. |
| **D20-06-B — Time format** | **APPROVED:** 12-hour format with AM/PM. Example: `04:30 PM`. |
| **D20-06-C — Timezone convention** | **APPROVED:** IST (India Standard Time). Customer-facing examples must use IST when the displayed time represents Indian Standard Time. Do **not** claim that named-zone runtime conversion using `Asia/Kolkata` has already been implemented. |
| **D20-06-D — Scope** | **APPROVED:** Customer-facing order schedule notifications; custom cake quote notifications; reschedule requested, accepted, and rejected notifications. Apply wherever the relevant WhatsApp payload actually contains date/time information. **Important:** `order_received` and `order_confirmed` currently do not carry schedule fields per BLB-20M evidence; do not add new template variables or alter template semantics. Do not invent schedule information. Preserve delivery time ranges where the underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. |
| **D20-06-E — Storage/display rule** | **APPROVED:** Retain existing storage unchanged. Convention concerns customer-facing display formatting only. Do not normalize/migrate/change stored `scheduledDate`, `scheduledTime`, `proposedDeliveryDate`, or `proposedDeliveryTime` fields in this milestone. Any future formatting implementation requires separate **BLB-21** implementation authorization and compatibility review. |
| **D20-06-F — Reschedule UTC inconsistency** | **Implementation prerequisite (recorded):** Known reschedule acceptance UTC formatting inconsistency documented in BLB-20M must be resolved and verified through a separately authorized implementation before customer-facing reschedule date/time formatting is treated as reliable. This approval does **not** authorize that implementation. |
| **Current evidence (preserved)** | Order `scheduledDate/scheduledTime` are stored as strings and passed through as-is. Custom-cake proposal stores `proposedDeliveryDate` (`YYYY-MM-DD`) and `proposedDeliveryTime` string. Slot parsing/custom-cake conversion use fixed `+05:30` offset logic; customer-facing display formatting is not standardized in WhatsApp payloads. Reschedule acceptance currently writes UTC ISO date/`HH:MM:SS` into `scheduledDate/scheduledTime` (inconsistency). |
| **Boundaries / non-approval** | Documentation/formatting decision only. **Not** an implementation authorization, **not** Meta approval, **not** template submission/enablement/send authorization, **not** legal/compliance approval. BLB-21 remains **NOT AUTHORIZED**. |

### D20-07 — Customer Alternative-Time Request

| Field | Record |
|---|---|
| **Decision** | Clarify semantics/payload for customer alternative-time request vs admin proposal/responses. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Approver** | Project Owner (explicit approval in BLB-20P conversation) |
| **Evidence reference** | BLB-20P decision capture (2026-11-22); BLB-20O proposal/evidence (`docs/client-handover/BLB-20O-D20-07-CUSTOMER-ALTERNATIVE-TIME-REQUEST-DECISION-PROPOSAL.md`); documentation-only. |
| **D20-07-A — Schedule displayed** | **APPROVED:** Show the customer's requested alternative date/time only. |
| **D20-07-B — Review status** | **APPROVED:** Explicitly state that the bakery will review the request and confirm whether the requested alternative is available. |
| **D20-07-C — Existing schedule** | **APPROVED:** Do not display the old schedule in this notification. Clearly state that the existing schedule remains unchanged until the bakery confirms the change. |
| **D20-07-D — Implementation prerequisites** | **APPROVED (prerequisites recorded):** Before implementation, ensure reliable alternative-slot data is available, apply the approved D20-06 date/time convention, update the template registry and payload mapping, and complete appropriate testing under separate implementation authorization. |
| **Approved customer-facing message** | **APPROVED CONTENT — NOT IMPLEMENTED**<br><br>Hello {{customerName}},<br><br>We received your request to change the scheduled time for order {{orderNumber}}.<br><br>Requested alternative: {{requestedAlternativeDateTime}}<br><br>Our team at S.V. Sweets & Bakers will review your request and let you know whether this alternative is available.<br><br>Please note that your existing schedule remains unchanged until we confirm the change.<br><br>Track your order: {{trackingUrl}} |
| **Variable / formatting note** | `{{requestedAlternativeDateTime}}` is a proposed template variable; **not yet confirmed as available** in current notification registry/payload. Format per D20-06: `DD MMM YYYY`, 12-hour AM/PM, IST. Preserve ranges only when the underlying value is a range. Do **not** append a second IST suffix if the formatted value already includes it. Do **not** imply the alternative has been accepted or confirmed. |
| **Implementation authorization** | **NOT GRANTED**. Any registry/payload/mapping/template/code/test change requires separate BLB-21 authorization. |
| **Current evidence (preserved)** | `requestAlternativeSlot` stores `customerAlternativeSlot/note`, emits `RESCHEDULE_REQUESTED`; current WhatsApp mapping uses existing `order.scheduledDate/scheduledTime` (mismatch) and template/registry remain NOT_SUBMITTED/enabled:false/fail-closed. |

### D20-08 — Admin Reschedule Proposal

| Field | Record |
|---|---|
| **Decision** | Decide whether to introduce a WhatsApp notification for admin-initiated reschedule proposals (`RESCHEDULE_PROPOSED` flow), and capture required sub-decisions before any implementation. |
| **Status** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** |
| **D20-08-A — Trigger WhatsApp notification?** | **APPROVED BY PROJECT OWNER — Option B (2026-11-22).** Decision: Introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "I explicitly select Option B for D20-08-A. Please prepare the documentation-only owner decision capture prompt. Do not authorize implementation." |
| **D20-08-B — Proposed-slot information/variables** | **APPROVED BY PROJECT OWNER — Option A (2026-11-22).** Decision: Use one formatted `{{proposedSchedule}}` variable to communicate the proposed schedule in the dedicated admin-initiated reschedule WhatsApp notification. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "For D20-08-B, I select Option A. Please prepare the decision review and documentation-only owner decision capture workflow. Do not authorize implementation." Approved meaning: the value must follow D20-06 — Date `DD MMM YYYY`; Time 12-hour AM/PM; Timezone IST; preserve a source-provided time range if one exists; do not invent a time range when the source provides a single time; do not append IST twice. Example: `25 Dec 2026, 10:00 AM IST`. **`{{proposedSchedule}}` is an owner-approved proposed variable, not an existing registered or mapped WhatsApp payload variable.** |
| **D20-08-C — Customer instruction/response mechanism** | **APPROVED BY PROJECT OWNER — Option B (2026-11-22).** Decision: Instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. Do not direct customers to the public tracking page as a response mechanism; do not invent a WhatsApp button, direct acceptance link, or unverified specific contact channel. Approver: Project Owner. Evidence: Explicit owner instruction (2026-11-22): "I approve D20-08-C as Option B — instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. D20-08-E (exact customer-facing wording) remains NOT DECIDED. D20-08-D (expiry/deadline mention) remains NOT DECIDED. D20-08-F (implementation prerequisites acknowledgement) remains NOT DECIDED. This approval is for the owner decision only. Documentation-only capture is authorized. No source changes, template activation, Meta submission, message sending, or implementation authorization. BLB-21 remains NOT AUTHORIZED. Approval date: 2026-11-22." |
| **D20-08-D — Response deadline/expiry communication** | **APPROVED BY PROJECT OWNER — Option C (2026-11-22).** Decision: The customer-facing WhatsApp notification must not mention an exact proposal expiry date or time, a relative response deadline, a response-window duration, or a countdown/deadline warning. Instead, the notification should instruct the customer to contact S.V. Sweets & Bakers to discuss the proposed schedule. No expiry-related template variable is required for this approved decision. This decision does not change the application's existing proposal expiry behaviour. Approver: Project Owner. Approval date: 2026-11-22. Evidence: Explicit owner instruction in BLB-23D (2026-11-22). This decision does not authorize implementation, template activation, Meta submission, UAT, production deployment, or message sending. |
| **D20-08-E — Exact customer-facing wording** | **NOT DECIDED**. Draft wording remains draft only; not approved. |
| **D20-08-F — Implementation prerequisites acknowledgement** | **NOT DECIDED**. Acknowledgement, if later given, does not authorize execution. |
| **Current evidence** | `RESCHEDULE_PROPOSED` exists in order status/model/controller flow. Admin proposal emits `STATUS_CHANGED` with status `RESCHEDULE_PROPOSED`; no WhatsApp template/registry mapping in `customerOrderNotifications.ts`, `notificationOutboxService.ts`, or `whatsappTemplateRegistry.ts`. Existing reschedule WhatsApp payloads use existing order schedule fields and must not be reused to communicate a newly proposed schedule incorrectly. BLB-20R/20S captured investigation and owner-review worksheet. BLB-20W/20X reviewed D20-08-C; owner selected Option B (2026-11-22). BLB-23A reviewed D20-08-D expiry behavior; owner selected Option C (2026-11-22): no expiry/deadline/countdown/response-window wording in WhatsApp notification; existing expiry enforcement unchanged. |
| **Boundary / non-authorization** | D20-08-A/B/C/D approvals record **decision direction/content-contract intent only** (dedicated template; single formatted `{{proposedSchedule}}` variable with D20-06 formatting; generic contact S.V. Sweets & Bakers instruction, no tracking-page response mechanism/button/direct acceptance link/unverified specific channel; no expiry/deadline/countdown/response-window wording in WhatsApp notification; existing expiry enforcement unchanged). They do **not** approve exact wording, template registry/outbox implementation, payload mapping, date/time formatting implementation, order scheduling/storage changes, admin/customer API changes, Meta submission/approval, legal/compliance approval, or production delivery. `{{proposedSchedule}}` remains a proposed variable, not an existing registered/mapped WhatsApp payload variable. **BLB-21 remains NOT AUTHORIZED.** |
| **Approval recorded?** | **Partial.** D20-08-A (Option B, 2026-11-22, Project Owner), D20-08-B (Option A, 2026-11-22, Project Owner), D20-08-C (Option B, 2026-11-22, Project Owner), and D20-08-D (Option C, 2026-11-22, Project Owner) approved. D20-08-E/F remain NOT DECIDED; D20-08 overall is not fully approved. |

### D20-09 — Custom-Cake Tracking URL

| Field | Record |
|---|---|
| **Decision** | Choose custom-cake notification destination. |
| **Status** | **NOT DECIDED** |
| **Current evidence** | Current notifications use `${base}/account/custom-cake-requests` (list page). Specific detail route exists: `app/account/custom-cake-requests/[orderId]/page.tsx`. Notification payload currently does not construct a request-specific detail URL. |
| **Options** | (A) Existing custom-cake request list page — simpler, already used, less specific. (B) Specific request detail destination — more specific UX; requires payload/URL construction and owner confirmation of identifier/route behavior. |
| **Recommendation** | Owner chooses based on UX and security/access expectations. Any URL/route/payload change requires separate authorization; confirm production domain first (D20-01). |
| **Approval recorded?** | No. No routes/URLs changed. |

---

## 3. Decision Status Summary

| Decision | Status | Approval recorded |
|---|---|---|
| D20-01 Production domain | **NOT DECIDED / EXTERNAL CONFIRMATION REQUIRED** | No |
| D20-02 Payment amount formatting | **APPROVED BY PROJECT OWNER** | Yes — BLB-20C conversation (2026-11-21), documentation/format only; not implemented/live/Meta-approved |
| D20-03 Customer-friendly payment methods | **APPROVED BY PROJECT OWNER** | Yes — BLB-20F conversation (2026-11-21), explicit "yes giveee" approving all three labels; documentation/wording only; not implemented/live/Meta-approved |
| D20-04 Order confirmation wording | **APPROVED BY PROJECT OWNER** | Yes — BLB-20I conversation (2026-11-21), explicit "approved add emoji"; remove `{{status}}`, use approved customer-friendly message with 🎉✅📦❤️; documentation/wording only; not implemented/live/Meta-approved |
| D20-05 Custom-cake quote formatting | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** | Partial — D20-05-A and D20-05-C approved by Project Owner (2026-11-21, BLB-20L); D20-05-D resolved through approved D20-06 convention (2026-11-22, BLB-20N); D20-05-B/E/F NOT DECIDED |
| D20-06 Date/time display convention | **APPROVED BY PROJECT OWNER** | Yes — BLB-20N (2026-11-22), documentation/formatting only; not implemented/live/Meta-approved |
| D20-07 Customer alternative-time request | **APPROVED BY PROJECT OWNER** | Yes — BLB-20P (2026-11-22), documentation/content only; implementation NOT GRANTED; not implemented/live/Meta-approved |
| D20-08 Admin reschedule proposal | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** | Partial — D20-08-A approved (Option B, 2026-11-22, Project Owner); D20-08-B approved (Option A, 2026-11-22, Project Owner, single formatted `{{proposedSchedule}}` per D20-06; proposed var not registered/mapped); D20-08-C approved (Option B, 2026-11-22, Project Owner, generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link/unverified specific channel); D20-08-D approved (Option C, 2026-11-22, Project Owner, no expiry/deadline/countdown/response-window wording in WhatsApp notification; existing expiry enforcement unchanged; no expiry variable required); D20-08-E/F NOT DECIDED; no implementation/Meta/legal approval |
| D20-09 Custom-cake tracking URL | **NOT DECIDED** | No |

---

## 4. Proposed BLB-21 Implementation Scope (Future — Separate Explicit Authorization Required)

**BLB-21 is NOT authorized by this register.** If/when owner decisions and required approvals are obtained, a separately authorized BLB-21 may scope only the explicitly approved items below:

| Candidate change | Depends on | Notes |
|---|---|---|
| Payment amount currency formatting | D20-02 (approved format), W01 legal, separate BLB-21 implementation authorization | Implement approved ₹ / Indian grouping / 2-decimal format; describe value as order amount (not gateway-captured/settled unless separately verified). D20-03 remains separately undecided. |
| Payment method label mapping | D20-03 (labels approved), separate BLB-21 implementation authorization | Map `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store` in customer-facing notification payload/template; do not change internal payment values/processing/business logic. |
| Order confirmation status wording | D20-04 (approved wording), separate BLB-21 implementation authorization | Remove internal `{{status}}` from order confirmation template; use approved customer-friendly message with 🎉✅📦❤️ and retain `{{customerName}}`/`{{orderNumber}}`; align registry/template/payload. |
| Quote formatting/completeness guard | D20-05, D20-06 | Ensure quote-prepared payload has complete formatted values; fail closed on incomplete data. |
| Customer alternative-time payload correction | D20-07 | Communicate requested alternative slot; revise template/registry/payload/mapping as approved. |
| Optional reschedule-proposed notification | D20-08 | Add registry/outbox/controller mapping only if explicitly approved. |
| Custom-cake tracking destination | D20-01, D20-09 | Use approved destination; update URL construction/template variables only as needed. |
| Date/time formatting normalization | D20-06 | Apply consistent approved display format across affected templates. |

**BLB-21 preconditions:** explicit owner decisions recorded; W01 legal/compliance written approval; Meta submission plan/approval path; no unapproved template enablement; fresh verification after code changes; no DB/provider/deploy/release actions without separate authorization.

---

## 5. Legal / Meta / External Approval Blockers

| Gate | Status | Evidence / note |
|---|---|---|
| W01 written legal/compliance validation | **NOT RECEIVED** | BLB-09B recorded business-policy APPROVE WITH CONDITIONS only; BLB-10A confirms legal/compliance approval not received/verified. |
| Meta template approval | **NOT RECEIVED** | All 18 registered templates NOT_SUBMITTED/disabled; no Meta submission or approval evidence. |
| D-14 infrastructure/operations evidence | **NOT RECEIVED** | BLB-10A/11A: missing hosting/security/backup/rollback/monitoring/ownership evidence. |
| D-16/D-17/D-18 UAT dependencies | **UNRESOLVED** | UAT readiness/sign-off/isolated data/env authorizations not complete. |
| Group 5 execution authorization | **0/13 granted; 13/13 DEFER** | BLB-09B decision register unchanged. |
| D-19 Production release | **NO-GO** | No production release authorization. |

---

## 6. UAT and Production Authorization Blockers

- No BLB-20 decision creates execution authorization.
- No local UAT, DB precheck/index creation, provider testing, template submission, template enablement, message sending, deployment, or production release is authorized.
- Any future execution requires separate, explicit, scope-specific authorization with prerequisites, named operator/approver/date where applicable.

---

## 7. Updated Project Readiness Conclusion

**Project status remains NOT READY / NO-GO.**

BLB-20 provides a decision register only. **D20-02, D20-03, D20-04, D20-06, and D20-07 are APPROVED BY PROJECT OWNER as documentation/wording/formatting decisions (not implemented, not enabled, not Meta-approved, not live; D20-07 implementation NOT GRANTED). D20-05 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED (D20-05-A and D20-05-C approved by Project Owner 2026-11-21, BLB-20L; D20-05-D resolved through approved D20-06 convention 2026-11-22, BLB-20N; D20-05-B/E/F NOT DECIDED). D20-08 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED (D20-08-A approved by Project Owner 2026-11-22, BLB-20U, Option B: dedicated WhatsApp notification template for admin-initiated reschedule proposals; D20-08-B approved by Project Owner 2026-11-22, BLB-20V, Option A: single formatted `{{proposedSchedule}}` variable per D20-06; `{{proposedSchedule}}` proposed/not registered/mapped; D20-08-C approved by Project Owner 2026-11-22, Option B: generic contact S.V. Sweets & Bakers instruction, no tracking-page response mechanism/button/direct acceptance link/unverified specific channel; D20-08-D approved by Project Owner 2026-11-22, Option C: no expiry/deadline/countdown/response-window wording in WhatsApp notification; existing expiry enforcement unchanged; no expiry variable required; D20-08-E/F NOT DECIDED; no exact wording/registry-outbox/payload mapping/Meta/legal/production approval; BLB-21 NOT AUTHORIZED).** The remaining two content/payload decisions (D20-01, D20-09) remain unresolved. **Overall count: 5 fully approved / 2 partially approved / 2 not decided.** Legal/compliance, Meta approval, D-14 evidence, UAT readiness/acceptance, Group 5 authorizations, and production release gates remain unresolved. No WhatsApp template is approved, enabled, or sent.

---

## 8. Next Milestone Recommendation

**BLB-20A/next owner decision capture — documentation/control:** obtain explicit project-owner responses for remaining unresolved decisions (D20-01, D20-05-B/E/F, D20-08-E/F, D20-09), plus OD-01–OD-05 where still applicable. Record decisions with status, approver, date, conditions, and evidence references. 

After decisions/approvals are recorded: **BLB-21 (separately authorized implementation)** only for approved source/payload/template-registry changes; followed by fresh verification, legal/Meta submission/approval workflow, and separately authorized UAT/provider validation. No production release until all required gates are satisfied and D-19 explicit authorization is granted.

---

## Appendix A — Files Inspected (Read-Only)

- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md`
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md`
- `docs/client-handover/BLB-09B/02-W01-BUSINESS-POLICY-DECISION.md`
- `docs/client-handover/BLB-10A/02-W01-LEGAL-COMPLIANCE-EVIDENCE-REGISTER.md`
- `docs/client-handover/BLB-11A-PROJECT-OWNER-RESOLUTION-PLAN.md`
- Code evidence previously inspected in BLB-19 (registry, notification services, outbox, order/payment/custom-cake controllers/models, frontend route presence) was used as current-state reference; no code was modified in BLB-20.

## Appendix B — Execution Confirmation

- **No application source/test/config/env/dependency files modified.**
- **No DB/provider/API/Meta/template enablement/message sending/email/SMS/OTP/Razorpay/Cloudinary operations performed.**
- **No deployment/release/Git mutation performed.**
- **Existing staged/unstaged/untracked files preserved.**