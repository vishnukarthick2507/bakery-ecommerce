# BLB-23A — D20-08-D Expiry / Deadline Decision Review

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22 (review) / 2026-11-22 (owner decision captured, BLB-23D)  
**Type:** READ-ONLY source inspection + documentation-only owner decision capture  
**Status:** **D20-08-D APPROVED BY PROJECT OWNER — Option C (2026-11-22)**  
**BLB-21:** **NOT AUTHORIZED**  

---

## 1. Executive Summary

This review inspects the actual admin-initiated reschedule proposal expiry behavior to support an owner decision for **D20-08-D** (whether/ how to communicate proposal expiry/deadline in the dedicated D20-08 WhatsApp notification).

**Key evidence-based findings:**
- Proposal response window is **configurable per proposal** by admin: `responseWindowHours` integer, **min 1, max 72, default 3 hours** (`backend/src/controllers/orderController.ts` L1243-1255,1368-1369).
- `expiresAt` is calculated at proposal creation: `now + responseWindowHours*60*60*1000` (L1368-1369,1381,1393).
- Expiry is enforced by **two mechanisms**: (1) customer response endpoints check `expiresAt` and return expired (L1504-1514,1680-1689,1828-1834); (2) `proposalExpiry` worker scans every 30s, atomically marks PENDING proposals with `expiresAt <= now` as EXPIRED, restores previous order status, clears `reschedulePreviousStatus`, and initializes admin email notification tracking (L323-454,437-447).
- **No WhatsApp expiry notification** exists. Expiry admin alert is **email only** (`sendRescheduleExpiryAlert`, Brevo) with retry/backoff/lease; UAT-safe suppression applies (L54-319). No WhatsApp template/registry/outbox mapping for proposal expiry.
- Customer UI shows a live countdown for PENDING proposals; when countdown reaches 0 it displays "Expired" and "Your response time has expired..." message ( `app/account/orders/[orderNumber]/page.tsx` L152-168,187-215,537-609). Backend rejects accept/decline/request-alternative after expiry.
- D20-08-C (approved Option B, 2026-11-22) requires generic contact S.V. Sweets & Bakers instruction; no tracking-page response mechanism/button/direct acceptance link/unverified channel.
- **BLB-23D owner decision (2026-11-22): D20-08-D Option C APPROVED BY PROJECT OWNER.** The customer-facing WhatsApp notification must not mention an exact proposal expiry date or time, a relative response deadline, a response-window duration, or a countdown/deadline warning. Instead, the notification should instruct the customer to contact S.V. Sweets & Bakers to discuss the proposed schedule. No expiry-related template variable is required for this approved decision. This decision does not change the application's existing proposal expiry behaviour. D20-08-E/F remain NOT DECIDED.

**Original recommendation (pre-decision, preserved for history): Option B (relative response window) with strict caveats**, or **Option D** if owner wants zero expiry-claim risk until D20-08-E/F and implementation are fully authorized. **Option A (explicit expiry date/time)** was high-risk unless a precise, timezone-correct, precomputed `{{proposalExpiresAt}}` (PROPOSED — NOT IMPLEMENTED) value was added and validated. **Owner selected Option C (2026-11-22).**

---

## 2. Source Evidence (Exact References)

