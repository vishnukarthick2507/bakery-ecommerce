# BLB-20R — D20-08 Admin-Initiated Reschedule Proposal Decision Proposal

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Read-only source inspection + documentation-only proposal creation  
**Authorization:** BLB-20R only. **No BLB-21 authorization.**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Preflight / Scope Boundary

| Check | Result |
|---|---|
| Repository path | `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp` |
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (matches expected) |
| Git status (preflight) | `107 total / 58 tracked / 49 untracked` (pre-existing dirty worktree preserved) |
| Inspected files (minimum required) | `backend/src/routes/orderRoutes.ts`, `backend/src/routes/adminOrderRoutes.ts`, `backend/src/controllers/orderController.ts`, `backend/src/models/Order.ts`, `backend/src/services/notificationOutboxService.ts`, `backend/src/services/customerOrderNotifications.ts`, `backend/src/services/whatsappTemplateRegistry.ts`, `backend/src/services/proposalExpiry.ts`, `backend/src/server.ts` (mount evidence only) |
| Prohibited operations | None performed: no source/test/config/env/dependency/DB/provider/Meta/deploy changes; no tests/builds; no Git mutations; no external communications |

**This document is a decision proposal only.** It does **not** implement D20-08, does **not** authorize BLB-21, does **not** submit/approve/enable any WhatsApp template, does **not** imply Meta approval or live delivery, and does **not** modify any decision-register document.

---

## 2. Purpose and Scope

D20-08 investigates the **admin-initiated reschedule proposal** workflow: the bakery/admin proposes a new delivery/pickup slot to the customer, and the customer must be informed of the proposed slot and the applicable response process.

This is distinct from D20-07 (customer requests alternative time; see Section 4). The purpose is to establish source-backed facts, identify notification/readiness gaps, and provide owner-review decision options. **D20-08 remains NOT DECIDED.**

---

## 3. Source Evidence and Exact Implementation Findings

### 3.1 Route / Endpoint (Admin-Initiated Proposal)

| Finding | Source evidence |
|---|---|
| Admin propose-slot endpoint exists | `backend/src/routes/adminOrderRoutes.ts`: `POST "/:id/propose-slot"`, `authenticateAdmin`, `proposeSlot` (lines 1-15). |
| Mount path | `backend/src/server.ts`: `import adminOrderRoutes from "./routes/adminOrderRoutes.js"` (line 16); `app.use("/api/admin/orders", adminOrderRoutes)` (line 117). Effective route: **`POST /api/admin/orders/:id/propose-slot`**. |
| Authentication | `authenticateAdmin` middleware required (`adminOrderRoutes.ts` line 11; controller checks `req.admin`, returns 401 if missing, `orderController.ts` lines 1285-1288). |

### 3.2 Request Fields and Validation

Source: `proposeSlotSchema` and `proposeSlot` in `backend/src/controllers/orderController.ts` lines 1243-1255, 1290-1365.

| Field | Validation / behavior | Evidence |
|---|---|---|
| `:id` (path) | Must be valid Mongo ObjectId; 400 `"Invalid order ID"` otherwise | `orderController.ts` 1291-1296 |
| `time` (body) | Required ISO datetime string (`z.string().datetime(...)`); parsed as `new Date(proposedTimeStr)` | 1244-1246, 1308-1309 |
| `note` (body) | Required trimmed string, min 1, max 500; described as rescheduling reason | 1247 |
| `responseWindowHours` (body) | Optional integer, min 1, max 72, default 3 | 1248-1254 |
| Slot validity | `validateSlot(proposedTime, order.fulfillmentType)` must pass; 400 on invalid | 1322-1332 |
| Pending proposal conflict | Rejects if any pending proposal exists in `rescheduleProposals` history, or legacy `proposedSlot.status === "PENDING"` when no history; 409 | 1334-1344 |
| Eligible order status | Only `PLACED`, `PAYMENT_CONFIRMED`, `CONFIRMED` (`RESCHEDULE_ELIGIBLE_STATUSES`); 400 otherwise | 1274-1355 |
| Same-as-confirmed guard | Rejects if `confirmedSlot` exists and proposed time has same ms value; 400 | 1357-1365 |

### 3.3 Proposed Date/Time Storage and Schedule Behavior

Source: `orderController.ts` lines 1367-1399.

