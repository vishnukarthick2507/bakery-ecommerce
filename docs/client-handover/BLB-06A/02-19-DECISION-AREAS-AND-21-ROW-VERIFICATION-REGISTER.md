# 02 — 19 Decision Areas & 21 Worksheet Rows Verification Register

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-06A — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO AUTHORIZATION  
**Date:** 2026-11-21

## Rules

- No decision marked confirmed without genuine written evidence.
- Decision confirmation != execution authorization. UAT approval != production approval.
- Historical S06 approval remains limited to original scope; not extended.
- 19 decision areas and 21 worksheet rows preserved.

## Register

| Row | Decision ID | Original requirement | Latest evidence found | Evidence source/path | Approver identity/role | Decision date | Selected option | Conditions/limitations | Verification result | Current status | Remaining action | Separate execution authorization required? |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BLB-03M/AP-01 | Guest checkout Continue option A/B | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Owner/client written decision | Yes |
| 2 | AP-02 | Synthetic customer/admin access policy | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Policy decision | Yes |
| 3 | AP-03 | Isolated UAT DB write policy (27018 only) | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Policy decision; D-11 separate auth | Yes |
| 4 | AP-04 | Synthetic data provisioning/cleanup | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Policy + execution auth | Yes |
| 5 | AP-05/CUST-11 | Registration/OTP safe testing path | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Decision; S02 must remain intact | Yes |
| 6 | AP-06/CUST-10 | Guest checkout UAT scope | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Resolve dependencies + decision | Yes |
| 7 | AP-07 | Payment testing restrictions | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Sandbox-only policy decision | Yes |
| 8 | AP-08/CUST-14 | Custom cake/media scope | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Scope decision; media isolation evidence | Yes |
| 9 | AP-09 | Admin ADM-01-13 scope | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Scope decision | Yes |
| 10 | AP-10 | Notification/WhatsApp suppression expectations | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Policy decision | Yes |
| 11 | AP-16 | Synthetic data/credentials handling | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Handling policy + auth | Yes |
| 12 | D-13 | Origin/Referer compatibility | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Defer/investigate/enforce decision; origin inventory | Yes |
| 13 | D-S05 | S05 provenance design doc disposition | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Decision | Yes (if doc/change action needed) |
| 14 | D-14 | WAF/CDN/proxy/topology evidence | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Infra owner evidence (EXTERNAL) | Yes |
| 15 | D-15 | A11y/browser smoke scope | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT RECEIVED | Scope decision | Yes |
| 16 | D-16 | Synthetic UAT data/credentials execution | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Separate execution auth | Yes |
| 17 | D-17 | Customer UAT execution | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Separate UAT auth after deps | Yes |
| 18 | D-18 | Admin UAT execution | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Separate UAT auth after deps | Yes |
| 19 | D-11 | S07 UAT index precheck/rollout | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Separate explicit D-11 auth; 127.0.0.1:27018/bluebell_whatsapp_uat; UAT_SAFE_MODE=true | Yes |
| 20 | D-12 | S07 production index rollout | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Deferred; separate prod auth after D-11 evidence | Yes |
| 21 | D-19 | Production release Go/No-Go | None new | BLB-04D baseline | — | — | — | — | No new evidence | NOT AUTHORIZED | Explicit release auth after all gates | Yes |

## Summary

| Status | Count |
|---|---:|
| NOT RECEIVED | 15 |
| RECEIVED — NOT VERIFIED | 0 |
| VERIFIED — DECISION CONFIRMED | 0 |
| VERIFIED — CONDITIONAL DECISION | 0 |
| VERIFIED — REJECTED | 0 |
| VERIFIED — DEFERRED | 0 |
| AMBIGUOUS — CLARIFICATION REQUIRED | 0 |
| CONFLICTING EVIDENCE | 0 |
| NOT AUTHORIZED | 6 |
| **Total rows** | **21** |