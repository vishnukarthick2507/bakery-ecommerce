# BLB-20S — D20-08 Owner Decision Capture Worksheet

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Documentation-only decision capture worksheet (single new file)  
**Project status:** **NOT READY / NO-GO**

---

## 1. Purpose

This worksheet presents the six D20-08 decisions for explicit Project Owner responses. It is based on the read-only source investigation documented in `BLB-20R-D20-08-ADMIN-INITIATED-RESCHEDULE-PROPOSAL.md` and the existing decision-control context in `BLB-20-PROJECT-OWNER-DECISION-REGISTER.md`, `BLB-20A-OWNER-DECISION-CAPTURE-WORKSHEET.md`, and `BLB-20B-OWNER-DECISION-REVIEW-PACKAGE.md`.

**This worksheet records D20-08-A and D20-08-B as explicitly approved by the Project Owner (BLB-20U/20V, 2026-11-22).** D20-08-C/D/E/F remain **NOT DECIDED** until the Project Owner explicitly responds with decision, date, approver, conditions, and evidence reference. D20-08 overall remains **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED**.

---

## 2. Background / D20-07 Distinction

| Item | D20-07 (approved content, implementation NOT GRANTED) | D20-08 (this worksheet — PARTIALLY APPROVED) |
|---|---|---|
| Initiator | Customer requests alternative time (`POST /api/orders/:id/proposal/request-alternative`) | Bakery/admin proposes new slot (`POST /api/admin/orders/:id/propose-slot`) |
| Meaning | Customer-requested alternative pending bakery review; existing schedule unchanged until bakery confirms change | Bakery-proposed new schedule pending customer response; existing schedule unchanged until customer accepts (source-backed) |
| Current WhatsApp mapping | `RESCHEDULE_REQUESTED -> order_reschedule_requested` exists in code/registry/outbox mapping, but template is `NOT_SUBMITTED`/`enabled:false`; payload uses existing order schedule fields (known D20-07 mismatch/gap); D20-07 wording approved as content only (BLB-20P 2026-11-22), implementation NOT GRANTED | **No `RESCHEDULE_PROPOSED` WhatsApp template/registry/outbox mapping exists.** `proposeSlot` triggers `notifyCustomerOrder(..., "STATUS_CHANGED", ..., "RESCHEDULE_PROPOSED")`; `whatsappTemplateFor` returns null for that status, so no WhatsApp outbox job is enqueued. |
| Status | **APPROVED BY PROJECT OWNER — 2026-11-22** (content only; implementation NOT GRANTED) | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-08-A approved Option B 2026-11-22; D20-08-B approved Option A 2026-11-22; D20-08-C/D/E/F NOT DECIDED) |

Do not reuse D20-07 wording/payload assumptions for D20-08 without separate owner decision and verified payload/template mapping.

---

## 3. Source-Backed Facts (BLB-20R)

| Fact | Source evidence (read-only) |
|---|---|
| Admin propose endpoint exists | `backend/src/routes/adminOrderRoutes.ts` POST `/:id/propose-slot` (`authenticateAdmin`, `proposeSlot`); mounted at `/api/admin/orders` in `backend/src/server.ts`. Effective route: `POST /api/admin/orders/:id/propose-slot`. |
| Request fields/validation | `proposeSlotSchema`: `time` required ISO datetime; `note` required trimmed 1-500; `responseWindowHours` optional int 1-72, default 3 (`orderController.ts`). Slot validated by `validateSlot`; pending proposal conflict returns 409; eligible statuses `PLACED/PAYMENT_CONFIRMED/CONFIRMED`; same-as-confirmed rejected. |
| Proposed slot storage | Proposal stored in `rescheduleProposals` with `proposalId`, optional `previousConfirmedSlot`, `proposedSlot` Date, `reason`, `proposedBy/At`, `status:"PENDING"`, `expiresAt`; legacy `order.proposedSlot` mirror set. |
| Schedule on proposal creation | `proposeSlot` sets `order.orderStatus="RESCHEDULE_PROPOSED"` and saves `reschedulePreviousStatus`; it **does not change** `scheduledDate`, `scheduledTime`, or `confirmedSlot`. |
| Customer response endpoints exist | Authenticated API routes: `POST /api/orders/:id/proposal/accept`, `/decline`, `/request-alternative` (`orderRoutes.ts`, mounted `/api/orders`). No verified customer-facing WhatsApp deep-link/button/action URL was inspected. |
| Accept behavior | Proposal ACCEPTED; `confirmedSlot` becomes proposed slot; `scheduledDate/scheduledTime` overwritten from accepted UTC ISO split; status restored by previous-status rules; `reschedulePreviousStatus` cleared; `RESCHEDULE_ACCEPTED` emitted. D20-06-F UTC formatting caveat applies. |
| Decline behavior | Proposal DECLINED; previous status restored; existing confirmed/scheduled fields unchanged by decline path; `RESCHEDULE_REJECTED` emitted. |
| Expiry behavior | `proposalExpiry.ts` marks expired PENDING proposals EXPIRED, restores previous order status, clears `reschedulePreviousStatus`, processes admin expiry email alerts; **no customer WhatsApp expiry notification observed**. |
| Current WhatsApp gap | No `RESCHEDULE_PROPOSED` template/registry/outbox mapping. `whatsappTemplateFor` returns null for `STATUS_CHANGED` + `RESCHEDULE_PROPOSED`; no WhatsApp outbox job enqueued. Existing reschedule templates use `scheduledDate/scheduledTime` (old/current schedule fields) and are `NOT_SUBMITTED`/`enabled:false`/fail-closed. |
| Tracking URL pattern | Existing payload builders use `${NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app}/track?order=...` (supported pattern; D20-01/domain confirmation separate where applicable). |

