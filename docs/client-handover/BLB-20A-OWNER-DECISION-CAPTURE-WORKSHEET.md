# BLB-20A — WhatsApp Owner Decision Capture & Readiness Gate

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Previous milestone:** BLB-20 complete  
**Date prepared:** 21 November 2026  
**Mode:** Documentation-only (read-only inspection + new worksheet)  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

This worksheet captures the nine outstanding WhatsApp notification decisions identified in BLB-20 for project-owner review. It is a decision-capture artifact only. **No decisions have been implemented or inferred by this document.** D20-02, D20-03, D20-04, D20-06, and D20-07 have been recorded as **APPROVED BY PROJECT OWNER** based on explicit owner approvals (BLB-20C/20F/20I 2026-11-21, BLB-20N/20P 2026-11-22); these are documentation/wording/formatting decisions only and are **not** implementation, Meta, legal/compliance, template enablement, or send authorization. **D20-05 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-05-A and D20-05-C approved 2026-11-21, BLB-20L; D20-05-D resolved through approved D20-06 convention 2026-11-22, BLB-20N; D20-05-B/E/F NOT DECIDED). **D20-08 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-08-A approved 2026-11-22, BLB-20U; D20-08-B approved 2026-11-22, BLB-20V; D20-08-C approved 2026-11-22, Option B — generic contact S.V. Sweets & Bakers, no tracking-page response mechanism/button/direct acceptance link; D20-08-D/E/F NOT DECIDED). All other decisions remain **NOT DECIDED**. **Overall count: 5 fully approved / 2 partially approved / 2 not decided.** Recommendations are technical/business drafting aids and are **not** approvals.

**Current state:** All 18 registered WhatsApp templates remain `NOT_SUBMITTED` / `enabled:false` / fail-closed. No Meta template approval, no legal/compliance written approval, no real WhatsApp delivery, and no production release authorization exists. BLB-21 implementation is **NOT authorized** by BLB-20A.

**Owner instruction:** For each decision below, select one allowed status, record the actual decision, approval date, conditions, and evidence reference. If no decision is supplied, leave status as `NOT DECIDED`.

---

## 2. How to Complete This Worksheet

| Field | Owner completes |
|---|---|
| **Owner's actual decision** | State the selected option/decision clearly. |
| **Status** | Use only: `NOT DECIDED`, `APPROVED BY PROJECT OWNER`, `APPROVED WITH CONDITIONS`, `DEFERRED`, `REJECTED`, `EXTERNAL CONFIRMATION REQUIRED`. |
| **Approval date** | Enter date only when an actual decision is made (YYYY-MM-DD). |
| **Conditions** | List any conditions, constraints, or follow-up requirements. |
| **Evidence reference** | Link/email/doc/ticket/meeting record supporting the decision. |

**Rules:** Do not treat recommendations as approved. Business-policy decisions do not equal legal approval or execution authorization. Any source/config/template change requires separate explicit authorization (proposed BLB-21).

---

## 3. Nine Decision Records

### D20-01 — Production Domain

| Field | Content |
|---|---|
| **Decision ID** | D20-01 |
| **Question requiring approval** | What is the canonical customer-facing production domain, and which custom-cake destination should WhatsApp notifications use? |
| **Available options** | (A) Confirm canonical production domain (specify exact domain). (B) Confirm order tracking destination: `${canonical-domain}/track?order=<orderNumber>`. (C) Custom-cake destination: existing list page `${canonical-domain}/account/custom-cake-requests` OR specific detail page `${canonical-domain}/account/custom-cake-requests/[requestId]` (confirm identifier/route). (D) Defer / require external confirmation. |
| **Technical evidence** | No written canonical production domain evidence found in BLB-18/19/09B/10A/11A. Current code fallback: `NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"` in `customerOrderNotifications.ts` and `customCakeNotifications.ts`. Order track route exists: `app/track/page.tsx`. Custom-cake list exists: `app/account/custom-cake-requests/page.tsx`; detail exists: `app/account/custom-cake-requests/[orderId]/page.tsx` but notification currently links to list only. |
| **Recommendation** | Confirm canonical production domain in writing before Meta submission; confirm domain is business-controlled and HTTPS/Meta-compatible; choose custom-cake list vs detail based on UX/access expectations. |
| **Owner's actual decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Conditions** |  |
| **Evidence reference** |  |

**Evidence required for closure:** Written owner confirmation of canonical domain; domain control/ownership confirmation; selected order/custom-cake destination; Meta domain/URL compatibility confirmation where applicable.