| Area | File | Lines | Evidence |
|---|---|---:|---|
| Proposal schema/default window | `backend/src/controllers/orderController.ts` | L1243-1255 | `proposeSlotSchema`: `time` ISO datetime; `note` required 1-500; `responseWindowHours` int min 1 max 72 optional default 3 |
| Expiry calculation | `backend/src/controllers/orderController.ts` | L1368-1369,1381,1393 | `responseWindowMs = (responseWindowHours ?? 3)*60*60*1000`; `expiresAt = new Date(now.getTime()+responseWindowMs)`; stored in history entry and `proposedSlot.expiresAt` |
| Proposal creation/status | `backend/src/controllers/orderController.ts` | L1371-1395 | Sets `reschedulePreviousStatus`, pushes PENDING proposal with `expiresAt`, sets `orderStatus=RESCHEDULE_PROPOSED`, stores `proposedSlot` |
| Customer accept expiry check | `backend/src/controllers/orderController.ts` | L1504-1514,1585-1587 | If `proposal.expiresAt <= now`: `markExpiredProposal`, restore previous status (`reschedulePreviousStatus ?? "CONFIRMED"`), save, return expired; API returns 400 "Proposal has expired" |
| Customer decline expiry check | `backend/src/controllers/orderController.ts` | L1680-1689,1742-1745 | Same expiry behavior; returns 400 "Proposal has expired" |
| Customer alternative expiry check | `backend/src/controllers/orderController.ts` | L1828-1834,1851-1853 | Same expiry behavior; clears `reschedulePreviousStatus`; returns 400 "Proposal has expired" |
| markExpiredProposal helper | `backend/src/controllers/orderController.ts` | L1262-1272 | Finds PENDING history entry sets EXPIRED; sets `proposedSlot.status = EXPIRED` |
| Expiry worker constants | `backend/src/services/proposalExpiry.ts` | L8-12,26-41 | Scan interval 30s; max notification attempts 5; claim lease 2m; backoff 1/5/15/30 min |
| Expiry sweep | `backend/src/services/proposalExpiry.ts` | L323-433 | Finds orders with PENDING proposal `expiresAt <= now`; atomic claim sets proposal EXPIRED, `proposedSlot.status=EXPIRED`, initializes expiry notification PENDING/attempts=0/nextRetryAt=now; restores `orderStatus=reschedulePreviousStatus`, unsets `reschedulePreviousStatus`; calls `processPendingExpiryNotifications` |
| Expiry admin email notifications | `backend/src/services/proposalExpiry.ts` | L54-319 | Sends admin email via `sendRescheduleExpiryAlert` (Brevo) only; UAT-safe suppression blocks external email; config check; atomic lease/attempt/retry/backoff/terminal failure. No WhatsApp send. |
| Worker startup | `backend/src/services/proposalExpiry.ts` | L435-454; `backend/src/server.ts` L27,249,279 | `startProposalExpiryWorker` runs sweep immediately then every 30s; started on server startup; stopped on graceful shutdown |
| Order model proposal fields | `backend/src/models/Order.ts` | L21-52,104-109 | `ProposalStatus` includes EXPIRED; `IRescheduleProposal` has `expiresAt`, `status`, customer response fields, expiry notification fields; `IProposedSlot` has `expiresAt`, `status` |
| Customer UI countdown | `app/account/orders/[orderNumber]/page.tsx` | L152-168,187-215,537-609 | `getCountdownSeconds` returns seconds or null when <=0; countdown updates every 1s; PENDING proposal shows "Time left to respond" / formatted countdown; when null shows "Your response time has expired. Your original confirmed delivery slot remains unchanged. The bakery will follow up with you." |
| Admin UI propose window | `app/admin/orders/page.tsx` | L334,360,1293,1307,688-808 | Admin can pass `responseWindowHours` (default 3 in UI state); displays proposed slot, status, expiresAt; WhatsApp copy text exists but is manual/admin UI copy, not automated WhatsApp template send |
| Expiry notification email | `backend/src/services/emailService.ts` | L651-720 (grep evidence) | `sendRescheduleExpiryAlert` exists; includes `expiresAt` string in email body; best-effort |
| Tests (read-only evidence) | `backend/tests/proposalExpiry.test.ts`, `backend/tests/uatSafeMode.test.ts` | grep evidence | Tests cover expiry marking, notification status transitions, UAT suppression behavior |

---

## 3. Actual Expiry Lifecycle (Evidence-Based)

1. **Proposal creation (admin):** Admin POST `/api/admin/orders/:id/propose-slot` with `time`, `note`, optional `responseWindowHours` (1-72, default 3). Controller validates slot, computes `expiresAt = now + responseWindowHours hours`, stores PENDING proposal/history and `proposedSlot.expiresAt`, sets order `RESCHEDULE_PROPOSED`, stores previous status (L1243-1439).
2. **Pending window:** Customer can accept/decline/request alternative while PENDING and `expiresAt > now`.
3. **Customer response before expiry:** Accept/decline/request-alternative endpoints transactionally check proposal/order state and `expiresAt`; if not expired, mutate proposal/order accordingly (L1445-1882).
4. **Expiry detection:** Two paths:
   - **On-demand (customer action):** if customer acts at/after expiry, endpoint marks proposal EXPIRED, restores previous status, saves, returns 400 "Proposal has expired" (accept/decline/request-alternative).
   - **Background worker:** `expireProposals()` runs every 30s (`PROPOSAL_EXPIRY_SCAN_INTERVAL_MS=30_000`, L8,437-447). It finds PENDING proposals `expiresAt <= now`, atomically claims/marks EXPIRED, sets `proposedSlot.status=EXPIRED`, initializes notification state, restores `orderStatus` to `reschedulePreviousStatus`, unsets `reschedulePreviousStatus` (L323-433).