| Finding | Evidence |
|---|---|
| Proposed time stored as Date | `proposedSlot: proposedTime` in history entry; `order.proposedSlot.time = proposedTime` (1376, 1388). |
| Existing `scheduledDate`/`scheduledTime` are **not changed** by `proposeSlot` | `proposeSlot` sets proposal/history/status/proposedSlot fields only; no assignment to `order.scheduledDate` or `order.scheduledTime` observed (1367-1396). |
| Existing `confirmedSlot` is **not changed** by `proposeSlot` | No assignment to `order.confirmedSlot`; history stores `previousConfirmedSlot` when present (1375). |
| Order status changes immediately to `RESCHEDULE_PROPOSED` | `order.orderStatus = "RESCHEDULE_PROPOSED"` (1385). Previous status saved in `order.reschedulePreviousStatus` (1371, 1386). |
| Proposal expiry computed | `expiresAt = now + responseWindowHours*60*60*1000` (1368-1369). |
| History append | Proposal pushed into `rescheduleProposals` with `proposalId` (crypto.randomUUID), `proposedSlot`, `reason`, `proposedBy`, `proposedAt`, `status: "PENDING"`, `expiresAt`, optional `previousConfirmedSlot` (1372-1384). |
| Legacy mirror maintained | `order.proposedSlot` object also set with time/note/proposedBy/proposedAt/status/expiresAt (1387-1394). |
| Persistence | Transactional save in Mongoose session (1310, 1315-1399, 1406-1408). |

### 3.4 Order/Proposal Statuses

Source: `backend/src/models/Order.ts` lines 3-24, 337-352, 375-399; controller transitions.

| Entity | Statuses / fields | Evidence |
|---|---|---|
| `OrderStatus` includes `RESCHEDULE_PROPOSED` | `Order.ts` 14, 350 | Present in enum/type and schema. |
| `ProposalStatus` | `"PENDING" \| "ACCEPTED" \| "DECLINED" \| "EXPIRED" \| "ALTERNATIVE_REQUESTED"` | `Order.ts` 21 |
| `IRescheduleProposal` | `proposalId`, `previousConfirmedSlot?`, `proposedSlot`, `reason`, `proposedBy`, `proposedAt`, `status`, `expiresAt`, `customerResponse?`, `customerResponseAt?`, `customerAlternativeSlot?`, `customerAlternativeNote?`, expiry notification tracking fields | `Order.ts` 25-43 |
| `IProposedSlot` (legacy mirror) | `time, note, proposedBy, proposedAt, status, expiresAt` | `Order.ts` 45-52 |
| `order.reschedulePreviousStatus` | Stores pre-proposal status for restoration | `Order.ts` 109; set in `proposeSlot` 1371/1386 |
| `order.rescheduleProposals` | Array of proposal history | `Order.ts` 107, 375-399+ |

### 3.5 Customer Accept / Decline / Alternative-Request Behavior

Source: `orderController.ts` 1445-1882; routes `orderRoutes.ts` 68-84.

| Action | Route | Key behavior | Evidence |
|---|---|---|---|
| Accept | `POST /api/orders/:id/proposal/accept` (`orderRoutes.ts` 69-72, mounted `/api/orders` server.ts 111) | Requires customer auth. Finds pending proposal/history or legacy mirror. If expired, marks expired, restores previous status, returns 400 "Proposal has expired". Validates order status in `RESCHEDULE_PROPOSED/PLACED/PAYMENT_CONFIRMED/CONFIRMED`. Sets `confirmedSlot = proposedSlot`; proposal ACCEPTED; updates slotHistory; restores status: PLACED->CONFIRMED, PAYMENT_CONFIRMED->PAYMENT_CONFIRMED, else CONFIRMED; sets `scheduledDate`/`scheduledTime` from accepted UTC slot; clears `reschedulePreviousStatus`; saves. Emits `RESCHEDULE_ACCEPTED` notification. | 1445-1619, esp. 1506-1567, 1590-1599 |
| Decline | `POST /api/orders/:id/proposal/decline` (`orderRoutes.ts` 75-78) | Requires customer auth. Handles expiry similarly. Validates order status. Marks proposal DECLINED, `proposedSlot.status` DECLINED, adds slotHistory entry "Customer declined reschedule proposal" with from/to unchanged confirmed/requested/now; restores `orderStatus = reschedulePreviousStatus ?? "CONFIRMED"`; clears `reschedulePreviousStatus`; saves. Emits `RESCHEDULE_REJECTED` notification. Does not change `scheduledDate/scheduledTime/confirmedSlot`. | 1622-1781, esp. 1680-1756 |
| Request alternative | `POST /api/orders/:id/proposal/request-alternative` (`orderRoutes.ts` 81-84) | Requires customer auth. Body: `time` ISO datetime required, `note` optional max 500. Handles expiry similarly. Validates alternative slot with `validateSlot`. Marks proposal `ALTERNATIVE_REQUESTED`, records `customerAlternativeSlot/note`, sets `proposedSlot.status` ALTERNATIVE_REQUESTED, restores previous order status, clears `reschedulePreviousStatus`, saves. Emits `RESCHEDULE_REQUESTED` notification with detail containing requested alternative ISO/note. Does **not** change `scheduledDate/scheduledTime/confirmedSlot`. | 1783-1882, esp. 1835-1861 |

