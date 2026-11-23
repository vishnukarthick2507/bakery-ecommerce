# 05 — Implementation Work Packages & Dependencies

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## Status legend
VERIFIED STATIC EVIDENCE | VERIFIED DOCUMENTARY EVIDENCE | NOT VERIFIED | EXTERNAL EVIDENCE REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | EXECUTION AUTHORIZATION REQUIRED | PROPOSED — NOT APPROVED

## 1. Work package overview

| WP | Priority | Objective | Dependencies | Primary owner | Exit evidence | Authorization |
|---|---|---|---|---|---|---|
| WP-C1 | P0 | WhatsApp consent capture/journey/remediation (BLB05A-W01) | R-016 legal wording, AP-10, R-001 spec | Frontend+Backend+Legal+QA | Code+tests+audit trail+doc | Implementation + legal + sandbox auth |
| WP-C2 | P1 | Release boundary classification and clean candidate | R-004, R-013 | Release Manager+Tech Lead | Classification sheet, clean build, manifest | Git/cleanup/release auth |
| WP-C3 | P1 | Security hardening and verification pack | R-009, D-13/D-14 | Security+Backend+DevOps | Tests, config matrix, docs | Implementation+infra auth |
| WP-C4 | P1 | S07 DB index readiness (UAT-gated) | D-11, AP-03, R-005 | DBA+Backend | Precheck/verify/rollback evidence | **Separate D-11 auth only** |
| WP-C5 | P1 | Payment/WhatsApp sandbox verification | WP-C1, AP-07/AP-10 | QA+Backend+Ops | Sandbox reports | Separate provider/sandbox auth |
| WP-C6 | P1 | Testing/CI expansion | WP-C1/C2 baseline | QA+Frontend+Backend | CI green, coverage, E2E | Implementation+CI auth |
| WP-C7 | P1 | Docs/ops/handover completion | WP-C3-C6 outputs | Delivery+Tech Writer+Ops | 25-item checklist complete | Client input + doc approval |
| WP-C8 | P2 | Maintainability/legal cleanup | WP-C2 | Tech Lead+Legal | Lockfile/LICENSE/SBOM/refactor PRs | Repo/legal/impl auth |

## 2. Dependency map

```text
BLB-04D decisions/legal evidence (NOT RECEIVED)
  -> WP-C1 consent/legal/policy package
  -> WP-C2 release boundary classification
      -> WP-C6 CI/test baseline
      -> WP-C8 maintainability/legal cleanup
  -> WP-C3 security/infra evidence
  -> WP-C4 D-11 UAT-only index precheck/rollout (separate explicit auth)
  -> WP-C5 sandbox verification (after WP-C1/C3 as needed)
  -> WP-C7 docs/handover completion
  -> D-17/D-18 UAT (separate auth) -> D-19 release (separate auth)
```

## 3. Detailed WP-C1 (P0) sub-tasks (PROPOSED — NOT APPROVED)

| Sub-task | Description | Depends on | Evidence |
|---|---|---|---|
| C1.1 | Legal/compliance-approved consent wording and policy | Client/legal decision | Signed/approved policy ref |
| C1.2 | Frontend consent UI in checkout/custom-cake | C1.1 | UI screenshots, E2E |
| C1.3 | Backend consent contract/version/audit fields | C1.1 | Migration/code review/tests |
| C1.4 | Outbox eligibility fail-closed enforcement | C1.3 | Unit/integration tests |
| C1.5 | Admin status clarity/suppression visibility | C1.4 | UI/API tests |
| C1.6 | Sandbox/provider verification | C1.1-C1.5, sandbox auth | Test report |
| C1.7 | Docs/runbook update | C1.6 | Reviewed docs |

## 4. Critical external dependencies

| Dependency | Type | Current status | Owner |
|---|---|---|---|
| 19 decision areas / 21 rows | BUSINESS/CLIENT DECISION REQUIRED | 0 confirmed (BLB-04D) | Owner/Client |
| Consent legal wording | BUSINESS/CLIENT/LEGAL DECISION REQUIRED | NOT RECEIVED | Client/Legal |
| D-14 infra/topology evidence | EXTERNAL EVIDENCE REQUIRED | BLOCKED | Infra/hosting owner |
| Razorpay sandbox access/config | EXTERNAL EVIDENCE REQUIRED | NOT VERIFIED | Client/Ops |
| WhatsApp provider sandbox/templates | EXTERNAL EVIDENCE REQUIRED | NOT VERIFIED | Client/Ops/Meta |
| D-11 UAT DB execution auth | EXECUTION AUTHORIZATION REQUIRED | NOT AUTHORIZED | Owner/DBA |

## 5. Sequencing constraints

- No implementation without separate implementation authorization.
- No D-11 DB operation without separate explicit D-11 auth and UAT-only target `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`.
- No provider sandbox/live testing without separate provider auth.
- No UAT without D-16/D-17/D-18 and dependency closures.
- No production release without D-19 explicit auth and all gates.