5. **Post-expiry notification:** Worker then processes pending expiry notifications. **Admin email alert only** (`sendRescheduleExpiryAlert`), with lease/retry/backoff/max attempts/terminal failure (L54-319). No customer WhatsApp expiry notification. No WhatsApp registry/outbox mapping for expiry.
6. **Terminal state:** Proposal remains EXPIRED; original schedule/status restored (per worker/controller). Expired proposal cannot be accepted/declined/requested again through those endpoints because they require PENDING proposal and return 409/400 as applicable.

---

## 4. Customer and Admin Behavior

| Scenario | Observed behavior | Evidence | Confidence |
|---|---|---|---|
| Default response window | 3 hours | `responseWindowHours` default 3 (L1253); controller fallback `?? 3` (L1368) | Verified |
| Allowed window range | 1-72 hours, integer | Zod schema min 1 max 72 (L1248-1252) | Verified |
| `expiresAt` calculation | Proposal creation time + window ms | L1368-1369 | Verified |
| Timezone/timestamp semantics | JS Date/ISO timestamps; stored as Mongo Date; countdown uses browser `Date.getTime()`; email uses `toISOString()` | L1369, proposal model Date fields; UI L154-156; email grep L692/720 | Verified (runtime semantics); display timezone conversion is client-dependent |
| Customer countdown display | Live HH/MM/SS countdown; at 0 shows "Expired" and expiry message | `page.tsx` L152-168,187-215,539-609 | Verified in source |
| Customer does nothing | Worker eventually marks EXPIRED and restores previous status; admin email alert attempted; no WhatsApp expiry to customer | proposalExpiry L323-433,54-319 | Verified |
| Accept before expiry | Allowed if PENDING and not expired; sets accepted, updates confirmed schedule/status | orderController L1445-1620 | Verified |
| Decline before expiry | Allowed if PENDING and not expired; sets declined, restores previous status | L1622-1781 | Verified |
| Request alternative before expiry | Allowed if PENDING and not expired; sets ALTERNATIVE_REQUESTED, records customer alternative slot/note, restores previous status | L1783-1882 | Verified |
| On expiry | Proposal EXPIRED; `proposedSlot.status` EXPIRED; previous order status restored; `reschedulePreviousStatus` cleared | worker L382-416; controller expiry branches | Verified |
| Original schedule preserved? | **Confirmed slot not overwritten by expiry worker/controller expiry branches.** Worker restores status and clears previous status; does not set `confirmedSlot` to proposed. | L401-416 worker; controller expiry branches only mark expired/restore status | Verified (code path) |
| Expiry email? | **Admin email only**, if configured and UAT allows; retry/backoff. | proposalExpiry L54-319, emailService sendRescheduleExpiryAlert | Verified |
| Expiry WhatsApp? | **No.** No template/registry/outbox mapping for expiry. | repo grep/registry/outbox; whatsappTemplateRegistry has no expiry template | Verified (absence) |
| Admin expiry alert? | **Email alert path exists** (admin notification email/Brevo config dependent). | L44-52,215-319 | Verified in code; delivery depends on config/UAT |
| Expired proposal accepted through backend? | **No.** Endpoints detect expiry, mark expired/restore, return 400. | L1504-1514,1680-1689,1828-1834 | Verified |
| Race conditions | Worker uses atomic `updateOne` with PENDING+expiresAt<=now claim (L370-398). Controller uses transaction + status/expiresAt checks. | proposalExpiry L370-398; controller session transactions | Verified (design present); concurrency stress not run in this audit |
| Expiry processing scheduled and started? | **Yes.** `startProposalExpiryWorker()` called at server startup (server.ts L249); interval 30s; stopped on shutdown (L279). | server.ts L27,249,279; proposalExpiry L437-454 | Verified |
| Exact expiry time evidence | `expiresAt` stored as Date on proposal/proposedSlot at creation. Worker claims when `expiresAt <= now` on 30s scan; customer endpoint checks `expiresAt.getTime() <= now.getTime()`. Exact processing may be up to scan interval + processing delay. | L1369,366,1507,1682,1828,340-343 | Verified with timing caveat |

---

## 5. Current Notification Behavior

