# 01 — Stakeholder Follow-up Register

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-08A — Stakeholder Follow-up & Decision Collection Coordination  
**Date:** 2026-11-21  
**Status:** DRAFT — PREPARATION ONLY — NO CONTACT MADE

## Register (19 decision areas / 21 worksheet rows)

| Row | Decision ID | Outstanding decision | Responsible stakeholder role | Required response | Business/technical impact | Priority | Dependency | Current status | Follow-up status | Last contact date | Next follow-up date | Evidence reference |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BLB-03M/AP-01 | Guest checkout Continue option A/B | Business owner / Project owner | Selected option, rationale, conditions | Defines CUST-10/UAT scope | P1 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 1 |
| 2 | AP-02 | Synthetic customer/admin access policy | Business owner / Security/QA | Approved policy | UAT identity control | P1 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 2 |
| 3 | AP-03 | Isolated UAT DB write policy (27018 only) | Business owner / DBA | Approved policy; UAT target/SAFE_MODE constraints | Safe DB boundary | P1 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 3 |
| 4 | AP-04 | Synthetic data provisioning/cleanup | Business owner / QA/DBA | Approved policy | UAT data lifecycle | P1 | AP-03 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 4 |
| 5 | AP-05/CUST-11 | Registration/OTP safe testing path | Business owner / Security | Safe path or deferral; S02 intact | CUST-11 evidence | P1 | AP-02/03/04/10 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 5 |
| 6 | AP-06/CUST-10 | Guest checkout UAT scope | Business owner | Scope decision after deps | CUST-10 blocked | P1 | AP-01-05,07,10 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 6 |
| 7 | AP-07 | Payment testing restrictions | Business owner / Finance/Ops | Sandbox-only restrictions | Safe payment verification | P1 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 7 |
| 8 | AP-08/CUST-14 | Custom cake/media scope | Business owner / Legal/Ops | No-media/defer/scope decision | Media/compliance risk | P1 | AP-03/04/10 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 8 |
| 9 | AP-09 | Admin ADM-01-13 scope | Business owner | Scope decision | Admin UAT coverage | P1 | AP-02/03/04/10 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 9 |
| 10 | AP-10 | Notification/WhatsApp suppression expectations | Business owner / Legal/Ops | Policy decision | Evidence interpretation | P1 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 10 |
| 11 | AP-16 | Synthetic data/credentials handling | Business owner / Security | Handling procedure | Secure UAT operations | P1 | AP-02/04 | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 11 |
| 12 | D-13 | Origin/Referer compatibility | Business owner / Tech lead | Defer/investigate/enforce decision | Avoid breakage/security hardening | P2 | D-14 helpful | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 12 |
| 13 | D-S05 | S05 provenance design doc disposition | Business owner / Tech lead | Disposition decision | Audit trail completeness | P2 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 13 |
| 14 | D-14 | Infrastructure topology/evidence | Infrastructure/Hosting owner | D-14 evidence package | Real-world control verification | P1 | External access | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 14 |
| 15 | D-15 | A11y/browser smoke scope | Business owner / QA | Scope decision | Release confidence | P2 | — | NOT RECEIVED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 15 |
| 16 | D-16 | Synthetic UAT data/credentials execution auth | Business owner / Security | Separate execution auth | D-17/D-18 blocked | P2 | AP-02/03/04/16 | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 16 |
| 17 | D-17 | Customer UAT execution auth | Business owner / QA | Separate UAT auth | Client acceptance evidence | P2 | D-16, deps | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 17 |
| 18 | D-18 | Admin UAT execution auth | Business owner / QA | Separate UAT auth | Admin acceptance evidence | P2 | D-16, deps | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 18 |
| 19 | D-11 | S07 UAT index precheck/rollout auth | Business owner / DBA | Separate explicit D-11 auth | S07 UAT confidence | P1 | AP-03, prechecks | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 19 |
| 20 | D-12 | Prod S07 index rollout auth | Business owner / DBA | Separate prod DB auth | Prod DB safety | P2 | D-11 evidence | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 20 |
| 21 | D-19 | Production release Go/No-Go | Business owner / Client | Separate explicit release auth | Production release | P2 | All gates | NOT AUTHORIZED | Not sent | `[PLACEHOLDER]` | `[PLACEHOLDER]` | BLB-06A/02 row 21 |

## P0 cross-cutting (tracked in W01 follow-up)

| ID | Outstanding decision | Owner role | Priority | Status | Follow-up status |
|---|---|---|---|---|---|
| BLB05A-W01 | WhatsApp consent wording/policy/legal approval | Legal/Compliance + Business owner | P0 | NOT RECEIVED | Not sent |