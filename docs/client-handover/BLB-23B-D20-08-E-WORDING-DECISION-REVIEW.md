# BLB-23B — D20-08-E Exact Customer-Facing Wording Decision Review

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Type:** Documentation-only owner decision preparation (read-only evidence review)  
**Status:** **D20-08-E NOT DECIDED** — draft review only, no approval recorded  
**BLB-21:** **NOT AUTHORIZED**

---

## 1. Executive Summary

D20-08-E requires owner approval of the **exact customer-facing WhatsApp wording** for the dedicated admin-initiated reschedule proposal notification. This package provides draft options grounded in already-approved decisions. **No wording is approved by this document.**

## 2. Locked Inputs (Already Approved — Do Not Reopen)

| Decision | Approved state | Evidence |
|---|---|---|
| D20-08-A | Option B — dedicated WhatsApp notification template for admin-initiated reschedule proposals | BLB-20U / register 2026-11-22 |
| D20-08-B | Option A — single formatted `{{proposedSchedule}}` variable, D20-06 format | BLB-20V / register 2026-11-22 |
| D20-08-C | Option B — instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule; no public tracking-page response mechanism; no WhatsApp button/direct acceptance link; no unverified specific contact channel | BLB-20X / register 2026-11-22 |
| D20-06 | DD MMM YYYY, 12-hour AM/PM, IST display; preserve ranges; no IST double-append; storage unchanged | BLB-20N / register 2026-11-22 |

## 3. Unresolved Dependencies

| Dependency | Status | Impact |
|---|---|---|
| D20-08-D | **APPROVED BY PROJECT OWNER — Option C (2026-11-22, BLB-23D)** | No expiry/deadline/countdown/response-window wording in WhatsApp notification; contact S.V. Sweets & Bakers to discuss proposed schedule; existing expiry enforcement unchanged; no expiry variable required |
| D20-08-F | **NOT DECIDED** | Prerequisites acknowledgement is not execution authorization |
| BLB-21 | **NOT AUTHORIZED** | No template/registry/outbox/mapping implementation |
| G-01/G-02/G-04 | OPEN | No worker; RESCHEDULE_PROPOSED unmapped; registry drift/Meta unverified |

## 4. Wording Constraints (Must Hold)

- Use `{{customerName}}`, `{{orderNumber}}`, `{{proposedSchedule}}` only as approved/proposed variables. `{{proposedSchedule}}` is **approved as decision, PROPOSED/not registered/mapped**.
- Include D20-08-C instruction: **contact S.V. Sweets & Bakers to discuss the proposed schedule**.
- Do **not** direct customers to public tracking page as response mechanism.
- Do **not** invent WhatsApp button, direct acceptance link, or unverified specific contact channel.
- Clearly state existing schedule remains unchanged until proposal is accepted and change confirmed by bakery/team (consistent with D20-08 intent; owner to confirm exact semantics).
- Do **not** mention expiry/deadline/countdown/response-window duration (D20-08-D Option C approved 2026-11-22). No expiry-related template variable required.
- Do **not** claim order cancelled on expiry.
- Follow D20-06 display convention for `{{proposedSchedule}}` value at implementation time.

## 5. Draft Options (NOT APPROVED)

### Draft E1 — Minimal, D20-08-C/D aligned (recommended baseline; D20-08-D Option C approved)
> Hello {{customerName}}, we have a proposed change to the scheduled time for your order {{orderNumber}}.
> 
> Proposed schedule: {{proposedSchedule}}
> 
> Please contact S.V. Sweets & Bakers to discuss the proposed schedule.
> 
> Your existing schedule remains unchanged until you accept the proposal and the change is confirmed by our team.
> 
> Thank you for choosing S.V. Sweets & Bakers.

### Draft E2 — Shorter variant
> Hello {{customerName}}, S.V. Sweets & Bakers has proposed a new schedule for order {{orderNumber}}: {{proposedSchedule}}. Please contact S.V. Sweets & Bakers to discuss the proposed schedule. Your existing schedule remains unchanged until the change is confirmed by our team.

### Draft E3 — Historical alternative (NOT SELECTED by D20-08-D)
> Hello {{customerName}}, we have a proposed change to the scheduled time for your order {{orderNumber}}. Proposed schedule: {{proposedSchedule}}. Please contact S.V. Sweets & Bakers within {{responseWindowHours}} hours to discuss the proposed schedule. Your existing schedule remains unchanged until you accept the proposal and the change is confirmed by our team.

**E3 is NOT SELECTED / NOT COMPATIBLE with approved D20-08-D Option C (2026-11-22).** It is retained only as historical alternative. Do not use it unless owner explicitly revises D20-08-D (no such revision recorded). `{{responseWindowHours}}` remains PROPOSED — NOT IMPLEMENTED.

## 6. Recommendation (Non-Binding)

Recommend **Draft E1** as the safest baseline (consistent with approved D20-08-D Option C: no expiry/deadline/countdown/response-window wording). It is clear, includes D20-08-C instruction, avoids unsupported channels/actions, and avoids deadline claims. Owner must explicitly approve exact wording under D20-08-E; E1/E2 remain **NOT APPROVED** until that separate decision.

## 7. Owner Decision Capture

**Decision ID:** D20-08-E — Exact customer-facing wording  
**Status:** **NOT DECIDED**  
**Owner selected draft / custom wording:** ______________________________  
**Approved by:** ______________________________  
**Approval date:** ______________________________  
**Conditions/evidence:** ______________________________  

**No approval recorded by this document.** BLB-21 remains NOT AUTHORIZED.

*End of BLB-23B D20-08-E wording decision review (documentation-only).*