---

### D20-02 — Payment Amount Formatting

| Field | Content |
|---|---|
| **Decision ID** | D20-02 |
| **Question requiring approval** | How should payment amount be displayed in WhatsApp templates, and what does the amount represent? |
| **Available options** | (A) `INR 1,250.00` prefix format. (B) `₹1,250.00` symbol format. (C) Other approved format (specify). Decimal precision: 2 decimals or other (specify). Amount description: “order total amount recorded on the order” / “payment received amount” / other owner/legal-approved wording (specify). |
| **Technical evidence** | `payment_received` currently sends `order.totalAmount.toFixed(2)` (no currency symbol) and raw `order.paymentMethod` (`customerOrderNotifications.ts`). `Order.totalAmount` is the order total recorded on the order; current code does **not** present this as an independently verified gateway-captured settlement amount. |
| **Recommendation** | Use explicit currency (A or B), consistent decimals, and owner/legal-approved wording that does not misstate gateway capture/settlement semantics. |
| **Owner's actual decision** | **APPROVED BY PROJECT OWNER (BLB-20C, 2026-11-21).** Approved customer-facing format: "Payment received successfully" / "Hello {{customerName}}," / thank-you message / Payment details: `Order number: {{orderNumber}}`, `Amount paid: ₹{{amount}}`, `Payment method: {{paymentMethod}}` / processing update / "Thank you for choosing **S.V. Sweets & Bakers!**". Rules: Indian Rupees (₹); Indian number grouping (e.g. `₹1,25,000.00`); two decimal places consistently; customer-friendly payment method labels (`COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`); concise/professional/customer-friendly. **Amount accuracy:** existing implementation uses `order.totalAmount.toFixed(2)` and this value must be described as the **order amount**; do **not** claim gateway-captured/settled amount unless separately verified. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Conditions** | Documentation/format decision only. Not implementation, Meta approval, template submission/enablement/send authorization, or legal/compliance approval. D20-03 is separately recorded as **APPROVED BY PROJECT OWNER** (BLB-20F, 2026-11-21); no other decision status changed by this D20-02 entry. BLB-21 remains **NOT AUTHORIZED**. |
| **Evidence reference** | BLB-20C conversation — explicit project owner approval (2026-11-21). |

**Evidence required for closure:** Completed by owner approval above (format/precision/wording recorded). Separate implementation/legal/Meta authorizations remain required before any live use.

---

### D20-03 — Payment Method Labels

