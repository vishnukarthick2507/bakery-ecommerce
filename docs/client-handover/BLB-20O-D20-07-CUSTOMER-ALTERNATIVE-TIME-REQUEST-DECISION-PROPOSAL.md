# BLB-20O — D20-07 Customer Alternative-Time Request Decision Proposal

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 22 November 2026  
**Scope:** Read-only source inspection + documentation-only proposal/capture  
**Authorization:** BLB-20O proposal; BLB-20P documentation-only decision capture. **No BLB-21 authorization.**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Preflight

| Check | Result |
|---|---|
| Repository path | `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp` |
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (matches expected) |
| Git status before | `107 total / 58 tracked / 49 untracked` (dirty pre-existing; preserved) |
| Prohibited operations | None performed (read-only inspection + documentation-only edits) |

---

## 2. Executive Summary

D20-07 concerns the customer-facing WhatsApp notification sent when a customer requests an alternative delivery/pickup time in response to an admin reschedule proposal (`RESCHEDULE_REQUESTED` / `order_reschedule_requested`).

**Source-backed finding:** the workflow stores the customer's requested alternative slot (`customerAlternativeSlot`) and optional note (`customerAlternativeNote`) on the reschedule proposal, and the controller emits a `RESCHEDULE_REQUESTED` notification whose detail text includes the requested alternative time. However, the WhatsApp template payload builder currently sends the **order's current `scheduledDate`/`scheduledTime`** (existing order schedule fields), not the customer's requested alternative slot. The registry/template contract also only includes `customerName, orderNumber, scheduledDate, scheduledTime, trackingUrl`.

**BLB-20P decision capture (2026-11-22):** D20-07 is **APPROVED BY PROJECT OWNER — 2026-11-22** (documentation/content decision only; **implementation authorization NOT GRANTED**; **not implemented / not Meta-approved / not enabled/live**). Original BLB-20O evidence remains preserved below.

---

## 3. Source Evidence — End-to-End Data Flow

### A. Route / endpoint
- **File:** `backend/src/routes/orderRoutes.ts`
- **Symbol/route:** `POST /:id/proposal/request-alternative` -> `requestAlternativeSlot` (customer auth required).
- **Evidence:** lines ~14, ~81-83 import and register `requestAlternativeSlot`.

### B. Controller validation and handling
- **File:** `backend/src/controllers/orderController.ts`
- **Schema:** `alternativeSlotSchema` = `{ time: z.string().datetime({ message: "Valid ISO datetime is required" }), note: z.string().trim().max(500).optional().default("") }` (lines ~1257-1260).
- **Handler:** `export const requestAlternativeSlot = async (req: AuthRequest, res: Response)` (lines ~1783+).
- **Observed behavior (source-confirmed):**
  1. Requires customer auth and valid `orderId`.
  2. Parses body with `alternativeSlotSchema`.
  3. Loads order in transaction; verifies ownership (`order.userId` matches customer).
  4. Finds pending proposal from `rescheduleProposals` history or legacy `proposedSlot` pending.
  5. If proposal expired, marks expired, restores previous status, saves, returns 400 "Proposal has expired".
  6. Parses alternative as `new Date(parsed.data.time)` and validates via `validateSlot(alternative, order.fulfillmentType)`.
  7. Sets proposal: `status = "ALTERNATIVE_REQUESTED"`, `customerResponse = "REQUESTED_ALTERNATIVE"`, `customerResponseAt = now`, `customerAlternativeSlot = alternative`, `customerAlternativeNote = parsed.data.note`.
  8. Marks proposals modified; sets legacy `proposedSlot.status = "ALTERNATIVE_REQUESTED"` if present.
  9. Restores `order.orderStatus = order.reschedulePreviousStatus ?? "CONFIRMED"` and clears `reschedulePreviousStatus`.
  10. **Does not change** `order.scheduledDate` / `order.scheduledTime` / `order.confirmedSlot`.
  11. Saves order.
  12. Emits notification: `notifyCustomerOrder(result.order, "RESCHEDULE_REQUESTED", \`proposal:${result.proposal.proposalId}:alternative-requested\`, \`Your requested alternative time is ${result.proposal.customerAlternativeSlot?.toISOString() ?? "unavailable"}. ${result.proposal.customerAlternativeNote ?? ""}\`, result.order.orderStatus)`.
  13. Returns 200 with message "Alternative time request recorded" and order summary including `confirmedSlot` and `rescheduleProposals`.

