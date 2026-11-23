# 08 — Remediation Milestone Roadmap

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Control

Planning only. No dates promised. Sequencing is dependency-driven and subject to owner/client decisions, execution authorizations, evidence outcomes, and resource availability. Project remains **NOT READY — CRITICAL BLOCKERS**.

## 2. Milestone sequence

| Milestone | Objective | Entry criteria | Key work | Exit criteria | Dependencies | Authorization |
|---|---|---|---|---|---|---|
| **BLB-05B (current)** | Remediation planning & delivery closure strategy | BLB-05A complete | Produce 10 planning docs; validate consistency | 10 docs exist; findings mapped; 19 decision areas preserved; no execution auth created | BLB-05A | None (docs only) |
| **BLB-05C — P0/P1 Critical Remediation** | Fix consent journey, critical security/contract gaps | BLB-05B approved; R-001/R-016/R-002 inputs; implementation auth | WhatsApp consent UX/persistence/enforcement; security hardening; logging/CSRF matrix; UI status clarity | P0 code changes merged, tests pass, security review complete | R-001,R-002,R-009,R-010,R-016 | Separate implementation + legal/policy approvals |
| **BLB-05D — Release Boundary & Quality Remediation** | Establish clean candidate and quality baseline | BLB-05C or parallel where safe; cleanup auth | Classify 107+ entries; lockfile/LICENSE/SBOM; CI/E2E/unit test expansion; refactor high-risk maintainability items | Clean reviewed release candidate; CI green; lockfile/legal baseline | R-004,R-007,R-013,R-014 | Separate git cleanup/repo/legal/implementation auth |
| **BLB-05E — DB/Security/Payment/Infra Readiness** | Close DB/infra/payment verification gaps | Decisions/infra access; D-11 auth for index work | Schema docs, backup/restore drills, D-14 evidence, payment sandbox verification, env/secret matrix | DB/infra/payment evidence packs complete; D-11 precheck/rollout done only if authorized | R-003,R-005,R-006,R-011,R-012,R-015 | Separate D-11/ops/infra/sandbox auth |
| **BLB-05F — Isolated UAT & Regression** | Execute authorized UAT and regression | D-16/D-17/D-18 auth; synthetic data approved; UAT safe mode | CUST/ADM UAT, a11y smoke, regression, provider sandbox scenarios | UAT evidence complete with no critical unresolved defects | R-002,R-005,R-006,R-007,D-15-D-18 | Separate UAT/synthetic data/provider auth |
| **BLB-05G — Documentation & Acceptance Pack** | Complete client-facing handover documentation | Prior milestones evidence available | 25-item checklist completion, manuals, runbooks, acceptance checklist, known limitations | All required docs COMPLETE/approved; acceptance package ready | R-008, all workstreams | Client input/review/sign-off |
| **BLB-05H — Final Readiness & Controlled Handover** | Final go/no-go and handover | All gates green; D-19 auth | Final readiness review, client acceptance, deployment/release if authorized | Signed acceptance, release manifest, operational handover complete | D-19, all blockers closed | Separate production release/deploy/acceptance auth |

## 3. Alternative sequencing notes

- BLB-05D repo classification can start in parallel with BLB-05C planning, but no destructive cleanup before owner review.
- BLB-05E infra evidence (D-14) can be requested immediately; it is external dependency-bound.
- BLB-05G documentation drafting can proceed now for verified facts; runtime sections wait for evidence.
- D-11 S07 UAT index work may occur in BLB-05E/05F only with separate explicit authorization and UAT-safe constraints.

## 4. Critical path

```text
BLB-05B (plan)
  -> Decision/legal closure (R-002/R-016, no execution)
  -> BLB-05C P0/P1 remediation (authorized impl)
  -> BLB-05D release boundary + test baseline (authorized cleanup/impl)
  -> BLB-05E DB/infra/payment evidence (authorized ops/sandbox/D-11)
  -> BLB-05F isolated UAT/regression (authorized UAT)
  -> BLB-05G docs/acceptance pack
  -> BLB-05H final acceptance/release (separate D-19/release auth)
```

## 5. Milestone readiness scorecard (target)

| Dimension | BLB-05A | Target before BLB-05H |
|---|---:|---|
| Architecture | 62 | >=80, documented |
| Frontend quality | 58 | >=80, consent/UI/E2E covered |
| Backend quality | 64 | >=80, critical refactors/tests done |
| Database design | 60 | >=80, schema docs + authorized index verification |
| Security | 61 | >=85, no critical/high unmitigated |
| Payment workflow | 63 | >=85, sandbox/runtime evidence |
| WhatsApp automation | 45 | >=85, consent + provider evidence |
| Testing | 54 | >=80, CI/UAT evidence |
| Deployment readiness | 40 | >=85, runbooks/drills/ownership |
| Documentation | 38 | >=90, 25-item checklist complete |
| Repository cleanliness | 35 | >=85, clean release candidate |
| Client handover readiness | 32 | >=90, signed acceptance |

Scores are targets only; they do not override blockers or missing evidence.

## 6. Exit rule

No milestone may be marked complete without evidence. BLB-05B completion means planning artifacts exist - **not** remediation complete.