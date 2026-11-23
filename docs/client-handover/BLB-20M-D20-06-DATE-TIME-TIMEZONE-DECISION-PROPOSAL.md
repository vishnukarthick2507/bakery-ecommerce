# BLB-20M — D20-06 Date, Time and Timezone Decision Proposal

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 22 November 2026  
**Scope:** Read-only source inspection + documentation-only changes  
**Authorization:** BLB-20M proposal; BLB-20N documentation-only decision capture. **No BLB-21 authorization.**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

This document proposed owner-review options for **D20-06 (Date/Time Display Convention)** based on read-only source inspection and existing BLB-18/19/20 artifacts. **No application code, tests, config, env, dependencies, DB, provider settings, templates, or deployments were changed by BLB-20M/BLB-20N.**

**BLB-20N decision capture (2026-11-22):** D20-06 is **APPROVED BY PROJECT OWNER — 2026-11-22** as a customer-facing display convention (documentation/decision capture only; **not implemented**, **not Meta-approved**, **not enabled/live**). The original BLB-20M technical findings below are preserved as historical evidence. Current application behavior remains unchanged until separately authorized BLB-21 implementation.

Key evidence-backed findings:
- **Order scheduling** stores `scheduledDate` and `scheduledTime` as **strings** (`Order.ts`), with no timezone field. Checkout submits `scheduledDate` as `YYYY-MM-DD` (HTML date input) and `scheduledTime` as a fixed range string like `10:00 AM - 12:00 PM` (`app/checkout/page.tsx`, `orderController.ts` schema, `slotValidation.parseCheckoutSlot`).
- **Custom cake quotes** store `proposedDeliveryDate` as string (`YYYY-MM-DD` validated by controller) and `proposedDeliveryTime` as free-text string (`CustomCakeRequest.ts`, `customCakeController.ts`). Admin UI uses a `date` input and a `text` input with placeholder `e.g., 2:00 PM - 4:00 PM`.
- **Timezone behavior is mixed/implicit:** slot validation and checkout parsing use a **fixed `+05:30` (Kolkata) offset** (`slotValidation.ts`: `KOLKATA_OFFSET_MINUTES = 330`). Custom-cake conversion also uses a fixed `IST_OFFSET_MINUTES = 330` and comments “Interpret proposed time in IST...” (`customCakeController.ts`). There is no `Asia/Kolkata` IANA zone conversion via `Intl`/timezone library in inspected backend scheduling paths; behavior is fixed-offset math, not DST-aware zone rules (India has no DST, but implementation is fixed-offset, not named-zone).
- **Critical inconsistency:** on reschedule acceptance, `orderController.acceptProposal` sets `order.scheduledDate` to `confirmedSlotTime.toISOString().split("T")[0]` and `order.scheduledTime` to UTC `HH:MM:SS` (`confirmedSlotTime.toISOString().split("T")[1]?.split(".")[0] ?? "10:00:00"`). This differs from checkout format and can leak UTC date/time into customer-facing WhatsApp payloads.
- **WhatsApp payloads** pass date/time values through mostly as-is: order received has no schedule fields; reschedule templates and custom-cake quote template include schedule/date-time params; `customerOrderNotifications.ts` uses `order.scheduledDate/scheduledTime` directly.

---

## BLB-20N Owner Approval Capture (2026-11-22, documentation-only)

**D20-06 status:** **APPROVED BY PROJECT OWNER — 2026-11-22** (customer-facing display convention only; **not implemented**; **not Meta-approved**; **not template submission/enablement/send authorization**; **not legal/compliance approval**; **BLB-21 remains NOT AUTHORIZED**).