### C. Model / persisted fields
- **File:** `backend/src/models/Order.ts`
- **Types/fields (source-confirmed):**
  - `ProposalStatus` includes `"ALTERNATIVE_REQUESTED"` (line ~21).
  - `IRescheduleProposal` includes `proposedSlot: Date`, `status: ProposalStatus`, `expiresAt: Date`, `customerResponse?: "ACCEPTED" | "DECLINED" | "REQUESTED_ALTERNATIVE"`, `customerResponseAt?: Date`, `customerAlternativeSlot?: Date`, `customerAlternativeNote?: string` (lines ~25-43).
  - Order includes `scheduledDate: string`, `scheduledTime: string`, `requestedSlot?`, `confirmedSlot?`, `proposedSlot?`, `rescheduleProposals: IRescheduleProposal[]`, `reschedulePreviousStatus?` (lines ~102-109).
  - Schema persists `customerAlternativeSlot` and `customerAlternativeNote` in reschedule proposal entries (grep evidence around lines ~394-395).
- **Interpretation (source-backed):** existing confirmed schedule is represented by order `scheduledDate/scheduledTime` and/or `confirmedSlot`; customer-requested alternative is represented by proposal `customerAlternativeSlot/note`; admin decision remains pending (no accept/reject of alternative in this handler).

### D. Notification event and outbox mapping
- **File:** `backend/src/services/notificationOutboxService.ts`
- **Observed behavior:** `DIRECT_EVENT_TYPE_TO_INTERNAL_EVENT` maps `RESCHEDULE_REQUESTED` -> `RESCHEDULE_REQUESTED` (line ~369). Outbox validates template/event through registry and fail-closed rules.
- **File:** `backend/src/services/customerOrderNotifications.ts`
- **Event type:** `CustomerOrderEvent` includes `RESCHEDULE_REQUESTED` (earlier in file; used by switch).
- **WhatsApp template mapping (source-confirmed):**
  - `case "RESCHEDULE_REQUESTED": return { templateName: "order_reschedule_requested", params: [customerName, order.orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl] };` (lines ~181-185).
- **Important:** mapping uses **current order schedule** (`order.scheduledDate`, `order.scheduledTime`). It does **not** use `customerAlternativeSlot`, `customerAlternativeNote`, or the `detail` argument passed by controller.

### E. Template registry contract
- **File:** `backend/src/services/whatsappTemplateRegistry.ts`
- **Entry (source-confirmed):** `internalEvent: "RESCHEDULE_REQUESTED"`, `templateName: "order_reschedule_requested"`, `requiredVariables: ["customerName", "orderNumber", "scheduledDate", "scheduledTime", "trackingUrl"]`, `approvalState: "NOT_SUBMITTED"`, `enabled: false`, fail-closed notes (lines ~223-232).

### F. Admin-side related workflow (context only)
- **Observed:** `proposeSlot` creates pending reschedule proposal (`RESCHEDULE_PROPOSED` status) and notifies `STATUS_CHANGED` with RESCHEDULE_PROPOSED detail. `acceptProposal`/`declineProposal` handle admin-proposed slot acceptance/decline and emit `RESCHEDULE_ACCEPTED`/`RESCHEDULE_REJECTED` using order schedule fields. `requestAlternativeSlot` is the customer response path requesting a different time; it records alternative on proposal and emits `RESCHEDULE_REQUESTED`.
- **Uncertainty:** The current codebase has no inspected dedicated admin "accept customer alternative slot" endpoint in the read snippets; admin workflows may need separate confirmation. This is an uncertainty to resolve before implementation.

---

## 4. Exact Current Notification Behavior (Confirmed by Source)

For customer alternative-time request (`POST /:id/proposal/request-alternative`, `requestAlternativeSlot`):

| Aspect | Actual behavior | Evidence |
|---|---|---|
| Event emitted | `RESCHEDULE_REQUESTED` | `orderController.ts` requestAlternativeSlot |
| Idempotency key detail | `proposal:${proposalId}:alternative-requested` | `orderController.ts` |
| Detail string passed to notifier | Includes requested alternative ISO and note | `orderController.ts` line ~1859 |
| WhatsApp template name | `order_reschedule_requested` | `customerOrderNotifications.ts` |
| WhatsApp params sent | `[customerName, orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl]` | `customerOrderNotifications.ts` lines ~181-185 |
| Schedule value actually used | **Existing order schedule fields** (`order.scheduledDate/scheduledTime`) | `customerOrderNotifications.ts` |
| Requested alternative used in WhatsApp params? | **No, not in current WhatsApp payload builder** | absence in mapping; controller detail not used by WhatsApp template mapping |
| Template/registry supports alternative slot variables? | **No, current registry requires only scheduledDate/scheduledTime** | `whatsappTemplateRegistry.ts` |
| Template approval/enabled? | **NOT_SUBMITTED / enabled:false / fail-closed** | `whatsappTemplateRegistry.ts` |