### 3.6 Expiry Behavior

Source: `backend/src/services/proposalExpiry.ts`.

| Finding | Evidence |
|---|---|
| Sweep finds pending proposals where `expiresAt <= now` | `expireProposals` query: `rescheduleProposals` elemMatch `status PENDING`, `expiresAt <= now` (338-345). |
| Atomic claim marks proposal EXPIRED | Sets `rescheduleProposals.$[p].status = EXPIRED`, `proposedSlot.status = EXPIRED`, initializes expiry notification tracking PENDING/attempts 0/nextRetryAt now (370-393). |
| Order status restored on expiry | Sets `orderStatus` to `reschedulePreviousStatus`; unsets `reschedulePreviousStatus` (401-416). No change to `scheduledDate/scheduledTime/confirmedSlot` observed. |
| Customer notification on expiry | **No WhatsApp/customer outbox notification observed.** Service sends **admin email alert** via `sendRescheduleExpiryAlert` through `processPendingExpiryNotifications` (422-423, 214-315). UAT-safe suppression and config checks present. |
| Expiry worker scheduling | `startProposalExpiryWorker` runs sweep every `PROPOSAL_EXPIRY_SCAN_INTERVAL_MS = 30_000` (8, 435-447). |

### 3.7 Current Notification / Communication Behavior for Admin Proposal

| Finding | Evidence |
|---|---|
| `proposeSlot` calls `notifyCustomerOrder` | After transaction commit, finds proposal and calls `notifyCustomerOrder(order, "STATUS_CHANGED", \`proposal:${proposal.proposalId}\`, \`A new time was proposed: ${proposal.proposedSlot.toISOString()}. ${proposal.reason}\`, "RESCHEDULE_PROPOSED")` (1416-1425). |
| Email path | `notifyCustomerOrder` sends email for non-`PAYMENT_FAILED` events when `order.userId` exists and user email verified (customerOrderNotifications.ts 24-39). It passes event as `CustomerOrderEmailInput["event"]` cast; actual email template handling for `STATUS_CHANGED`/`RESCHEDULE_PROPOSED` status is **not fully inspected here** (emailService not fully read). **Unresolved from inspected notification mapping:** exact customer email content/template for this specific propose-slot notification. |
| WhatsApp path for proposeSlot | `enqueueCustomerOrderWhatsApp` builds template via `whatsappTemplateFor(order, event, status)`. For event `STATUS_CHANGED` and status `RESCHEDULE_PROPOSED`, `whatsappTemplateFor` has no matching status case and returns `null` (customerOrderNotifications.ts 139-170, 181-198; no `RESCHEDULE_PROPOSED` case). Therefore **no WhatsApp outbox job is enqueued** for the current admin proposal path. |
| `RESCHEDULE_PROPOSED` not in outbox event mapping | `notificationOutboxService.ts` `DIRECT_EVENT_TYPE_TO_INTERNAL_EVENT` has no `RESCHEDULE_PROPOSED` / `STATUS_CHANGED_RESCHEDULE_PROPOSED` (364-378). `STATUS_CHANGED_TEMPLATE_TO_INTERNAL_EVENT` has no reschedule-proposed template (356-362). |
| `RESCHEDULE_PROPOSED` not in WhatsApp registry | `whatsappTemplateRegistry.ts` contains `RESCHEDULE_REQUESTED/ACCEPTED/REJECTED` entries only (222-254); no `RESCHEDULE_PROPOSED` / admin-proposal template. `enabled:false`, `NOT_SUBMITTED`, fail-closed apply to existing reschedule entries. |
| Existing reschedule templates mapped | `RESCHEDULE_REQUESTED -> order_reschedule_requested`, `RESCHEDULE_ACCEPTED -> order_reschedule_accepted`, `RESCHEDULE_REJECTED -> order_reschedule_rejected` in customer notifications, outbox direct event map, and registry (customerOrderNotifications.ts 181-195; notificationOutboxService.ts 369-371; registry 222-254). All three are `NOT_SUBMITTED`, `enabled:false`. |

