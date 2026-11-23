# BLB-20K — D20-05 Custom Cake Quote Message Decision Proposal and Owner Review Package

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Expected/baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 21 November 2026  
**Scope:** Read-only source inspection + documentation-only changes  
**Authorization:** BLB-20K only. **No BLB-21 authorization.**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Preflight (Mandatory Repository Protection)

| Check | Result |
|---|---|
| Repository path | `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp` (confirmed) |
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (matches expected baseline) |
| Git status before | `107 total / 58 tracked / 49 untracked` (dirty pre-existing; preserved) |
| Unexpected HEAD/branch changes | None detected |
| Prohibited operations performed | None |

**Preservation statement:** All pre-existing modified, staged, and untracked files were preserved. No Git mutations, no source/test/config/env/dependency changes, no DB/provider/Meta/template/deploy operations were performed.

---

## 2. Files Inspected (Read-Only)

### Source
- `backend/src/models/CustomCakeRequest.ts` — quote/admin/customer/conversion fields, status enums.
- `backend/src/controllers/customCakeController.ts` — `proposeProposalSchema`, `proposeProposal` validation/transition/notification, quote field handling.
- `backend/src/services/customCakeNotifications.ts` — quote template mapping, empty-string fallback, fail-closed approval gate, tracking URL construction, idempotency key.
- `backend/src/services/whatsappTemplateRegistry.ts` — `custom_cake_quote_prepared` registry entry, required variables, NOT_SUBMITTED/disabled state, `validateTemplateForSend` fail-closed validation.
- `backend/src/services/notificationOutboxService.ts` (previously inspected; referenced for outbox validation behavior) — fail-closed template validation before send.

