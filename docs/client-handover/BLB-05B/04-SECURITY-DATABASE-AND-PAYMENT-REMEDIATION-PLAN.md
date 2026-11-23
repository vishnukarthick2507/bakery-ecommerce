# 04 — Security, Database & Payment Remediation Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Control

Planning only. No code/config changes, no DB writes/queries/migrations/index operations, no live Razorpay txns/webhooks/captures, no provider calls, no service restarts/deployments. No security control may be weakened to simplify testing. S02/OTP safeguards must remain intact.

## 2. Security remediation (Workstream E)

| Finding | Validation | Severity | Priority | Remediation | Owner | Dependencies | Acceptance criteria | Verification | Authorization |
|---|---|---|---|---|---|---|---|---|---|
| BLB05A-S01 JWT fail-fast/prod config | PARTIALLY VERIFIED | HIGH | P1 | Enforce startup fail-fast in production for missing/weak `JWT_SECRET`; deployment preflight; document secret rotation | Security Lead + Backend + DevOps | R-011 env matrix | App refuses insecure prod startup; preflight checklist passes | Unit/config tests, staging startup test (authorized) | Implementation + ops auth |
| BLB05A-S02 CORS no-origin | VERIFIED (static) | HIGH | P1 | Document threat model; keep strict trusted-origin allowlist; ensure sensitive routes require auth/CSRF/rate-limit/idempotency; evaluate no-origin policy per route class | Security Lead + Backend | D-14 infra, R-009 | CORS policy matrix documented; no sensitive cookie-auth route exposed by origin gap | Code review, integration tests | Implementation auth |
| BLB05A-S03 CSRF scope matrix | PARTIALLY VERIFIED | MEDIUM | P1 | Create endpoint auth/CSRF matrix; tests for cookie-auth state-changing routes; document Bearer-only exceptions | Backend + QA | R-007 | Every state-changing endpoint classified; tests pass | Integration tests | Implementation auth |
| BLB05A-S04 Logging/redaction consistency | PARTIALLY VERIFIED | MEDIUM | P1 | Standardize on `logger`; lint/CI rule banning raw console in backend; verify redaction covers PII/secrets/tokens/OTP | Backend + Security | R-007 | No raw sensitive logs in reviewed paths; lint enforced | Code review, tests, log scan | Implementation auth |
| BLB05A-S05 Secret ownership/rotation/transfer | VERIFIED (docs gap) | MEDIUM | P1 | Create secret inventory (names only), owners, rotation, transfer, incident process; no values in docs | DevOps + Security + Client | R-011 | Handover includes secret ownership matrix; rotation procedure documented | Doc review | Client/ops input |
| BLB05A-S06 Rate-limit distribution | VERIFIED (static)/REQUIRES EXTERNAL INFRA EVIDENCE | MEDIUM | P1 | Document process-local limits; add edge/WAF/distributed limiter strategy for prod; verify trusted proxy/client IP | DevOps + Security | D-14, R-015 | Prod rate-limit architecture documented and verified in authorized env | Infra evidence, load/rate tests (authorized) | Infra/ops auth |
| BLB05A-S07 SBOM/license | VERIFIED | LOW | P2 | Generate SBOM, dependency license review, NOTICE/LICENSE | Tech Lead + Legal | R-013 | SBOM and license report included in handover | Doc/artifact review | Legal/repo auth |
| BLB05A-S08 UAT safe mode controls | VERIFIED (positive) | INFO | P1 | Preserve and document UAT-safe controls in deployment/runbooks | DevOps + QA | R-003 | Runbooks require `UAT_SAFE_MODE=true` where applicable | Doc review | None |

### Security acceptance rules

- No OTP bypass, no S02 weakening, no authz bypass for testing.
- Customer/admin authentication separation remains enforced and tested.
- Credential rotation and access transfer documented before handover.

## 3. Database remediation (Workstream D)