### 3.8 Exact Payload / Template Variable Availability

| Template/event | Current params (source) | Registry required vars | Availability / gap |
|---|---|---|---|
| `RESCHEDULE_REQUESTED` (`order_reschedule_requested`) | `[customerName, orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl]` | same 5 vars | Available as current order fields; semantic mismatch risk already recorded in D20-07 (uses existing schedule, not requested alternative). |
| `RESCHEDULE_ACCEPTED` (`order_reschedule_accepted`) | `[customerName, orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl]` | same 5 vars | Available. On accept, controller updates `scheduledDate/scheduledTime` to accepted UTC-derived values before save/notify (orderController.ts 1556-1561, 1590-1599) — D20-06-F UTC formatting inconsistency caveat applies. |
| `RESCHEDULE_REJECTED` (`order_reschedule_rejected`) | `[customerName, orderNumber, order.scheduledDate, order.scheduledTime, trackingUrl]` | same 5 vars | Available; existing schedule retained by decline flow. |
| Admin-proposed reschedule (D20-08 target) | **No WhatsApp template/payload currently mapped.** | **No registry entry exists.** | Proposed slot is available in proposal/history as Date (`proposal.proposedSlot`), reason/note available, expiry available, orderNumber/customerName/trackingUrl available. **No approved/registered template variables for proposed slot display.** A proposed-slot display string would need a defined formatting source and D20-06-compliant formatting; raw ISO Date is not customer-friendly. |

### 3.9 Reliability / Accidental Old-Schedule Risk

| Risk | Source-backed assessment |
|---|---|
| Accidental old schedule display | **High if reusing existing reschedule templates/params without change.** Existing reschedule WhatsApp payload builders use `order.scheduledDate` and `order.scheduledTime` (customerOrderNotifications.ts 184, 189, 194). For admin-proposed reschedule, the existing order schedule remains unchanged until acceptance (`proposeSlot` does not mutate scheduledDate/scheduledTime). Reusing those params would communicate the old/current schedule, not the newly proposed slot. |
| Proposed slot availability | Proposal stores `proposedSlot` Date in history and `order.proposedSlot.time` (Order.ts 28/46; controller 1376/1388). Available in backend model/controller context. Not currently mapped to WhatsApp template params. |
| UTC/local formatting inconsistency | Accept flow writes `scheduledDate/scheduledTime` using UTC ISO split (orderController.ts 1556-1561). D20-06-F records this as implementation prerequisite; any D20-08 display formatting must follow D20-06 and avoid misrepresenting UTC-derived fields as IST unless converted appropriately. |
| Expiry/customer action clarity | Expiry is enforced by proposal `expiresAt` and expiry sweep; no customer WhatsApp expiry notification path observed. Customer response endpoints exist (accept/decline/request-alternative) but are authenticated API routes; no customer-facing response URL/template action was verified in inspected source. |

---

## 4. D20-07 vs D20-08 Distinction

| Dimension | D20-07 — Customer Alternative-Time Request | D20-08 — Admin-Initiated Reschedule Proposal |
|---|---|---|
| Initiator | Customer responds to an existing proposal by requesting alternative time (`requestAlternativeSlot`, `POST /api/orders/:id/proposal/request-alternative`) | Bakery/admin proposes a new slot (`proposeSlot`, `POST /api/admin/orders/:id/propose-slot`) |
| Current status/effect | Proposal becomes `ALTERNATIVE_REQUESTED`; order status restored to `reschedulePreviousStatus ?? CONFIRMED`; existing `scheduledDate/scheduledTime/confirmedSlot` unchanged | Order becomes `RESCHEDULE_PROPOSED`; proposal PENDING; existing `scheduledDate/scheduledTime/confirmedSlot` unchanged until customer accepts |
| Customer communication intent | Acknowledge customer's requested alternative; pending review; not accepted/confirmed. D20-07 approved wording/content exists (BLB-20P, 2026-11-22), implementation NOT GRANTED. | Inform customer that bakery proposed a new slot; clearly state proposed slot and required response process; must not imply acceptance/confirmation; existing schedule remains unchanged until acceptance only if confirmed by source behavior (confirmed above for propose flow). |
| Current WhatsApp mapping | `RESCHEDULE_REQUESTED -> order_reschedule_requested` exists in code/registry/outbox mapping but template is `NOT_SUBMITTED`, `enabled:false`; payload currently uses existing order schedule fields (known D20-07 mismatch/gap). | **No `RESCHEDULE_PROPOSED` WhatsApp template/registry/outbox mapping exists.** `proposeSlot` triggers `notifyCustomerOrder(..., "STATUS_CHANGED", ..., "RESCHEDULE_PROPOSED")` but WhatsApp template resolver returns null for that status; no outbox job enqueued. |
| Implementation status | D20-07 decision approved; implementation authorization NOT GRANTED | D20-08 NOT DECIDED; no implementation authorization |

