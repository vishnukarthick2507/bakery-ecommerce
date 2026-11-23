# 06 — Deployment & DevOps Readiness

**Audit:** BLB-05A (read-only)  
**Date:** 2026-11-21

## Scope

Static inspection only. No deployment, no service restart, no env/config changes, no external connectivity checks.

## Evidence inspected

- `vercel.json`, `render.yaml`, `.github/workflows/ci.yml`
- `package.json`, `backend/package.json` scripts
- `.env.example`, `backend/.env.example`
- `DEPLOYMENT_WORKFLOW.md`, `scripts/prep-deploy.mjs`, `scripts/health-check.mjs` (presence/names; content sampled where useful)
- `README.md`, `docs/UAT_SAFE_MODE.md`, `docs/release/*` constraints

## Deployment topology (as configured)

| Component | Evidence | Observation |
|---|---|---|
| Frontend | `vercel.json`: Next.js, region `bom1`, env refs, CORS headers for `/api/*` | Vercel-oriented; env values referenced as Vercel secrets (`@...`) |
| Backend | `render.yaml`: Node web service, `oregon`, branch `main`, build `cd backend && pnpm install --frozen-lockfile`, start `cd backend && npx tsx src/server.ts` | Render IaC present; secrets `sync:false` (dashboard-managed) |
| CI | `.github/workflows/ci.yml`: Node 22 + pnpm; typecheck, backend vitest, Playwright CI | CI exists; triggers on `main` push/PR |

**Inferred / not verified:** actual Vercel/Render projects, domains, DNS, TLS certs, reverse proxy/WAF/CDN, production env completeness, secret rotation, backup jobs, monitoring/alerting.

## Readiness assessment

| Area | Status | Evidence | Gap/risk |
|---|---|---|---|
| Build scripts | PARTIAL | Frontend `build/start/typecheck`; backend `dev/start/typecheck/test` | Backend uses `tsx` in start; production compiled-build strategy unclear |
| Env documentation | PARTIAL | Root and backend `.env.example` exist | No complete env matrix with owner, required/optional, environment, rotation, secret handling |
| CI | PARTIAL | GitHub Actions CI on `main` | Current working branch is `feature/whatsapp-business-automation`; CI trigger/branch policy for release needs confirmation |
| Health checks | PARTIAL | `scripts/health-check.mjs` exists | Not runtime-verified; Render/Vercel health probe config not fully documented here |
| Logging/monitoring | MISSING/UNKNOWN | Code has logging; no monitoring/alerting runbook found in audit | No Sentry/APM/log aggregation/alert ownership documented |
| Backup/recovery | MISSING | No backup/restore runbook found | Critical for MongoDB/production handover |
| Rollback | MISSING | No deployment rollback procedure documented | Release risk |
| Secrets management | PARTIAL | Render secrets `sync:false`; Vercel secret refs; `.env.example` names only | No secret rotation/ownership/transfer procedure |
| Environment separation | PARTIAL | `UAT_SAFE_MODE` docs exist; release docs warn about 27017/27019/Atlas | No complete dev/staging/UAT/prod matrix and access controls handover |
| Deployment runbook | PARTIAL | `DEPLOYMENT_WORKFLOW.md`, `render.yaml`, `vercel.json` exist | Not validated end-to-end; missing operator checklist/sign-off |

## Findings

| ID | Severity | Finding | Evidence | Business impact | Remediation | Separate auth |
|---|---|---|---|---|---|---|
| BLB05A-D01 | HIGH | No verified backup/restore/rollback runbook | docs absence; release docs mention risk | Data loss / prolonged outage during incident | Create and test backup/restore/rollback runbooks | Yes (ops access) |
| BLB05A-D02 | HIGH | Production deployment readiness not evidenced | no deployment sign-off/run logs in audited docs | Client may assume deployable; release failure risk | Controlled staging/prod dry run with evidence | Yes |
| BLB05A-D03 | MEDIUM | Backend start uses `tsx src/server.ts` in Render | `render.yaml` | Runtime compile/dependency behavior differs from compiled prod best practice; cold-start/debug risk | Evaluate compiled build/start (`tsc` output or documented tsx rationale) | Yes |
| BLB05A-D04 | MEDIUM | Env var inventory incomplete for handover | `.env.example`, `backend/.env.example`, code refs | Misconfiguration/security exposure on deployment | Complete env matrix (name, purpose, required, env, owner, rotation) | Yes |
| BLB05A-D05 | MEDIUM | Monitoring/alerting/incident ownership undocumented | no ops runbook | Failures may go undetected | Define monitoring, alerts, log retention, on-call/escalation | Yes (client input) |
| BLB05A-D06 | LOW | CI targets `main`; active work on feature branch with dirty tree | `ci.yml`, git status | Release branch discipline unclear | Define release branching/tagging/CI policy | Yes |

## Verdict (deployment readiness)

**NOT READY.** Deployment artifacts exist, but operational evidence (backup/restore, rollback, monitored deployment, env/secrets transfer, verified runbooks) is insufficient for professional client handover.