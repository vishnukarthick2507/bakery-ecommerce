# 07 — Remediation Acceptance Criteria

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## Status legend
VERIFIED STATIC EVIDENCE | VERIFIED DOCUMENTARY EVIDENCE | NOT VERIFIED | EXTERNAL EVIDENCE REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | EXECUTION AUTHORIZATION REQUIRED | PROPOSED — NOT APPROVED

## 1. P0 acceptance criteria — WhatsApp consent (BLB05A-W01 / R-001)

| ID | Criterion | Verification method | Evidence required | Gate |
|---|---|---|---|---|
| AC-W01-1 | No automated WhatsApp notification is authorized by phone number existence alone | Code review + negative integration tests | Test report, code refs | Implementation auth |
| AC-W01-2 | Explicit consent capture exists at approved touchpoints with approved wording/version | UI review + E2E | Screenshots, consent text version ref | Legal/business decision + impl auth |
| AC-W01-3 | Consent state transitions (UNKNOWN/GRANTED/DENIED/WITHDRAWN/SUPPRESSED as adopted) are auditable | DB/audit log inspection in authorized env | Audit records | Impl + env auth |
| AC-W01-4 | Suppressed/withdrawn/denied/unknown contacts receive no ineligible automated sends | Integration/sandbox tests | Outbox/provider logs | Sandbox auth |
| AC-W01-5 | Suppressed notifications are never displayed as sent/delivered | UI/API tests | Screenshots/test report | Impl auth |
| AC-W01-6 | Order status and notification status remain distinct | UI/API contract tests | Contract tests | Impl auth |
| AC-W01-7 | Consent persistence failure fails closed for eligibility and does not create false sent state | Failure-injection tests | Test report | Impl auth |
| AC-W01-8 | Existing security controls preserved (S02, authz, CSRF, redaction) | Security regression tests | Test report | Impl/test auth |

## 2. P1 acceptance criteria — security/DB/payment/ops

| ID | Criterion | Verification | Evidence | Gate |
|---|---|---|---|---|
| AC-S01 | Production startup fails fast on missing/weak critical secrets | Config/startup test | Test/log evidence | Impl auth |
| AC-S02 | CORS/origin/CSRF policy matrix documented and tested per endpoint class | Code review + integration tests | Matrix + tests | Impl auth |
| AC-S03 | Sensitive logging redaction standardized; no raw console sensitive leaks in scoped paths | Lint/code review/log scan | CI/lint report | Impl auth |
| AC-DB01 | S07 idempotency indexes verified in UAT only after D-11 auth | Precheck + post-verify | Precheck/verify/rollback report | D-11 separate auth |
| AC-DB02 | Schema/ERD/data dictionary complete with runtime caveats | Doc review | Approved docs | Doc auth |
| AC-PAY01 | Razorpay sandbox create/verify/webhook/idempotency/reconciliation pass | Sandbox test report | Redacted logs/report | Sandbox auth |
| AC-PAY02 | Amount remains DB-sourced; invalid signatures/duplicates handled idempotently | Tests | Test report | Impl/sandbox auth |
| AC-OPS01 | Backup/restore drill evidence exists | Drill report | RPO/RTO evidence | Ops/infra auth |
| AC-OPS02 | Deployment rollback/monitoring/alert ownership documented and verified | Runbook/drill | Evidence | Ops auth |

## 3. P1 acceptance criteria — testing/docs/release

| ID | Criterion | Verification | Evidence | Gate |
|---|---|---|---|---|
| AC-Q01 | CI covers critical checkout/payment/consent/admin flows | CI runs | CI reports | Impl auth |
| AC-Q02 | Frontend unit/component tests exist for critical flows | CI runs | Coverage/test report | Impl auth |
| AC-DOC01 | 25-item handover checklist complete or explicitly client-accepted exception | Doc review | Checklist sign-off | Client input |
| AC-REL01 | Release candidate clean, classified, reproducible build | Git/release audit | Manifest/build logs | Git/release auth |
| AC-UAT01 | Authorized CUST/ADM UAT evidence complete for scoped release | UAT reports | Signed evidence | D-16/D-17/D-18 auth |

## 4. Release acceptance gate (all required before D-19 consideration)

- All P0 criteria PASS or formally risk-accepted by authorized owner with written evidence.
- No unresolved CRITICAL/HIGH security/compliance blocker.
- D-11/D-12/D-14/D-17/D-18/D-19 dependencies resolved per authorization matrix.
- Client acceptance checklist signed; no fabricated approval.