**Conclusion:** Current WhatsApp payload is source-confirmed to use existing order schedule fields, while the business event is a customer-requested alternative. This is a semantic/payload mismatch risk. The detail string contains alternative time but is not mapped into WhatsApp template params by current code.

---

## 5. Customer Communication Risks

- **Misleading confirmation risk (medium/high):** If the template text reads as "reschedule requested/received" but displays the existing schedule only, customers may think their alternative was not captured or that the old schedule is being re-requested.
- **False acceptance risk (high if poorly worded):** Any wording that implies the alternative is confirmed/approved before admin review would be incorrect.
- **Missing context risk (medium):** Showing only requested alternative without current schedule can be ambiguous if customer forgot original slot; showing both without labels can confuse.
- **Formatting risk (medium):** `order.scheduledDate/scheduledTime` are raw strings and can be inconsistent (see D20-06/BLB-20M evidence, including reschedule acceptance UTC formatting inconsistency). Any future date/time display must follow approved D20-06 convention only where reliable.

These risks are grounded in inspected source behavior; no external customer feedback is assumed.

---

## 6. D20-07 Owner Decision Options (NOT DECIDED)

### Option 1 — Requested alternative only (acknowledgement + requested slot)
- **Customer-facing meaning:** "We received your requested alternative delivery/pickup time; it is pending bakery review."
- **Required source values:** `customerName`, `orderNumber`, `customerAlternativeSlot` (or a reliably formatted requested date/time), `trackingUrl`; optional note not recommended for WhatsApp template variable unless approved.
- **Advantages:** Directly addresses the customer's action; avoids implying acceptance.
- **Risks/limitations:** Current WhatsApp mapping/registry do **not** include alternative slot params; current code uses `order.scheduledDate/scheduledTime`. Requires future source/template/registry/payload change (separate BLB-21 authorization). Needs clear formatting and IST/time-range handling per D20-06.
- **Future source change required?** **Yes.**

### Option 2 — Both schedules with explicit labels
- **Customer-facing meaning:** "We received your request to change delivery from [current schedule] to [requested alternative]. Pending review."
- **Required source values:** existing confirmed schedule (`order.scheduledDate/scheduledTime` or confirmedSlot-derived display) **and** requested alternative (`customerAlternativeSlot`), plus labels.
- **Advantages:** Most context; reduces ambiguity.
- **Risks/limitations:** More template variables and complexity; both values must be reliable and unambiguous. Current registry/mapping do not support it. D20-06 formatting and UTC reschedule inconsistency must be handled before implementation.
- **Future source change required?** **Yes.**

### Option 3 — Acknowledgment without schedule details
- **Customer-facing meaning:** "We received your request to change the delivery/pickup time for order {{orderNumber}}. Our team will review it and confirm."
- **Required source values:** `customerName`, `orderNumber`, `trackingUrl` (minimum). No schedule fields required.
- **Advantages:** Lowest mismatch risk given current payload uncertainty; no risk of showing wrong date/time; simple.
- **Risks/limitations:** Less specific; customer may want to see the requested time they submitted. Still requires template/registry/payload alignment if current template expects schedule variables.
- **Future source change required?** **Likely yes** (template/registry/mapping currently expect schedule params).

### Option 4 (source-justified) — Keep current schedule fields but fix wording to "existing schedule" only after owner/legal review
- **Customer-facing meaning:** Could acknowledge request and restate existing/current schedule, but this is **not recommended** unless explicitly approved because it may confuse the request intent.
- **Required source values:** already available in current mapping.
- **Advantages:** Minimal payload change.
- **Risks/limitations:** High confusion risk; does not communicate requested alternative. Not recommended.
- **Future source change required?** Possibly template text only, but semantic risk remains.

---

## 7. Recommended Wording (Proposal History; BLB-20P Captured Approved Content)

**Recommended owner-review option (historical proposal):** Option 1 or 2 depending on owner preference for specificity vs simplicity; **default recommendation: Option 1 (requested alternative only)** if reliable requested-alternative formatting is implemented, otherwise Option 3 until data/formatting is reliable. This was a recommendation only, not approval. BLB-20P captured the owner decision on 2026-11-22.

**Approved customer-facing message (APPROVED CONTENT — NOT IMPLEMENTED; implementation authorization NOT GRANTED):**

> Hello {{customerName}},
> 
> We received your request to change the scheduled time for order {{orderNumber}}.
> 
> Requested alternative: {{requestedAlternativeDateTime}}
> 
> Our team at S.V. Sweets & Bakers will review your request and let you know whether this alternative is available.
> 
> Please note that your existing schedule remains unchanged until we confirm the change.
> 
> Track your order: {{trackingUrl}}

