# 02 — Dependency & Priority Matrix

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Priority framework

| Priority | Definition | Release impact |
|---|---|---|
| **P0 — Critical** | Prevents safe operation, exposes significant security/compliance risk, or blocks essential customer/business workflow/acceptance | Must be resolved/accepted with evidence before any client handover claim |
| **P1 — High** | Prevents production confidence, reliable delivery, maintainability, or formal acceptance | Must be resolved or formally risk-accepted by authorized owner before release |
| **P2 — Medium** | Important for professional quality, maintainability, operational efficiency | Should be completed before handover; defer only with documented owner acceptance |
| **P3 — Low** | Polish/non-critical cleanup/optional enhancements | Can follow post-handover if explicitly accepted |

No severity reduced to improve score. P0/P1 remain blockers until evidence closes them.

## 2. Dependency matrix

| Register ID | Priority | Depends on | Blocks | Can proceed now (docs/planning)? | Execution gate |
|---|---|---|---|---|---|
| R-001 WhatsApp consent journey | P0 | R-016 legal wording; R-002/AP-10 policy; R-004 stable baseline for implementation later | R-006 WhatsApp runtime verification, R-007 tests, R-008 docs, D-17/D-18 confidence, handover | Yes — design/planning/legal review prep | Separate implementation + legal approval + provider test auth |
| R-002 Decision closure (19 areas) | P0 | Owner/client response | R-003/R-005/R-006/R-007/UAT/deploy/acceptance as applicable | Yes — BLB-04D evidence capture docs/process | Written decision evidence; separate execution auth per activity |
| R-003 Deployment/ops readiness | P1 | R-015 infra evidence; R-011 env matrix; R-004 release candidate | D-19, client acceptance, production operations | Yes — runbook drafting | Separate ops/infra access and drill authorization |
| R-004 Release boundary/repo integrity | P1 | R-013 lockfile/legal disposition; owner scope decisions | All implementation/testing/release milestones | Yes — classification plan | Separate git cleanup/release packaging authorization |
| R-005 S07 UAT index precheck/rollout | P1 | R-002 decisions AP-03/D-11; isolated UAT DB availability; backup/restore plan | D-17 CUST-14 idempotency confidence, D-12, D-19 | Yes — precheck/rollback plan drafting | **Separate explicit D-11 execution authorization only**; UAT target `127.0.0.1:27018/bluebell_whatsapp_uat`; `UAT_SAFE_MODE=true`; no 27017/27019/Atlas/prod |
| R-006 Payment/WhatsApp provider verification | P1 | R-001, R-010, R-002/AP-07/AP-10, sandbox/provider access | D-19, acceptance confidence | Yes — test case design | Separate sandbox/provider execution authorization; no live txns/messages |
| R-007 Testing/CI coverage | P1 | R-004 baseline; R-001/R-010 for consent/payment UI tests | D-17/D-18 readiness, D-19 | Yes — test strategy/case design | Separate implementation authorization |
| R-008 Client documentation pack | P1 | R-003/R-005/R-006/R-011/R-012 outputs; client input | Client acceptance | Yes — draft docs from known facts | Client/business/legal input and doc approval |
| R-009 Security hardening/verification | P1 | R-015, R-003, D-13/D-14 decisions/evidence | D-19, production confidence | Yes — threat/control matrix drafting | Separate implementation/infra authorization |
| R-010 UI contract/status clarity | P1 | R-001, R-006 | R-007, acceptance | Yes — UX/spec drafting | Separate implementation authorization |
| R-011 Env/CI/release process | P1 | R-004, R-003 | R-003, R-006, D-19 | Yes | Separate process/ops authorization |
| R-012 DB schema/backup docs | P1 | R-003, R-005 | R-008, ops readiness | Yes — schema doc drafting from code | Separate DB drill authorization |
| R-013 Lockfile/LICENSE/SBOM/delivery metadata | P2 | R-004 classification | R-004 clean release candidate | Yes — policy/legal review prep | Separate repo cleanup/legal authorization |
| R-014 Maintainability/quality debt | P2 | R-004, R-007 | long-term maintenance | Yes — refactor backlog | Separate implementation authorization |
| R-015 External infra evidence (D-14) | P1 | Infra/hosting/CDN/WAF owner access | R-003, R-009, D-13 enforcement confidence, D-19 | Yes — evidence request checklist | External access/permission required |
| R-016 Consent legal/compliance approval | P0 | Client/legal stakeholder | R-001 implementation finalization | Yes — draft review package | Client/legal approval required |