**Do not reuse D20-07 wording or payload assumptions for D20-08 without separate owner decision and verified payload/template mapping.** D20-07 communicates a customer-requested alternative pending bakery review; D20-08 would communicate a bakery-proposed alternative pending customer response.

---

## 5. Current Notification Readiness and Gaps

### Ready / Present (source-backed)
- Admin propose endpoint, validation, transactional proposal creation, and status transition to `RESCHEDULE_PROPOSED` exist.
- Proposed slot is stored as Date in proposal history and `order.proposedSlot`.
- Customer accept/decline/request-alternative endpoints exist and are authenticated.
- Expiry worker marks proposals EXPIRED, restores previous order status, and processes admin expiry email notifications.
- Tracking URL pattern exists in notification payload builders: `${NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app}/track?order=...` (customerOrderNotifications.ts 114). This is an existing supported destination pattern; D20-01/production domain confirmation remains separate where applicable.

### Gaps / Unresolved
1. **No WhatsApp template for admin-proposed reschedule.** No `RESCHEDULE_PROPOSED`/`order_reschedule_proposed` (or equivalent) entry in `whatsappTemplateRegistry.ts`; no mapping in `notificationOutboxService.ts`; `whatsappTemplateFor` returns null for `STATUS_CHANGED` + `RESCHEDULE_PROPOSED`.
2. **No approved Meta template / no enabled registry entry / no Meta submission.** All existing reschedule templates are NOT_SUBMITTED/enabled:false/empty metaTemplateId/fail-closed by project state.
3. **Proposed-slot template variable contract undefined.** Existing reschedule templates use `scheduledDate, scheduledTime` (current order schedule). For D20-08, using those fields risks showing the old schedule. A dedicated proposed-slot variable (or clearly labeled pair) is needed but is **not currently registered**.
4. **Customer response action in WhatsApp is unresolved.** Accept/decline/request-alternative are authenticated API endpoints (`/api/orders/:id/proposal/accept|decline|request-alternative`). No customer-facing WhatsApp deep link/button/URL flow was verified. Any CTA wording must not invent a URL or unsupported action.
5. **Expiry customer communication gap.** Proposal expiry restores order status and alerts admin by email; no customer WhatsApp expiry notification was found.
6. **D20-06 formatting prerequisite.** Proposed slot is a Date; display must follow D20-06 (DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only where underlying value is a range; do not append IST twice). Proposal proposedSlot is a single Date/time point in schema; range handling not applicable unless future model changes.
7. **UTC/local formatting inconsistency (D20-06-F).** Accept path currently writes `scheduledDate/scheduledTime` using UTC ISO split. Not a direct D20-08 template blocker, but any implementation touching schedule display must avoid compounding this inconsistency.
8. **Email behavior for STATUS_CHANGED/RESCHEDULE_PROPOSED not fully evidenced here.** `notifyCustomerOrder` invokes email path for STATUS_CHANGED; exact email template/content for RESCHEDULE_PROPOSED was not fully inspected in this task. Marked unresolved.

---

## 6. Proposed Customer Communication (Draft for Owner Review — NOT APPROVED)

**Status:** DRAFT ONLY — NOT APPROVED / NOT IMPLEMENTED / NOT AUTHORIZED FOR SEND / NOT META-SUBMITTED.

### Draft A — Proposed slot + tracked response instruction (recommended for owner review only if response-flow gap is accepted as "track your order" rather than direct action link)

> Hello {{customerName}},
> 
> S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}.
> 
> Proposed schedule: {{proposedSchedule}} *(proposed variable; not currently registered/mapped)*
> 
> Your existing schedule remains unchanged until you accept the proposed change. Please review the proposal by tracking your order: {{trackingUrl}}
> 
> If you need help, please contact S.V. Sweets & Bakers.