| Sub-decision | Approved decision | Notes / boundaries |
|---|---|---|
| **D20-06-A — Date format** | `DD MMM YYYY` (example: `25 Dec 2026`) | Customer-facing display convention only. |
| **D20-06-B — Time format** | 12-hour format with AM/PM (example: `04:30 PM`) | Customer-facing display convention only. |
| **D20-06-C — Timezone convention** | IST (India Standard Time). Customer-facing examples must use IST when the displayed time represents Indian Standard Time. | Do **not** claim that named-zone runtime conversion using `Asia/Kolkata` has already been implemented. Current inspected code uses fixed `+05:30` offset behavior. |
| **D20-06-D — Scope** | Customer-facing order schedule notifications; custom cake quote notifications; reschedule requested, accepted, and rejected notifications. Apply wherever the relevant WhatsApp payload actually contains date/time information. | `order_received` and `order_confirmed` currently do **not** carry schedule fields per BLB-20M evidence; do not add new template variables or alter template semantics. Do not invent schedule information. Preserve delivery time ranges where the underlying value represents a range (e.g., `10:00 AM – 12:00 PM IST`); do not convert point-in-time to range or vice versa. |
| **D20-06-E — Storage/display rule** | Retain existing storage unchanged. Approved convention concerns customer-facing display formatting only. | Do not normalize/migrate/change stored `scheduledDate`, `scheduledTime`, `proposedDeliveryDate`, or `proposedDeliveryTime` fields in this milestone. Any future formatting implementation requires separate **BLB-21** implementation authorization and compatibility review. |
| **D20-06-F — Reschedule UTC inconsistency** | Known reschedule acceptance UTC formatting inconsistency documented in BLB-20M is an **implementation prerequisite**. | Must be resolved and verified through separately authorized implementation before customer-facing reschedule date/time formatting is treated as reliable. This approval does **not** authorize that implementation. |

**Current application behavior:** unchanged (BLB-20M evidence preserved below). **Future implementation requirement:** separate BLB-21 authorization + compatibility review + verification; no Meta submission/enablement/send without separate approvals.

---

## 2. Preflight (Mandatory Repository Protection)

| Check | Result |
|---|---|
| Repository path | `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp` |
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (matches expected) |
| Git status before | `107 total / 58 tracked / 49 untracked` (dirty pre-existing; preserved) |
| Git status after | To be recorded in final report (documentation-only edits expected inside existing untracked `docs/client-handover/`) |
| Prohibited operations | None performed |

---

## 3. Source Files Inspected

### Backend models/controllers/services
- `backend/src/models/Order.ts` — `scheduledDate: string`, `scheduledTime: string`, slot/reschedule fields.
- `backend/src/models/CustomCakeRequest.ts` — `proposedDeliveryDate: string|null`, `proposedDeliveryTime: string|null`.
- `backend/src/controllers/orderController.ts` — create-order schema/parse/validation; reschedule propose/accept/decline/requestAlternative behavior; scheduledDate/time assignments.
- `backend/src/controllers/customCakeController.ts` — `proposeProposalSchema` (`YYYY-MM-DD`, required time string), propose validation, conversion IST fixed-offset parsing.
- `backend/src/services/slotValidation.ts` — business hours, fixed `+05:30` offset, Kolkata day/time calc, `parseCheckoutSlot` format/range parsing, `formatSlotDate/formatSlotTime`.
- `backend/src/services/customerOrderNotifications.ts` — WhatsApp template payload construction; reschedule templates pass `order.scheduledDate/scheduledTime`.
- `backend/src/services/customCakeNotifications.ts` — quote payload uses `proposedPrice`, `proposedDeliveryDate`, `proposedDeliveryTime` as strings/fallback empty.
- `backend/src/services/whatsappTemplateRegistry.ts` — required variables for relevant templates.

### Frontend (targeted)
- `app/checkout/page.tsx` — date input (`type="date"`, `YYYY-MM-DD` value) and fixed time-slot select (`10:00 AM - 12:00 PM` ... `6:00 PM - 8:00 PM`).
- `app/admin/custom-cakes/page.tsx` — proposal form uses `type="date"` for proposedDeliveryDate and `type="text"` placeholder `e.g., 2:00 PM - 4:00 PM` for proposedDeliveryTime.
- `app/account/custom-cake-requests/*` and admin/order/reschedule displays inspected via grep for date/time field usage (read-only evidence gathering).

### Existing decision/docs
- `docs/client-handover/BLB-18-WHATSAPP-TEMPLATE-READINESS-SUBMISSION-PACKAGE.md` (context)
- `docs/client-handover/BLB-19-NOTIFICATION-CONTENT-PAYLOAD-READINESS-REPORT.md` (context)
- `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md`
- `docs/client-handover/BLB-20A-OWNER-DECISION-CAPTURE-WORKSHEET.md`
- `docs/client-handover/BLB-20B-OWNER-DECISION-REVIEW-PACKAGE.md`
- `docs/client-handover/BLB-20K-D20-05-CUSTOM-CAKE-QUOTE-DECISION-PROPOSAL.md`

---