---

## 4. D20-08 Decision Items (D20-08-A/B Approved; C-F NOT DECIDED)

> **Instructions to Project Owner:** D20-08-A and D20-08-B have been explicitly recorded below (BLB-20U/20V). For D20-08-C/D/E/F, provide an explicit decision, date, approver, conditions, and evidence reference. Do not treat silence, draft wording, or recommendation as approval.

### D20-08-A — Should admin-initiated reschedule proposals trigger WhatsApp notifications?

| Field | Content |
|---|---|
| **Decision ID** | D20-08-A |
| **Question** | Should admin-initiated reschedule proposals trigger WhatsApp notifications? |
| **Options** | **A:** No WhatsApp notification; retain current behavior. <br> **B:** Dedicated D20-08 WhatsApp template. <br> **C:** Defer the decision. |
| **Recommendation** | **B, if the owner wants customers notified through WhatsApp.** Rationale: a dedicated template avoids D20-07 semantic/payload confusion and avoids reusing existing old-schedule reschedule params. Option A remains acceptable if WhatsApp is not desired for this event. |
| **Owner decision** | **Option B — APPROVED BY PROJECT OWNER.** Introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Approver** | Project Owner |
| **Conditions** | Documentation-only decision capture. Approves direction only (dedicated template). Does **not** approve exact WhatsApp message wording, template variables/payload contracts, tracking URL/customer response instructions, template registry/outbox implementation, Meta submission/approval, legal/compliance approval, or production delivery. **BLB-21 remains NOT AUTHORIZED.** D20-08-C/D/E/F remain NOT DECIDED. |
| **Evidence reference** | Explicit owner instruction in current conversation: "I explicitly select Option B for D20-08-A. Please prepare the documentation-only owner decision capture prompt. Do not authorize implementation." (2026-11-22) |

---

### D20-08-B — What proposed-slot information should the message contain?

| Field | Content |
|---|---|
| **Decision ID** | D20-08-B |
| **Question** | What proposed-slot information should the message contain? |
| **Options** | **A:** One formatted `proposedSchedule` variable. <br> **B:** Separate `proposedDate` and `proposedTime` variables. <br> **C:** Include the reason and/or expiry information as additional variables. <br> **D:** Defer. |
| **Recommendation** | **Use one formatted `proposedSchedule` variable if the owner wants the simplest customer-facing message. Do not include reason or expiry by default.** Rationale: simpler variable contract; easier D20-06-compliant display; reason/expiry add template length/sensitivity/formatting decisions. |
| **Owner decision** | **Option A — APPROVED BY PROJECT OWNER.** Use one formatted `{{proposedSchedule}}` variable to communicate the proposed schedule in the dedicated admin-initiated reschedule WhatsApp notification. |
| **Status** | **APPROVED BY PROJECT OWNER** |
| **Approval date** | 2026-11-22 |
| **Approver** | Project Owner |
| **Conditions** | Documentation-only decision capture. Approved meaning: value must follow D20-06 — Date `DD MMM YYYY`; Time 12-hour AM/PM; Timezone IST; preserve a source-provided time range if one exists; do not invent a time range when the source provides a single time; do not append IST twice. Example: `25 Dec 2026, 10:00 AM IST`. `{{proposedSchedule}}` is an owner-approved proposed variable, **not an existing registered or mapped WhatsApp payload variable**. This does not authorize registry/payload/outbox/mapping implementation, date/time formatting implementation, scheduling/storage/API changes, tracking/response mechanism changes, Meta submission/approval, legal/compliance approval, or production delivery. **BLB-21 remains NOT AUTHORIZED.** D20-08-C/D/E/F remain NOT DECIDED. |
| **Evidence reference** | Explicit owner instruction in current conversation: "For D20-08-B, I select Option A. Please prepare the decision review and documentation-only owner decision capture workflow. Do not authorize implementation." (2026-11-22) |

