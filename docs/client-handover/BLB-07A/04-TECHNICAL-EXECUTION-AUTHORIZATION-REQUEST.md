# 04 — Technical Execution Authorization Request

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-07A — Stakeholder Decision Collection & Approval Request Pack  
**Date prepared:** 2026-11-21  
**Status:** DRAFT REQUEST — NOT SENT — NO APPROVALS RECEIVED

## 1. Control

Each operation requires **separate, explicit authorization**. Do not bundle all operations under one general approval. Authorization for one operation does not authorize another. Plan approval != execution authorization. UAT approval != production release authorization.

## 2. Operation-specific authorization requests

| # | Operation | Exact scope | Environment | Preconditions | Expected outcome | Responsible operator | Approver | Explicit authorization decision (Approve/Reject/Defer) | Conditions/limitations | Date/validity |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | Source-code implementation | `[Specific files/modules/findings, e.g. BLB05A-W01 consent remediation WP-C1]` | Dev/feature workspace | Approved design; required business/legal decisions; rollback plan | Code changes implemented per approved scope only | `[Tech lead/dev]` | `[Owner/Client/Tech authority]` |  | No unrelated refactors; no deploy | `[PLACEHOLDER]` |
| 2 | Test-file modifications | `[Specific test files/suites]` | Dev/CI | Implementation scope defined | Tests added/updated for approved scope | `[QA/dev]` | `[Tech authority]` |  | No production execution | `[PLACEHOLDER]` |
| 3 | Local automated test execution | `[Specific commands/suites]` | Local/CI | Safe env; no external provider/live DB side effects | Test evidence for scoped changes | `[QA/dev]` | `[Tech authority]` |  | No UAT/provider/prod ops | `[PLACEHOLDER]` |
| 4 | Local UAT | `[Approved CUST/ADM cases]` | Isolated UAT env; synthetic data only | D-16/D-17/D-18 deps; safe mode; decision closure | UAT evidence for scoped cases | `[QA/UAT operator]` | `[Owner/Client]` |  | No real customer data/provider calls | `[PLACEHOLDER]` |
| 5 | Database UAT precheck | `[Read-only precheck queries/checks for D-11]` | **Only** `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` | D-11 explicit auth; backup readiness; precheck plan | Precheck report (duplicates/expiresAt/index state) | `[DBA/Backend]` | `[Owner/Client/DBA authority]` |  | No 27017/27019/Atlas/prod; no writes unless separately authorized | `[PLACEHOLDER]` |
| 6 | UAT index creation or rollout | `[S07 idempotency indexes only, exact DDL]` | **Only** `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` | Separate explicit D-11 auth; prechecks pass; backup; rollback | Indexes created/verified in UAT only | `[DBA]` | `[Owner/Client/DBA authority]` |  | No 27017/27019/Atlas/prod; no unrelated DB changes | `[PLACEHOLDER]` |
| 7 | WhatsApp sandbox/provider testing | `[Test numbers/templates/events only]` | Provider sandbox/test | Legal/consent W01 decisions; AP-10; template approval; test recipients | Sandbox evidence; no real customer messages | `[Ops/Backend/QA]` | `[Owner/Client/Compliance/Ops]` |  | No real customer messages; no prod | `[PLACEHOLDER]` |
| 8 | Email/OTP sandbox testing | `[Test mailboxes/accounts only]` | Sandbox/test | AP-05 decision; S02 preserved; test accounts | Safe OTP/email evidence | `[Ops/Backend/QA]` | `[Owner/Client/Security]` |  | No real customer OTP/email; no S02 weakening | `[PLACEHOLDER]` |
| 9 | Razorpay sandbox testing | `[Sandbox create/verify/webhook/reconciliation cases]` | Razorpay sandbox | AP-07 decision; sandbox keys/config | Sandbox payment evidence | `[Ops/Backend/QA]` | `[Owner/Client/Finance/Ops]` |  | No live txns/webhooks/captures | `[PLACEHOLDER]` |
| 10 | Production provider operations | `[Explicit provider operation named separately]` | Production provider accounts | All prior gates; legal/compliance; rollback/support | Approved prod provider operation | `[Ops]` | `[Owner/Client]` |  | Explicitly named operation only | `[PLACEHOLDER]` |
| 11 | Deployment | `[Specific service/version/env]` | Staging or production (named separately) | Release candidate, rollback, monitoring, env readiness | Controlled deployment | `[Release/Ops]` | `[Owner/Client/Release authority]` |  | No prod release implied by staging | `[PLACEHOLDER]` |
| 12 | Production database operations | `[Explicit DB operation, e.g. D-12 index rollout]` | Production DB (named separately) | D-12 gate, backup/rollback, maintenance window | Approved prod DB operation | `[DBA]` | `[Owner/Client/DBA authority]` |  | Explicit operation only; no unrelated changes | `[PLACEHOLDER]` |
| 13 | Production release | `[Explicit release scope/version]` | Production | All gates/evidence/acceptance; D-19 | Production release authorized | `[Release manager]` | `[Owner/Client]` |  | Separate explicit D-19 auth; NO-GO until granted | `[PLACEHOLDER]` |

## 3. Required authorization statement template

> I, `[NAME / ROLE / AUTHORITY]`, authorize operation `[# / name]` for scope `[SCOPE]` in environment `[ENV]` on `[DATE]`, valid until `[DATE/CONDITION]`, subject to `[CONDITIONS]`. I understand this authorization does not grant any other operation.

**Evidence/reference:** `[PLACEHOLDER]`