## 4. Current Storage and Validation Behavior

### A. Storage

| Domain | Field | Storage/type | Timezone retained? | Evidence |
|---|---|---|---|---|
| Order | `scheduledDate` | `String`, required, trimmed | No explicit TZ | `backend/src/models/Order.ts` lines ~283-287 |
| Order | `scheduledTime` | `String`, required, trimmed | No explicit TZ | `backend/src/models/Order.ts` lines ~289-293 |
| Order reschedule proposal | `proposedSlot`, `customerAlternativeSlot`, `confirmedSlot`, `requestedSlot` | `Date` fields in proposal/slot structures (separate from scheduledDate/scheduledTime strings) | Date is absolute UTC instant in Mongo/JS Date; display/TZ interpretation is application concern | `orderController.ts` reschedule flows; Order model slot fields (inspected by references) |
| Custom cake | `proposedDeliveryDate` | `String`, default null, trimmed | No explicit TZ | `CustomCakeRequest.ts` lines 73-77 |
| Custom cake | `proposedDeliveryTime` | `String`, default null, trimmed | No explicit TZ | `CustomCakeRequest.ts` lines 79-83 |

### B. Validation and conversion

| Area | Observed behavior | Evidence |
|---|---|---|
| Checkout scheduledDate schema | `z.string().trim().min(1)`; actual format validated by `parseCheckoutSlot` | `orderController.ts` create schema |
| Checkout scheduledTime schema | `z.string().trim().min(1)`; actual format validated by `parseCheckoutSlot` | `orderController.ts` create schema |
| Checkout slot parsing | `parseCheckoutSlot` expects date `YYYY-MM-DD` and time range `H:MM AM/PM - H:MM AM/PM`; rejects invalid/rolled dates; computes start in fixed `+05:30` offset; validates end against business hours | `slotValidation.ts` lines 116-173 |
| Slot validation | Rejects past slot; checks bakery hours by Kolkata fixed-offset day/hour/minute | `slotValidation.ts` `validateSlot`, `getKolkataDayAndTime`, `KOLKATA_OFFSET_MINUTES=330` |
| Custom cake proposedDeliveryDate | Zod regex `^\d{4}-\d{2}-\d{2}$`; controller rejects invalid date and past date (`today` at 00:00 local server time) | `customCakeController.ts` `proposeProposalSchema`, `proposeProposal` |
| Custom cake proposedDeliveryTime | Zod required trimmed string min 1; no strict format regex | `customCakeController.ts` schema |
| Custom cake conversion time parsing | Parses `HH:mm` or `H:MM AM/PM`; interprets in IST using fixed offset `5*60+30`; constructs UTC millis via `Date.UTC(...) - IST_OFFSET_MINUTES*60*1000`; validates slot | `customCakeController.ts` conversion block ~1077-1115 |
| UTC/IST conversion mechanism | Fixed offset math (`+05:30`) in `slotValidation.ts` and custom cake conversion. No `Asia/Kolkata` IANA timezone API usage found in inspected scheduling paths. | `slotValidation.ts`, `customCakeController.ts` |
| DST/server timezone risk | India has no DST currently; fixed +05:30 is generally stable for IST. Risk remains if business expands beyond IST or if code assumes server local timezone elsewhere. `proposeProposal` past-date check uses server-local `new Date()` midnight normalization, which may differ from IST depending on server TZ. | `customCakeController.ts` past-date check; general observation |

### C. WhatsApp payloads (relevant templates)