**D20-06 convention note:** Any displayed date/time must use `DD MMM YYYY`, 12-hour AM/PM, IST, preserving genuine delivery-time ranges (e.g., `25 Dec 2026, 04:30 PM IST` or `25 Dec 2026, 10:00 AM – 12:00 PM IST` where the underlying value represents a range). Do not convert point-in-time to range or vice versa. **Do not append a second `IST` if the requested-alternative display value already includes IST under D20-06.**

**Important boundaries:** This wording is **APPROVED CONTENT — NOT IMPLEMENTED**. Implementation authorization is **NOT GRANTED** and it is **NOT AUTHORIZED FOR SEND**. `{{requestedAlternativeDateTime}}` is a **proposed variable only**; it does **not** currently exist in the WhatsApp template registry or WhatsApp payload mapping. Adding/changing variables requires separate BLB-21 authorization and Meta template work.

---

## 8. D20-07 Decision Capture (BLB-20P — 2026-11-22)

**Status:** **APPROVED BY PROJECT OWNER — 2026-11-22** (documentation/content decision only). **Implementation authorization NOT GRANTED.**

| Sub-decision | Decision | Status |
|---|---|---|
| **D20-07-A — Schedule displayed** | Show the customer's requested alternative date/time only. | **APPROVED BY PROJECT OWNER** |
| **D20-07-B — Review status** | Explicitly state that the bakery will review the request and confirm whether the requested alternative is available. | **APPROVED BY PROJECT OWNER** |
| **D20-07-C — Existing schedule** | Do not display the old schedule in this notification. Clearly state that the existing schedule remains unchanged until the bakery confirms the change. | **APPROVED BY PROJECT OWNER** |
| **D20-07-D — Implementation prerequisites** | Before implementation, ensure reliable alternative-slot data is available, apply the approved D20-06 date/time convention, update the template registry and payload mapping, and complete appropriate testing under separate implementation authorization. | **APPROVED BY PROJECT OWNER (prerequisites recorded; implementation NOT GRANTED)** |

**Approved customer-facing message (APPROVED CONTENT — NOT IMPLEMENTED):**

> Hello {{customerName}},
> 
> We received your request to change the scheduled time for order {{orderNumber}}.
> 
> Requested alternative: {{requestedAlternativeDateTime}}
> 
> Our team at S.V. Sweets & Bakers will review your request and let you know whether this alternative is available.
> 
> Please note that your existing schedule remains unchanged until we confirm the change.
> 
> Track your order: {{trackingUrl}}

**Variable / formatting note:** `{{requestedAlternativeDateTime}}` is a proposed template variable; not yet confirmed available in current notification registry/payload. Format per D20-06: `DD MMM YYYY`, 12-hour AM/PM, IST. Preserve ranges only when the underlying value is a range. Do not append a second IST suffix if the formatted value already includes it. Do not imply the alternative has been accepted or confirmed.

---

## 9. Dependencies and Implementation Boundary

- **D20-06:** Approved convention applies to any date/time displayed. D20-06-F reschedule UTC formatting inconsistency remains an implementation prerequisite where relevant.
- **D20-08:** D20-07 affects D20-08 only insofar as reschedule notification semantics/template naming/payloads should be consistent. **D20-08 remains NOT DECIDED** and is not resolved by this proposal.
- **D20-05:** Remains **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (B/E/F undecided). No change.
- **BLB-21:** Any source code/template registry/payload/mapping/test change is a future, separately authorized implementation task. **BLB-21 remains NOT AUTHORIZED.**

---

## 10. Verification / Boundaries (Updated BLB-20P)

- No application source, tests, fixtures, config, env, deps, DB, provider, Meta, or deployment changes made.
- No Git mutations performed.
- **D20-07 is APPROVED BY PROJECT OWNER — 2026-11-22** (A/B/C/D approved; exact wording APPROVED CONTENT — NOT IMPLEMENTED; implementation authorization NOT GRANTED). D20-08 remains **NOT DECIDED**. D20-09 remains **NOT DECIDED**. D20-06 remains approved. D20-05 remains partially approved (B/E/F undecided).
- Overall count: **5 fully approved / 1 partially approved / 3 not decided**.
- All 18 registered WhatsApp templates remain **NOT_SUBMITTED / enabled:false / empty metaTemplateId / fail-closed**.
- Blockers unchanged: W01 NOT RECEIVED; Meta approval NOT RECEIVED; D-14 NOT RECEIVED; D-16/D-17/D-18 UNRESOLVED; Group 5 13/13 DEFER, 0/13 granted; D-19 NO-GO; BLB-11A OD-01–OD-05 unresolved unless actual evidence exists.
- **BLB-21 remains NOT AUTHORIZED.**