---

### D20-08-C — What should customers be instructed to do?

| Field | Content |
|---|---|
| **Decision ID** | D20-08-C |
| **Question** | What should customers be instructed to do? |
| **Options** | **A:** Track their order and review the proposal, subject to verification that the tracking page supports this. <br> **B:** Contact the bakery for assistance. <br> **C:** Use another verified customer response mechanism. <br> **D:** Defer. |
| **Recommendation** | **B until the tracking-page response functionality is verified.** Do not invent links, buttons, or customer actions. Rationale: backend has authenticated API endpoints for accept/decline/request-alternative, but no verified customer-facing WhatsApp deep link/button/action URL or tracking-page response UX was confirmed in BLB-20R inspection. |
| **Constraints / notes** | Tracking URL pattern exists (`/track?order=...`) as a destination pattern, but "review/respond on tracking page" requires UX verification. Do not claim accept/decline/request-alternative buttons or URLs exist in WhatsApp unless verified and approved. |
| **Owner decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Approver** |  |
| **Conditions** |  |
| **Evidence reference** |  |

---

### D20-08-D — Should the message mention the response deadline?

| Field | Content |
|---|---|
| **Decision ID** | D20-08-D |
| **Question** | Should the message mention the response deadline? |
| **Options** | **A:** Include the expiry date/time. <br> **B:** Mention a response window in hours. <br> **C:** Do not mention expiry. <br> **D:** Defer. |
| **Recommendation** | **C unless the owner specifically wants a deadline communicated and the exact customer-facing semantics are verified.** Rationale: expiry adds formatting/variable/semantics complexity; source has expiry behavior but no customer WhatsApp expiry notification; deadline wording must not be misleading. |
| **Source note** | The source currently has a configurable response window, defaulting to **3 hours**, with a maximum of **72 hours** (`proposeSlotSchema.responseWindowHours` default 3, min 1, max 72; `expiresAt = now + responseWindowHours*60*60*1000` in `orderController.ts`). Proposal expiry is enforced by `proposalExpiry.ts`. |
| **Owner decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Approver** |  |
| **Conditions** |  |
| **Evidence reference** |  |

---

### D20-08-E — Exact customer-facing wording

| Field | Content |
|---|---|
| **Decision ID** | D20-08-E |
| **Question** | What exact customer-facing wording should be used for D20-08? |
| **Draft wording (NOT APPROVED)** | See "Exact Draft Wording" section below. |
| **Recommendation** | Owner should **approve, request edits, or defer**. Do not mark wording approved automatically. If approved later, record exact final wording, date, approver, and conditions. |
| **Critical note** | `{{proposedSchedule}}` is a **proposed variable only** — **not currently registered or mapped** in WhatsApp template registry/payload/outbox. Any use requires separate BLB-21 authorization, variable contract decision, D20-06-compliant formatting, registry/payload mapping, tests, and Meta submission/approval. |
| **Owner decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Approver** |  |
| **Conditions** |  |
| **Evidence reference** |  |

---

### D20-08-F — Implementation prerequisites

| Field | Content |
|---|---|
| **Decision ID** | D20-08-F |
| **Question** | Does the Project Owner acknowledge the implementation prerequisites required before any D20-08 implementation? (Acknowledgement does not authorize execution.) |
| **Prerequisites** | 1. Dedicated event/template/registry/outbox mapping. <br> 2. Reliable proposed-slot payload and D20-06-compliant formatting (DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only where underlying value is a range; do not append IST twice; display only). <br> 3. Verified customer response instructions (no invented links/buttons/actions). <br> 4. D20-06-F UTC/local formatting inconsistency addressed under separate authorization where applicable. <br> 5. Tests under separate authorization. <br> 6. Meta submission and approval. <br> 7. Applicable legal/compliance review. <br> 8. Explicit separate BLB-21 implementation authorization. |
| **Recommendation** | Acknowledge prerequisites for planning clarity only. **Acknowledging prerequisites does not authorize implementation, Meta submission, template enablement, or live delivery.** |
| **Owner decision** |  |
| **Status** | **NOT DECIDED** |
| **Approval date** |  |
| **Approver** |  |
| **Conditions** |  |
| **Evidence reference** |  |