| Template / event | Required vars (registry) | Current payload source/format | Evidence |
|---|---|---|---|
| `order_received` / ORDER_PLACED | `customerName, orderNumber, totalAmount, status, trackingUrl` | No scheduledDate/time param; includes `status` and `totalAmount.toString()` | `customerOrderNotifications.ts` lines 118-128; registry 65-73 |
| `order_confirmed` / STATUS_CHANGED_CONFIRMED | `customerName, orderNumber, status, trackingUrl` | No scheduledDate/time param; includes internal `status` (D20-04 approved wording decision exists, implementation not authorized) | `customerOrderNotifications.ts` 141-145; registry 84-92 |
| `order_reschedule_requested` / RESCHEDULE_REQUESTED | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | Uses `order.scheduledDate`, `order.scheduledTime` as-is (current order schedule). D20-07 already flags semantic mismatch for alternative-request case. | `customerOrderNotifications.ts` 181-185; registry 222-232 |
| `order_reschedule_accepted` / RESCHEDULE_ACCEPTED | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | Uses `order.scheduledDate`, `order.scheduledTime` as-is after acceptance. | `customerOrderNotifications.ts` 186-190; registry 233-243 |
| `order_reschedule_rejected` / RESCHEDULE_REJECTED | `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl` | Uses `order.scheduledDate`, `order.scheduledTime` as-is (retained schedule). | `customerOrderNotifications.ts` 191-195; registry 244-254 |
| `custom_cake_quote_prepared` / CUSTOM_CAKE_QUOTE_PREPARED | `customerName, referenceNumber, proposedPrice, proposedDeliveryDate, proposedDeliveryTime, trackingUrl` | Uses `String(request.proposedPrice ?? "")`, `request.proposedDeliveryDate ?? ""`, `request.proposedDeliveryTime ?? ""` — raw/fallback values, no formatting normalization. | `customCakeNotifications.ts` 53-64; registry 160-177 |

**Other templates with schedule/date-time in payload:** None found in inspected WhatsApp template payload builders. `order_received` and `order_confirmed` currently do **not** include schedule params. Email/SMS/order details strings include scheduledDate/scheduledTime (`orderEmailDetails`), but that is outside WhatsApp template parameter scope except as consistency context.

---

## 5. Current Date/Time Conversion Behavior

| Path | Input | Conversion | Output/storage | Risk |
|---|---|---|---|---|
| Checkout slot parse | `scheduledDate` `YYYY-MM-DD`, `scheduledTime` `H:MM AM/PM - H:MM AM/PM` | Parsed into UTC Date using fixed `+05:30` offset | `parsedSlot` Date for validation; order stores original string fields as submitted | Format is rigid; only fixed slot ranges accepted by parser; timezone fixed-offset. |
| Order create persistence | validated strings | none | `Order.scheduledDate`, `Order.scheduledTime` stored as submitted strings | No normalized display format. |
| Reschedule acceptance | `proposal.proposedSlot` Date (absolute) | **Sets scheduled strings from UTC ISO**: `confirmedSlotTime.toISOString().split("T")[0]` and UTC `HH:MM:SS` | `scheduledDate` becomes UTC `YYYY-MM-DD`, `scheduledTime` becomes UTC `HH:MM:SS` | **High inconsistency:** differs from checkout range format; can show wrong day/time to IST customers; WhatsApp reschedule accepted/rejected/requested payloads will pass these values through. |
| Reschedule request alternative | `alternative` Date from request body, validated | No change to `order.scheduledDate/scheduledTime` | Current order schedule remains; alternative stored in proposal | D20-07 semantic mismatch: WhatsApp sends current schedule, not requested alternative. |
| Custom cake quote proposal | `proposedDeliveryDate` `YYYY-MM-DD`, `proposedDeliveryTime` free-text required | Past-date check uses server-local date; no time normalization | Stored as strings | Server timezone may affect past-date boundary; time format inconsistency possible. |
| Custom cake conversion | proposed date/time strings | Fixed IST offset parsing; supports `HH:mm` and `H:MM AM/PM` | Validated slot Date; order scheduledDate/time set to `String(claimed.proposedDeliveryDate)` and trimmed time string | Stored time format may not match checkout range format; customer-facing WhatsApp quote sends raw strings. |

---

## 6. Identified Inconsistencies and Risks

1. **Reschedule acceptance UTC overwrite (high):** `orderController.acceptProposal` writes `scheduledDate` as UTC ISO date and `scheduledTime` as UTC `HH:MM:SS`. Checkout stores `YYYY-MM-DD` + `10:00 AM - 12:00 PM` range. This can cause wrong/odd customer-facing date/time in WhatsApp reschedule templates and UI. Evidence: `orderController.ts` ~1556-1562.
2. **Time format inconsistency (medium/high):** Checkout uses range slots; custom cake admin UI suggests range but allows free text; conversion accepts `HH:mm` or `H:MM AM/PM`; reschedule acceptance stores `HH:MM:SS` UTC. No single canonical display format.
3. **Timezone ambiguity (medium):** Storage has no TZ. Parsing/validation uses fixed `+05:30`. User-facing strings do not indicate IST. Server-local past-date checks may diverge from IST.
4. **Semantic mismatch in reschedule request (known, D20-07):** `RESCHEDULE_REQUESTED` WhatsApp uses current schedule, not customer-requested alternative slot. Evidence: `customerOrderNotifications.ts` 181-185, `orderController.ts` 1855-1861.
5. **D20-05 dependency:** custom cake quote message approved in wording, but date/time display format/timezone remains unresolved (D20-05-D). `{{trackingUrl}}` also unresolved by D20-05-E; separate from D20-06.
6. **Template readiness risk:** All relevant templates remain NOT_SUBMITTED/enabled:false. Any format decision will require later BLB-21 implementation authorization and Meta template/sample alignment before submission.

