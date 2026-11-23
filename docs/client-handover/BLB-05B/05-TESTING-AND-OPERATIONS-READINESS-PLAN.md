# 05 — Testing & Operations Readiness Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Control

Planning only. No tests executed, no UAT, no provider sandbox calls, no DB operations, no deployments/restarts. All execution requires separate explicit authorization.

## 2. Testing strategy (Workstream G)

### 2.1 Test layers

| Layer | Purpose | Environment | Auth required |
|---|---|---|---|
| Frontend unit/component | UI logic, form validation, state rendering | Local/CI | Implementation auth to add tests |
| Backend unit/integration | Controllers/services/models/middleware | Local/CI | Implementation auth |
| API integration | Route contracts, authz, negative cases | Local/CI/isolated test env | Implementation auth |
| Deterministic E2E | Critical customer/admin journeys with mocked providers where appropriate | CI/staging | Implementation auth |
| Isolated UAT | Business acceptance with synthetic data | `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` as applicable | Separate UAT execution auth + decisions |
| Provider sandbox verification | Razorpay/WhatsApp sandbox behavior | Provider sandbox | Separate sandbox/provider auth |
| Production verification | Smoke/monitoring post-deploy | Production | Separate production release/deploy auth |

### 2.2 Critical workflow test matrix (planning)

| Workflow | Preconditions | Positive cases | Negative/failure cases | Expected outcome | Evidence | Cleanup/rollback |
|---|---|---|---|---|---|---|
| Customer registration/login/OTP | Approved AP-05 path; synthetic identity; S02 intact | Register/login/reset/change password per approved flow | Invalid OTP, expired OTP, rate limit, wrong role, CSRF/origin failures | Secure auth; no OTP disclosure/bypass | Test logs, screenshots, audit records | Revoke test sessions/data cleanup |
| Guest checkout | AP-01 decided; AP-06/AP-07/AP-10 decided | Browse/cart/checkout/track as scoped | Invalid address/pincode/schedule, payment failure, duplicate submit | Order created correctly; idempotent | E2E report, DB/order evidence (UAT only) | Cancel/cleanup synthetic orders |
| Authenticated checkout | Customer auth + catalog/product availability | COD/pay-at-store/online per policy | Unauthorized access, stale cart, inventory conflict | Correct status transitions | API/E2E evidence | Cleanup synthetic data |
| Payment lifecycle | AP-07, sandbox authorized | Create-order, verify, webhook captured/failed, retry | Invalid signature, duplicate webhook, amount mismatch, cancelled order | Idempotent reconciliation; no client-trusted amount | Sandbox logs, test report | No live txns; sandbox cleanup |
| Custom cake request | AP-08 scope decided | Submit, admin propose, customer respond, convert per scope | Invalid dates/files, unauthorized access, duplicate conversion | Correct state/audit; no unauthorized WhatsApp | E2E/API evidence | Cleanup synthetic records |
| WhatsApp consent/notification | R-001 implemented; AP-10; sandbox authorized | Consent grant, eligible enqueue, status updates, STOP | No consent, withdrawn, provider failure, duplicate event | No send without eligibility; suppressed not sent/delivered | Audit logs, outbox/webhook evidence | Suppress/cleanup sandbox contacts |
| Admin order/product/customer management | AP-09, D-18 authorized | CRUD/status transitions per role | Unauthorized customer access, invalid transition, CSRF missing | RBAC enforced; audit trail | UAT evidence | Rollback/cleanup per matrix |
| Accessibility/responsive smoke | D-15 scope decided | Keyboard nav, focus, labels, mobile/desktop layouts | Contrast/focus/overflow failures | Critical flows usable | Screenshots/a11y report | N/A |

### 2.3 QA gaps to close (from BLB-05A Q01-Q06)

| Gap | Plan | Priority |
|---|---|---|
| CI Playwright narrow | Add deterministic checkout/admin/payment/consent suites; include backend webServer or stable mocks | P1 |
| No frontend unit/component tests | Add Vitest/RTL/component tests for critical forms/state | P1 |
| Config fragmentation | Consolidate/document canonical configs; CI uses release-candidate suite | P2 |
| No coverage thresholds | Add coverage reporting; set thresholds for critical modules after baseline | P2 |
| Historical vs release evidence | Release-candidate evidence package with scope/date/commit/env | P1 |
| Generated artifacts | Exclude from delivery; publish CI artifacts | P2 |

## 3. Operations readiness (Workstream H)

| Area | Required artifact | Owner | Dependencies | Acceptance criteria | Auth |
|---|---|---|---|---|---|
| Frontend deployment | Vercel/project runbook, env matrix, domain/TLS checklist | DevOps | R-011, D-14 | Reproducible deploy steps and rollback | Ops auth |
| Backend deployment | Render/service runbook, health checks, startup preflight | DevOps | R-011, R-003 | Health/rollback verified in non-prod | Ops auth |
| Env/secret transfer | Names-only matrix, owners, rotation, storage location, handover checklist | Security/DevOps/Client | R-009 | No secrets in docs; owners assigned | Client/ops auth |
| TLS/domain | Cert/DNS/redirect/HSTS expectations | DevOps/Client IT | D-14 | Verified config evidence | External infra |
| Monitoring/alerting | Uptime, error rate, logs, payment/webhook/WhatsApp failures | DevOps | R-003 | Alerts tested and owned | Ops auth |
| Structured logging | Request IDs, redaction, retention, access | Backend/Security | R-009 | PII/secret redaction verified | Implementation auth |
| Backups/restore | Mongo backup schedule, restore drill, RPO/RTO targets | DBA/DevOps | R-012 | Restore drill evidence | Ops/infra auth |
| Rollback | App/DB/config rollback steps, decision triggers | Release Manager | R-003/R-004 | Tabletop or drill evidence | Ops auth |
| Incident response | Severity model, contacts, escalation, comms templates | Ops/Client | Client input | On-call/escalation ownership documented | Client input |
| Operational ownership | RACI for app, DB, secrets, providers, domains | Delivery/Client | R-002 | Signed responsibility matrix | Client decision |

## 4. Environment separation

| Environment | Purpose | Data | External side effects | Gate |
|---|---|---|---|---|
| Local dev | Development/debug | Synthetic/dev only | Blocked by default where possible | Dev controls |
| CI | Automated tests | Ephemeral/synthetic | Mocked/sandbox only | CI config |
| Isolated UAT | Authorized acceptance | Synthetic approved only | Suppressed/blocked unless separately authorized | D-16/D-17/D-18 + `UAT_SAFE_MODE=true` |
| Staging/sandbox | Pre-prod/provider verification | Synthetic | Provider sandbox only with auth | Separate auth |
| Production | Live service | Real data (authorized) | Live providers with authorization | D-19 + release auth |

## 5. Exit criteria for testing/ops readiness planning

- Test matrix covers all BLB-05A critical workflows.
- Every critical workflow has positive/negative/failure cases and evidence requirements.
- Ops artifacts have owners, dependencies, and authorization gates.
- No test/ops execution implied by this document.