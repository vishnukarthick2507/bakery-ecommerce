# 01 — Business Owner / Project Owner Decision Request

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-07A — Stakeholder Decision Collection & Approval Request Pack  
**Date prepared:** 2026-11-21  
**Status:** DRAFT REQUEST — NOT SENT — NO APPROVALS RECEIVED

## 1. Purpose

This request asks the business owner / project owner to provide written decisions for the outstanding project decisions identified in BLB-04D through BLB-06A. These decisions are required before remediation implementation, UAT, database/provider operations, deployment, or production release can be authorized.

**Current project status:** NOT READY — CRITICAL BLOCKERS. Production release: NO-GO. No implementation/UAT/database/provider/deployment authorization is granted by this document.

## 2. How to respond

Please complete the response register in Section 4 for each applicable decision. For each decision, provide:

- **Decision ID**
- **Selected option** (if options are documented; otherwise state your decision clearly)
- **Approved / Rejected / Deferred**
- **Conditions** (any limits, prerequisites, or caveats)
- **Reason or business justification**
- **Approver name and role**
- **Date**

**Required response date:** `[PLACEHOLDER — PLEASE SPECIFY]`  
**Named decision owner / approver:** `[PLACEHOLDER — NAME / ROLE / AUTHORITY]`  
**Response channel:** `[PLACEHOLDER — EMAIL / DOCUMENT / MEETING RECORD]`

A decision confirmation does not authorize implementation, testing, UAT, database/provider operations, deployment, or production release. Any execution requires separate, explicit, operation-specific authorization.

## 3. Decision summary (19 decision areas / 21 worksheet rows)

| Row | Decision ID | Decision needed | Why needed before remediation/progress | Impact if delayed | Known options (from baseline) |
|---:|---|---|---|---|---|
| 1 | BLB-03M/AP-01 | Guest checkout Continue option (A/B) | Defines CUST-10/UAT scope and checkout behavior | Guest checkout UAT/remediation scope remains blocked | Option A/B as documented in BLB-03M/04D baseline (confirm selected option) |
| 2 | AP-02 | Synthetic customer/admin access policy | Controls safe UAT identity/access | UAT cannot be safely prepared/executed | Policy decision; no code option invented |
| 3 | AP-03 | Isolated UAT DB write policy (`127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`) | Establishes safe DB boundary | D-11/UAT DB operations remain blocked | Approve/reject/defer policy; execution separate |
| 4 | AP-04 | Synthetic data provisioning/cleanup policy | Defines UAT data lifecycle | UAT data handling cannot proceed | Approve/reject/defer |
| 5 | AP-05/CUST-11 | Registration & OTP safe testing path | Needed for CUST-11 without weakening S02 | OTP/registration UAT evidence blocked | Safe evidence path or defer (no OTP bypass) |
| 6 | AP-06/CUST-10 | Guest checkout order submission UAT scope | Depends on upstream decisions | CUST-10 remains blocked | Scope decision after dependencies resolved |
| 7 | AP-07 | Payment testing restrictions | Prevents unsafe live payment testing | Payment verification remains blocked | Sandbox-only/restricted scope recommended in baseline |
| 8 | AP-08/CUST-14 | Custom cake and media scope | Controls media/compliance risk | CUST-14 blocked; media ops remain prohibited | No-media/defer/limited scope (decide) |
| 9 | AP-09 | Admin ADM-01-13 scope | Defines admin UAT coverage | Admin UAT blocked | Scope selection |
| 10 | AP-10 | Notification/WhatsApp suppression expectations | Defines acceptable evidence/behavior | WhatsApp/UAT evidence interpretation blocked | Suppression/expectation policy |
| 11 | AP-16 | Synthetic data/credentials operational handling | Secure UAT handling | D-16-D-18 blocked | Handling procedure decision |
| 12 | D-13 | Origin/Referer compatibility decision | Avoids breaking clients; informs security hardening | Enforcement/change remains blocked | Defer/investigate/enforce-later (as applicable) |
| 13 | D-S05 | Missing S05 provenance design doc disposition | Audit trail completeness | Documentation completeness gap remains | Approve disposition option per baseline |
| 14 | D-14 | Infrastructure topology/evidence ownership | Real-world control verification | Release confidence blocked | Provide evidence/owner (infra request separate) |
| 15 | D-15 | Accessibility/browser smoke scope | Release confidence/acceptance | A11y smoke remains unscoped | Scope decision |
| 16 | D-16 | Synthetic UAT data/credentials execution authorization | Required before UAT execution | D-17/D-18 cannot start | Separate execution authorization |
| 17 | D-17 | Customer UAT execution authorization | Required for customer acceptance evidence | Customer UAT blocked | Separate execution authorization |
| 18 | D-18 | Admin UAT execution authorization | Required for admin acceptance evidence | Admin UAT blocked | Separate execution authorization |
| 19 | D-11 | S07 UAT index precheck/rollout authorization | S07 UAT idempotency confidence | D-11 execution blocked | Separate explicit auth; UAT-only 127.0.0.1:27018/bluebell_whatsapp_uat; UAT_SAFE_MODE=true |
| 20 | D-12 | S07 production index rollout authorization | Future prod DB safety | Prod index rollout blocked/deferred | Separate prod DB auth after D-11 evidence |
| 21 | D-19 | Production release Go/No-Go authorization | Final release/handover | Production release remains NO-GO | Separate explicit release auth after all gates |