| Notification | Current behavior | Evidence |
|---|---|---|
| Reschedule proposed (D20-08) | Admin proposes slot: controller emits `notifyCustomerOrder(..., "STATUS_CHANGED", ..., "RESCHEDULE_PROPOSED")`; WhatsApp template mapping returns null for STATUS_CHANGED+RESCHEDULE_PROPOSED; no WhatsApp outbox enqueue. | `orderController.ts` L1418-1424; `customerOrderNotifications.ts` L139-170 |
| Proposal accepted/declined/alternative requested | Email/WhatsApp mappings exist for RESCHEDULE_ACCEPTED/REJECTED/REQUESTED events in code/registry, but WhatsApp templates are NOT_SUBMITTED/enabled:false and Meta approval UNVERIFIED; outbox worker not started. | `customerOrderNotifications.ts` L181-195; registry L222-254; server/outbox findings |
| Proposal expiry to customer | **No WhatsApp/email customer notification path found.** | No template/mapping; proposalExpiry only admin email alert |
| Proposal expiry to admin | Email alert via Brevo from `proposalExpiry` worker; UAT blocked; retries/backoff. | `proposalExpiry.ts` L54-319 |

---

## 6. Risks and Unresolved Facts

| Risk / fact | Severity | Evidence / note |
|---|---|---|
| D20-08-D undecided | High | No owner-approved expiry communication |
| No customer WhatsApp expiry notification exists | High | Absence in registry/outbox/customer notifications |
| Dynamic expiry time unsuitable for static WhatsApp template body | High | WhatsApp templates require pre-approved structure; runtime-varying deadline needs approved variable/format |
| 30s worker scan means expiry processing may occur after exact `expiresAt` | Medium | `PROPOSAL_EXPIRY_SCAN_INTERVAL_MS=30s` |
| Client countdown uses browser clock; server uses server Date | Medium | UI L154-156; backend Date checks |
| `getCountdownSeconds` returns null at <=0, UI shows "Expired" but accept/decline buttons remain enabled by UI state logic except isSubmitting/proposing; backend will reject on click | Medium | UI L152-168,604-609,587-603; backend 400 on expired |
| Response window is admin-configurable (1-72h) | Medium | Wording must not hardcode "3 hours" unless owner decides fixed value |
| "Order will be cancelled" claim would be incorrect | Critical to avoid | Expiry restores previous status/schedule; does not cancel order |
| D20-08-E/F undecided; BLB-21 NOT AUTHORIZED | Blocking | No implementation can proceed |

**INCONCLUSIVE:** Exact production timezone/clock skew behavior; email delivery success in real env; admin UI behavior in all deployed frontend states beyond inspected source.

---

## 7. Options A–D

| Option | Description | Customer understanding | Misunderstanding risk | Compatibility with actual behavior | New backend fields needed? | New notification params needed? | Unsupported action implied? | Conflicts with D20-08-C? | Recommendation notes |
|---|---|---|---|---|---:|---:|---:|---:|---|
| **A** | Explicit expiry date/time in WhatsApp notification | Clear if accurate | **High** if timezone/format wrong or value stale | Requires precise precomputed value; worker enforces expiresAt but message must match stored expiresAt | Possibly no if using existing `expiresAt` value, but formatting/param plumbing needed | **Yes** — PROPOSED `{{proposalExpiresAt}}` (NOT IMPLEMENTED) | No, if worded carefully | No, can coexist | Only safe with D20-06 formatting, IST clarity, exact stored expiresAt, and BLB-21 implementation/testing |
| **B** | Relative response window (e.g., "within X hours") | Usually clear | **Medium** — "within 3 hours" can be ambiguous from message read time; admin window is configurable 1-72h | Compatible if value reflects actual configured window | No for logic; needs payload value | **Likely yes** — PROPOSED `{{responseWindowHours}}` or preformatted text (NOT IMPLEMENTED), unless fixed wording approved | No | No | Safer than exact timestamp if value is accurate; must not hardcode default if admin can change window |
| **C** | No expiry mention in WhatsApp; contact bakery for assistance | Simple | **Medium** — customer may miss deadline; but avoids false deadline claims | Fully compatible with backend; matches D20-08-C contact instruction | No | No | No | **Aligned** | Safest given current undecided D20-08-E/F and no expiry WhatsApp implementation |
| **D** | Defer expiry communication until expiry/customer response experience finalized | N/A (internal deferral) | Low for customers (no claim made) | Compatible; avoids premature commitment | No | No | No | No | Safest process option; delays clarity |

---

## 8. Recommended Option

**Recommended: Option C for initial D20-08 notification content**, with **Option B as a future enhancement only after D20-08-E/F, BLB-21 authorization, and precise payload/format implementation**. 

**Rationale:**
- D20-08-C already approved contact instruction; Option C reinforces it without adding deadline claims.
- Avoids hardcoding 3 hours when admin can configure 1-72 hours.
- Avoids explicit timestamp formatting/timezone/clock-skew risks.
- Requires no new variables and no backend behavior assumptions beyond existing contact instruction.
- Option A should be rejected for now unless/until a PROPOSED `{{proposalExpiresAt}}` is explicitly approved, formatted per D20-06, and verified end-to-end.