---

## 7. Date Format Options (Owner Review Only — NOT DECIDED)

| Option | Example | Advantages | Disadvantages / compatibility | Recommendation note |
|---|---|---|---|---|
| **A. `DD/MM/YYYY`** | `25/12/2026` | Compact; familiar in India; easy to type/compare. | Ambiguous internationally; less friendly in conversational WhatsApp text. | Viable if owner prefers numeric brevity. |
| **B. `25 December 2026` / `DD MMMM YYYY`** | `25 December 2026` | Very clear and formal; no locale ambiguity. | Longer; slightly more verbose for WhatsApp templates. | Clear, but longer. |
| **C. `DD MMM YYYY`** | `25 Dec 2026` | Clear, compact, customer-friendly; already proposed in D20-06 draft. | Month abbreviation language should be consistent (English). | **Recommended for owner review only** - balances clarity and brevity. |
| **D. Keep `YYYY-MM-DD`** | `2026-12-25` | Matches current stored/custom-cake format; unambiguous. | Less customer-friendly in WhatsApp; feels technical. | Not preferred for customer-facing messages. |

**Compatibility note:** Current storage is string-based; formatting can be applied at notification payload construction if inputs are parseable/normalized. Reschedule acceptance UTC overwrite must be resolved before reliable formatting.

---

## 8. Time Format Options (Owner Review Only — NOT DECIDED)

| Option | Example | Advantages | Disadvantages / compatibility | Recommendation note |
|---|---|---|---|---|
| **A. 12-hour with AM/PM** | `04:30 PM` | Familiar for Indian retail/customer communication; matches checkout slot style. | Needs consistent spacing/case; range formatting must be decided. | **Recommended for owner review only** for customer-facing WhatsApp. |
| **B. 24-hour** | `16:30` | Unambiguous, compact. | Less familiar to some customers; differs from current checkout display. | Viable for internal/admin, less friendly for WhatsApp. |
| **C. Preserve range string** | `10:00 AM - 12:00 PM` | Matches checkout slots; communicates window. | Custom cake/reschedule acceptance may not have range; UTC bug currently produces `HH:MM:SS`. | Use where slot range is semantically correct; do not force on point times without rule. |

**Compatibility note:** Custom cake `proposedDeliveryTime` is currently free-text; formatting/validation rules need owner decision and later BLB-21 implementation. Reschedule accepted currently stores UTC `HH:MM:SS`.

---

## 9. Timezone Options and Recommendation (Recommendation Only — NOT DECIDED)

| Option | Meaning | Advantages | Disadvantages / risks | Evidence fit |
|---|---|---|---|---|
| **A. Explicit IST label in customer messages** | Display `IST`/`India Standard Time` after time | Clear to customers; matches bakery operating context. | Must be true for displayed value; requires consistent conversion/formatting. | Business is IST-oriented; code uses fixed +05:30 in inspected paths. |
| **B. `Asia/Kolkata` as named timezone** | Use IANA zone in implementation/conversion logic | Semantically clear in engineering; future-proof if zone rules change. | India currently has no DST; implementation change needed; owner-facing wording still needs decision. | Not currently used in inspected scheduling code; fixed offset used instead. |
| **C. Fixed `+05:30` offset behavior (current)** | Keep existing fixed offset math | Matches current implementation; simple. | Not named-zone API; messaging should still clarify IST if shown. | **Current code behavior** in `slotValidation.ts` and custom-cake conversion. |

**Recommendation (owner review only, NOT DECIDED):** For customer-facing WhatsApp, use a clear IST-aware display (e.g., `hh:mm AM/PM IST`) **only after** confirming storage/conversion behavior and fixing reschedule acceptance UTC formatting inconsistency. Implementation should be standardized through an authorized BLB-21 change; do not claim named `Asia/Kolkata` runtime behavior unless actually implemented.

