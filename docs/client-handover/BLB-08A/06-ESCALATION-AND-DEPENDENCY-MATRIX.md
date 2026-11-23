# 06 — Escalation & Dependency Matrix

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Milestone:** BLB-08A — DRAFT — PREPARATION ONLY — NO CONTACT MADE  
**Date:** 2026-11-21

## 1. Escalation matrix (role placeholders; no org hierarchy invented)

| ID | Outstanding area | First responsible stakeholder | Next escalation role | Escalation trigger | Business impact | Technical impact | Permitted while waiting | Prohibited while waiting |
|---|---|---|---|---|---|---|---|---|
| E-W01 | W01 WhatsApp consent | Legal/Compliance + Business owner | `[Senior business sponsor / Legal lead placeholder]` | No response by `[PLACEHOLDER date]` or ambiguous response | P0 compliance/notification blocker | Consent remediation cannot close | Documentation/planning, legal review package prep | Any WhatsApp sends, consent implementation without approval/auth |
| E-D14 | D-14 infra evidence | Infrastructure/Hosting owner | `[Ops/IT manager placeholder]` | No evidence by `[PLACEHOLDER date]` | Release/deployment confidence blocked | Prod controls unverified | Evidence request refinement, runbook drafting | Infra access, prod changes, deployment |
| E-AUTH | 13 operation authorizations | Technical authority / Project owner | `[Senior delivery sponsor placeholder]` | No auth by `[PLACEHOLDER date]` or bundled/ambiguous auth | Remediation cannot start | All execution gates blocked | Planning/spec refinement | Any implementation/test/UAT/DB/provider/deploy/release |
| E-BIZ | 19/21 business decisions | Business owner / Project owner | `[Executive sponsor placeholder]` | No response by `[PLACEHOLDER date]` | UAT/acceptance/release blocked | Scoped work cannot be authorized | Decision package maintenance | Any execution based on assumed decisions |
| E-D11 | D-11 UAT index auth | DBA + Business owner | `[Data/IT owner placeholder]` | No explicit D-11 auth by `[PLACEHOLDER date]` | S07 UAT confidence blocked | Index precheck/rollout blocked | Precheck/rollback plan drafting only | Any DB write/index op on 27017/27019/Atlas/prod; D-11 without explicit auth |
| E-D19 | D-19 production release | Business owner / Client | `[Executive sponsor placeholder]` | Missing gates near target release | Release NO-GO | Production release blocked | Release readiness tracking | Any production release/deploy |

## 2. Dependency highlights

- W01 (P0) blocks consent remediation closure.
- AP-01-10/16 dependencies block D-16/D-17/D-18.
- D-11 requires separate explicit auth and UAT-only `127.0.0.1:27018/bluebell_whatsapp_uat` + `UAT_SAFE_MODE=true`.
- D-14 external evidence blocks production confidence.
- D-19 requires all gates and explicit release authorization.