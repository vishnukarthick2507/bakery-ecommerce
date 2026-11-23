# BLB-20W — D20-08-C Customer Response Instruction Decision Review

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Read-only investigation + documentation-only review (single new file)  
**Status:** **REVIEW ONLY — D20-08-C NOT DECIDED**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Decision ID and Question

| Field | Value |
|---|---|
| **Decision ID** | D20-08-C |
| **Question** | What should customers be instructed to do in the dedicated WhatsApp notification for an admin-initiated reschedule proposal (D20-08)? |
| **Current status** | **NOT DECIDED** (no owner option selected; no approval captured) |
| **D20-08 overall** | **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (D20-08-A/B approved; D20-08-C/D/E/F NOT DECIDED) |
| **BLB-21** | **NOT AUTHORIZED** |

### Preserved approved decisions (not changed by this review)
- **D20-08-A:** APPROVED — Option B. Dedicated WhatsApp notification template for admin-initiated reschedule proposals.
- **D20-08-B:** APPROVED — Option A. Single formatted `{{proposedSchedule}}` variable.
- **`{{proposedSchedule}}` formatting:** D20-06 — DD MMM YYYY, 12-hour AM/PM, IST; preserve source-provided range; do not invent range; do not append IST twice. Owner-approved proposed variable, **not yet registered/mapped**.
- D20-08 overall remains **PARTIALLY APPROVED**. **BLB-21 remains NOT AUTHORIZED.**

---

## 2. Verified Implementation Evidence and Exact Source Locations

### 2.1 Backend proposal/response endpoints exist (authenticated API)

| Evidence | Source | Finding |
|---|---|---|
| Admin propose endpoint | `backend/src/routes/adminOrderRoutes.ts:9-13` (`POST /:id/propose-slot`, `authenticateAdmin`, `proposeSlot`); mounted `backend/src/server.ts:16,117` as `/api/admin/orders` | Admin can create proposal; order becomes `RESCHEDULE_PROPOSED`, existing schedule unchanged until acceptance. |
| Customer accept endpoint | `backend/src/routes/orderRoutes.ts:69-72` `POST /:id/proposal/accept`, `authenticateCustomer`, `acceptProposal`; mounted `backend/src/server.ts:111` as `/api/orders` | Authenticated customer API exists. |
| Customer decline endpoint | `backend/src/routes/orderRoutes.ts:75-78` `POST /:id/proposal/decline`, `authenticateCustomer`, `declineProposal` | Authenticated customer API exists. |
| Customer request-alternative endpoint | `backend/src/routes/orderRoutes.ts:81-84` `POST /:id/proposal/request-alternative`, `authenticateCustomer`, `requestAlternativeSlot` | Authenticated customer API exists. |
| Accept/decline/alternative behavior | `backend/src/controllers/orderController.ts:1445-1882` | Accept updates confirmed/scheduled fields and restores status by rules; decline restores previous status and keeps existing schedule; alternative stores requested alternative slot/note and restores previous status. All require `req.customer`; ownership checked; 404/400/409 paths present. |

**Important boundary:** Backend endpoints existing does **not** by itself prove a verified customer-facing WhatsApp/action workflow.

### 2.2 Customer account order detail page has proposal response UI (authenticated)

| Evidence | Source | Finding |
|---|---|---|
| Authenticated account order page | `app/account/orders/[orderNumber]/page.tsx` (client component; fetches `/api/orders/me/:orderNumber` with credentials) | Customer-facing authenticated order detail page exists. |
| Pending proposal display | `app/account/orders/[orderNumber]/page.tsx:526-585` | When `order.proposedSlot?.status === 'PENDING'`, UI shows "We need to change your delivery time", original time, suggested time, note/reason, countdown. |
| Accept action UI | `app/account/orders/[orderNumber]/page.tsx:586-597,351-387` | "Accept new time" button calls `POST /api/orders/:id/proposal/accept` with credentials; then refreshes `/api/orders/me/:orderNumber`. |
| Decline action UI | `app/account/orders/[orderNumber]/page.tsx:598-603,389-424` | "Decline" button calls `POST /api/orders/:id/proposal/decline`; refresh shows alternative form. |
| Request alternative UI | `app/account/orders/[orderNumber]/page.tsx:610-651,426-448` | Alternative form (date/time/note) posts to `POST /api/orders/:id/proposal/request-alternative` when `showAlternativeForm` and countdown active. |
| Declined/alternative/expired states | `app/account/orders/[orderNumber]/page.tsx:679-760` (grep evidence) | UI handles DECLINED, ALTERNATIVE_REQUESTED, EXPIRED states. |
| Data source for account page | `backend/src/controllers/orderController.ts:796-825` (`getMyOrderByNumber`) | Returns authenticated customer's order with `rescheduleProposals` included. |

**Finding:** A customer-facing authenticated response workflow exists on the **account order detail page** (`/account/orders/[orderNumber]`), not the public tracking page. This supports accept/decline/request-alternative through existing UI.

