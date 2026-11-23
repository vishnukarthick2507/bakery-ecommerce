# 03 — Security & Database Audit

**Audit:** BLB-05A (read-only, static)  
**Date:** 2026-11-21

## Security boundary

No penetration testing, no runtime exploitation, no DB queries, no external provider calls. Findings based on source/config/docs inspection. A clean static review does **not** prove absence of vulnerabilities.

## Security findings

| ID | Severity | Category | Affected file/module | Evidence | Business impact | Recommended remediation | Separate auth |
|---|---|---|---|---|---|---|---|
| BLB05A-S01 | HIGH | Release/auth config | `backend/src/config/jwt.ts`, `backend/src/server.ts` | JWT secret min 32 chars enforced in config; server logs/continues in some cases per backend audit | Misconfigured prod could weaken/disable auth guarantees | Fail-fast in production; deployment preflight checks | Yes |
| BLB05A-S02 | HIGH | CORS/origin surface | `backend/src/server.ts`, `backend/src/lib/origin.ts` | CORS allows no-origin requests; trusted origin normalization | Non-browser clients bypass origin checks; CSRF depends on cookie presence | Document threat model; enforce auth/rate-limit/idempotency; restrict where feasible | Yes |
| BLB05A-S03 | MEDIUM | CSRF scope | `backend/src/middleware/csrf.ts` | Protects cookie-authenticated state-changing requests; webhook path exemption for Razorpay | Bearer-only endpoints rely on token auth (ok) but rules must be clearly documented/tested | Add explicit CSRF policy matrix and tests per endpoint class | Yes |
| BLB05A-S04 | MEDIUM | Logging/redaction | `backend/src/lib/logger.ts`, various controllers | Logger redacts sensitive keys; some controllers use `console.error/warn` | Sensitive data leakage in logs possible | Centralize logging; lint rule banning console in backend | Yes |
| BLB05A-S05 | MEDIUM | Secrets/deployment transfer | `.env.example`, `backend/.env.example`, `render.yaml`, `vercel.json` | Env names documented; no secret transfer/rotation runbook | Operational compromise or misconfiguration during handover | Create secret ownership/rotation/transfer checklist (no values) | Yes (client input) |
| BLB05A-S06 | MEDIUM | Rate-limit distribution | `backend/src/middleware/rateLimit.ts`, S03 reports | Process-local in-memory limiters | Ineffective across multiple instances/restarts; edge protection unverified | Document limits; add distributed/rEdge controls for production | Yes (infra) |
| BLB05A-S07 | LOW | Dependency/license visibility | lockfiles, package manifests, no root LICENSE | Third-party inventory not client-ready | Compliance/maintenance risk | Generate SBOM/license report | Yes |
| BLB05A-S08 | INFO | UAT safe mode controls | `backend/src/config/uatSafeMode.ts`, docs | Blocks external side effects in UAT mode | Positive control; must be correctly configured in envs | Include in deployment/handover runbooks | No |

## Database audit (static)

| ID | Severity | Category | Affected model/module | Evidence | Business impact | Recommended remediation | Separate auth |
|---|---|---|---|---|---|---|---|
| BLB05A-DB01 | HIGH | Index deployment gap | `backend/src/models/CustomCakeSubmissionIdempotency.ts`, S07 reports | Unique idempotencyKey + TTL expiresAt defined in code; prod/UAT index creation/verification not performed | Duplicate/race protection may be absent in deployed DB | Authorized UAT-first index precheck/rollout with backup/rollback | Yes (DB auth) |
| BLB05A-DB02 | MEDIUM | Schema governance documentation | `backend/src/models/*` | Many models/indexes exist; no single schema/ERD/data dictionary handover doc | Maintenance and migration risk | Produce schema documentation and migration/index runbook | Yes |
| BLB05A-DB03 | MEDIUM | Order model complexity | `backend/src/models/Order.ts` | Large model with lifecycle/payment/reservation/proposal/archive fields | Data integrity/regression risk | Add data dictionary, invariants, and targeted integrity tests | Yes |
| BLB05A-DB04 | LOW | Backup/restore evidence | no backup runbook found | DB recovery unverified | Data loss risk | Document/test backup/restore | Yes (ops) |

## Not verified

- Actual MongoDB indexes in any deployed environment.
- Data retention/deletion behavior in production.
- Multi-instance session/rate-limit behavior.
- Real secret strength/rotation in Vercel/Render.