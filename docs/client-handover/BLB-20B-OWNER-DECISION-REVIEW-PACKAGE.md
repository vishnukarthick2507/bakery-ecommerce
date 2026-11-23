# BLB-20B — WhatsApp Owner Decision Review & Approval Capture

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Previous milestone:** BLB-20A complete  
**Date prepared:** 21 November 2026  
**Mode:** Documentation-only (read-only inspection + new review package)  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

This package helps the project owner review the nine outstanding WhatsApp notification decisions (D20-01–D20-09) with plain-English questions, current technical behavior, options, trade-offs, dependencies, and evidence requirements. It is **not** an approval record and **not** an implementation authorization.

**No owner decisions are invented by this document.** D20-02, D20-03, D20-04, D20-06, and D20-07 have been recorded as **APPROVED BY PROJECT OWNER** based on explicit owner approvals (BLB-20C/20F/20I 2026-11-21, BLB-20N/20P 2026-11-22; documentation/wording/formatting only). **D20-05 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-05-A and D20-05-C approved 2026-11-21, BLB-20L; D20-05-D resolved through approved D20-06 convention 2026-11-22, BLB-20N; D20-05-B/E/F NOT DECIDED). **D20-08 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-08-A approved 2026-11-22, BLB-20U; D20-08-B approved 2026-11-22, BLB-20V; D20-08-C approved 2026-11-22, Option B — generic contact S.V. Sweets & Bakers, no tracking-page response mechanism/button/direct acceptance link; D20-08-D/E/F NOT DECIDED). All other decision statuses remain `NOT DECIDED` unless and until the project owner explicitly records them with date, conditions, and evidence reference. **Overall count: 5 fully approved / 2 partially approved / 2 not decided.**

**Current blockers remain unchanged:** W01 legal/compliance written validation NOT RECEIVED; Meta template approval NOT RECEIVED; D-14 NOT RECEIVED; D-16/D-17/D-18 UNRESOLVED; Group 5 13/13 DEFER (0/13 granted); D-19 NO-GO; BLB-11A OD-01–OD-05 UNRESOLVED unless actual evidence exists. All 18 registered WhatsApp templates remain `NOT_SUBMITTED` / `enabled:false` / fail-closed.

---

## 2. Nine Owner Decision Reviews

### D20-01 — Canonical Production Domain & Domain Ownership

| Field | Content |
|---|---|
| **Plain-English question** | What is the official website/domain customers should be sent to in WhatsApp messages, and can the business confirm it controls that domain? |
| **Existing technical behaviour** | Order notifications build tracking URL as `${NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/track?order=<orderNumber>`. Custom-cake notifications build `${base}/account/custom-cake-requests`. The Vercel fallback is a code default, not written owner confirmation. |
| **Available options** | (A) Confirm canonical production domain (exact HTTPS domain) and domain ownership/control. (B) Confirm temporary/staging domain is not for customer templates. (C) Defer until domain/hosting decision is finalized. |
| **Recommended option & reasoning** | **A**. Meta templates and customer trust require a stable, business-controlled domain. Submitting templates with an unconfirmed fallback domain risks wrong links, rework, and policy/brand issues. |
| **Consequences** | **A:** Enables consistent URL review but may require env/config confirmation before enablement. **B/C:** Blocks confident template submission/readiness; existing fallback remains unsuitable for approved production use. |
| **Evidence/confirmation required** | Written owner confirmation of canonical domain; domain ownership/control evidence; HTTPS certificate/hosting confirmation; confirmation of `NEXT_PUBLIC_SITE_URL` production value. |
| **Owner decision field** | NOT DECIDED |
| **Conditions** |  |
| **Approval evidence** |  |

### D20-02 — Payment Amount Formatting & Accurate Wording

| Field | Content |
|---|---|
| **Plain-English question** | How should the payment amount appear in WhatsApp messages, and what exactly does that amount represent? |
| **Existing technical behaviour** | `payment_received` currently sends `order.totalAmount.toFixed(2)` with no currency symbol. Current value is the order total amount recorded on the order. It is not presented by code as an independently verified gateway-captured settlement amount. |
| **Available options** | (A) `INR 1,250.00` (prefix). (B) `₹1,250.00` (symbol). (C) Other format. Also decide wording: “Amount received for order…” / “Order total…” etc., with legal/owner confirmation. |
| **Recommended option & reasoning** | **A or B with explicit currency + 2 decimals**. Recommended wording should be careful and factual, e.g. amount received for order total as recorded, only if owner/legal confirms. Avoid settlement/capture claims. |
| **Consequences** | **A/B:** Clear for Indian customers; requires payload/template formatting decision and possibly source change. **Ambiguous/no currency:** risk of customer confusion. **Incorrect semantics:** legal/customer-trust risk. |
| **Evidence/confirmation required** | Owner-selected format; decimal precision; approved amount semantics wording; legal/compliance confirmation if required. |
| **Owner decision field** | **APPROVED BY PROJECT OWNER (BLB-20C, 2026-11-21).** Approved format: "Payment received successfully" with customer-friendly message, `Order number: {{orderNumber}}`, `Amount paid: ₹{{amount}}`, `Payment method: {{paymentMethod}}`, S.V. Sweets & Bakers closing. Rules: ₹ currency; Indian number grouping (e.g. `₹1,25,000.00`); two decimal places; customer-friendly payment labels (`COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`); concise/professional/customer-friendly. **Amount accuracy:** value must be described as **order amount**; do **not** claim gateway-captured/settled amount unless separately verified. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Conditions** | Documentation/format decision only. Not implementation, Meta approval, template submission/enablement/send, or legal/compliance approval. D20-03 is separately recorded as **APPROVED BY PROJECT OWNER** (BLB-20F, 2026-11-21); no other decision status changed by this D20-02 entry. BLB-21 remains **NOT AUTHORIZED**. |
| **Approval evidence** | BLB-20C conversation — explicit project owner approval (2026-11-21). |