## 3. Decision dependency overlay (19 decision areas)

| Decision area | Blocks before execution/UAT/release | Independent decision now? | Execution authorized? |
|---|---|---|---|
| BLB-03M/AP-01 | CUST-10/AP-06, D-17, D-19 | Yes (decision) | No |
| AP-02 | AP-16, D-16, D-17/D-18 | Yes | No |
| AP-03 | AP-04/AP-06/AP-08/AP-09, D-11 precondition, D-16-D-18 | Yes | No |
| AP-04 | AP-06/AP-08/AP-09, D-16-D-18 | Partially | No |
| AP-05/CUST-11 | CUST-11 scope, AP-06 confidence, D-17 | Yes (decision) | No |
| AP-06/CUST-10 | D-17, D-19 | No (dependency-blocked) | No |
| AP-07 | AP-06/CUST-10, D-17, D-19 | Yes | No |
| AP-08/CUST-14 | CUST-14 scope, D-17 | Yes (scope decision) | No |
| AP-09 | ADM-01-13, D-18, D-19 | Yes | No |
| AP-10 | AP-05/06/08/09, D-17/D-18 evidence interpretation | Yes | No |
| AP-16 | D-16-D-18 | Yes | No |
| D-13 | Future enforcement, D-19 confidence | Yes (defer/investigate) | No |
| D-S05 | Audit trail/doc completeness, D-19 | Yes | No |
| D-14 | S03/S05/S07 real-world confidence, D-13 evidence, D-19 | No (external) | No |
| D-15 | D-19 confidence | Yes (scope) | No |
| D-16 | D-17/D-18 | No | No |
| D-17 | D-19 | No | No |
| D-18 | D-19 | No | No |
| D-11 | S07 UAT confidence, D-12, D-19 | No | No |
| D-12 | D-19 | No | No |
| D-19 | Production release/client handover | No | No |

*Note: 19 decision areas include AP-05/CUST-11 etc. as combined areas; worksheet contains 21 rows - both preserved.*

## 4. Critical path

1. **R-002/R-016** decision/legal closure inputs (no execution).
2. **R-004** release-boundary classification and clean candidate plan (authorized later).
3. **R-001/R-009/R-010** P0/P1 security/consent/contract remediation (authorized implementation).
4. **R-007/R-006** automated tests + authorized sandbox/provider verification.
5. **R-005** D-11 UAT-only index precheck/rollout (separately authorized, `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`).
6. **R-003/R-011/R-012/R-015** ops/infra/runbooks/evidence.
7. **R-008/R-013** documentation/legal/delivery packaging.
8. **Authorized UAT + acceptance (D-17/D-18/D-19)** - only after all gates/evidence/authorizations. 

## 5. What can proceed now (documentation/planning only)

- R-001/R-016 design/legal review package drafting.
- R-002 BLB-04D decision evidence capture templates/register maintenance.
- R-003/R-011/R-012 runbook and matrix drafting.
- R-004 classification matrix and release-manifest template.
- R-005 precheck/rollback plan drafting (no DB execution).
- R-006/R-007 test case and coverage matrix drafting.
- R-008 documentation drafts from verified facts.
- R-015 infra evidence request checklist.

## 6. What remains prohibited

- Any code/config/env/dependency/test implementation changes.
- Git reset/clean/stash/checkout/switch/add/commit/push/pull/merge/rebase/amend/cherry-pick/restore/delete/rename/move/overwrite.
- Any DB writes/migrations/index creation/rollout/queries against 27017/27019/Atlas/prod; D-11 execution without separate explicit authorization.
- Any provider calls (Razorpay/WhatsApp/email/OTP/Cloudinary), live txns/webhooks/captures.
- Any UAT execution, synthetic data provisioning, credential handling, service restart, deployment, production release.
- Any fabricated decision/approval/authorization.