---

## 10. Exact Owner Decisions Required

1. **D20-06-A — Customer-facing date format:** choose one format (`DD MMM YYYY` recommended for review, or `DD/MM/YYYY`, `25 December 2026`, other approved format).
2. **D20-06-B — Customer-facing time format:** choose 12-hour AM/PM, 24-hour, or approved range/point-time rule.
3. **D20-06-C — Timezone label/semantics:** whether to display `IST`, `India Standard Time`, no timezone label, or another approved label; confirm timezone truthfulness.
4. **D20-06-D — Scope consistency:** confirm format applies to order schedule, reschedule requested/accepted/rejected, custom-cake quote, and any other customer-facing WhatsApp template carrying date/time.
5. **D20-06-E — Canonical storage/display rule:** decide whether to normalize display only, or also normalize stored scheduled strings (requires BLB-21 and migration/compatibility analysis).
6. **D20-06-F — Reschedule acceptance UTC bug handling:** owner acknowledges this known inconsistency must be resolved in authorized implementation before date/time formatting can be trusted for reschedule notifications.

---

## 11. Dependencies on D20-05, D20-07, D20-08

| Dependency | Impact | Status impact |
|---|---|---|
| **D20-05-D** | Custom cake quote approved wording (D20-05-C) includes `{{proposedDeliveryDate}}` and `{{proposedDeliveryTime}}`; display format/timezone was unresolved at BLB-20M proposal time. | **Historical proposal-time status; current status (BLB-20N, 2026-11-22):** D20-05-D **RESOLVED THROUGH APPROVED D20-06 CONVENTION**. D20-05 remains **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-05-B/E/F still NOT DECIDED). |
| **D20-07** | Reschedule request semantics/payload mismatch (current schedule vs requested alternative slot) intersects with date/time formatting. Formatting alone does not fix semantic mismatch. | **Superseded historical status (as of earlier BLB-20O review):** D20-07 remained **NOT DECIDED** at that time. **Current status (BLB-20P, 2026-11-22):** D20-07 **APPROVED BY PROJECT OWNER** (documentation/content decision only; implementation authorization NOT GRANTED; see BLB-20P capture). |
| **D20-08** | Admin reschedule proposal template (if ever approved) will need same date/time/timezone convention. | D20-08 remains **NOT DECIDED**. |
| **D20-01/D20-09** | Tracking destination/domain not directly date/time formatting, but template review/submission packages should be consistent. | D20-01/D20-09 remain **NOT DECIDED**. |

---

## 12. Explicit Statement (Updated by BLB-20N Capture)

- **D20-06 is APPROVED BY PROJECT OWNER — 2026-11-22** as a customer-facing date/time/timezone display convention (documentation-only capture; **not implemented**, **not Meta-approved**, **not enabled/live**). Original BLB-20M technical findings remain preserved.
- **BLB-21 remains NOT AUTHORIZED.** No source/test/config/template implementation was performed.
- **Current decision counts (BLB-20N snapshot; superseded historical status):** 4 fully approved (D20-02, D20-03, D20-04, D20-06) / 1 partially approved (D20-05) / 4 not decided (D20-01, D20-07, D20-08, D20-09). D20-07 was NOT DECIDED / SOURCE EVIDENCE INSUFFICIENT at BLB-20N/BLB-20O review time. **Current status (BLB-20P, 2026-11-22):** D20-07 **APPROVED BY PROJECT OWNER** (documentation/content only; implementation authorization NOT GRANTED), making current counts **5 fully approved / 1 partially approved / 3 not decided** (D20-01, D20-08, D20-09 remain NOT DECIDED) per BLB-20P.
- **D20-05 impact:** D20-05-D resolved through approved D20-06 convention; D20-05-B/E/F remain NOT DECIDED; D20-05 remains **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED**.
- Blockers unchanged: W01 legal/compliance NOT RECEIVED; Meta approval NOT RECEIVED; D-14 NOT RECEIVED; D-16/D-17/D-18 UNRESOLVED; Group 5 13/13 DEFER, 0/13 granted; D-19 NO-GO; BLB-11A OD-01–OD-05 UNRESOLVED unless actual evidence exists.
- All 18 registered WhatsApp templates remain `NOT_SUBMITTED`, `enabled:false`, empty `metaTemplateId`, fail-closed.