### Documentation
- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md`
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md`
- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md`
- `docs/client-handover/BLB-20A-OWNER-DECISION-CAPTURE-WORKSHEET.md`
- `docs/client-handover/BLB-20B-OWNER-DECISION-REVIEW-PACKAGE.md`

---

## 3. Exact Source Evidence Supporting Quote Proposal

| # | Evidence question | Finding (current source) | Evidence |
|---:|---|---|---|
| 1 | Available quote fields | `proposedPrice` (Number, min 0, default null), `proposedDeliveryDate` (String, default null), `proposedDeliveryTime` (String, default null), `adminNotes` (String, max 1000, default null), plus status/customer confirmation/conversion fields. | `backend/src/models/CustomCakeRequest.ts` lines 67-107. |
| 2 | `proposedPrice` required/validated? | **Yes.** Zod schema: `z.number().positive("Price must be a positive number").finite(...)`; controller requires valid parsed body; conversion also rejects missing/invalid/non-positive proposedPrice. | `customCakeController.ts` `proposeProposalSchema` lines 73-78; `proposeProposal` uses `safeParse`; conversion guards at ~1036-1041. |
| 3 | `proposedDeliveryDate`/`proposedDeliveryTime` validated? | **Yes.** Date: required string, trimmed, `YYYY-MM-DD` regex; controller also parses date and rejects invalid/past date. Time: required trimmed string min length 1. | `proposeProposalSchema` lines 79-89; controller lines 743-759. |
| 4 | `adminNotes` exposed to customers? | **Not in WhatsApp notification payload.** `custom_cake_quote_prepared` template params are `[customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl]` — no adminNotes. `adminNotes` is stored on request and returned in admin proposal response; any other customer-facing exposure is outside this WhatsApp payload and should be treated separately. | `customCakeNotifications.ts` lines 53-64; `proposeProposal` response includes `adminNotes`. |
| 5 | Can quote notification params become empty? | **Possible at payload-construction edge cases, but fail-closed.** Notifier uses `String(request.proposedPrice ?? "")`, `request.proposedDeliveryDate ?? ""`, `request.proposedDeliveryTime ?? ""`. If values are missing/empty, registry/outbox validation rejects missing required variables. Proposal API path requires valid fields before notify. | `customCakeNotifications.ts` lines 59-62; `whatsappTemplateRegistry.ts` `validateDefinitionForSend` lines 345-362. |
| 6 | Outbox rejects missing required template params? | **Yes, fail-closed.** `validateTemplateForSend`/`validateDefinitionForSend` checks param array, length >= requiredVariables, and each required variable is non-empty after trim; returns `MISSING_REQUIRED_VARIABLES`/`INVALID_PARAMS` etc. Outbox/notification flow treats invalid template as non-sendable/fail-closed. | `whatsappTemplateRegistry.ts` lines 335-362, 375-389. |
| 7 | Quote proposed vs accepted/final/paid amount? | **Proposed quote only.** `proposeProposal` stores proposed fields and sets status CONTACTED, customerConfirmed PENDING. No payment capture/settlement occurs in quote preparation. Conversion later creates an order using proposed values after acceptance; that is separate from quote notification. | `proposeProposal` sets `status: "CONTACTED"`, `customerConfirmed: "PENDING"`; no payment call. `convertCustomCakeRequestToOrder` uses `claimed.proposedPrice` as amount later. |
| 8 | Current tracking destination | Custom cake notifications use `${NEXT_PUBLIC_SITE_URL ?? "https://bakery-ecommerce-topaz.vercel.app"}/account/custom-cake-requests` (list page). | `customCakeNotifications.ts` lines 24-27, 45. |
| 9 | Tracking domain/URL owner-confirmed? | **No.** D20-01 and D20-09 remain NOT DECIDED. Fallback domain is code default only. | BLB-20/20A/20B D20-01, D20-09. |
| 10 | Date/time format and timezone verified? | **Historical (BLB-20K, 2026-11-21):** No final owner decision at proposal time. Stored as `YYYY-MM-DD` date and required time string; custom-cake conversion logic interprets proposed time with IST offset for slot validation, but customer-facing WhatsApp display format/timezone was not owner-finalized. **Current status (BLB-20N, 2026-11-22): D20-06 APPROVED BY PROJECT OWNER** as display convention (`DD MMM YYYY`, 12-hour AM/PM, IST, scope/storage/range rules as recorded); D20-05-D resolved through approved D20-06 convention; implementation still requires separate BLB-21 authorization. | Model/controller/schema; conversion logic in `customCakeController.ts`; BLB-20 D20-06; BLB-20N capture. |

---

## 4. Existing Evidence and Constraints (Carried Forward, Verified)

- Quote payload fields available: `proposedPrice`, `proposedDeliveryDate`, `proposedDeliveryTime`, optional `adminNotes`.
- `proposedPrice` validated as positive finite number; `proposedDeliveryDate` validated as `YYYY-MM-DD` and not in past by controller; `proposedDeliveryTime` required.
- Quote preparation transitions PENDING -> CONTACTED before notification.
- Missing required template params fail closed in registry validation; notifier has empty-string fallbacks but should not be relied upon as normal behavior.
- `custom_cake_quote_prepared` remains **NOT_SUBMITTED**, **enabled:false**.
- Canonical production domain undecided (D20-01). Custom cake tracking destination undecided (D20-09). Date/time display/timezone undecided (D20-06).
- No behavior silently changed by this proposal.

---

## 5. Neutral Owner-Review Message Proposal (NOT APPROVED)

> **Status:** Proposal for owner review only. **D20-05-A and D20-05-C approved by Project Owner (2026-11-21, BLB-20L) as documentation/wording decisions; D20-05-D resolved through approved D20-06 convention (2026-11-22, BLB-20N); D20-05 remains PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED (B/E/F NOT DECIDED). Not implemented / not Meta-approved / not enabled / not sent.**

### Proposed customer-facing draft (uses actual template variable names)

**Your custom cake quote is ready! 🎂**

Hello {{customerName}},

We've prepared a quote for your custom cake request.

**Request reference:** {{referenceNumber}}  
**Proposed quote:** ₹{{proposedPrice}}  
**Proposed delivery date:** {{proposedDeliveryDate}}  
**Proposed delivery time:** {{proposedDeliveryTime}}

Please review your quote and contact us if you would like to proceed or discuss any changes.

Thank you for choosing S.V. Sweets & Bakers! ❤️

### Template parameter mapping (actual registry names)

| Template variable | Meaning | Source |
|---|---|---|
| `{{customerName}}` | Customer name (fallback "Customer") | `request.name` / notifier fallback |
| `{{referenceNumber}}` | Custom cake request reference | `request.referenceNumber` |
| `{{proposedPrice}}` | Proposed quote price value | `request.proposedPrice` (currently stringified; formatting decision pending) |
| `{{proposedDeliveryDate}}` | Proposed delivery date | `request.proposedDeliveryDate` |
| `{{proposedDeliveryTime}}` | Proposed delivery time | `request.proposedDeliveryTime` |
| `{{trackingUrl}}` | Review/tracking URL (template has this variable; current destination undecided) | `customCakeNotifications.ts` trackingUrl builder |

**Note:** The existing registry/template includes `trackingUrl` as a required variable. The draft above omits a visible URL line for readability, but any final approved template must account for all required variables and the approved destination (D20-01/D20-09). Do not invent a custom-cake detail URL.

### Mandatory wording restrictions
- Amount is a **proposed quote** only — not paid, captured, settled, or finally payable.
- Do **not** claim tax or delivery charges are included.
- Do **not** claim tax or delivery charges are additional.
- Do **not** promise availability or delivery until confirmed.
- Do **not** invent a response deadline.
- Do **not** expose internal `adminNotes`.
- Do **not** invent a custom cake detail URL.
- ₹ / Indian grouping / 2 decimals are approved for D20-05-A presentation (BLB-20L, 2026-11-21, documentation-only); no pricing/tax/delivery policy is established by this draft. D20-05-D is resolved through approved D20-06 convention (BLB-20N, 2026-11-22, display-only; not implemented); D20-05-B/E/F remain NOT DECIDED.

---

## 6. D20-05 Owner Decision Table (BLB-20L Partial Approval Capture)

> **BLB-20L update (2026-11-21, documentation-only):** Project Owner explicitly approved D20-05-A and D20-05-C in BLB-20L conversation. D20-05 is **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED**. D20-05 is **not fully approved**.

| Sub-decision | Question | Owner decision / proposal | Dependencies / evidence required | Status |
|---|---|---|---|---|
| **D20-05-A — Currency and precision** | How should proposed quote amount be displayed? | **APPROVED BY PROJECT OWNER (2026-11-21, BLB-20L).** Currency: Indian Rupees (₹). Two decimal places. Indian number grouping. Example: `₹1,25,000.00`. Customer-facing quote line: `Proposed quote: ₹{{proposedPrice}}`. Formatting decision only; source-code formatting not implemented. | Implementation requires separate BLB-21 authorization. | **APPROVED BY PROJECT OWNER** |
| **D20-05-B — Tax and delivery charges** | Does proposed quote include applicable tax/delivery charges, exclude them, or require separate confirmation? | No option selected. Owner must confirm business policy before wording is finalized. | Explicit business/legal confirmation; do not assume inclusion/exclusion. | **NOT DECIDED** |
| **D20-05-C — Quote wording** | Is the neutral proposed message acceptable? | **APPROVED BY PROJECT OWNER (2026-11-21, BLB-20L).** Approved wording (preserve exactly):<br><br>“Your custom cake quote is ready! 🎂<br><br>Hello {{customerName}},<br><br>We've prepared a quote for your custom cake request.<br><br>Request reference: {{referenceNumber}}<br><br>Proposed quote: ₹{{proposedPrice}}<br><br>Proposed delivery date: {{proposedDeliveryDate}}<br><br>Proposed delivery time: {{proposedDeliveryTime}}<br><br>Please review your quote and contact us if you would like to proceed or discuss any changes.<br><br>Thank you for choosing S.V. Sweets & Bakers! ❤️”<br><br>Preserve wording, emojis, and variable names exactly. **Important:** This wording approval does not resolve the required `{{trackingUrl}}` variable. Do not silently remove that variable, invent a tracking URL, or claim the displayed draft is ready for Meta submission. Tracking-link placement and destination remain unresolved under D20-05-E. | Implementation requires separate BLB-21 authorization; legal/compliance review as applicable; D20-05-E must resolve `{{trackingUrl}}` placement/destination before Meta submission. | **APPROVED BY PROJECT OWNER** |
| **D20-05-D — Date/time display** | What date/time format/timezone should be shown? | **RESOLVED THROUGH APPROVED D20-06 CONVENTION (2026-11-22, BLB-20N).** Date `DD MMM YYYY` (e.g., `25 Dec 2026`); Time 12-hour AM/PM (e.g., `04:30 PM`); Timezone IST when displayed time represents IST; preserve delivery time ranges where underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. Display convention only; storage unchanged; no implementation authorized. | Future implementation requires separate BLB-21 authorization + compatibility review; D20-06-F UTC reschedule inconsistency prerequisite. | **RESOLVED THROUGH APPROVED D20-06 CONVENTION** |
| **D20-05-E — Tracking URL placement and destination** | Where should customer review the quote / how is `{{trackingUrl}}` handled? | Coordinate with D20-01/D20-09; do not assume current list page is final. `{{trackingUrl}}` remains a required registry variable and is unresolved. | D20-01 canonical domain, D20-09 custom-cake destination, actual route confirmation, and template placement decision. | **NOT DECIDED** |
| **D20-05-F — Quote acceptance semantics** | How should customer proceed/accept? | Owner to choose approved channel: reply/contact bakery/existing website action as already supported. Do not invent new workflow. | Owner confirmation of supported workflow; no new acceptance flow invented. | **NOT DECIDED** |

---

## 7. Documentation Updates

### Created
- `docs/client-handover/BLB-20K-D20-05-CUSTOM-CAKE-QUOTE-DECISION-PROPOSAL.md` (this file)

### Updated for consistency
- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md` — added BLB-20K proposal reference; BLB-20L recorded D20-05 partial approval (A/C approved, B/D/E/F NOT DECIDED).
- `docs/client-handover/BLB-20A-OWNER-DECISION-CAPTURE-WORKSHEET.md` — added BLB-20K proposal reference; BLB-20L recorded D20-05 partial approval.
- `docs/client-handover/BLB-20B-OWNER-DECISION-REVIEW-PACKAGE.md` — added BLB-20K proposal reference; BLB-20L recorded D20-05 partial approval.