### 2.3 Public/guest tracking page does NOT show proposal response actions

| Evidence | Source | Finding |
|---|---|---|
| Tracking page route/UI | `app/track/page.tsx` (entire inspected file, esp. lines 1-740) | Public tracking page renders lookup form, status timeline, items, delivery/pickup/schedule. No `proposedSlot`, no `rescheduleProposals`, no accept/decline/request-alternative UI, no proposal-related text. |
| Tracking page order type | `app/track/page.tsx:31-65` | `Order` type has no `proposedSlot` or `rescheduleProposals` fields. |
| Tracking page data fetch | `app/track/page.tsx:270-303` | Fetches `GET /api/orders/:orderNumber` with credentials; on 401 requires phone and falls back to `POST /api/orders/track`. |
| Authenticated track endpoint response shape | `backend/src/controllers/orderController.ts:659-720` (`getOrderByNumber`) | Returns limited order fields; **does not include `proposedSlot` or `rescheduleProposals`**. Also requires authenticated owner for user-linked orders; guest-linked userId absent case returns 401 asking for phone tracking. |
| Guest track endpoint response shape | `backend/src/controllers/orderController.ts:722-773` (`trackGuestOrder`) | Returns limited order fields; **does not include `proposedSlot` or `rescheduleProposals`**. |
| Track URL used by notifications | `backend/src/services/customerOrderNotifications.ts:114` | `trackingUrl = ${NEXT_PUBLIC_SITE_URL ?? https://bakery-ecommerce-topaz.vercel.app}/track?order=...` |

**Finding:** The existing WhatsApp tracking URL points to `/track?order=...`. The tracking page currently does **not** display pending admin proposal details or provide accept/decline/request-alternative actions. Directing customers to "review/respond on tracking page" would be **unsupported/misleading** for current implementation.

### 2.4 WhatsApp interactive/deep-link response mechanisms

| Evidence | Source | Finding |
|---|---|---|
| WhatsApp template registry/payload | `backend/src/services/whatsappTemplateRegistry.ts`, `backend/src/services/customerOrderNotifications.ts` | No D20-08/RESCHEDULE_PROPOSED WhatsApp template mapping exists. Existing templates are text body params + tracking URL pattern only; no interactive button/deep-link response action for reschedule proposals inspected. |
| Proposal API routes | `backend/src/routes/orderRoutes.ts:69-84` | Endpoints are authenticated POST APIs; no customer-facing WhatsApp deep link, signed action link, or button callback route was found in inspected source. |

**Finding:** No verified WhatsApp interactive button, deep link, or direct response mechanism exists for admin reschedule proposal response.

### 2.5 Access/workflow reality

| Question | Verified answer | Evidence |
|---|---|---|
| Can customer respond through existing UI? | **Yes, on authenticated account order detail page** (`/account/orders/[orderNumber]`), for logged-in customer orders. | `app/account/orders/[orderNumber]/page.tsx:351-448,526-679`; `getMyOrderByNumber` returns proposals. |
| Can customer respond through tracking page (`/track?order=...`)? | **No evidence of response UI; current page lacks proposal UI/data fields.** | `app/track/page.tsx` no proposal UI; `getOrderByNumber`/`trackGuestOrder` omit proposal fields. |
| Can guest/customer via WhatsApp tracking link respond? | **Not verified; currently unsupported by tracking page.** | Tracking URL pattern points to `/track`; track page no response actions. |
| Are APIs accessible through customer-facing workflow? | **Yes for authenticated account page workflow; no for tracking page/WhatsApp deep link.** | Account page calls APIs with credentials; no tracking-page/WhatsApp action wiring found. |

---

## 3. D20-08-C Options — Advantages, Limitations, Risks

### Option A — Direct customers to order tracking page (only if proposal/response actions actually available there)
- **Advantages:** Simple instruction if true; aligns with existing tracking URL pattern.
- **Limitations / risks:** **Not currently supported.** `/track?order=...` page does not display pending proposal or accept/decline/request-alternative actions. Backend track endpoints omit proposal fields. Using Option A now would mislead customers and imply unsupported action.
- **Verdict:** **Unsafe as-is.** Could become viable only after separate authorized implementation verifies tracking-page proposal display + response actions + data exposure rules.

### Option B — Ask customers to contact S.V. Sweets & Bakers to respond, without implying specific channel or unsupported action
- **Advantages:** Safest currently supportable instruction if phrased generically; avoids inventing links/buttons/response UI. Operationally clear that bakery assistance is needed.
- **Limitations / risks:** Higher manual operational load; slower response; customer may expect immediate self-service. Must not mention WhatsApp/phone/email/URL/button unless separately verified/approved.
- **Verdict:** **Safest current customer-facing wording option** among A-C, provided wording is generic and non-misleading.

