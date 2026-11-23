# BLB-03U-R — Controlled UAT Readiness Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-21  
**Milestone:** BLB-03U-R — Controlled UAT Readiness Planning (documentation-only)  
**Status:** **READY FOR INTERNAL REVIEW**

## 1. Purpose

Prepare complete, evidence-based runbooks/checklists for a later controlled, isolated UAT execution milestone. This plan **does not** execute UAT and **does not** grant operational authorization.

## 2. Scope and constraints

- **Documentation-only.** No code/test/config/env/dependency/service/DB/provider/Git operations performed.
- **Execution status:** **NOT AUTHORIZED** for UAT, DB index creation, account/data provisioning, external provider calls, or deployment.
- **Release status:** **NOT READY**.
- **Safety boundary:** Isolated UAT only, `UAT_SAFE_MODE=true`, DB target `127.0.0.1:27018/bluebell_whatsapp_uat`. Explicitly prohibited: MongoDB Atlas, production port `27017`, temporary restore port `27019`, real customer/admin credentials, real customer data, real provider operations.

## 3. Evidence base

Inspected read-only: `BLB-03T-R-INTERNAL-DECISION-REGISTER.md`, `BLB-03U-STEP7B-RELEASE-GATE-TRACKER.md`, `BLB-03S-OWNER-DECISION-REQUEST.md`, `BLB-03-UAT-RESULTS.md`, `BLB-03-UAT-TEST-PLAN.md`, `BLB-03-TEST-DATA-PLAN.md`, `UAT_SAFE_MODE.md`, `BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`, S07 design/report, `BLB-03S-RELEASE-READINESS.md`, `CLIENT_HANDOVER_STATUS.md`, and targeted implementation evidence (`backend/src/models/CustomCakeSubmissionIdempotency.ts`, `backend/src/controllers/customCakeController.ts`, UAT-safe-mode docs).

## 4. Internal decision status resolution

| Decision | Current internal status | Basis | Execution authorization |
|---|---|---|---|
| BLB-03M / AP-01 Guest checkout | **RECOMMENDED — NOT CONFIRMED** (Option A recommended) | UAT results show step-1 Continue validates phone only; final `handlePlaceOrder()` and backend enforce guest name/email/phone. Option A aligns step-1 UX with existing final/backend rules. | **NOT AUTHORIZED** (no code change/UAT). |
| AP-02 Synthetic customer/admin access | **RECOMMENDED — NOT CONFIRMED** | UAT blocked by missing secure synthetic identities/credentials; least-privilege/out-of-band required. | **NOT AUTHORIZED** (no provisioning). |
| AP-03 Isolated UAT DB write permissions | **RECOMMENDED — NOT CONFIRMED** | UAT Safe Mode requires 127.0.0.1:27018/bluebell_whatsapp_uat; controlled writes needed for blocked scenarios. | **NOT AUTHORIZED** (no DB writes). |
| AP-04 Synthetic data provisioning/cleanup | **RECOMMENDED — NOT CONFIRMED** | Test-data plan and UAT results require synthetic-only, manifest, cleanup/rollback. | **NOT AUTHORIZED**. |
| AP-05 Registration/OTP testing policy | **RECOMMENDED — NOT CONFIRMED** / **BLOCKED** for unsafe paths | S02 remediated OTP disclosure; UAT Safe Mode suppresses external OTP delivery; plaintext non-recoverable. CUST-11 safe evidence path needs technical confirmation. | **NOT AUTHORIZED**. |
| AP-06 Guest checkout / CUST-10 | **RECOMMENDED — NOT CONFIRMED** | Depends on BLB-03M, AP-02/03/04/05/07/10 as applicable; isolated UAT only. | **NOT AUTHORIZED**. |
| AP-07 Payment restrictions | **RECOMMENDED — NOT CONFIRMED** | UAT Safe Mode blocks live Razorpay client/API/tx-creating operations/webhook processing. No live/real payments. | **NOT AUTHORIZED**. |
| AP-08 Custom cake/media | **RECOMMENDED — NOT CONFIRMED** / partially **BLOCKED** | S07 adds honeypot/idempotency; Cloudinary external ops blocked in safe mode. Media upload safe-isolation requires technical confirmation. | **NOT AUTHORIZED**. |
| AP-09 Admin workflow scope ADM-01–13 | **RECOMMENDED — NOT CONFIRMED** | Phase read-only then controlled mutating with rollback; admin credentials/scope required. | **NOT AUTHORIZED**. |
| AP-10 Notification suppression | **RECOMMENDED — NOT CONFIRMED** | UAT Safe Mode suppresses email/OTP/WhatsApp/admin alerts; suppressed must not be reported as sent/delivered. | **NOT AUTHORIZED**. |
| Decision 11 S07 UAT index rollout | **RECOMMENDED — NOT CONFIRMED** (plan only) | Model defines unique `idempotencyKey`, TTL `expiresAt` `expireAfterSeconds:0`; DB enforcement not verified in UAT/prod. | **NOT AUTHORIZED** (no DB ops). |
| Decision 12 S07 production index rollout | **DEFERRED** | Separate prod approval/change plan required; UAT approval does not transfer. | **NOT AUTHORIZED**. |
| Decision 13 Origin/Referer compatibility | **RECOMMENDED — NOT CONFIRMED** (investigate then enforce/defer with evidence) | Deferred in S07; compatibility risk unassessed. | **NOT AUTHORIZED**. |
| Decision 14 WAF/CDN/trusted-proxy verification | **RECOMMENDED — NOT CONFIRMED** | Repo has partial evidence; infra topology/edge config requires external access. | **NOT AUTHORIZED**. |
| Decision 15 Accessibility/browser smoke | **RECOMMENDED — NOT CONFIRMED** | No manual a11y/browser smoke completed; scope defined in checklist. | **NOT AUTHORIZED**. |
| Decision 16 Synthetic UAT data/credentials | **RECOMMENDED — NOT CONFIRMED** | Covered by AP-02/04 policy; secure delivery/cleanup required. | **NOT AUTHORIZED**. |
| Decision 17 Customer UAT CUST-10–14 | **RECOMMENDED — NOT CONFIRMED** | Blocked pending prerequisites/authorizations. | **NOT AUTHORIZED**. |
| Decision 18 Admin UAT ADM-01–13 | **RECOMMENDED — NOT CONFIRMED** | Blocked pending prerequisites/authorizations. | **NOT AUTHORIZED**. |
| Decision 19 Production release Go/No-Go | **DEFERRED** / NO-GO currently | All release gates not satisfied. | **NOT AUTHORIZED**. |

