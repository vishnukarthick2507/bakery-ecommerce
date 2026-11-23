# 08 — Unresolved Decisions & External Evidence Register

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## Status legend
VERIFIED STATIC EVIDENCE | VERIFIED DOCUMENTARY EVIDENCE | NOT VERIFIED | EXTERNAL EVIDENCE REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | EXECUTION AUTHORIZATION REQUIRED | PROPOSED — NOT APPROVED

## 1. Decision register (19 decision areas / 21 worksheet rows preserved)

Baseline: BLB-04D (0 new evidence, 0 confirmed, 0 execution authorizations). No external systems checked.

| Row | Decision ID | Status | Type | Required evidence/decision | Owner | Blocks | Execution authorized? |
|---:|---|---|---|---|---|---|---|
| 1 | BLB-03M/AP-01 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Written option A/B selection | Owner/Client | AP-06, D-17, D-19 | No |
| 2 | AP-02 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Synthetic access policy | Owner/Client | D-16-D-18 | No |
| 3 | AP-03 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | UAT DB write policy (27018 only) | Owner/Client | D-11 preconditions, D-16-D-18 | No |
| 4 | AP-04 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Synthetic data provisioning/cleanup | Owner/Client | D-16-D-18 | No |
| 5 | AP-05/CUST-11 | NOT RECEIVED — DECISION REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | Safe OTP/registration testing path; S02 intact | Owner/Client | CUST-11, D-17 | No |
| 6 | AP-06/CUST-10 | DEPENDENCY-BLOCKED | BUSINESS/CLIENT DECISION REQUIRED | Guest checkout UAT scope after deps | Owner/Client | D-17, D-19 | No |
| 7 | AP-07 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Payment testing restrictions (sandbox-only) | Owner/Client | D-17, D-19 | No |
| 8 | AP-08/CUST-14 | NOT RECEIVED — DECISION REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | Custom cake/media scope | Owner/Client | D-17 | No |
| 9 | AP-09 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Admin ADM-01-13 scope | Owner/Client | D-18, D-19 | No |
| 10 | AP-10 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Notification/WhatsApp suppression expectations | Owner/Client | D-17, D-18 | No |
| 11 | AP-16 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | Credential/data handling | Owner/Client | D-16-D-18 | No |
| 12 | D-13 | NOT RECEIVED — DECISION REQUIRED | BUSINESS/CLIENT DECISION REQUIRED / EXTERNAL EVIDENCE REQUIRED | Origin/Referer defer/investigate/enforce decision; origin inventory | Owner/Client/Tech | Enforcement, D-19 confidence | No |
| 13 | D-S05 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | S05 provenance doc disposition | Owner/Client/Tech | Audit completeness | No |
| 14 | D-14 | NOT RECEIVED — BLOCKED | EXTERNAL EVIDENCE REQUIRED | WAF/CDN/proxy/TLS/client-IP/rate-limit topology evidence | Infra/Hosting owner | D-13, D-19 | No |
| 15 | D-15 | NOT RECEIVED | BUSINESS/CLIENT DECISION REQUIRED | A11y/browser smoke scope | Owner/Client | D-19 confidence | No |
| 16 | D-16 | NOT RECEIVED | EXECUTION AUTHORIZATION REQUIRED | Synthetic UAT data/credentials execution auth | Owner/Client | D-17, D-18 | No |
| 17 | D-17 | NOT RECEIVED — BLOCKED | EXECUTION AUTHORIZATION REQUIRED | Customer UAT auth | Owner/Client | D-19 | No |
| 18 | D-18 | NOT RECEIVED — BLOCKED | EXECUTION AUTHORIZATION REQUIRED | Admin UAT auth | Owner/Client | D-19 | No |
| 19 | D-11 | NOT RECEIVED — NOT AUTHORIZED | EXECUTION AUTHORIZATION REQUIRED | Separate explicit D-11 auth; `127.0.0.1:27018/bluebell_whatsapp_uat`; `UAT_SAFE_MODE=true`; prechecks/backup/rollback | Owner/Client/DBA | D-12, D-19 confidence | No |
| 20 | D-12 | NOT RECEIVED — DEFERRED | EXECUTION AUTHORIZATION REQUIRED | Prod index rollout auth after D-11 evidence | Owner/Client/DBA | D-19 | No |
| 21 | D-19 | NOT RECEIVED — DEFERRED / NO-GO | EXECUTION AUTHORIZATION REQUIRED | Explicit production release Go/No-Go | Owner/Client | Production release | No |

## 2. External evidence register

| ID | Evidence needed | Why | Current status | Owner | Blocks |
|---|---|---|---|---|---|
| EV-01 | D-14 infra topology/WAF/CDN/proxy/TLS/client-IP/rate-limit evidence | Validate real-world S03/S05/S07 assumptions | EXTERNAL EVIDENCE REQUIRED | Infra owner | D-13, D-19 |
| EV-02 | Razorpay sandbox config/keys/webhook dashboard evidence | Payment verification | EXTERNAL EVIDENCE REQUIRED | Ops/Finance | T-PAY-01 |
| EV-03 | WhatsApp provider/Meta sandbox/template/consent policy evidence | WhatsApp verification | EXTERNAL EVIDENCE REQUIRED | Ops/Legal | T-WA-02, W01 closure |
| EV-04 | Hosting/env ownership, secret storage/rotation/transfer evidence | Ops handover | EXTERNAL EVIDENCE REQUIRED | Client/Ops | Deployment readiness |
| EV-05 | Backup/restore infrastructure and drill evidence | Data safety | EXTERNAL EVIDENCE REQUIRED | DBA/Ops | AC-OPS01 |
| EV-06 | Legal/compliance approval for WhatsApp consent wording/policy | W01 compliance | BUSINESS/CLIENT DECISION REQUIRED | Client/Legal | WP-C1 |
| EV-07 | Client acceptance criteria/signatories/support contacts/SLA terms | Handover completion | BUSINESS/CLIENT DECISION REQUIRED | Client | AC-DOC01, D-19 |

## 3. Summary

- **Unresolved decisions:** 19 areas / 21 rows.
- **Confirmed decisions:** 0.
- **Execution authorizations present:** 0.
- **External evidence items unresolved:** 7 (EV-01-EV-07).
- **Repository absence of external approval is not proof of absence externally; it is "not found in inspected repo materials."**