### Option C — Neutral notification without prescribing a response action
- **Advantages:** Avoids unsupported instructions; low legal/UX misdirection risk.
- **Limitations / risks:** Poor customer experience; customer may not know how to respond; may increase missed responses/expired proposals. Still needs careful wording to avoid implying no action needed.
- **Verdict:** Safer than A, weaker than B operationally.

### Option D — Defer response instruction until customer-facing response mechanism is verified or implemented under separate authorization
- **Advantages:** Avoids sending ambiguous/incomplete notification; preserves fail-closed posture until UX is verified.
- **Limitations / risks:** Delays D20-08 WhatsApp usefulness; admin-proposed reschedule remains without approved customer response instruction.
- **Verdict:** Safest project-control option; best if owner prioritizes zero misleading communication over speed.

### Additional materially better option (not replacing A-D)
- **Option E (for owner consideration, separate):** Approve generic contact-bakery instruction now (B-like) **and** separately authorize a future verified self-service response path (account/tracking deep link or authenticated flow) before claiming "track/review/respond online". This is a phased approach; requires separate BLB-21/UX/product authorization.

---

## 4. Recommended Option and Rationale

**Recommended:** **Option B (generic contact S.V. Sweets & Bakers)** as the safest currently supportable customer instruction, *if* the owner wants D20-08-C to move forward before a verified self-service response flow is available in the WhatsApp destination. 

**Rationale:**
- Current verified self-service response UI exists in authenticated account order detail page, but WhatsApp tracking URL points to `/track?order=...`, which lacks proposal/response UI and proposal data fields. Therefore Option A is misleading as-is.
- No WhatsApp interactive button/deep link/direct response mechanism is verified.
- Option B can be made truthful with careful generic wording ("contact S.V. Sweets & Bakers for assistance") and no invented channel/action.
- Option D is also acceptable if owner prefers to defer until a verified response mechanism is implemented/confirmed.

**Not recommended now:** Option A, unless/until tracking/account response flow is verified and explicitly approved for the message.

---

## 5. Proposed Customer-Facing Wording for Recommended Option (DRAFT — NOT APPROVED)

> **DRAFT ONLY — NOT APPROVED / NOT IMPLEMENTED / NOT AUTHORIZED FOR SEND / NOT META-SUBMITTED**

```text
Hello {{customerName}},

S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}.

Proposed schedule: {{proposedSchedule}}

Your existing schedule remains unchanged until you accept the proposed change.

If you need help or would like to respond, please contact S.V. Sweets & Bakers.

Thank you for choosing S.V. Sweets & Bakers!
```

**Wording caveats:**
- Uses approved D20-08-A direction and D20-08-B `{{proposedSchedule}}` variable contract intent; `{{proposedSchedule}}` remains proposed/not registered/mapped.
- Does **not** claim tracking-page response availability, no deep link/button, no specific contact channel, no acceptance mechanism beyond generic contact.
- `{{proposedSchedule}}` must follow D20-06 when implemented.
- This is draft wording only; D20-08-E remains NOT DECIDED.

---

## 6. Assumptions and Unresolved Dependencies

| Item | Status | Notes |
|---|---|---|
| D20-08-C owner selection | **UNRESOLVED / NOT DECIDED** | No owner option selected. |
| D20-08-E exact wording | **NOT DECIDED** | Draft above is not approved. |
| D20-08-D expiry/deadline mention | **NOT DECIDED** | Source has configurable response window default 3h max 72h; no customer expiry WhatsApp. |
| D20-08-F prerequisites | **NOT DECIDED** | Acknowledgement does not authorize execution. |
| Tracking-page proposal response capability | **NOT VERIFIED / NOT IMPLEMENTED in tracking page** | `/track` has no proposal UI; track endpoints omit proposal fields. |
| Account-page response capability | **Verified in authenticated account UI** | Not the same as WhatsApp `/track` destination; auth required. |
| WhatsApp interactive/deep-link response | **NOT VERIFIED / NOT FOUND** | No button/deep-link action found. |
| `{{proposedSchedule}}` registry/payload mapping | **NOT IMPLEMENTED** | Owner-approved proposed variable only. |
| Meta template submission/approval | **NOT AUTHORIZED / NOT RECEIVED** | All templates remain NOT_SUBMITTED/enabled:false/fail-closed. |
| Legal/compliance | **NOT RECEIVED** | W01 still unresolved. |
| BLB-21 implementation authorization | **NOT AUTHORIZED** | No implementation. |

---

## 7. No-Implementation / No-Approval Statement

- This document is **read-only investigation + decision review only**.
- **D20-08-C remains NOT DECIDED.**
- **D20-08 overall remains PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED.**
- **BLB-21 remains NOT AUTHORIZED.**
- No application source, tests, config, env, deps, DB, provider, Meta, WhatsApp registry/mapping/payload/outbox/template behavior changed.
- No tests/builds run. No external actions performed.

---

*End of BLB-20W D20-08-C review (documentation-only, no approval captured).*