## 5. Readiness summary

| Area | Readiness | Status |
|---|---|---|
| Customer UAT runbook/planning | Documentation prepared; execution blocked by prerequisites | **READY FOR INTERNAL REVIEW** / Execution **NOT AUTHORIZED** |
| Admin UAT runbook/planning | Documentation prepared; execution blocked by prerequisites | **READY FOR INTERNAL REVIEW** / Execution **NOT AUTHORIZED** |
| Synthetic data/credentials policy | Documentation prepared | **READY FOR INTERNAL REVIEW** / Execution **NOT AUTHORIZED** |
| S07 UAT index rollout runbook | Documentation prepared; DB execution blocked | **READY FOR INTERNAL REVIEW** / Execution **NOT AUTHORIZED** |
| Evidence checklist | Documentation prepared | **READY FOR INTERNAL REVIEW** |
| Operational authorization gates | Documentation prepared | **READY FOR INTERNAL REVIEW** |

## 6. Key blockers and gaps

- BLB-03M not internally confirmed (Option A recommended, not confirmed).
- AP-02–AP-10 not formally approved/authorized for execution.
- CUST-11 safe OTP evidence path requires technical confirmation; may be **BLOCKED** for full flow.
- CUST-14/AP-08 media upload safe-isolation requires technical confirmation; external media path **BLOCKED** under UAT Safe Mode.
- S07 DB indexes not created/verified in UAT/prod; index rollout **NOT AUTHORIZED**.
- Origin/Referer, WAF/CDN/trusted-proxy, accessibility/browser smoke not verified.
- CUST-10–14 and ADM-01–13 **NOT TESTED** in this milestone.
- Production release **NOT READY** / **DEFERRED**.

## 7. Deliverables created by this milestone

1. `docs/release/BLB-03U-R-UAT-READINESS-PLAN.md` (this file)
2. `docs/uat/BLB-03U-R-CUSTOMER-UAT-RUNBOOK.md`
3. `docs/uat/BLB-03U-R-ADMIN-UAT-RUNBOOK.md`
4. `docs/uat/BLB-03U-R-SYNTHETIC-DATA-AND-CREDENTIALS.md`
5. `docs/uat/BLB-03U-R-S07-UAT-INDEX-ROLLOUT-RUNBOOK.md`
6. `docs/uat/BLB-03U-R-UAT-EVIDENCE-CHECKLIST.md`
7. `docs/release/BLB-03U-R-OPERATIONAL-AUTHORIZATION-GATES.md`

## 8. Next recommended milestone

**BLB-03V — Internal Confirmation & Execution Authorization Package (documentation/control only):** confirm BLB-03M and AP decisions internally with named approver/date/evidence; resolve AP-05 safe evidence path and AP-08 media isolation; authorize S07 UAT index precheck/rollout as a separate controlled operation; then authorize isolated UAT execution. No UAT/DB/provider/deploy actions until those authorizations are explicitly recorded.