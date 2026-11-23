# 07 — Repository & Release Boundary Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05B — DOCUMENTATION ONLY — NO IMPLEMENTATION AUTHORIZED  
**Date:** 2026-11-21

## 1. Control

Planning only. No git reset/clean/stash/checkout/switch/add/commit/push/pull/merge/rebase/amend/cherry-pick/restore. No file delete/rename/move/overwrite/cleanup. All existing changes preserved. Do not discard any existing change without explicit owner review and separate authorization.

## 2. Current repository state (BLB-05B preflight)

| Metric | Value |
|---|---:|
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` |
| Total changed/untracked entries | 107 |
| Tracked changes | 59 |
| Untracked entries | 48 |
| BLB-05A reported | 106 at audit start (recalculated, not assumed unchanged) |

**Note:** BLB-05B documentation creation will add untracked files under `docs/client-handover/BLB-05B/`; these are audit/planning artifacts and must be reported separately in final verification.

## 3. Release-boundary problem statement

BLB05A-C01 (HIGH): dirty worktree prevents identifying authoritative deliverable. The 107 entries may include intended feature work, security remediation, tests, docs, generated artifacts, local temp files, or accidental files. No entry may be discarded by assumption.

## 4. Classification plan (authorized future execution)

| Classification | Criteria | Disposition | Owner | Authorization |
|---|---|---|---|---|
| Intended product code | Feature/fix required for approved scope | Review, test, include in release candidate | Tech Lead | Implementation/release auth |
| Intended tests | Valid automated tests for in-scope behavior | Review, run in CI, include | QA/Tech Lead | Implementation auth |
| Intended documentation | Handover/release/security/UAT docs required for evidence | Curate, version, include in doc pack | Delivery/Tech Writer | Doc/release auth |
| Generated artifacts | `.next/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo`, logs | Exclude from delivery; .gitignore/release manifest rules | DevOps | Cleanup auth |
| Local/dev-only files | IDE, temp, scratch, agent scratchpads not for client | Exclude; do not delete without review | Tech Lead | Cleanup auth |
| Accidental/sensitive files | Secrets, credentials, dumps, PII | Remove from repo history/delivery per security process; rotate secrets if exposed | Security Lead | Security incident + cleanup auth |
| Ambiguous | Cannot classify confidently | Escalate to owner; preserve until decided | Release Manager | Owner decision |

## 5. Release-candidate construction rules

1. **Baseline:** identify authoritative baseline (current `HEAD` or approved integration baseline) and record it.
2. **Scope manifest:** every included change mapped to requirement/finding/decision.
3. **No silent inclusion:** untracked docs/artifacts reviewed before inclusion.
4. **Reproducible build:** clean install/build/test from release candidate using documented package manager and lockfile.
5. **Audit trail:** classification sheet, review approvals, test evidence, release notes, tag.
6. **No destructive cleanup:** preserve pre-existing work until reviewed and explicitly authorized.

## 6. Package manager / lockfile ambiguity plan (R-013)

| Item | Current evidence | Risk | Planned remediation | Auth |
|---|---|---|---|---|
| `package-lock.json` (root) | Present | npm/pnpm drift | Decide authoritative manager (packageManager declares pnpm) | Repo cleanup auth |
| `pnpm-lock.yaml` (root) | Present | Duplicate lockfile signal | Keep authoritative, remove stale per policy | Repo cleanup auth |
| `backend/package-lock.json` | Present | Backend install drift | Align with workspace policy | Repo cleanup auth |
| `pnpm-workspace.yaml` | Present | Workspace config authoritative if pnpm selected | Confirm and document | Tech Lead decision |

**Acceptance:** one documented install path; clean install succeeds in CI; lockfile policy in README/dev docs.

## 7. Delivery exclusion checklist (future authorized packaging)

- `node_modules/`, `.next/`, `playwright-report/`, `test-results/`, `dist/`, coverage outputs, local env files, logs, dumps.
- Any file containing secrets/credentials/PII/OTP/customer data.
- Internal-only drafts unless explicitly approved for client delivery.
- Unreviewed untracked files.

## 8. Release candidate exit criteria

- All 107+ entries classified with owner/disposition.
- Release scope approved by owner/client where required.
- Clean build from candidate passes required CI gates.
- Critical P0/P1 findings closed or explicitly risk-accepted by authorized owner.
- Required documentation pack complete.
- UAT/acceptance evidence attached per BLB-04D/05G gates.
- No unreviewed generated/accidental/sensitive files in package.

## 9. Prohibited actions (BLB-05B)

- No git cleanup/reset/stash/commit/push/branch switch.
- No deletion/move/rename/overwrite of existing files.
- No assumption that dirty entries are disposable.