## 4. Response register (complete for all applicable rows)

| Row | Decision ID | Selected option | Approved / Rejected / Deferred | Conditions | Reason / business justification | Approver name & role | Date |
|---:|---|---|---|---|---|---|---|
| 1 | BLB-03M/AP-01 |  |  |  |  |  |  |
| 2 | AP-02 |  |  |  |  |  |  |
| 3 | AP-03 |  |  |  |  |  |  |
| 4 | AP-04 |  |  |  |  |  |  |
| 5 | AP-05/CUST-11 |  |  |  |  |  |  |
| 6 | AP-06/CUST-10 |  |  |  |  |  |  |
| 7 | AP-07 |  |  |  |  |  |  |
| 8 | AP-08/CUST-14 |  |  |  |  |  |  |
| 9 | AP-09 |  |  |  |  |  |  |
| 10 | AP-10 |  |  |  |  |  |  |
| 11 | AP-16 |  |  |  |  |  |  |
| 12 | D-13 |  |  |  |  |  |  |
| 13 | D-S05 |  |  |  |  |  |  |
| 14 | D-14 |  |  |  |  |  |  |
| 15 | D-15 |  |  |  |  |  |  |
| 16 | D-16 |  |  |  |  |  |  |
| 17 | D-17 |  |  |  |  |  |  |
| 18 | D-18 |  |  |  |  |  |  |
| 19 | D-11 |  |  |  |  |  |  |
| 20 | D-12 |  |  |  |  |  |  |
| 21 | D-19 |  |  |  |  |  |  |

## 5. Additional business policy confirmations requested

| Topic | Requested decision | Approver | Date | Notes |
|---|---|---|---|---|
| Refund/cancellation/rescheduling policy | Confirm current business policy and any handover documentation requirements | `[PLACEHOLDER]` |  |  |
| Custom cake workflow expectations | Confirm approval/response/notification expectations | `[PLACEHOLDER]` |  |  |
| Customer/admin UAT acceptance criteria | Confirm what constitutes acceptable UAT sign-off | `[PLACEHOLDER]` |  |  |
| Production go-live acceptance | Confirm business acceptance prerequisites | `[PLACEHOLDER]` |  |  |

## 6. Important boundaries

- This document is a request draft only. It has not been sent.
- No response is treated as received/verified until evidence is reviewed.
- Missing required approval information is not consent.
- Decision != implementation authorization != UAT authorization != production release authorization.