| Field | Content |
|---|---|
| **Decision ID** | D20-03 |
| **Question requiring approval** | Approve customer-facing payment method labels for WhatsApp templates. |
| **Available options** | (A) Approve proposed mappings: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`. (B) Modify labels (specify). (C) Defer/reject. |
| **Technical evidence** | `Order.paymentMethod` enum: `COD | ONLINE | PAY_AT_STORE` (`backend/src/models/Order.ts`). `customerOrderNotifications.ts` currently passes raw enum value to `payment_received` template. |
| **Recommendation** | Approve Option A or provide owner-approved customer-friendly labels; avoid exposing raw internal enums in customer-facing messages. |
| **Owner's actual decision** | **APPROVED BY PROJECT OWNER (BLB-20F, 2026-11-21).** Explicit owner reply "yes giveee" in direct response to approving all three proposed labels. Approved labels: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Conditions** | Documentation/wording decision only. Labels are for customer-facing WhatsApp notifications and do **not** change internal payment values, payment processing, or business logic. Not implementation, Meta approval, template submission/enablement/send authorization, or legal/compliance approval. BLB-21 remains **NOT AUTHORIZED**. |
| **Evidence reference** | BLB-20F conversation — explicit project owner approval: "yes giveee" (2026-11-21), in direct response to approval question for all three labels. |

**Evidence required for closure:** Completed by owner approval above (all three labels explicitly approved). Separate implementation/legal/Meta authorizations remain required before any live use.

---

### D20-04 — Order Confirmation Wording

| Field | Content |
|---|---|
| **Decision ID** | D20-04 |
| **Question requiring approval** | Should the `order_confirmed` WhatsApp template remove the raw internal status variable or map it to a customer-friendly label? |
| **Available options** | (A) Remove raw status variable from customer-facing message/template; adjust registry/payload/template accordingly (separate authorized implementation). (B) Keep variable but map internal enums to customer-friendly labels before send (separate authorized implementation). (C) Other approved wording (specify). |
| **Technical evidence** | Registry `order_confirmed` requires `customerName, orderNumber, status, trackingUrl`. `customerOrderNotifications.ts` defaults `status` to `order.orderStatus`; STATUS_CHANGED caller in `orderController.ts` passes 4 args, so raw internal enum (e.g., `CONFIRMED`) is used. |
| **Recommendation** | Prefer Option A for clarity, or Option B if variable retention is needed. Do not expose raw internal enum values to customers. |
| **Owner's actual decision** | **APPROVED BY PROJECT OWNER (BLB-20I, 2026-11-21).** Explicit owner reply "approved add emoji" in direct response to proposal to remove internal `{{status}}` and use customer-friendly order confirmation message. Approved: remove `{{status}}` completely; use approved customer-friendly wording; include emojis 🎉, ✅, 📦, ❤️; retain `{{customerName}}` and `{{orderNumber}}`. Approved message: "🎉 **Your order is confirmed!** / Hello {{customerName}}, / Great news! Your order **#{{orderNumber}}** has been confirmed. ✅ / 📦 We'll keep you updated as your order progresses. / Thank you for choosing **S.V. Sweets & Bakers!** ❤️" |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-21 |
| **Conditions** | Documentation/wording decision only. Not implementation, Meta approval, template submission/enablement/send authorization, or legal/compliance approval. Any registry/template/payload change requires separate BLB-21 authorization. BLB-21 remains **NOT AUTHORIZED**. |
| **Evidence reference** | BLB-20I conversation — explicit project owner approval: "approved add emoji" (2026-11-21). |

**Evidence required for closure:** Completed by owner approval above (removal of `{{status}}` and approved wording recorded). Separate implementation/legal/Meta authorizations remain required before any live use.

---

### D20-05 — Custom-Cake Quote Formatting

| Field | Content |
|---|---|
| **Decision ID** | D20-05 |
| **Question requiring approval** | What are the approved currency/formatting/inclusion rules and wording for custom-cake quote WhatsApp notifications? |
| **Available options** | Currency: `INR`/`₹`/other. Decimal precision: 0/2/other. Tax: included / excluded / not stated (specify exact wording; no assumption). Delivery charge: included / excluded / not stated (specify exact wording; no assumption). Date format/time format/timezone: specify. Customer review link: list page or specific detail page (align with D20-09). |
| **Technical evidence** | `custom_cake_quote_prepared` requires `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl`. `proposeProposalSchema` requires positive `proposedPrice`, `YYYY-MM-DD` date, required time string. Notifier has empty-string fallback but pre-enqueue/outbox validation is fail-closed. No evidence that tax/delivery are included in quoted price unless owner/legal confirms. |
| **Recommendation** | Approve explicit wording for price inclusiveness/exclusions. Require complete formatted quote fields before future enablement. Do not imply tax/delivery inclusion without written evidence. |
| **Proposal package** | `docs/client-handover/BLB-20K-D20-05-CUSTOM-CAKE-QUOTE-DECISION-PROPOSAL.md` (owner review/proposal; D20-05-A/C approved by BLB-20L, remaining sub-decisions NOT DECIDED). |
| **Owner's actual decision** | **PARTIALLY APPROVED (2026-11-21, BLB-20L).**<br><br>**D20-05-A — APPROVED BY PROJECT OWNER:** Currency Indian Rupees (₹); two decimal places; Indian number grouping; example `₹1,25,000.00`; customer-facing quote line `Proposed quote: ₹{{proposedPrice}}`. Formatting decision only; source-code formatting not implemented.<br><br>**D20-05-C — APPROVED BY PROJECT OWNER:** Approved wording (preserve exactly):<br>“Your custom cake quote is ready! 🎂<br><br>Hello {{customerName}},<br><br>We've prepared a quote for your custom cake request.<br><br>Request reference: {{referenceNumber}}<br><br>Proposed quote: ₹{{proposedPrice}}<br><br>Proposed delivery date: {{proposedDeliveryDate}}<br><br>Proposed delivery time: {{proposedDeliveryTime}}<br><br>Please review your quote and contact us if you would like to proceed or discuss any changes.<br><br>Thank you for choosing S.V. Sweets & Bakers! ❤️”<br><br>Preserve wording, emojis, and variable names exactly. Wording approval does not resolve required `{{trackingUrl}}` variable; do not silently remove it, invent a tracking URL, or claim draft is ready for Meta submission. Tracking-link placement/destination unresolved under D20-05-E.<br><br>**D20-05-B — NOT DECIDED:** No assumption tax/delivery included or excluded.<br>**D20-05-D — RESOLVED THROUGH APPROVED D20-06 CONVENTION (2026-11-22, BLB-20N):** Date `DD MMM YYYY` (e.g., `25 Dec 2026`); Time 12-hour AM/PM (e.g., `04:30 PM`); Timezone IST when displayed time represents IST; preserve delivery time ranges where underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. Display convention only; storage unchanged; no implementation authorized.<br>**D20-05-E — NOT DECIDED:** Depends on D20-01/D20-09 and actual route confirmation; `{{trackingUrl}}` unresolved.<br>**D20-05-F — NOT DECIDED:** No new acceptance workflow invented. |
| **Status** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** |
| **Approval date** | 2026-11-21 (D20-05-A, D20-05-C only) |
| **Conditions** | Documentation-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED. D20-05-B/D/E/F remain NOT DECIDED; D20-05 not fully approved. `{{trackingUrl}}` unresolved — do not remove/invent/claim Meta-ready. |
| **Evidence reference** | BLB-20L conversation (2026-11-21), explicit Project Owner approval of proposed quote message and INR price formatting. |

**Evidence required for closure (remaining):** D20-05-B tax/delivery inclusion wording (business/legal confirmation); D20-05-E tracking link placement/destination and actual route confirmation (D20-01/D20-09), including how required `{{trackingUrl}}` is handled; D20-05-F acceptance/proceeding semantics; legal/compliance confirmation where needed. (D20-05-D resolved through approved D20-06 convention, 2026-11-22.)

---

### D20-06 — Date/Time Display Convention

| Field | Content |
|---|---|
| **Decision ID** | D20-06 |
| **Question requiring approval** | What consistent date/time/timezone display convention should be used across WhatsApp notifications? |
| **Available options** | Date: `DD MMM YYYY` / `YYYY-MM-DD` / other (specify). Time: `hh:mm AM/PM` / `HH:mm` / other (specify). Timezone: `IST` / none / other (specify). Apply consistently to: order received, order confirmation/schedule, quote prepared, reschedule notifications. |
| **Technical evidence** | Order `scheduledDate/scheduledTime` are stored/passed as strings. Custom-cake proposal uses `proposedDeliveryDate` (`YYYY-MM-DD`) and `proposedDeliveryTime` string. Custom-cake conversion/slot parsing use fixed `+05:30` offset logic; customer-facing display formatting is not standardized. Reschedule acceptance currently writes UTC ISO date/`HH:MM:SS` into `scheduledDate/scheduledTime`. |
| **Recommendation** | Use a clear, consistent customer-facing format (proposed: `DD MMM YYYY`, `hh:mm AM/PM IST`) only after confirming application timezone behavior and owner preference. |
| **Proposal package** | `docs/client-handover/BLB-20M-D20-06-DATE-TIME-TIMEZONE-DECISION-PROPOSAL.md` (proposal/evidence; owner approved D20-06 on 2026-11-22, BLB-20N). |
| **Owner's actual decision** | **APPROVED BY PROJECT OWNER (2026-11-22, BLB-20N).** D20-06-A: `DD MMM YYYY` (e.g., `25 Dec 2026`). D20-06-B: 12-hour AM/PM (e.g., `04:30 PM`). D20-06-C: IST (India Standard Time) when displayed time represents IST; do not claim named-zone `Asia/Kolkata` runtime conversion already implemented. D20-06-D: scope = customer-facing order schedule notifications, custom cake quote notifications, reschedule requested/accepted/rejected notifications; apply where payload actually contains date/time; `order_received`/`order_confirmed` currently do not carry schedule fields - do not add new variables/alter semantics/invent schedule; preserve delivery time ranges where underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. D20-06-E: retain existing storage unchanged; display formatting only; no storage normalization/migration in this milestone; future implementation requires separate BLB-21 authorization + compatibility review. D20-06-F: reschedule acceptance UTC formatting inconsistency is implementation prerequisite; must be resolved/verified through separately authorized implementation before reschedule date/time formatting treated reliable; approval does not authorize implementation. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Conditions** | Documentation-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED. Storage unchanged; D20-06-F UTC inconsistency remains implementation prerequisite. |
| **Evidence reference** | BLB-20N conversation (2026-11-22); BLB-20M proposal/evidence. |

**Evidence required for closure:** None for decision capture. Future implementation closure requires separate BLB-21 authorization, compatibility review, UTC reschedule fix verification, and Meta/legal/UAT gates as applicable.

---

### D20-07 — Customer Alternative-Time Request

| Field | Content |
|---|---|
| **Decision ID** | D20-07 |
| **Question requiring approval** | How should the customer alternative-time request WhatsApp notification be semantically defined and which schedule should it communicate? |
| **Available options** | (A) Requested alternative only (if reliably available/formatted; pending review, not confirmed). (B) Both existing confirmed schedule and requested alternative with explicit labels. (C) Acknowledgement without schedule details. (D) Another source-justified option (specify). |
| **Technical evidence** | `requestAlternativeSlot` (`orderController.ts`) stores `customerAlternativeSlot/note`, emits `RESCHEDULE_REQUESTED`; current WhatsApp mapping uses existing `order.scheduledDate/scheduledTime` (mismatch). Registry/template NOT_SUBMITTED/enabled:false/fail-closed. |
| **Proposal package** | `docs/client-handover/BLB-20O-D20-07-CUSTOMER-ALTERNATIVE-TIME-REQUEST-DECISION-PROPOSAL.md` (proposal/evidence; owner approved D20-07 2026-11-22, BLB-20P). |
| **Owner's actual decision** | **APPROVED BY PROJECT OWNER (2026-11-22, BLB-20P).** D20-07-A: Show the customer's requested alternative date/time only. D20-07-B: Explicitly state that the bakery will review the request and confirm whether the requested alternative is available. D20-07-C: Do not display the old schedule in this notification; clearly state that the existing schedule remains unchanged until the bakery confirms the change. D20-07-D: Before implementation, ensure reliable alternative-slot data is available, apply the approved D20-06 date/time convention, update the template registry and payload mapping, and complete appropriate testing under separate implementation authorization. |
| **Approved customer-facing message** | **APPROVED CONTENT — NOT IMPLEMENTED**<br><br>Hello {{customerName}},<br><br>We received your request to change the scheduled time for order {{orderNumber}}.<br><br>Requested alternative: {{requestedAlternativeDateTime}}<br><br>Our team at S.V. Sweets & Bakers will review your request and let you know whether this alternative is available.<br><br>Please note that your existing schedule remains unchanged until we confirm the change.<br><br>Track your order: {{trackingUrl}}<br><br>`{{requestedAlternativeDateTime}}` is a proposed template variable, not yet confirmed available in current notification registry/payload. Format per D20-06: DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only when underlying value is a range; do not append a second IST suffix if already included; do not imply alternative accepted/confirmed. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Conditions** | Documentation/content decision only. **Implementation authorization NOT GRANTED**. No registry/payload/mapping/template/code/test change without separate BLB-21 authorization. All 18 templates remain NOT_SUBMITTED/enabled:false/empty metaTemplateId. |
| **Evidence reference** | BLB-20P conversation (2026-11-22); BLB-20O proposal/evidence. |

**Implementation prerequisites (recorded, not authorized):** reliable alternative-slot data; D20-06 formatting; template registry/payload mapping updates; appropriate testing under separate implementation authorization.

---

### D20-08 — Admin Reschedule Proposal

| Field | Content |
|---|---|
| **Decision ID** | D20-08 |
| **Question requiring approval** | Should customers receive a separate WhatsApp notification when admin proposes a new reschedule time (`RESCHEDULE_PROPOSED`), and what sub-decisions are required before any implementation? |
| **Available options** | D20-08-A: (A) No WhatsApp / retain current behavior; (B) Dedicated D20-08 WhatsApp template; (C) Defer. D20-08-B/C/D/E/F cover proposed-slot variables, customer instruction, expiry/deadline, exact wording, and prerequisite acknowledgement (see BLB-20S/20R). |
| **Technical evidence** | `RESCHEDULE_PROPOSED` exists in model/controller flow. Admin proposal emits `STATUS_CHANGED` with status `RESCHEDULE_PROPOSED`; **no WhatsApp registry/outbox mapping exists**. Existing reschedule payloads use existing order schedule fields and must not be reused for newly proposed schedule. BLB-20R/20S provide investigation and decision worksheet. |
| **Owner's actual decision** | **D20-08-A — APPROVED BY PROJECT OWNER (Option B, 2026-11-22).** Decision: Introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "I explicitly select Option B for D20-08-A. Please prepare the documentation-only owner decision capture prompt. Do not authorize implementation." <br><br>**D20-08-B — APPROVED BY PROJECT OWNER (Option A, 2026-11-22).** Decision: Use one formatted `{{proposedSchedule}}` variable to communicate the proposed schedule in the dedicated admin-initiated reschedule WhatsApp notification. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "For D20-08-B, I select Option A. Please prepare the decision review and documentation-only owner decision capture workflow. Do not authorize implementation." Approved meaning: value must follow D20-06 — Date `DD MMM YYYY`; Time 12-hour AM/PM; Timezone IST; preserve a source-provided time range if one exists; do not invent a time range when the source provides a single time; do not append IST twice. Example: `25 Dec 2026, 10:00 AM IST`. `{{proposedSchedule}}` is an owner-approved proposed variable, not an existing registered or mapped WhatsApp payload variable. <br><br>**D20-08-C — APPROVED BY PROJECT OWNER (Option B, 2026-11-22).** Decision: Instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. Do not direct customers to public tracking page as a response mechanism; do not invent WhatsApp button/direct acceptance link/unverified specific contact channel. Evidence: explicit owner instruction 2026-11-22; documentation-only capture authorized; BLB-21 NOT AUTHORIZED. <br><br>**D20-08-D/E/F — NOT DECIDED.** |
| **Status** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** |
| **Approval date** | 2026-11-22 (D20-08-A, D20-08-B) |
| **Conditions** | Documentation-only decision capture. D20-08-A approves direction only (dedicated template). D20-08-B approves single formatted `{{proposedSchedule}}` variable contract intent per D20-06 (proposed variable, not registered/mapped). Neither approves exact wording, tracking URL/customer response instructions, template registry/outbox implementation, payload mapping, date/time formatting implementation, order scheduling/storage changes, admin/customer API changes, Meta submission/approval, legal/compliance approval, or production delivery. **BLB-21 remains NOT AUTHORIZED.** D20-08-C approved (Option B, 2026-11-22); D20-08-D/E/F remain NOT DECIDED; D20-08 overall is not fully approved. |
| **Evidence reference** | BLB-20U capture; explicit owner instruction in current conversation (2026-11-22); BLB-20R/20S evidence. |

**Evidence required for closure:** D20-08-D expiry/deadline decision; D20-08-E exact approved wording; D20-08-F prerequisite acknowledgement (does not authorize execution); separate BLB-21 implementation authorization before any implementation; Meta/legal/compliance approvals as applicable.

---

### D20-09 — Custom-Cake Tracking URL

| Field | Content |
|---|---|
| **Decision ID** | D20-09 |
| **Question requiring approval** | Should custom-cake WhatsApp notifications link to the existing request list page or a specific request detail page? |
| **Available options** | (A) Existing list page `${base}/account/custom-cake-requests` (current behavior). (B) Specific request detail page `${base}/account/custom-cake-requests/[requestId]` (requires authorized payload/URL change and access confirmation). (C) Other approved destination (specify). |
| **Technical evidence** | Current custom-cake notification URL is list page only. Detail route exists in frontend (`app/account/custom-cake-requests/[orderId]/page.tsx`), but notification payload does not currently include request-specific detail URL. Must confirm authentication/access behavior and correct identifier before recommending route change. |
| **Recommendation** | Choose based on UX and access/security expectations. If detail page selected, confirm authorized customer can access only their own request and that URL construction uses correct identifier. Depends on D20-01 domain confirmation. |
| **Owner's actual decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Conditions** |  |
| **Evidence reference** |  |

**Evidence required for closure:** Owner-selected destination; access/authorization confirmation; canonical domain confirmation; implementation authorization if changed.

---

## 4. Evidence Required Summary

| Decision | Minimum evidence required to close |
|---|---|
| D20-01 | Written canonical domain confirmation, domain control evidence, selected tracking destinations, Meta URL compatibility check. |
| D20-02 | **CLOSED for format decision (2026-11-21, BLB-20C).** Approved: ₹, Indian grouping, 2 decimals, approved message format, order-amount wording. Separate implementation/legal/Meta authorization still required. |
| D20-03 | **CLOSED for wording decision (2026-11-21, BLB-20F).** All three labels explicitly approved: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`. Separate implementation/legal/Meta authorization still required. |
| D20-04 | **CLOSED for wording decision (2026-11-21, BLB-20I).** Approved: remove `{{status}}`; use approved customer-friendly message with 🎉✅📦❤️; retain `{{customerName}}` and `{{orderNumber}}`. Separate implementation/legal/Meta authorization still required. |
| D20-05 | **Partial approval recorded (BLB-20L, 2026-11-21):** D20-05-A currency/precision and D20-05-C wording approved. Remaining closure evidence: D20-05-B tax/delivery inclusion wording (business/legal confirmation), D20-05-D date/time format/timezone (D20-06), D20-05-E tracking link placement/destination + `{{trackingUrl}}` handling (D20-01/D20-09/actual route confirmation), D20-05-F acceptance/proceeding semantics; legal/compliance confirmation where needed. |
| D20-06 | Approved date/time/timezone convention and application timezone confirmation. |
| D20-07 | **Approved (BLB-20P, 2026-11-22):** D20-07-A/B/C/D + exact wording approved as content. Implementation prerequisites recorded (reliable alternative-slot data, D20-06 formatting, registry/payload mapping, testing under separate authorization); implementation authorization NOT GRANTED. |
| D20-08 | **Partial (BLB-20U/20V, 2026-11-22):** D20-08-A APPROVED (Option B, dedicated WhatsApp notification template for admin-initiated reschedule proposals). D20-08-B APPROVED (Option A, single formatted `{{proposedSchedule}}` per D20-06; proposed variable not registered/mapped). D20-08-C APPROVED (Option B, 2026-11-22, generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link/unverified specific channel). D20-08-D/E/F NOT DECIDED. No exact wording/expiry mention/registry-outbox/payload mapping/Meta/legal/production approval; BLB-21 NOT AUTHORIZED. |
| D20-09 | Selected destination, access/authorization confirmation, canonical domain dependency resolved. |