### Status/count (post-BLB-20L)
- D20-02, D20-03, D20-04 remain **APPROVED BY PROJECT OWNER** with existing evidence intact.
- D20-05 is **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-05-A and D20-05-C approved 2026-11-21; D20-05-D resolved through approved D20-06 convention 2026-11-22; D20-05-B/E/F NOT DECIDED).
- D20-06 is **APPROVED BY PROJECT OWNER** (2026-11-22, BLB-20N) as a display convention; implementation remains separately authorized.
- D20-01, D20-07, D20-08, D20-09 remain **NOT DECIDED**.
- Overall decision count: **4 fully approved / 1 partially approved / 4 not decided**.
- All blockers unchanged. BLB-21 remains **NOT AUTHORIZED**.

---

## 8. Blockers (Unchanged)

- W01 legal/compliance written validation: **NOT RECEIVED**.
- Meta template approval: **NOT RECEIVED**.
- D-14: **NOT RECEIVED**.
- D-16/D-17/D-18: **UNRESOLVED**.
- Group 5: **13/13 DEFER, 0/13 granted**.
- D-19: **NO-GO**.
- BLB-11A OD-01–OD-05: **UNRESOLVED** unless actual evidence exists.
- BLB-21: **NOT AUTHORIZED**.

All 18 templates remain **NOT_SUBMITTED**, **enabled:false**, fail-closed.

---

## 9. Confirmation

- **D20-05 is PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED (A/C approved; D20-05-D resolved through approved D20-06 convention; B/E/F NOT DECIDED). D20-05 is not fully approved.**
- **Overall count: 4 fully approved / 1 partially approved / 4 not decided.**
- **No source, test, configuration, environment, dependency, database, provider, Meta, template, deployment, or Git mutations occurred.**
- **No WhatsApp delivery is live or Meta-approved.**

## 10. Further Authorization Required

- **D20-05 remaining decisions (B/E/F)** required before full D20-05 closure/implementation (D20-05-D resolved through approved D20-06 convention; implementation still requires separate BLB-21 authorization).
- **D20-01/D20-06/D20-09** decisions required for domain/date-time/tracking finalization where applicable.
- **BLB-21 separate explicit authorization** required before any source/test/config/template-registry/payload implementation.
- **Legal/compliance, Meta approval, UAT, and production authorizations** remain required as applicable.