### D20-03 — Customer-Friendly Payment Method Labels

| Field | Content |
|---|---|
| **Plain-English question** | How should payment methods be described to customers in WhatsApp messages? |
| **Existing technical behaviour** | Raw enum `order.paymentMethod` is sent: `COD`, `ONLINE`, `PAY_AT_STORE`. |
| **Available options** | (A) Approve mappings: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`. (B) Custom labels. (C) Defer. |
| **Recommended option & reasoning** | **A**. These are clear, customer-friendly, and map directly to existing enum values. |
| **Consequences** | **A:** Improves clarity; requires authorized source mapping change. **Raw enums:** confusing/unprofessional. **Custom labels:** acceptable if owner-approved and unambiguous. |
| **Evidence/confirmation required** | Owner-approved label mapping; confirmation no other customer-visible payment methods need labels. |
| **Owner decision field** | **APPROVED BY PROJECT OWNER (BLB-20F, 2026-11-21).** Explicit owner reply "yes giveee" in direct response to approving all three proposed labels. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approved labels** | `COD → Cash on delivery`; `ONLINE → Online payment`; `PAY_AT_STORE → Pay at store`. |
| **Conditions** | Documentation/wording decision only. Labels are for customer-facing WhatsApp notifications and do **not** change internal payment values, payment processing, or business logic. Not implementation, Meta approval, template submission/enablement/send, or legal/compliance approval. BLB-21 remains **NOT AUTHORIZED**. |
| **Approval evidence** | BLB-20F conversation — explicit project owner approval: "yes giveee" (2026-11-21), in direct response to approval question for all three labels. |

### D20-04 — Order Confirmation Status Wording

| Field | Content |
|---|---|
| **Plain-English question** | Should the order confirmation WhatsApp message show an internal status value, or should it use plain customer wording? |
| **Existing technical behaviour** | `order_confirmed` template includes `status` variable. Code passes raw `order.orderStatus` (internal enum, e.g. `CONFIRMED`). |
| **Available options** | (A) Remove status variable and use plain confirmation wording. (B) Keep variable but map internal enums to friendly labels. (C) Other wording. |
| **Recommended option & reasoning** | **A** preferred for simplicity and lower risk of enum leakage; **B** acceptable if Meta/template design needs variable. Either option must avoid raw internal enum exposure. |
| **Consequences** | **A:** Cleaner message; requires registry/template/payload alignment change. **B:** Flexible but needs mapping maintenance. **Raw enum:** poor customer experience and potential confusion. |
| **Evidence/confirmation required** | Owner-selected option; approved final message wording; acknowledgment of registry/payload impact. |
| **Owner decision field** | **APPROVED BY PROJECT OWNER (BLB-20I, 2026-11-21).** Explicit owner reply "approved add emoji" in direct response to proposal. Approved: remove internal `{{status}}` completely; use approved customer-friendly wording with emojis 🎉, ✅, 📦, ❤️; retain `{{customerName}}` and `{{orderNumber}}`. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approved message** | 🎉 **Your order is confirmed!** — Hello {{customerName}}, Great news! Your order **#{{orderNumber}}** has been confirmed. ✅ 📦 We'll keep you updated as your order progresses. Thank you for choosing **S.V. Sweets & Bakers!** ❤️ |
| **Conditions** | Documentation/wording decision only. Not implementation, Meta approval, template submission/enablement/send, or legal/compliance approval. Any registry/template/payload change requires separate BLB-21 authorization. BLB-21 remains **NOT AUTHORIZED**. |
| **Approval evidence** | BLB-20I conversation — explicit project owner approval: "approved add emoji" (2026-11-21). |

### D20-05 — Custom-Cake Quote Currency, Precision, Tax & Delivery Wording

| Field | Content |
|---|---|
| **Plain-English question** | How should custom-cake quote price and delivery/time details be worded so customers are not misled? |
| **Existing technical behaviour** | Quote template sends `proposedPrice`, `proposedDeliveryDate`, `proposedDeliveryTime` (plus `customerName`, `referenceNumber`, `trackingUrl`). Price is numeric; notifier converts missing values to empty strings but registry/outbox fail closed. No evidence in code/docs that tax or delivery charges are included/excluded. |
| **Available options** | Currency `INR`/`₹`; decimals 0/2; tax included/excluded/not stated (explicit wording); delivery included/excluded/not stated (explicit wording); date/time format; review link destination. |
| **Recommended option & reasoning** | Use explicit currency and approved precision. **Do not imply tax/delivery inclusion or exclusion without written business/legal evidence.** Require complete quote fields before future enablement. |
| **Proposal package** | `docs/client-handover/BLB-20K-D20-05-CUSTOM-CAKE-QUOTE-DECISION-PROPOSAL.md` (owner review/proposal; D20-05-A/C approved by BLB-20L, remaining sub-decisions NOT DECIDED). |
| **Consequences** | **Clear wording:** reduces disputes/confusion. **Assumed inclusion/exclusion:** customer/legal risk. **Missing formatting rules:** inconsistent templates and Meta submission rework. |
| **Evidence/confirmation required** | Remaining closure: D20-05-B tax/delivery inclusion wording (business/legal confirmation); D20-05-E tracking link placement/destination and `{{trackingUrl}}` handling (D20-01/D20-09/actual route confirmation); D20-05-F acceptance/proceeding semantics; legal/compliance confirmation where needed. D20-05-D resolved through approved D20-06 convention (2026-11-22, BLB-20N). |
| **Owner decision field** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED**. D20-05-A APPROVED: INR ₹, two decimals, Indian number grouping, example `₹1,25,000.00`, line `Proposed quote: ₹{{proposedPrice}}` (formatting decision only; not implemented). D20-05-C APPROVED: exact approved wording preserved: “Your custom cake quote is ready! 🎂 Hello {{customerName}}, We've prepared a quote for your custom cake request. Request reference: {{referenceNumber}} Proposed quote: ₹{{proposedPrice}} Proposed delivery date: {{proposedDeliveryDate}} Proposed delivery time: {{proposedDeliveryTime}} Please review your quote and contact us if you would like to proceed or discuss any changes. Thank you for choosing S.V. Sweets & Bakers! ❤️” (preserve wording/emojis/variables exactly; `{{trackingUrl}}` unresolved — do not remove/invent/claim Meta-ready). D20-05-D RESOLVED THROUGH APPROVED D20-06 CONVENTION (2026-11-22, BLB-20N): `DD MMM YYYY`, 12-hour AM/PM, IST, preserve ranges where underlying value is range; display-only, storage unchanged, no implementation authorized. D20-05-B/E/F NOT DECIDED. |
| **Conditions** | Documentation-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED. D20-05 not fully approved. |
| **Approval evidence** | BLB-20L conversation (2026-11-21), explicit Project Owner approval of proposed custom cake quote message and INR price formatting. |

### D20-06 — Consistent Date/Time & Verified Timezone

| Field | Content |
|---|---|
| **Plain-English question** | What date/time format should all WhatsApp notifications use, and should timezone be shown? |
| **Existing technical behaviour** | Order `scheduledDate/scheduledTime` passed through as stored strings. Custom-cake uses `YYYY-MM-DD` and time string. Slot parsing/custom-cake conversion use fixed `+05:30` offset; customer-facing display format is not standardized. Reschedule acceptance currently writes UTC ISO date/`HH:MM:SS` into `scheduledDate/scheduledTime` (known inconsistency). |
| **Available options** | Date: `DD MMM YYYY` or other. Time: `hh:mm AM/PM` or 24h. Timezone: `IST`, explicit local timezone, or none. Apply consistently across order/quote/reschedule templates. |
| **Recommended option & reasoning** | **`DD MMM YYYY` + `hh:mm AM/PM`**, with timezone label only after confirming application timezone behavior. Consistency reduces confusion. |
| **Proposal package** | `docs/client-handover/BLB-20M-D20-06-DATE-TIME-TIMEZONE-DECISION-PROPOSAL.md` (proposal/evidence; owner approved D20-06 2026-11-22, BLB-20N). |
| **Consequences** | **Consistent format:** better UX and easier template approval. **Unconfirmed timezone:** risk of wrong-time communication. **Mixed formats:** confusing and unprofessional. **UTC reschedule overwrite:** can display wrong schedule until fixed by authorized implementation. |
| **Evidence/confirmation required** | Future implementation closure: separate BLB-21 authorization, compatibility review, reschedule acceptance UTC inconsistency fix/verification, and Meta/legal/UAT gates as applicable. |
| **Owner decision field** | **APPROVED BY PROJECT OWNER (2026-11-22, BLB-20N).** D20-06-A `DD MMM YYYY` (e.g., `25 Dec 2026`); D20-06-B 12-hour AM/PM (e.g., `04:30 PM`); D20-06-C IST when displayed time represents IST (do not claim named-zone `Asia/Kolkata` runtime conversion already implemented); D20-06-D scope = customer-facing order schedule notifications, custom cake quote notifications, reschedule requested/accepted/rejected notifications, apply where payload actually contains date/time; `order_received`/`order_confirmed` currently do not carry schedule fields - do not add new variables/alter semantics/invent schedule; preserve delivery time ranges where underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa; D20-06-E storage unchanged, display-only, no normalization/migration in this milestone, future implementation requires separate BLB-21 authorization + compatibility review; D20-06-F UTC reschedule inconsistency is implementation prerequisite, approval does not authorize implementation. |
| **Conditions** | Documentation-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED. Storage unchanged. |
| **Approval evidence** | BLB-20N conversation (2026-11-22); BLB-20M proposal/evidence. |

### D20-07 — Customer-Requested Alternative Slot Payload

| Field | Content |
|---|---|
| **Plain-English question** | When a customer asks for a different time, should the WhatsApp message show the time they requested, the old confirmed time, both with labels, or just an acknowledgement? |
| **Existing technical behaviour** | `requestAlternativeSlot` stores `customerAlternativeSlot/note`, emits `RESCHEDULE_REQUESTED`; current WhatsApp mapping uses existing `order.scheduledDate/scheduledTime` (mismatch). Registry/template NOT_SUBMITTED/enabled:false/fail-closed. |
| **Proposal package** | `docs/client-handover/BLB-20O-D20-07-CUSTOMER-ALTERNATIVE-TIME-REQUEST-DECISION-PROPOSAL.md` (proposal/evidence; owner approved D20-07 2026-11-22, BLB-20P). |
| **Owner decision field** | **APPROVED BY PROJECT OWNER (2026-11-22, BLB-20P).** D20-07-A: Show customer's requested alternative date/time only. D20-07-B: Explicitly state bakery will review request and confirm whether requested alternative is available. D20-07-C: Do not display old schedule; clearly state existing schedule remains unchanged until bakery confirms the change. D20-07-D: Before implementation, ensure reliable alternative-slot data is available, apply approved D20-06 date/time convention, update template registry and payload mapping, and complete appropriate testing under separate implementation authorization. |
| **Approved customer-facing message** | **APPROVED CONTENT — NOT IMPLEMENTED**<br><br>Hello {{customerName}},<br><br>We received your request to change the scheduled time for order {{orderNumber}}.<br><br>Requested alternative: {{requestedAlternativeDateTime}}<br><br>Our team at S.V. Sweets & Bakers will review your request and let you know whether this alternative is available.<br><br>Please note that your existing schedule remains unchanged until we confirm the change.<br><br>Track your order: {{trackingUrl}}<br><br>`{{requestedAlternativeDateTime}}` is a proposed template variable, not yet confirmed available in current notification registry/payload. Format per D20-06: DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only when underlying value is a range; do not append second IST suffix if already included; do not imply alternative accepted/confirmed. |
| **Conditions** | Documentation/content decision only. **Implementation authorization NOT GRANTED**. Separate BLB-21 authorization required for any registry/payload/mapping/template/code/test change. D20-08 is PARTIALLY APPROVED (D20-08-A approved Option B, 2026-11-22; D20-08-B approved Option A, 2026-11-22; D20-08-C approved Option B, 2026-11-22; D20-08-D/E/F remain NOT DECIDED); D20-08 overall not fully approved. |
| **Approval evidence** | BLB-20P conversation (2026-11-22); BLB-20O proposal/evidence. |

### D20-08 — Admin-Proposed Reschedule Notification

| Field | Content |
|---|---|
| **Plain-English question** | Should customers get a WhatsApp message when the bakery/admin proposes a new delivery/pickup time, and what details/wording/response instructions are approved? |
| **Existing technical behaviour** | `RESCHEDULE_PROPOSED` exists in order flow. Admin proposal emits STATUS_CHANGED with `RESCHEDULE_PROPOSED`, but there is **no WhatsApp template/registry/outbox mapping**. Existing reschedule payloads use existing schedule fields and must not be reused for newly proposed schedule. |
| **Sub-decisions** | D20-08-A trigger (A no WhatsApp / B dedicated template / C defer); D20-08-B proposed-slot variables; D20-08-C customer instruction; D20-08-D expiry/deadline; D20-08-E exact wording; D20-08-F prerequisite acknowledgement (no execution authorization). |
| **Owner decision field** | **D20-08-A — APPROVED BY PROJECT OWNER (Option B, 2026-11-22):** Introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "I explicitly select Option B for D20-08-A. Please prepare the documentation-only owner decision capture prompt. Do not authorize implementation." <br><br>**D20-08-B — APPROVED BY PROJECT OWNER (Option A, 2026-11-22):** Use one formatted `{{proposedSchedule}}` variable to communicate the proposed schedule in the dedicated admin-initiated reschedule WhatsApp notification. Approver: Project Owner. Evidence: Explicit owner instruction in current conversation: "For D20-08-B, I select Option A. Please prepare the decision review and documentation-only owner decision capture workflow. Do not authorize implementation." Approved meaning: D20-06 formatting — Date `DD MMM YYYY`; Time 12-hour AM/PM; Timezone IST; preserve a source-provided time range if one exists; do not invent a time range when the source provides a single time; do not append IST twice. Example: `25 Dec 2026, 10:00 AM IST`. `{{proposedSchedule}}` is an owner-approved proposed variable, not an existing registered or mapped WhatsApp payload variable. <br><br>**D20-08-C — APPROVED BY PROJECT OWNER (Option B, 2026-11-22):** Instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. No tracking-page response mechanism, no WhatsApp button/direct acceptance link, no unverified specific contact channel. Evidence: explicit owner instruction 2026-11-22; documentation-only capture authorized; BLB-21 NOT AUTHORIZED. <br><br>**D20-08-D/E/F — NOT DECIDED.** |
| **Status** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** |
| **Conditions** | Documentation-only decision capture. D20-08-A approves direction only (dedicated template). D20-08-B approves proposed variable contract intent only (single formatted `{{proposedSchedule}}` per D20-06; proposed/not registered/mapped). Neither approves exact wording, tracking URL/customer response instructions, template registry/outbox implementation, payload mapping, date/time formatting implementation, order scheduling/storage changes, admin/customer API changes, Meta submission/approval, legal/compliance approval, or production delivery. **BLB-21 remains NOT AUTHORIZED.** D20-08 overall is not fully approved. |
| **Approval evidence** | BLB-20U capture (2026-11-22, D20-08-A); BLB-20V capture (2026-11-22, D20-08-B); explicit owner instructions in current conversation; BLB-20R/20S evidence. |

### D20-09 — Custom-Cake List vs Specific Request Detail Destination

| Field | Content |
|---|---|
| **Plain-English question** | When customers click a custom-cake WhatsApp link, should they go to the general custom-cake requests list or the specific request details page? |
| **Existing technical behaviour** | Notifications currently link to `/account/custom-cake-requests` (list page). A detail route exists (`/account/custom-cake-requests/[orderId]`), but notifications do not construct a specific detail URL. |
| **Available options** | (A) Keep list page (current). (B) Use specific request detail page (requires authorized payload/URL change and access confirmation). (C) Other destination. |
| **Recommended option & reasoning** | **B preferred for UX if access is safe and identifier is correct**; **A acceptable as low-risk interim**. Do not change without confirming auth/access and correct route param. |
| **Consequences** | **A:** No code change; extra click for customer. **B:** Better UX; requires authorized implementation and security/access verification. **Wrong detail routing:** broken link or access confusion. |
| **Evidence/confirmation required** | Owner-selected destination; confirmation of customer auth/access behavior; canonical domain confirmation (D20-01); correct request identifier/route. |
| **Owner decision field** | NOT DECIDED |
| **Conditions** |  |
| **Approval evidence** |  |

---

## 3. Recommendations and Trade-offs (Summary)

| Decision | Recommended option | Key trade-off |
|---|---|---|
| D20-01 | Confirm canonical business-controlled domain | Stability/compliance vs possible environment/config follow-up |
| D20-02 | **APPROVED (format):** ₹, Indian grouping, 2 decimals; amount described as order amount (not gateway-captured/settled unless separately verified) | Format clarity achieved for decision record; implementation still requires separate BLB-21 authorization |
| D20-03 | **APPROVED (labels):** COD→Cash on delivery, ONLINE→Online payment, PAY_AT_STORE→Pay at store | Clarity achieved for decision record; implementation still requires separate BLB-21 authorization; internal values/logic unchanged |
| D20-04 | **APPROVED (wording):** remove `{{status}}`; approved customer-friendly confirmation message with 🎉✅📦❤️; retain `{{customerName}}`/`{{orderNumber}}` | Clarity achieved for decision record; implementation still requires separate BLB-21 authorization |
| D20-05 | **PARTIALLY APPROVED (A/C):** INR ₹ formatting and approved quote wording recorded; D20-05-B/D/E/F remain NOT DECIDED | Wording/format clarity gained for approved items vs unresolved tax/delivery, date/time, tracking URL placement, and acceptance semantics |
| D20-06 | **APPROVED (2026-11-22, BLB-20N):** `DD MMM YYYY`, 12-hour AM/PM, IST, approved scope, storage unchanged, UTC reschedule inconsistency as implementation prerequisite | Clarity gained for display convention vs implementation still requires separate BLB-21 authorization and UTC fix verification |
| D20-07 | **APPROVED (2026-11-22, BLB-20P):** Requested alternative only; pending review/availability confirmation stated; existing schedule unchanged until confirmed; exact wording APPROVED CONTENT — NOT IMPLEMENTED | Clarity gained vs implementation still requires separate BLB-21 authorization and D20-07-D prerequisites |
| D20-08 | **PARTIALLY APPROVED (2026-11-22, BLB-20U/20V):** D20-08-A Option B approved — dedicated WhatsApp notification template for admin-initiated reschedule proposals. D20-08-B Option A approved — single formatted `{{proposedSchedule}}` per D20-06 (proposed variable, not registered/mapped). D20-08-C APPROVED Option B (2026-11-22). D20-08-D/E/F NOT DECIDED. | Direction/variable-contract/response-instruction clarity gained vs exact wording/expiry/registry-outbox/payload mapping/Meta/legal/implementation still unresolved; BLB-21 NOT AUTHORIZED |
| D20-09 | Detail page if safe; list page acceptable interim | Better UX vs access/routing verification |

---

## 4. Decision Dependencies

| Decision | Can decide independently? | Depends on canonical domain (D20-01)? | Depends on timezone evidence? | Requires business/legal confirmation? | Requires source changes if approved? |
|---|---:|---:|---:|---:|---:|
| D20-01 | Yes | N/A | No | Business ownership/control confirmation | Possibly env/config only; template/docs updates later |
| D20-02 | Yes (decision recorded) | No | No | Business decision recorded; legal/compliance approval still separate | Yes, likely payload/template formatting (separate BLB-21 authorization required) |
| D20-03 | Yes (decision recorded) | No | No | Business decision recorded; legal/compliance approval still separate | Yes, label mapping in payload (separate BLB-21 authorization required) |
| D20-04 | Yes (decision recorded) | No | No | Business decision recorded; legal/compliance approval still separate | Yes, registry/template/payload adjustment (separate BLB-21 authorization required) |
| D20-05 | Partially (A/C approved 2026-11-21 BLB-20L; D20-05-D resolved through approved D20-06 convention 2026-11-22 BLB-20N; B/E/F NOT DECIDED) | Link destination may depend on D20-09 | Yes for date/time display (convention now approved) | **Yes** (tax/delivery inclusion wording; remaining semantics) | Possibly payload formatting/guards; template wording (separate BLB-21 authorization required) |
| D20-06 | Yes (decision recorded 2026-11-22, BLB-20N) | No | **Yes** (IST/fixed-offset behavior evidence; display must be truthful) | Owner decision recorded; legal/compliance approval still separate | Yes, formatting normalization in payload/templates (separate BLB-21 authorization required; UTC reschedule prerequisite) |
| D20-07 | Yes (decision recorded 2026-11-22, BLB-20P) | No | Proposed/requested time may use D20-06 format | Business decision recorded; legal/compliance approval still separate | **Yes** - payload/template/registry/mapping change (separate BLB-21 authorization required; implementation NOT GRANTED) |
| D20-08 | Partially (D20-08-A/B approved 2026-11-22; C-F pending) | Destination may depend on D20-01 | Proposed time uses D20-06 format per D20-08-B | **Yes** (legal/compliance/policy and workflow) | **Yes** if implementation separately authorized (BLB-21 NOT AUTHORIZED) |
| D20-09 | Partially | **Yes** (canonical base URL) | No | Business UX/access confirmation | Yes if detail page selected |

**Dependency notes:**
- **D20-01 and D20-09 are related but separate decisions.** Domain confirmation does not decide list vs detail; detail/list choice does not confirm canonical domain.
- A project-owner decision does **not** satisfy legal/compliance, Meta approval, UAT, or execution authorization.

---

## 5. BLB-21 Change-to-Decision Matrix (Proposed — NOT AUTHORIZED)

| Proposed source change | Decision ID(s) | Affected source areas (expected) | Expected behaviour after implementation | Required tests (if authorized) | Risks / regression areas | Separate authorization required |
|---|---|---|---|---|---|---|
| Format payment amount with approved currency/precision | D20-02 (format approved, 2026-11-21 BLB-20C), D20-06 | `backend/src/services/customerOrderNotifications.ts`, possibly shared formatter util, template registry/docs | `payment_received` sends owner-approved ₹ / Indian grouping / 2-decimal format; describes value as order amount (not gateway-captured/settled unless separately verified) | Unit/service tests for payment notification payload; outbox/template validation tests; snapshot/message expectation updates | Misleading amount semantics; formatting regressions; Meta variable sample mismatch | **Yes** (BLB-21 still NOT AUTHORIZED) |
| Map payment method enum to customer-friendly labels | D20-03 (labels approved, 2026-11-21 BLB-20F) | `customerOrderNotifications.ts`, possibly shared label map | `payment_received` sends approved labels: `COD → Cash on delivery`, `ONLINE → Online payment`, `PAY_AT_STORE → Pay at store`; internal payment values/processing/business logic unchanged | Payload mapping tests for all enum values; regression for unknown/future values | Incorrect label mapping; missed enum value; inconsistent copy | **Yes** (BLB-21 still NOT AUTHORIZED) |
| Remove raw status from order confirmation or map friendly label | D20-04 (wording approved, 2026-11-21 BLB-20I) | `customerOrderNotifications.ts`, `whatsappTemplateRegistry.ts`, `notificationOutboxService.ts` event/template expectations, BLB docs | `order_confirmed` uses approved customer-friendly wording with no `{{status}}`; retains `{{customerName}}`/`{{orderNumber}}`; template/payload/registry remain consistent | Template registry validation tests; order status notification tests; outbox STATUS_CHANGED mapping tests | Registry/outbox mismatch; Meta template variable count mismatch; status mapping drift | **Yes** (BLB-21 still NOT AUTHORIZED) |
| Standardize date/time formatting across notifications | D20-06 (approved 2026-11-22, BLB-20N) | `customerOrderNotifications.ts`, `customCakeNotifications.ts`, shared formatter | Dates/times rendered in approved consistent format/timezone label per D20-06-A/B/C/D; storage unchanged per D20-06-E | Unit tests for formatter; notification payload tests for order/reschedule/custom-cake | Timezone conversion errors; wrong customer schedule display; locale inconsistency; UTC reschedule overwrite (D20-06-F prerequisite) | **Yes** (BLB-21 still NOT AUTHORIZED) |
| Custom-cake quote formatting/completeness guard | D20-05, D20-06 | `customCakeNotifications.ts`, possibly `customCakeController.ts` guardrails, registry/docs | Quote-prepared notification includes complete, approved-formatted price/date/time; fail closed if incomplete | Custom-cake notification tests; controller proposal tests; outbox/registry validation tests | Blocking legitimate notifications; formatting errors; tax/delivery wording risk if unapproved | **Yes** |
| Correct customer alternative-time request payload | D20-07 (approved content 2026-11-22, BLB-20P; implementation NOT GRANTED) | `orderController.ts`, `customerOrderNotifications.ts`, `notificationOutboxService.ts`, `whatsappTemplateRegistry.ts`, docs | `order_reschedule_requested` communicates requested alternative only per approved D20-07-A/B/C wording; existing schedule unchanged until confirmed; D20-06 formatting | Reschedule flow tests; outbox mapping tests; template registry validation tests; regression for accept/reject/proposed | Wrong schedule communicated; breaking existing reschedule flows; idempotency regressions; variable/registry mismatch | **Yes** (BLB-21 still NOT AUTHORIZED) |
| Add admin reschedule-proposed notification (if fully approved/authorized) | D20-08 (A/B approved, C-F NOT DECIDED), D20-01, D20-06 | `customerOrderNotifications.ts`, `notificationOutboxService.ts`, `whatsappTemplateRegistry.ts`, `orderController.ts`, docs | Customers receive approved WhatsApp notification when admin proposes reschedule; fail closed until approved/enabled | Reschedule proposal tests; outbox mapping/validation tests; registry tests; no-send when unapproved | Unwanted notifications; wrong trigger timing; wrong schedule payload; consent/template gate regressions | **Yes** — separate BLB-21 authorization required; not currently authorized |
| Change custom-cake tracking URL to specific detail page (if approved) | D20-09, D20-01 | `customCakeNotifications.ts`, possibly route/helper, docs | Custom-cake WhatsApp links open approved specific request detail destination | URL construction tests; access/route smoke tests (authorized env); notification payload tests | Broken links; wrong identifier; unauthorized access confusion; domain mismatch | **Yes** |

**Matrix rule:** No row authorizes implementation. Each row requires separate explicit BLB-21 authorization, approved decision inputs, and fresh verification.

---

## 6. Legal / Meta / UAT / Production Blockers

| Blocker | Status | Impact |
|---|---|---|
| W01 written legal/compliance validation | **NOT RECEIVED** | Blocks compliant implementation confidence and WhatsApp readiness. |
| Meta template approval | **NOT RECEIVED** | Blocks template enablement/live WhatsApp sending. All 18 remain NOT_SUBMITTED/disabled/fail-closed. |
| D-14 infrastructure/operations evidence | **NOT RECEIVED** | Blocks production/ops readiness confidence. |
| D-16/D-17/D-18 UAT readiness/acceptance | **UNRESOLVED** | Blocks authorized UAT execution and acceptance closure. |
| Group 5 execution authorizations | **13/13 DEFER; 0/13 granted** | No implementation/UAT/DB/provider/deploy/release execution authorized. |
| D-19 production release | **NO-GO** | No production release. |
| BLB-11A OD-01–OD-05 | **UNRESOLVED** unless actual evidence exists | Owner/legal/infra/UAT/release decisions still incomplete. |

---

## 7. Owner Sign-Off Section (Blank — No Decisions Filled)

> **Do not sign/date unless actual decisions are reviewed and explicitly made.** No false signatures, dates, approvals, or evidence references.

| Decision | Owner decision | Status | Approval date | Conditions | Evidence reference |
|---|---|---|---|---|---|
| D20-01 Canonical production domain |  | NOT DECIDED |  |  |  |
| D20-02 Payment amount formatting | Approved format: ₹, Indian grouping, 2 decimals, approved message/labels as specified; amount = order amount (not gateway-captured/settled unless separately verified). D20-03 remains separate NOT DECIDED. | **APPROVED BY PROJECT OWNER** | 2026-11-21 | Docs-only; not implementation/Meta/legal approval; BLB-21 NOT AUTHORIZED | BLB-20C conversation (2026-11-21) |
| D20-03 Payment method labels | Approved labels: COD→Cash on delivery, ONLINE→Online payment, PAY_AT_STORE→Pay at store. Internal values/processing/business logic unchanged. | **APPROVED BY PROJECT OWNER** | 2026-11-21 | Docs-only; not implementation/Meta/legal approval; BLB-21 NOT AUTHORIZED | BLB-20F conversation — "yes giveee" (2026-11-21) |
| D20-04 Order confirmation wording | Approved: remove `{{status}}`; customer-friendly confirmation message with 🎉✅📦❤️; retain `{{customerName}}`/`{{orderNumber}}`. | **APPROVED BY PROJECT OWNER** | 2026-11-21 | Docs-only; not implementation/Meta/legal approval; BLB-21 NOT AUTHORIZED | BLB-20I conversation — "approved add emoji" (2026-11-21) |
| D20-05 Custom-cake quote formatting | D20-05-A APPROVED: INR ₹, 2 decimals, Indian grouping, example `₹1,25,000.00`, `Proposed quote: ₹{{proposedPrice}}`. D20-05-C APPROVED: exact approved quote wording/emojis/variables preserved (`{{customerName}}`, `{{referenceNumber}}`, `{{proposedPrice}}`, `{{proposedDeliveryDate}}`, `{{proposedDeliveryTime}}`); `{{trackingUrl}}` unresolved — do not remove/invent/claim Meta-ready. D20-05-D RESOLVED THROUGH APPROVED D20-06 CONVENTION (2026-11-22, BLB-20N): `DD MMM YYYY`, 12-hour AM/PM, IST, preserve ranges where underlying value is range. D20-05-B/E/F NOT DECIDED. | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** | 2026-11-21 (A/C), 2026-11-22 (D20-05-D via D20-06) | Docs-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED; D20-05 not fully approved | BLB-20L (2026-11-21); BLB-20N (2026-11-22) |
| D20-06 Date/time format/timezone | D20-06-A `DD MMM YYYY`; D20-06-B 12-hour AM/PM; D20-06-C IST (no `Asia/Kolkata` runtime conversion claim); D20-06-D approved scope/range rules; D20-06-E storage unchanged; D20-06-F UTC reschedule inconsistency implementation prerequisite. | **APPROVED BY PROJECT OWNER** | 2026-11-22 | Docs-only; not implementation/Meta/legal/template enablement/send approval; BLB-21 NOT AUTHORIZED | BLB-20N conversation (2026-11-22); BLB-20M evidence |
| D20-07 Customer alternative-time request | D20-07-A/B/C/D approved; exact wording APPROVED CONTENT — NOT IMPLEMENTED. `{{requestedAlternativeDateTime}}` proposed variable only; D20-06 formatting; do not append second IST; do not imply acceptance/confirmation. | **APPROVED BY PROJECT OWNER** | 2026-11-22 | Documentation/content only; implementation authorization NOT GRANTED; BLB-21 NOT AUTHORIZED | BLB-20P conversation (2026-11-22); BLB-20O evidence |
| D20-08 Admin reschedule proposal | D20-08-A APPROVED: Option B — introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. D20-08-B APPROVED: Option A — single formatted `{{proposedSchedule}}` per D20-06 (DD MMM YYYY, 12-hour AM/PM, IST; preserve source-provided range; do not invent range; do not append IST twice; example `25 Dec 2026, 10:00 AM IST`); proposed variable not registered/mapped. D20-08-C APPROVED: Option B — generic contact S.V. Sweets & Bakers to discuss proposed schedule; no tracking-page response mechanism/button/direct acceptance link/unverified specific channel. D20-08-D/E/F NOT DECIDED. | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** | 2026-11-22 (D20-08-A, D20-08-B, D20-08-C) | Docs-only; direction/variable-contract/response-instruction intent only; no exact wording/expiry/registry-outbox/payload mapping/Meta/legal/production approval; BLB-21 NOT AUTHORIZED | BLB-20U/20V (2026-11-22); explicit owner instructions in current conversation |
| D20-09 Custom-cake tracking URL |  | NOT DECIDED |  |  |  |

| Final sign-off field | Entry |
|---|---|
| Project owner name |  |
| Role/title |  |
| Review date |  |
| Legal/compliance approval confirmed? | NO — NOT RECEIVED |
| Meta approval confirmed? | NO — NOT RECEIVED |
| BLB-21 implementation authorized? | NO — NOT AUTHORIZED |
| Signature |  |

---

## 8. Next-Step Recommendation

1. **Owner review meeting/written response:** complete D20-01–D20-09 in this package or BLB-20A worksheet with explicit status/date/conditions/evidence.
2. **Resolve external blockers in parallel:** W01 legal/compliance validation, D-14 evidence, BLB-11A OD-01–OD-05, Meta submission readiness prerequisites.
3. **After decisions are recorded:** prepare BLB-21 as a **separately authorized** implementation scope limited to approved rows in the matrix.
4. **After BLB-21 implementation (if authorized):** run fresh verification, update template submission package, obtain Meta approvals, then pursue separately authorized UAT/provider/release gates.

**BLB-20B does not authorize BLB-21 implementation. Project status remains NOT READY / NO-GO.**

---

## Appendix A — Files Inspected (Read-Only)

- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md`
- `docs/client-handover/BLB-20A-OWNER-DECISION-CAPTURE-WORKSHEET.md`
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md`
- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md`

## Appendix B — Execution Confirmation

- **No application source/test/config/env/dependency/database files modified.**
- **No provider/WhatsApp/Meta/API/email/SMS/OTP/Razorpay/Cloudinary operations performed.**
- **No template submission, enablement, or message sending performed.**
- **No deployment/release/Git mutation performed.**
- **Existing staged/unstaged/untracked files preserved.**
- **No owner decisions filled in or approvals created.**