**Draft A caveats:** `{{proposedSchedule}}` is a proposed variable only; not in registry/payload. It must be formatted per D20-06 (DD MMM YYYY, 12-hour AM/PM, IST; single point; no second IST). "Review the proposal by tracking your order" is cautious wording; it does **not** claim an in-message accept/decline button exists. Actual track page behavior for responding to proposals is **not verified in this BLB-20R backend inspection** and must be verified before approval/implementation.

### Draft B — Acknowledgement without specific response CTA beyond tracking/contact (safer if response UX unverified)

> Hello {{customerName}},
> 
> S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}.
> 
> Proposed schedule: {{proposedSchedule}} *(proposed variable; not currently registered/mapped)*
> 
> Your existing schedule remains unchanged until you confirm the change with us. For details, please track your order: {{trackingUrl}}

**Draft B caveats:** Avoids claiming accept/decline action mechanics; still requires verified tracking destination and proposed-slot variable/mapping. "Confirm the change with us" is less precise than API reality (accept/decline/request-alternative endpoints exist) and should be owner-refined.

### Wording constraints
- Do **not** claim the new time is confirmed.
- Do **not** invent accept/decline/request-alternative URLs or buttons.
- Do **not** append IST twice.
- Do **not** use `order.scheduledDate/scheduledTime` as proposed-slot fields.
- Use D20-06 display convention for any displayed proposed schedule.

---

## 7. Required Template Variables and Actual Availability

| Variable (proposed / referenced) | Status | Source-backed availability | Notes |
|---|---|---|---|
| `customerName` | Existing pattern | Available (`order.customer?.name || order.customerName`) | Used by existing WhatsApp payload builders. |
| `orderNumber` | Existing pattern | Available (`order.orderNumber`) | Used by existing WhatsApp payload builders. |
| `trackingUrl` | Existing pattern | Available as constructed URL pattern in `customerOrderNotifications.ts` line 114 | Destination/domain confirmation may be affected by D20-01; no new route invented. |
| `proposedSchedule` / `proposedDate`+`proposedTime` | **Proposed only — NOT registered/mapped** | Raw source value available as `proposal.proposedSlot` Date / `order.proposedSlot.time`; customer-friendly D20-06 display string **not currently produced** by WhatsApp payload builder | Owner must decide variable contract. Any new variable requires registry, payload builder, outbox mapping, Meta template work, and BLB-21 authorization. |
| `reason` / `note` | **Not proposed as required WhatsApp variable** | Available as `proposal.reason` (required on propose) | Including reason may increase template sensitivity/length; owner/legal/Meta review needed. Not currently in any reschedule template. |
| `expiresAt` / response window | **Not proposed as required WhatsApp variable** | Available (`proposal.expiresAt`, `responseWindowHours` input) | Could be useful but adds formatting/variable complexity; not currently registered. |
| `scheduledDate`, `scheduledTime` (existing order schedule) | Existing registry vars | Available on order | **Unsafe for D20-08 proposed-slot meaning** because existing schedule remains unchanged on proposal; would risk old-schedule display. |

---

## 8. Customer-Facing Status / Acceptance Semantics

| Semantic point | Source-backed status | Evidence |
|---|---|---|
| Proposal created by admin | Order becomes `RESCHEDULE_PROPOSED`; proposal status `PENDING`; `reschedulePreviousStatus` stored | `orderController.ts` 1371-1395 |
| Existing schedule unchanged on proposal | `scheduledDate/scheduledTime/confirmedSlot` not mutated in `proposeSlot`; only proposal/proposedSlot/status fields set | `orderController.ts` 1367-1396 |
| Customer accepts | Proposal ACCEPTED; `confirmedSlot` becomes proposed slot; `scheduledDate/scheduledTime` overwritten from accepted slot (UTC split); status restored per previous-status rules; `reschedulePreviousStatus` cleared | 1525-1567 |
| Customer declines | Proposal DECLINED; order status restored to previous (`reschedulePreviousStatus ?? CONFIRMED`); existing confirmed/scheduled fields not changed by decline path; `reschedulePreviousStatus` cleared | 1700-1724 |
| Customer requests alternative | Proposal ALTERNATIVE_REQUESTED; customer alternative slot/note stored; order status restored to previous; existing schedule unchanged | 1835-1849 |
| Proposal expires | Expiry sweep marks EXPIRED, sets proposedSlot.status EXPIRED, restores previous order status, clears `reschedulePreviousStatus`; admin email alert flow; no customer WhatsApp observed | `proposalExpiry.ts` 370-423 |
| Response channels available in backend | Authenticated API endpoints for accept/decline/request-alternative exist | `orderRoutes.ts` 68-84; controller 1445-1882 |

