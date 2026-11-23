# BLB-20X — D20-08-C Owner Decision Capture

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Scope:** Documentation-only owner decision capture preparation (single new file)  
**Status:** **OWNER DECISION CAPTURED — D20-08-C APPROVED (Option B, 2026-11-22)**  
**Project status:** **NOT READY / NO-GO**

---

## 1. Decision Question

| Field | Value |
|---|---|
| **Decision ID** | D20-08-C |
| **Question** | What should customers be instructed to do in the dedicated WhatsApp notification for an admin-initiated reschedule proposal (D20-08)? |
| **Current status** | **APPROVED BY PROJECT OWNER — Option B (2026-11-22)** |
| **Source of truth** | `docs/client-handover/BLB-20W-D20-08-C-CUSTOMER-RESPONSE-INSTRUCTION-REVIEW.md` |

### Existing approved decisions (preserved exactly)
- **D20-08-A:** APPROVED — Option B. Dedicated WhatsApp notification template for admin-initiated reschedule proposals.
- **D20-08-B:** APPROVED — Option A. Single formatted `{{proposedSchedule}}` variable. D20-06 formatting applies: DD MMM YYYY, 12-hour AM/PM, IST; preserve source-provided range; do not invent range; do not append IST twice. `{{proposedSchedule}}` is owner-approved but **not yet registered/mapped**.
- **D20-08-C:** **APPROVED BY PROJECT OWNER — Option B (2026-11-22).** D20-08-D/E/F: NOT DECIDED.
- **D20-08 overall:** **PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED**.
- **BLB-21:** **NOT AUTHORIZED**.

---

## 2. BLB-20W Evidence Summary

Verified findings from BLB-20W (read-only source inspection; no assumptions):

| Area | Verified finding | Evidence (BLB-20W) |
|---|---|---|
| Authenticated customer account order detail page | Supports viewing pending admin proposal and responding: accept, decline, or request alternative time through existing UI. | `app/account/orders/[orderNumber]/page.tsx:351-448,526-679`; data from `backend/src/controllers/orderController.ts:796-825` (`getMyOrderByNumber` includes `rescheduleProposals`). |
| Backend response APIs | Authenticated POST endpoints exist: `/api/orders/:id/proposal/accept`, `/decline`, `/request-alternative` (`orderRoutes.ts:69-84`; controller `orderController.ts:1445-1882`). | Endpoints exist, but endpoint existence alone does not prove a verified WhatsApp/customer-facing action. |
| Public tracking page (`/track?order=...`) | Does **not** expose proposal response controls; no proposedSlot/rescheduleProposals UI or data fields in track page/type; track endpoints omit proposal fields. | `app/track/page.tsx:31-65,270-303,1-740`; `orderController.ts:659-720,722-773`. |
| WhatsApp tracking URL pattern | Existing notifications use `/track?order=...`. | `backend/src/services/customerOrderNotifications.ts:114`. |
| WhatsApp interactive response | No WhatsApp interactive response button, deep link, or direct response mechanism verified. | `whatsappTemplateRegistry.ts`, `customerOrderNotifications.ts`, `orderRoutes.ts:69-84` inspection; no D20-08/RESCHEDULE_PROPOSED mapping. |

**Key implication:** Directing customers to the public tracking page as a response mechanism would be misleading/unsupported by current implementation. Authenticated account order detail page has response UI, but it is not the same as the public tracking link and requires authenticated access.

---

## 3. Option B Recommendation and Rationale

### Recommended option
**Option B — Generic contact instruction (recommended for owner review)**

Use a generic instruction asking the customer to contact S.V. Sweets & Bakers if they need assistance or want to discuss the proposed schedule.

### Rationale
- **Truthful today:** Does not claim a public tracking-page response capability, WhatsApp button, deep link, or direct acceptance link that is not verified.
- **Avoids misleading UX:** BLB-20W confirms `/track?order=...` does not expose proposal response controls; Option A is unsafe as-is.
- **Operationally workable:** Customer can contact the bakery; bakery can assist through verified channels/processes outside this unverified WhatsApp action flow.
- **Preserves boundaries:** Keeps D20-08-C within verified facts while D20-08-E wording, D20-08-D deadline, D20-08-F prerequisites, Meta/legal/BLB-21 gates remain unresolved.

### What Option B must NOT do
- Do **not** direct customers to the public tracking page as a response mechanism.
- Do **not** invent a WhatsApp button, direct acceptance link, or public tracking-page response capability.
- Do **not** name a specific contact channel (WhatsApp number, phone, email, URL, chat link) unless separately verified and approved.
- Do **not** imply the proposed schedule is accepted/confirmed.