---

## 5. Outstanding Legal and Meta Blockers (Carry Forward — Unchanged)

| Blocker | Status | Notes |
|---|---|---|
| W01 legal/compliance written validation | **NOT RECEIVED** | BLB-09B business-policy APPROVE WITH CONDITIONS is not legal approval. Legal/compliance validation/approval still required before implementation/release. |
| Meta template approval | **NOT RECEIVED** | All 18 registered templates remain `NOT_SUBMITTED` / `enabled:false`. No Meta submission/approval evidence. |
| D-14 infrastructure/operations evidence | **NOT RECEIVED** | Hosting/security/backup/rollback/monitoring/ownership evidence missing. |
| D-16 / D-17 / D-18 | **UNRESOLVED** | UAT readiness, acceptance authority, isolated data/env, and execution authorizations unresolved. |
| Group 5 execution authorizations | **13/13 DEFER; 0/13 granted** | No execution authorization granted. |
| D-19 production release | **NO-GO** | No production release authorization. |
| BLB-11A OD-01–OD-05 | **UNRESOLVED** | Unless actual written evidence is supplied; none recorded here. |

**Distinction:** Project-owner business decisions (this worksheet) ≠ legal/compliance approval ≠ Meta approval ≠ execution authorization ≠ UAT/production authorization.