---

## 5. Exact Draft Wording (DRAFT ONLY — NOT APPROVED)

> **DRAFT — NOT APPROVED / NOT IMPLEMENTED / NOT AUTHORIZED FOR SEND / NOT META-SUBMITTED**

```text
Hello {{customerName}},

S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}.

Proposed schedule: {{proposedSchedule}}

Your existing schedule remains unchanged until you accept the proposed change.

If you need help, please contact S.V. Sweets & Bakers.

Thank you for choosing S.V. Sweets & Bakers!
```

**Mandatory caveats:**
- `{{proposedSchedule}}` is a **proposed variable, not currently registered or mapped** in WhatsApp template registry/payload/outbox.
- `{{customerName}}`, `{{orderNumber}}` follow existing payload naming patterns but D20-08 template contract is **not** registered/approved/mapped.
- Proposed schedule display must follow D20-06 if/when implemented: DD MMM YYYY, 12-hour AM/PM, IST; preserve ranges only where underlying value is a range; do not append IST twice; display formatting only.
- "Existing schedule remains unchanged until you accept the proposed change" is source-backed for the propose/decline/expiry/alternative paths inspected; acceptance updates schedule per source.
- "Contact S.V. Sweets & Bakers" is cautious; no response URL/button/action invented. If owner chooses D20-08-C Option A/C, wording must be revised only after verification.
- Owner may **approve, request edits, or defer**. This draft is **not approved automatically**.

---

## 6. Decision Capture Summary Table

| Decision | Recommended option (review only) | Owner decision | Status | Approval date | Approver | Conditions | Evidence reference |
|---|---|---|---|---|---|---|---|
| D20-08-A Trigger WhatsApp? | B if owner wants WhatsApp notification | **Option B — APPROVED BY PROJECT OWNER.** Introduce a dedicated WhatsApp notification template for admin-initiated reschedule proposals. | **APPROVED BY PROJECT OWNER** | 2026-11-22 | Project Owner | Direction only; no wording/variables/payload/response instructions/registry-outbox/Meta/legal/production approval; BLB-21 NOT AUTHORIZED; C-F NOT DECIDED | Explicit owner instruction in current conversation (2026-11-22) |
| D20-08-B Proposed-slot info/variables | A (single `proposedSchedule`) if simplest; no reason/expiry by default | **Option A — APPROVED BY PROJECT OWNER.** Single formatted `{{proposedSchedule}}` per D20-06 (DD MMM YYYY, 12-hour AM/PM, IST; preserve source-provided range; do not invent range; do not append IST twice; e.g. `25 Dec 2026, 10:00 AM IST`). Proposed variable, not registered/mapped. | **APPROVED BY PROJECT OWNER** | 2026-11-22 | Project Owner | Variable-contract intent only; no registry/payload/outbox/mapping/formatting implementation/API/storage/Meta/legal/production approval; BLB-21 NOT AUTHORIZED; C-F NOT DECIDED | Explicit owner instruction in current conversation (2026-11-22) |
| D20-08-C Customer instruction | B until tracking-page response functionality verified |  | **NOT DECIDED** |  |  |  |  |
| D20-08-D Mention deadline? | C unless owner wants deadline and semantics verified |  | **NOT DECIDED** |  |  |  |  |
| D20-08-E Exact wording | Approve/request edits/defer; draft only |  | **NOT DECIDED** |  |  |  |  |
| D20-08-F Prerequisites acknowledged | Acknowledge for planning only; no execution authorization |  | **NOT DECIDED** |  |  |  |  |

---

## 7. Explicit Boundaries / Non-Authorization

- **D20-08-A is APPROVED BY PROJECT OWNER (Option B, 2026-11-22).** **D20-08-B is APPROVED BY PROJECT OWNER (Option A, 2026-11-22).** D20-08-C/D/E/F remain **NOT DECIDED** until explicit Project Owner responses are supplied and recorded. **D20-08 overall remains PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED.**
- This worksheet is **documentation-only**. It is **not** implementation authorization.
- **BLB-21 remains NOT AUTHORIZED.**
- No WhatsApp template submission is authorized. No Meta approval or delivery is implied.
- No source, tests, config, env, dependency, DB, provider, Meta, or deployment changes were made.
- No existing decision-register document was modified by this task.
- All 18 currently registered WhatsApp templates remain **NOT_SUBMITTED / enabled:false / empty metaTemplateId / fail-closed** (project state; unchanged by this document).
- Do not invent links, buttons, customer actions, template variables, or routes as existing capabilities.

---

*End of BLB-20S D20-08 owner decision capture worksheet (documentation-only).*