**Owner decision needed:** how explicitly WhatsApp should describe the response process, given verified API endpoints exist but no verified customer-facing WhatsApp action/link was inspected.

---

## 9. Relevant Failure, Expiry, and Unchanged-Schedule Behavior

| Scenario | Observed behavior | Evidence | Customer comms implication |
|---|---|---|---|
| Invalid/missing propose inputs | 400 validation errors | 1298-1306, schema 1243-1255 | No customer notification sent by propose path. |
| Invalid slot | 400 from `validateSlot` | 1322-1332 | No proposal created. |
| Pending proposal already exists | 409 | 1334-1344 | Prevents duplicate pending proposals. |
| Ineligible order status | 400 | 1346-1355 | Cannot propose for non-eligible statuses. |
| Proposal expires before response | Proposal marked EXPIRED; order restored to previous status; admin email alert queued/sent per notification config; no customer WhatsApp | `proposalExpiry.ts` 338-423 | D20-08 message should avoid implying proposal is open-ended; expiry/response window communication is an owner decision. |
| Customer declines | Existing schedule remains; previous status restored; RESCHEDULE_REJECTED notification event emitted (WhatsApp template currently NOT_SUBMITTED/disabled) | 1700-1756 | Current reject template exists but is not Meta-approved/enabled. |
| Customer accepts | Schedule updated to proposed/accepted slot; RESCHEDULE_ACCEPTED emitted | 1525-1599 | Existing accept template exists but not Meta-approved/enabled; UTC formatting caveat applies. |
| WhatsApp registry disabled/not submitted | Outbox/registry fail closed | `whatsappTemplateRegistry.ts` 299-315, 222-254; notificationOutbox behavior | No accidental live send from disabled/unapproved template. |

---

## 10. Decision Options (D20-08)

| Option | Description | Advantages | Risks / consequences | Prerequisites |
|---|---|---|---|---|
| **A. No WhatsApp for admin-proposed reschedule (status quo)** | Keep D20-08 unmapped; no WhatsApp template for RESCHEDULE_PROPOSED. | Zero Meta/template/wording/payload risk; preserves current fail-closed behavior. | Customer may miss admin proposal unless another channel is used; operational follow-up burden. | None beyond documenting decision. |
| **B. Add dedicated D20-08 WhatsApp template for admin-proposed reschedule** | Create separate internal event/template/registry/payload for admin proposal with proposed-slot variable(s), D20-06 formatting, clear "not confirmed until accepted" wording, and verified response instruction. | Clear semantics; avoids D20-07/D20-08 confusion; can show proposed slot accurately. | Requires BLB-21 implementation authorization, new template contract, registry/outbox mapping, payload formatting, tests, Meta submission/approval, response-flow UX verification. | Reliable proposed-slot formatting source; variable contract decision; response CTA/tracking UX verification; D20-06 formatting; D20-06-F awareness; Meta approval; legal/compliance as applicable. |
| **C. Reuse existing reschedule template family with careful remap** | Attempt to reuse an existing reschedule template name/structure for admin proposals. | Potentially fewer template names. | **High semantic/payload risk.** Existing reschedule templates/vars are old-schedule oriented (`scheduledDate/scheduledTime`) and D20-07/D20-08 semantics differ. Reuse can cause wrong schedule display or ambiguous customer messaging. | Strongly discouraged unless owner accepts high redesign risk and separate BLB-21 scope covers full remap/testing/Meta resubmission. |
| **D. Defer D20-08** | Leave undecided; no implementation. | No premature commitment. | Leaves admin-proposal WhatsApp gap undocumented as decision; future work still blocked. | None. |

**Recommendation (for owner review only, not approval):** **Option B (dedicated D20-08 template)** is the safest semantic path *if and only if* the project owner wants WhatsApp notification for admin-proposed reschedules. Option A remains acceptable if WhatsApp is not desired for this event. Option C is not recommended due old-schedule/payload/semantic mismatch risk. This recommendation is **not** owner approval and **not** implementation authorization.

---

## 11. Recommended Option with Reasoning

**Recommended for owner review:** **Option B — dedicated admin-proposed reschedule WhatsApp template**, with implementation deferred until separate authorization.