**This was a pre-decision recommendation only. Owner decision captured by BLB-23D (2026-11-22): D20-08-D Option C APPROVED BY PROJECT OWNER.**

---

## 9. Proposed Message Wording (Draft — NOT APPROVED, NOT IMPLEMENTED)

> **DRAFT ONLY — requires D20-08-E approval and BLB-21 implementation authorization.**

### Draft C1 (Option C, safest, no expiry mention)
"Hello {{customerName}}, we have a proposed change to the scheduled time for your order {{orderNumber}}. Proposed schedule: {{proposedSchedule}}. Please contact S.V. Sweets & Bakers to discuss the proposed schedule. Your existing schedule remains unchanged until you accept the proposal and the change is confirmed by our team."

### Draft B1 (Option B, only if owner chooses relative window; requires PROPOSED variable)
"Hello {{customerName}}, we have a proposed change to the scheduled time for your order {{orderNumber}}. Proposed schedule: {{proposedSchedule}}. Please contact S.V. Sweets & Bakers within {{responseWindowHours}} hours to discuss the proposed schedule. Your existing schedule remains unchanged until you accept the proposal and the change is confirmed by our team."

**Draft B1 caveats:** `{{responseWindowHours}}` is **PROPOSED — NOT IMPLEMENTED**; "within X hours" must be tied to actual configured window and message send time semantics; not approved.

---

## 10. Variables and Payload Requirements

| Variable | Status | Notes |
|---|---|---|
| `{{customerName}}` | Existing/approved in D20-08 context | Must be non-empty |
| `{{orderNumber}}` | Existing/approved | Must be non-empty |
| `{{proposedSchedule}}` | **Approved as decision (D20-08-B), PROPOSED/not registered/mapped** | D20-06 formatting required when implemented; preserve ranges; do not append IST twice |
| `{{proposalExpiresAt}}` | **PROPOSED — NOT IMPLEMENTED** | Only for Option A; requires D20-06 formatting, IST clarity, exact stored expiresAt |
| `{{responseWindowHours}}` | **PROPOSED — NOT IMPLEMENTED** | Only for Option B; must reflect actual configured 1-72h value |

---

## 11. Dependencies on D20-08-E/F

- **D20-08-D:** **APPROVED BY PROJECT OWNER — Option C (2026-11-22).** No expiry/deadline/countdown/response-window wording in WhatsApp notification; contact S.V. Sweets & Bakers to discuss proposed schedule (consistent with D20-08-C). Existing expiry enforcement unchanged; no expiry variable required.
- **D20-08-E (exact customer-facing wording):** NOT DECIDED. No draft above is approved.
- **D20-08-F (implementation prerequisites acknowledgement):** NOT DECIDED. Even if wording decided, no implementation authorized.
- **BLB-21:** NOT AUTHORIZED.
- **Registry/worker/safety:** G-01/G-02/G-04 must be resolved under authorized implementation before any D20-08 WhatsApp send.
- **Meta/legal:** Template submission/approval and W01/legal evidence remain external blockers.

---

## 12. Owner Decision Capture (Recorded)

**Decision ID:** D20-08-D — Proposal expiry/deadline communication in D20-08 WhatsApp notification  
**Current status:** **APPROVED BY PROJECT OWNER — Option C (2026-11-22)**  
**Options considered:** A (explicit date/time), B (relative response window), C (no expiry mention; contact bakery), D (defer) — **Option C selected; A/B/D not selected**.  
**Original recommendation (non-binding, pre-decision):** Option C initially; Option B only with precise variable/implementation later.  
**Owner decision:** Option C — Do not mention proposal expiry or a response deadline in the customer-facing WhatsApp notification. Instruct customer to contact S.V. Sweets & Bakers to discuss the proposed schedule. No expiry-related template variable required. Existing application proposal expiry behaviour unchanged.  
**Approved by:** Project Owner  
**Approval date:** 2026-11-22  
**Conditions/evidence:** Explicit owner instruction in BLB-23D (2026-11-22). Documentation-only decision capture; does not authorize implementation, template activation, Meta submission, UAT, production deployment, or message sending.  

**Approval recorded (documentation-only).** BLB-21 remains NOT AUTHORIZED.

*End of BLB-23A D20-08-D Expiry Decision Review — documentation-only, D20-08-D APPROVED Option C (2026-11-22), BLB-21 NOT AUTHORIZED.*