# 03 — Testing & Operations Verification Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION / NO TEST EXECUTION  
**Date:** 2026-11-21

## Status legend
VERIFIED STATIC EVIDENCE | VERIFIED DOCUMENTARY EVIDENCE | NOT VERIFIED | EXTERNAL EVIDENCE REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | EXECUTION AUTHORIZATION REQUIRED | PROPOSED — NOT APPROVED

## 1. Test inventory and gaps (VERIFIED STATIC/DOCUMENTARY EVIDENCE)

| Area | Current evidence | Gap |
|---|---|---|
| Backend unit/integration | `backend/tests/*.test.ts` (46 files observed); Vitest; Step 7A historical pass 45/639 | Runtime release-candidate evidence not current; coverage thresholds missing |
| Frontend E2E | Playwright configs; CI runs only custom-cake form nav | Checkout/payment/admin/consent flows missing in CI |
| Frontend unit/component | None found in root scripts | Major gap |
| UAT CUST/ADM | BLB-03 UAT docs exist; many blocked | No authorized execution evidence |
| Provider sandbox | Not evidenced | Razorpay/WhatsApp sandbox verification missing |
| A11y/perf/security ops | Not evidenced | No smoke/load/pen-test/ops drill evidence |

## 2. Verification matrix (PROPOSED — NOT APPROVED, EXECUTION AUTHORIZATION REQUIRED)

| ID | Objective | Preconditions | Test environment | Steps (high level) | Expected result | Evidence to retain | Auth required |
|---|---|---|---|---|---|---|---|
| T-FE-01 | Frontend unit/component coverage for checkout/custom-cake/auth | Test harness added | Local/CI | Add RTL/Vitest tests for forms, validation, consent UI, status rendering | Critical UI logic covered | Test report, coverage | Implementation + CI auth |
| T-FE-02 | Checkout E2E deterministic | Mocked backend/provider | CI | Cart->checkout->COD/pay-at-store/online-mocked flows | Pass/fail reproducible | Playwright report, traces | Implementation auth |
| T-BE-01 | Backend regression suite | Clean install, env | Local/CI | Run vitest suite | All pass or failures triaged | CI logs, JUnit/coverage | Test execution auth |
| T-BE-02 | Auth/CSRF/rate-limit integration | Test env | CI | Positive/negative authz, CSRF missing/origin bad, rate limit | Controls enforced | Test logs | Implementation/test auth |
| T-CUST-01 | Customer UAT scoped | D-17 auth, AP decisions, synthetic data, UAT safe mode | Isolated UAT `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` | Execute approved CUST cases | Expected outcomes per case | UAT sheet, screenshots/log refs (no PII/OTP) | D-16/D-17 + all deps |
| T-ADM-01 | Admin UAT scoped | D-18 auth, AP-09/02/03/04/10/16 | Isolated UAT, safe mode | Execute approved ADM cases | Expected outcomes | UAT sheet/evidence | D-18 + deps |
| T-WA-01 | WhatsApp consent lifecycle | R-001 implemented, AP-10, legal wording approved | Sandbox/dev isolated | Grant/withdraw/STOP/unknown/no-consent; check outbox/admin | No unauthorized send; suppressed not sent/delivered | Audit logs, outbox records | Implementation + sandbox/provider auth |
| T-WA-02 | WhatsApp provider sandbox | Provider sandbox access | Sandbox | Template send/status/failure/webhook idempotency | Correct status mapping | Provider logs (redacted), app logs | Separate provider auth |
| T-PAY-01 | Razorpay sandbox lifecycle | AP-07, sandbox keys, auth | Sandbox | Create/verify/webhook captured/failed/duplicate/retry | Idempotent, DB-truthful states | Test report, webhook logs | Separate sandbox auth; no live txns |
| T-A11Y-01 | Accessibility smoke | D-15 scope | Browser test env | Keyboard/focus/labels/errors/responsive | Critical flows usable | A11y report/screenshots | D-15 + execution auth |
| T-PERF-01 | Performance baseline | Scope defined | Staging/isolated | Load key endpoints/pages | Within agreed thresholds | Metrics report | Separate auth; no prod impact |
| T-SEC-01 | Security verification | Approved scope | Isolated/staging | Authz, IDOR, CSRF, rate limit, log redaction, secrets scan | No critical/high unresolved | Security report | Separate security test auth |
| T-OPS-01 | Backup/restore drill | R-003, infra access | Non-prod/approved env | Backup, restore, integrity checks | RPO/RTO/restore success | Drill report | Ops/infra auth |
| T-OPS-02 | Deployment rollback drill | Runbook drafted | Staging/approved | Deploy canary/rollback trigger | Rollback restores service | Drill report | Ops auth |
| T-OPS-03 | Monitoring/alerting | Monitoring configured | Staging/prod-approved | Trigger synthetic alerts | Alerts received/owned | Alert evidence | Ops auth |

## 3. Environment constraints

- Isolated UAT DB target only: `127.0.0.1:27018/bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true` for any future authorized UAT DB operation.
- No 27017/27019/Atlas/prod DB access.
- No real customer data, no real OTP/email/WhatsApp/Razorpay/Cloudinary/provider operations.
- No live payment txns/webhooks/captures.

## 4. Evidence package standard (PROPOSED — NOT APPROVED)

Each executed test (if later authorized) must retain: test ID, date/time, commit/HEAD, env, executor, preconditions, steps, actual result, pass/fail, defects, evidence refs, cleanup confirmation. No secrets/PII/OTP in evidence.