| Finding | Validation | Severity | Priority | Remediation | Owner | Dependencies | Acceptance criteria | Verification | Authorization |
|---|---|---|---|---|---|---|---|---|---|
| BLB05A-DB01 S07 idempotency indexes code-level only | VERIFIED | HIGH | P1 | UAT-first index precheck/rollout plan: duplicate key check, invalid/missing `expiresAt` check, backup, create unique `idempotencyKey` + TTL `expiresAt`, post-verify, rollback | DBA/Backend | D-11, AP-03, R-005 | Indexes verified in UAT only; no duplicates/invalid TTL blockers; rollback ready | Authorized precheck/verify reports | **Separate explicit D-11 execution auth** |
| BLB05A-DB02 Schema governance docs | VERIFIED (gap) | MEDIUM | P1 | ERD/data dictionary/index inventory/migration notes from code; mark runtime-unverified | Backend/DBA + Tech Writer | R-012 | Schema doc pack complete for handover | Doc review | Doc auth |
| BLB05A-DB03 Order model complexity | PARTIALLY VERIFIED | MEDIUM | P2 | Document invariants/state transitions; add targeted integrity tests; consider refactor after stabilization | Backend + QA | R-014 | Critical invariants documented and tested | Tests/doc review | Implementation auth |
| BLB05A-DB04 Backup/restore evidence | VERIFIED (gap) | LOW/HIGH ops impact | P1 | Backup/restore drill runbook and authorized execution evidence | DBA/DevOps | R-003 | Restore drill passes in authorized non-prod env | Drill report | Ops/infra auth |

### Mandatory DB constraints

- No MongoDB `27017`, temp restore `27019`, Atlas, or production DB access in this milestone.
- Future separately authorized S07 UAT index operation only on `127.0.0.1:27018/bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true`.
- Prechecks: backup/restore readiness, duplicate `idempotencyKey`, invalid/missing `expiresAt`, existing index state, rollback path.
- No DB writes/migrations/index creation/rollout in BLB-05B.

## 4. Payment and order lifecycle remediation (Workstream F)

| Finding | Validation | Severity | Priority | Remediation | Owner | Dependencies | Acceptance criteria | Verification | Authorization |
|---|---|---|---|---|---|---|---|---|---|
| BLB05A-P01 Razorpay runtime verification gap | VERIFIED (gap) | HIGH | P1 | Controlled sandbox/provider verification: create order, signature verify, webhook verify, captured/failed, duplicate/idempotency, reconciliation | Backend + QA | AP-07, R-006, sandbox access | All scoped scenarios pass with evidence; no live txns | Sandbox test report | Separate provider/sandbox auth; no live txns/webhooks/captures |
| BLB05A-P02 Frontend payment E2E gap | VERIFIED | MEDIUM | P1 | Deterministic mocked E2E for COD, pay-at-store, online create/verify/failure/retry | Frontend + QA | R-007 | CI covers critical payment UI flows | CI/test report | Implementation auth |
| BLB05A-P03 Payment ops runbook missing | VERIFIED | MEDIUM | P1 | Incident/reconciliation/webhook replay/refund documentation (policy-dependent) | Ops + Backend + Client | R-003, client refund policy | Runbook reviewed; responsibilities assigned | Doc review | Client/ops input |
| BLB05A-P04 Local test signal positive | VERIFIED | INFO | - | Maintain as regression gate; do not treat as production proof | QA | - | Included in release criteria | CI history | None |

### Payment acceptance criteria (planning)

- Amount source of truth remains DB order; client amount never trusted.
- Signature/webhook verification remains mandatory and timing-safe.
- Duplicate/superseded/retry/reconciliation states are idempotent and auditable.
- COD/pay-at-store/online states are distinct and documented.
- Refund handling documented only per client-approved policy; no live refund/capture operations.

## 5. Risk register

| Risk | Impact | Mitigation | Gate |
|---|---|---|---|
| D-11 executed without UAT-safe constraints | High data/environment risk | Hard gate: explicit D-11 auth, UAT-only URI, `UAT_SAFE_MODE=true`, prechecks | R-005 |
| S02 weakened for testing | Critical security risk | Prohibit OTP bypass/weakening; use approved safe evidence paths | R-009, AP-05 |
| Provider tests hit live customers | Critical | Sandbox/test accounts only; explicit authorization; no live txns/messages | R-006 |
| Infra controls assumed | High | D-14 evidence package required before D-19 | R-015 |