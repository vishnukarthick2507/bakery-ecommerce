# 06 — Client/Owner Decision Request Package

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-06A — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO AUTHORIZATION  
**Date:** 2026-11-21

## Control

This is a request package only. **No communications sent.** No approvals inferred. Decision confirmation != execution authorization.

## A. Priority request — W01 WhatsApp consent (P0)

| Field | Content |
|---|---|
| Outstanding decision | Approve WhatsApp consent wording, capture timing, withdrawal policy, notification scope, transactional/marketing distinction, unknown/opted-in/opted-out handling, retention, legal/compliance approver, workflow acceptance |
| Why needed | BLB05A-W01 CRITICAL; no automated notification may be authorized by phone number alone; suppressed must not show sent/delivered; consent must be auditable |
| Options (PROPOSED — NOT APPROVED) | A) Transactional-only explicit opt-in, fail-closed for unknown/withdrawn; B) Transactional-only + account preference center; C) Defer automation (manual wa.me only) until approved |
| Impact | A/B unblock implementation planning after separate auth; C reduces compliance risk but limits automation; no decision blocks all remediation |
| Consequence of no decision | W01 remains open; WhatsApp automation remediation cannot close; handover not ready |
| Required approver role | Client/Business Owner + Legal/Compliance |
| Required response format | Approver name, role, date, selected option, approved wording/version, withdrawal/retention policy, conditions, written evidence ref |
| Conditions to explicitly accept | Decision != implementation/sandbox/provider/UAT/production authorization; separate authorizations required |

## B. Decision closure request — 19 areas / 21 rows

| Decision ID | Outstanding decision | Why needed | Required approver | Required response format |
|---|---|---|---|---|
| BLB-03M/AP-01 | Guest checkout Continue option A/B | CUST-10/UAT scope | Owner/Client | Option, approver, date, scope, conditions, evidence |
| AP-02 | Synthetic customer/admin access policy | UAT identity control | Owner/Client | Policy, approver, date, evidence |
| AP-03 | UAT DB write policy (27018 only) | Safe UAT boundary | Owner/Client/DBA | Policy, target 127.0.0.1:27018/bluebell_whatsapp_uat, UAT_SAFE_MODE=true condition |
| AP-04 | Synthetic data provisioning/cleanup | UAT data lifecycle | Owner/Client | Policy, scope, approver |
| AP-05/CUST-11 | OTP/registration safe testing path | CUST-11 without S02 weakening | Owner/Client | Path selection, constraints, approver |
| AP-06/CUST-10 | Guest checkout UAT scope | Blocked by dependencies | Owner/Client | Scope after deps resolved |
| AP-07 | Payment testing restrictions | Safe payment verification | Owner/Client/Finance | Sandbox-only restrictions, approver |
| AP-08/CUST-14 | Custom cake/media scope | Media/compliance risk | Owner/Client | No-media/defer/scope, approver |
| AP-09 | Admin ADM-01-13 scope | Admin UAT coverage | Owner/Client | Scope, approver |
| AP-10 | Notification/WhatsApp suppression expectations | Evidence interpretation | Owner/Client | Policy, approver |
| AP-16 | Credential/data handling | Secure UAT operations | Owner/Client/Security | Handling procedure, approver |
| D-13 | Origin/Referer defer/investigate/enforce | Avoid breakage/security | Owner/Tech | Decision, origin inventory, approver |
| D-S05 | S05 provenance doc disposition | Audit trail | Owner/Tech | Option, approver |
| D-14 | Infra topology/WAF/TLS/proxy/rate-limit evidence | Real-world control verification | Infra/Hosting owner | Evidence package, diagrams/config refs, owner/date |
| D-15 | A11y/browser smoke scope | Release confidence | Owner/Client | Scope, approver |
| D-16 | Synthetic UAT data/credentials execution auth | Enable UAT | Owner/Client | Separate execution auth record |
| D-17 | Customer UAT execution auth | Acceptance evidence | Owner/Client | Separate UAT auth record |
| D-18 | Admin UAT execution auth | Acceptance evidence | Owner/Client | Separate UAT auth record |
| D-11 | S07 UAT index precheck/rollout auth | S07 UAT confidence | Owner/Client/DBA | Separate explicit D-11 auth; 127.0.0.1:27018/bluebell_whatsapp_uat; UAT_SAFE_MODE=true; prechecks/backup/rollback |
| D-12 | Prod S07 index rollout auth | Deferred prod change | Owner/Client/DBA | Separate prod DB auth after D-11 evidence |
| D-19 | Production release Go/No-Go | Release/handover | Owner/Client | Separate explicit release auth after all gates |

## C. Required response package minimum

For every decision: approver name, role/authority, date, selected option/scope, conditions/limitations, evidence reference, and explicit statement whether execution authorization is granted (default: not granted unless separately stated).