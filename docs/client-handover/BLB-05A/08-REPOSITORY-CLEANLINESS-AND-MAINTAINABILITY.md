# 08 — Repository Cleanliness & Maintainability

**Audit:** BLB-05A (read-only)  
**Date:** 2026-11-21

## Evidence

- `git status --short` (106 dirty/untracked entries at audit start)
- root file listing, package manifests, lockfiles, `.gitignore`, CI/deploy configs
- TODO/FIXME/HACK scan over tracked source/script files (excluding node_modules/.next/reports/dist): **0 matches** (PowerShell Select-String no-match exit code)

## Findings

| ID | Severity | Category | Affected file/module | Evidence | Business impact | Recommended remediation | Separate auth |
|---|---|---|---|---|---|---|---|
| BLB05A-C01 | HIGH | Dirty worktree / no clean release boundary | repository-wide | 106 modified/untracked entries | Cannot identify deliverable; audit/handover confusion | Authorized release triage, branch cleanup, tag/release candidate | Yes |
| BLB05A-C02 | MEDIUM | Multiple lockfiles / package manager ambiguity | `package-lock.json`, `pnpm-lock.yaml`, `backend/package-lock.json`, `packageManager` | Install drift, CI/local mismatch | Standardize pnpm or npm; remove stale lockfiles under authorization | Yes |
| BLB05A-C03 | MEDIUM | Generated artifacts present | `.next/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo` | Bloated/confusing handover package | Add artifact policy, clean generated outputs from delivery | Yes |
| BLB05A-C04 | MEDIUM | Documentation sprawl / untracked control docs | `docs/release/*`, `docs/security/*`, `docs/uat/*` many untracked | Hard to find authoritative client docs | Curate handover doc set; archive internal drafts appropriately | Yes |
| BLB05A-C05 | MEDIUM | Missing legal/delivery metadata | no root `LICENSE`; package license fields inconsistent | Legal/compliance ambiguity for client handover | Add LICENSE, NOTICE/SBOM, dependency license review | Yes (legal) |
| BLB05A-C06 | LOW | Dev/agent instruction files in repo root | `AGENTS.md`, `CLAUDE.md`, `TODO.md` | May confuse client/maintainers; internal process leakage | Move to internal docs or clearly label | Yes |
| BLB05A-C07 | LOW | Backend metadata inconsistency | `backend/package.json` main `index.js` vs tsx scripts | Minor onboarding friction | Align metadata and docs | Yes |
| BLB05A-C08 | INFO | No TODO/FIXME/HACK markers found in scanned source | scan result 0 | Positive signal, but not proof of no debt | Continue linting/quality gates | No |

## Maintainability verdict

**NOT READY.** The codebase shows some structure, but repository hygiene and release packaging are below professional handover standard due to dirty state, artifact sprawl, lockfile ambiguity, and incomplete delivery metadata.