---

## 4. Exact Proposed Message (DRAFT — NOT APPROVED)

> **DRAFT ONLY — NOT APPROVED / NOT IMPLEMENTED / NOT AUTHORIZED FOR SEND / NOT META-SUBMITTED**

```text
Hello {{customerName}},

S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}.

Proposed schedule: {{proposedSchedule}}

Your existing schedule remains unchanged until you accept the proposal. If you request any changes, the bakery must review and confirm them.

If you need assistance or want to discuss the proposed schedule, please contact S.V. Sweets & Bakers.

Thank you for choosing S.V. Sweets & Bakers!
```

### Required elements preserved
- `{{customerName}}` — preserved.
- `{{orderNumber}}` — preserved.
- `{{proposedSchedule}}` — preserved (D20-08-B approved proposed variable; D20-06 formatting; **not yet registered/mapped**).
- "Your existing schedule remains unchanged until you accept the proposal." — preserved.
- "If you request any changes, the bakery must review and confirm them." — preserved.

### Draft wording constraints
- No public tracking-page response instruction.
- No WhatsApp button, direct acceptance link, deep link, or invented response mechanism.
- No specific contact channel invented.
- No acceptance/confirmation implied for proposed schedule.

---

## 5. Option D Alternative (Preserved)

**Option D — Defer response instruction**

Defer the D20-08-C response instruction until a verified customer response mechanism is selected and, if needed, separately authorized/implemented.

| Aspect | Option D |
|---|---|
| **Advantages** | Avoids sending ambiguous or incomplete response instructions; preserves fail-closed posture; prevents misleading customers. |
| **Limitations** | Delays D20-08 WhatsApp usefulness; admin-proposed reschedule remains without approved customer response instruction. |
| **When appropriate** | If owner prioritizes zero misleading communication over speed, or wants to wait for verified self-service response flow (account/tracking deep link/other verified mechanism) under separate authorization. |

Option D remains a valid owner choice. Selecting Option D keeps D20-08-C NOT DECIDED for implementation wording until a verified mechanism is chosen.

---

## 6. Owner Approval Field

| Field | Entry |
|---|---|
| **Decision ID** | D20-08-C |
| **Recommended option** | Option B — Generic contact S.V. Sweets & Bakers instruction |
| **Alternative preserved** | Option D — Defer until verified customer response mechanism is selected (not selected) |
| **Owner selected option** | **Option B** |
| **Owner decision** | **APPROVED BY PROJECT OWNER** |
| **Approved by** | Project Owner |
| **Approval date** | 2026-11-22 |
| **Conditions / notes** | Instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. Do not direct customers to public tracking page as a response mechanism; do not invent WhatsApp button/direct acceptance link/unverified specific contact channel. D20-08-E/D/F remain NOT DECIDED. Documentation-only capture authorized; no source changes/template activation/Meta submission/message sending/implementation authorization. BLB-21 remains NOT AUTHORIZED. |
| **Evidence/reference** | Explicit owner instruction in conversation (2026-11-22): "I approve D20-08-C as Option B — instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule. D20-08-E (exact customer-facing wording) remains NOT DECIDED. D20-08-D (expiry/deadline mention) remains NOT DECIDED. D20-08-F (implementation prerequisites acknowledgement) remains NOT DECIDED. This approval is for the owner decision only. Documentation-only capture is authorized. No source changes, template activation, Meta submission, message sending, or implementation authorization. BLB-21 remains NOT AUTHORIZED. Approval date: 2026-11-22." |

**Approval recorded (documentation-only).** This does not authorize implementation.

---

## 7. Explicit Implementation Authorization Boundary

- **D20-08-C is APPROVED BY PROJECT OWNER (Option B, 2026-11-22)** for decision capture only.
- **D20-08 overall remains PARTIALLY APPROVED — REMAINING ITEMS NOT DECIDED** (A/B/C approved; D/E/F NOT DECIDED).
- **BLB-21 remains NOT AUTHORIZED.** This document does not authorize implementation.
- No WhatsApp template creation/submission/approval, no registry/payload/outbox/mapping changes, no customer-facing UI changes, no API changes, no Meta configuration, no WhatsApp delivery.
- Any future implementation requires: explicit owner decision(s), D20-08-E wording approval as needed, D20-06-compliant formatting implementation, verified response mechanism/wording, legal/compliance review as applicable, Meta approval, and separate BLB-21 implementation authorization.

---

*End of BLB-20X D20-08-C owner decision capture (documentation-only; NOT DECIDED; BLB-21 NOT AUTHORIZED).*