**Reasoning (source-backed):**
- The admin-proposed workflow is materially different from D20-07 customer-requested alternative. D20-07 has approved content stating "requested alternative" pending bakery review; D20-08 would need to say "bakery proposed" pending customer response.
- Current WhatsApp payloads for reschedule events use `order.scheduledDate/scheduledTime` (existing schedule). Reusing them for an admin proposal would risk displaying the old schedule rather than the proposed new slot.
- The codebase already has a fail-closed registry/outbox model; adding a dedicated disabled/unsubmitted template entry would fit the existing control pattern, but only under separate BLB-21 authorization.
- Customer response endpoints exist, but no verified WhatsApp deep-link/action was inspected; wording must be cautious and tracking/contact based unless UX is verified.

**Not recommended now:** any implementation, template submission, Meta action, or registry enablement.

---

## 12. Explicit Project-Owner Decision Fields

| Decision field | Owner response required | Status |
|---|---|---|
| D20-08-A | Should admin-initiated reschedule proposals send a WhatsApp notification at all? (Yes/No/Defer) | **NOT DECIDED** |
| D20-08-B | If yes, which template/variable contract is approved? (proposed single `proposedSchedule` vs `proposedDate`+`proposedTime`, and whether to include reason/expiry) | **NOT DECIDED** |
| D20-08-C | What customer response instruction is approved, given verified endpoints exist but no verified WhatsApp deep-link/action? (track order / contact bakery / other verified action) | **NOT DECIDED** |
| D20-08-D | Should expiry/response window be communicated in the message? | **NOT DECIDED** |
| D20-08-E | Approved exact customer-facing wording (English) and any localization requirement | **NOT DECIDED** |
| D20-08-F | Implementation prerequisites acknowledged: dedicated template/registry/outbox/payload mapping, D20-06 formatting, D20-06-F UTC caveat, no old-schedule reuse, response UX verification, tests, Meta submission/approval, legal/compliance as applicable | **NOT DECIDED** |

---

## 13. Decision Table

| Decision item | Options | Recommended option | Project-owner decision | Status |
|---|---|---|---|---|
| D20-08 Admin-initiated reschedule proposal WhatsApp notification | A) No WhatsApp/status quo; B) Dedicated D20-08 template (proposed-slot vars, D20-06, clear response semantics); C) Reuse/remap existing reschedule template family (high risk); D) Defer | **B** for owner review only if WhatsApp desired; otherwise A. C not recommended. | *(owner to complete)* | **NOT DECIDED** |

---

## 14. Implementation Prerequisites and Separate Authorization Requirements

If owner later approves D20-08, implementation still requires **separate BLB-21 authorization** and at minimum:

1. **Approved decision record**: exact option, wording, variable contract, response instruction, and conditions.
2. **Dedicated template contract**: new internal event/template name/registry entry; do not overload D20-07 semantics.
3. **Payload/mapping update**: `customerOrderNotifications.ts`/outbox/registry mapping for RESCHEDULE_PROPOSED (or owner-approved internal event name) with proposed-slot fields; do not reuse `order.scheduledDate/scheduledTime` as proposed slot.
4. **D20-06 formatting**: DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only if underlying value is a range (proposal proposedSlot is a point Date in current schema); do not append IST twice; display only.
5. **D20-06-F awareness**: avoid compounding UTC/local schedule formatting inconsistency; acceptance-path formatting fix remains separate prerequisite where applicable.
6. **Response UX verification**: confirm how customers respond (track page flow / authenticated actions / support contact) before claiming action in template.
7. **Fail-closed registry**: keep `NOT_SUBMITTED`, `enabled:false`, empty `metaTemplateId` until explicit Meta approval and authorized enablement.
8. **Testing**: unit/integration/outbox/registry/template-validation/regression tests under separate authorization.
9. **External gates unchanged**: W01 legal/compliance not received; Meta approval not received; D-14/D-16/D-17/D-18 unresolved as applicable; Group 5 0/13 granted; D-19 NO-GO.
10. **No production/UAT/DB/provider/Meta/live actions** without separate explicit authorization.

---

## 15. Boundaries / Non-Authorization Statement

- D20-08 is **NOT DECIDED**.
- This proposal is **not** implementation authorization.
- No WhatsApp template submission is authorized.
- No Meta approval or delivery is implied.
- **BLB-21 remains NOT AUTHORIZED.**
- All 18 currently registered WhatsApp templates remain **NOT_SUBMITTED / enabled:false / empty metaTemplateId / fail-closed** (project state; unchanged by this document).
- No code, tests, config, env, dependencies, DB, provider integrations, Meta settings, or deployment were changed by BLB-20R.

---

*End of BLB-20R D20-08 proposal (documentation-only).*