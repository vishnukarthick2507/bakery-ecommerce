# 06 — Operation-Specific Authorization Matrix

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## Control rules

- One approval does **not** authorize another operation.
- Decision confirmation != execution authorization.
- Plan approval != execution authorization.
- UAT approval != production approval.
- **Special DB restriction:** Any separately authorized future UAT database operation must target exactly `127.0.0.1:27018/bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true`. No other database target is permitted under this project boundary.

## Authorization matrix

| Operation | Required authorizing party | Exact scope | Environment | Preconditions | Evidence required | Explicit authorization status | Currently present? |
|---|---|---|---|---|---|---|---|
| Source-code implementation | Project owner/client authorized technical lead | Specific files/modules/findings (e.g. WP-C1 consent remediation) | Dev/feature workspace | Approved design, decision closure where needed, rollback plan | Written implementation authorization referencing scope/commit window | NOT AUTHORIZED | No |
| Test-file changes | Project owner/technical lead | Specific test suites/files | Dev/CI | Implementation scope defined | Written authorization or approved dev mandate | NOT AUTHORIZED | No |
| Local automated testing | Technical lead/QA lead | Specific commands/suites; no external providers/DB writes outside approved env | Local/CI | Dependencies installed as authorized, env safe | Test plan, command scope | NOT AUTHORIZED | No (execution not performed in BLB-05C) |
| Local UAT | Owner/Client + QA lead | Approved CUST/ADM cases, synthetic data only | Isolated local/UAT env | D-16/D-17/D-18 dependencies, safe mode, no real data/providers | UAT auth record, test cases, synthetic data plan | NOT AUTHORIZED | No |
| Database UAT precheck | Owner/Client + DBA/Tech Lead | Read-only/precheck queries only on approved target | **Only** `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` | D-11 precheck plan approved, backup readiness, no prod/27017/27019/Atlas | Written precheck authorization, query plan | NOT AUTHORIZED | No |
| Database index creation/rollout (UAT) | Owner/Client + DBA | S07 idempotency indexes only; exact DDL scope | **Only** `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` | Separate explicit D-11 auth, backup, duplicate/expiresAt prechecks, rollback, maintenance window | D-11 auth record, precheck report, backup evidence | NOT AUTHORIZED | No |
| WhatsApp provider testing | Owner/Client + Ops/Compliance | Sandbox/test numbers/templates only; no real customer messages | Provider sandbox/test | Legal/consent decision, AP-10, template approval, opt-in test data | Written provider-test authorization, recipient list, template IDs | NOT AUTHORIZED | No |
| Email/OTP provider testing | Owner/Client + Ops/Security | Sandbox/test mailboxes/numbers only; no real customers | Test/sandbox | AP-05 decision, S02 preserved, test accounts approved | Written provider-test authorization | NOT AUTHORIZED | No |
| Razorpay sandbox testing | Owner/Client + Finance/Ops | Sandbox keys, no live txns/webhooks/captures | Razorpay sandbox | AP-07 decision, sandbox config, reconciliation plan | Written sandbox authorization, key ownership evidence | NOT AUTHORIZED | No |
| Production provider operations | Owner/Client + Ops/Finance/Compliance | Explicitly named provider operation only | Production provider accounts | D-19-adjacent gates, rollback/support, legal/compliance | Written prod-provider authorization | NOT AUTHORIZED | No |
| Deployment | Owner/Client + Ops/Release Manager | Specific app/service/version/env | Staging/production as separately named | Release candidate, rollback, monitoring, env/secret readiness | Deployment authorization record, checklist | NOT AUTHORIZED | No |
| Production database operations | Owner/Client + DBA | Explicit operation (backup/restore/index/migration) | Production DB only if separately named | D-12/D-19 as applicable, backup/rollback, maintenance window | Written prod DB authorization | NOT AUTHORIZED | No |
| Production release | Owner/Client | Explicit release scope/version | Production | All required gates/evidence/decisions closed; D-19 | Signed release authorization, acceptance evidence | NOT AUTHORIZED / NO-GO | No |

## Current authorization summary

- **Currently present authorizations:** 0 new. Historical S06 Option A record remains narrow-scope only (not extended).
- **BLB-05C grants no authorization.** This document is readiness mapping only.