---

## 6. Implementation Dependencies (BLB-21 Not Authorized)

| Dependency | Required before BLB-21 implementation |
|---|---|
| D20-01..D20-09 owner decisions | Explicit owner status/decision/date/conditions/evidence for each applicable decision. |
| W01 legal/compliance | Written legal/compliance validation/approval received. |
| Meta readiness | Approved template submission plan; no enablement of unapproved templates. |
| Scope control | Separate explicit BLB-21 authorization with exact files/changes/tests/verification boundaries. |
| Verification | Fresh typecheck/build/tests after any authorized code change. |
| UAT/provider/release gates | D-14/D-16-D-18/Group 5/D-19 remain blocking until separately resolved/authorized. |

**This worksheet does not authorize BLB-21 implementation.**

---

## 7. Final Owner Sign-Off Section

> **Do not sign/date this section unless actual decisions have been reviewed and explicitly made.** No false signatures, dates, approvals, or evidence references.

| Field | Entry |
|---|---|
| **Project owner name** |  |
| **Role/title** |  |
| **Review date** |  |
| **D20-01 status/decision** | NOT DECIDED / (enter actual decision) |
| **D20-02 status/decision** | **APPROVED BY PROJECT OWNER** (2026-11-21, BLB-20C) — ₹ / Indian grouping / 2 decimals / approved payment-received format; amount described as order amount; docs-only, not implemented/live/Meta-approved; D20-03 remains NOT DECIDED |
| **D20-03 status/decision** | **APPROVED BY PROJECT OWNER** (2026-11-21, BLB-20F) — COD→Cash on delivery, ONLINE→Online payment, PAY_AT_STORE→Pay at store; docs-only, not implemented/live/Meta-approved |
| **D20-04 status/decision** | **APPROVED BY PROJECT OWNER** (2026-11-21, BLB-20I) — remove `{{status}}`; approved customer-friendly confirmation message with 🎉✅📦❤️; retain `{{customerName}}`/`{{orderNumber}}`; docs-only, not implemented/live/Meta-approved |
| **D20-05 status/decision** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (2026-11-21, BLB-20L; D20-05-D resolved through approved D20-06 convention 2026-11-22, BLB-20N). D20-05-A APPROVED: INR ₹, 2 decimals, Indian grouping, example `₹1,25,000.00`, `Proposed quote: ₹{{proposedPrice}}`. D20-05-C APPROVED: exact approved quote wording with 🎂/❤️ and variables `{{customerName}}`, `{{referenceNumber}}`, `{{proposedPrice}}`, `{{proposedDeliveryDate}}`, `{{proposedDeliveryTime}}` preserved; `{{trackingUrl}}` unresolved (do not remove/invent/claim Meta-ready). D20-05-D RESOLVED THROUGH APPROVED D20-06 CONVENTION: `DD MMM YYYY`, 12-hour AM/PM, IST, preserve ranges where underlying value is range. D20-05-B/E/F NOT DECIDED. Docs-only; not implemented/Meta-approved/legal/template enablement/send; BLB-21 NOT AUTHORIZED. |
| **D20-06 status/decision** | **APPROVED BY PROJECT OWNER** (2026-11-22, BLB-20N). D20-06-A `DD MMM YYYY`; D20-06-B 12-hour AM/PM; D20-06-C IST (do not claim `Asia/Kolkata` runtime conversion already implemented); D20-06-D approved scope (order schedule/custom cake quote/reschedule requested-accepted-rejected where payload contains date/time; no new vars/no invented schedule; preserve ranges); D20-06-E storage unchanged/display-only; D20-06-F UTC reschedule inconsistency is implementation prerequisite. Docs-only; not implemented/Meta-approved/legal/template enablement/send; BLB-21 NOT AUTHORIZED. |
| **D20-07 status/decision** | **APPROVED BY PROJECT OWNER** (2026-11-22, BLB-20P). D20-07-A requested alternative only; D20-07-B bakery review/confirm availability stated; D20-07-C old schedule not shown, existing schedule unchanged until confirmed; D20-07-D implementation prerequisites recorded. Exact wording APPROVED CONTENT — NOT IMPLEMENTED. Implementation authorization NOT GRANTED. |
| **D20-08 status/decision** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (2026-11-22, BLB-20U/20V). D20-08-A APPROVED BY PROJECT OWNER: Option B — introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. D20-08-B APPROVED BY PROJECT OWNER: Option A — single formatted `{{proposedSchedule}}` variable per D20-06 (DD MMM YYYY, 12-hour AM/PM, IST; preserve source-provided range; do not invent range; do not append IST twice; example `25 Dec 2026, 10:00 AM IST`); proposed variable not registered/mapped. D20-08-C APPROVED (Option B, 2026-11-22, generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link/unverified specific channel). D20-08-D/E/F NOT DECIDED. No exact wording/expiry mention/registry-outbox/payload mapping/Meta/legal/production approval; BLB-21 NOT AUTHORIZED. |
| **D20-09 status/decision** | NOT DECIDED / (enter actual decision) |
| **Conditions / comments** |  |
| **Evidence references** |  |
| **Legal/compliance approval confirmed?** | NO — NOT RECEIVED (separate evidence required) |
| **Meta approval confirmed?** | NO — NOT RECEIVED (separate evidence required) |
| **BLB-21 implementation authorized?** | NO — NOT AUTHORIZED by this worksheet |
| **Signature** |  |

---

## Appendix A — Files Inspected (Read-Only)

- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md` (primary reference)
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md` (context reference)
- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md` (context reference)
- `docs/client-handover/BLB-09B/02-W01-BUSINESS-POLICY-DECISION.md` (blocker carry-forward)
- `docs/client-handover/BLB-10A/02-W01-LEGAL-COMPLIANCE-EVIDENCE-REGISTER.md` (blocker carry-forward)
- `docs/client-handover/BLB-11A-PROJECT-OWNER-RESOLUTION-PLAN.md` (blocker carry-forward)

## Appendix B — Execution Confirmation

- **No application source/test/config/env/dependency files modified.**
- **No DB/provider/API/Meta/template enablement/message sending/email/SMS/OTP/Razorpay/Cloudinary operations performed.**
- **No deployment/release/Git mutation performed.**
- **Existing staged/unstaged/untracked files preserved.**
- **No decisions approved/invented on behalf of project owner.**