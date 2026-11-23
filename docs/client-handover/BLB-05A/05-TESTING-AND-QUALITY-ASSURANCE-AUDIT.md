# 05 — Testing & Quality Assurance Audit

**Audit:** BLB-05A (read-only)  
**Date:** 2026-11-21

## Scope

Static inspection of test files/configs and existing reports. No tests executed during BLB-05A. No UAT/operational/provider tests run.

## Test infrastructure (verified)

| Layer | Evidence | Observation |
|---|---|---|
| Backend unit/integration | `backend/package.json` `test: vitest run`; `backend/vitest.config.ts`; `backend/tests/*.test.ts` (46 files observed in inventory) | Vitest node env, no coverage reporters/thresholds, `fileParallelism=false`, `maxWorkers=1` |
| Frontend E2E | `playwright.config.ts`, `playwright.ci.config.ts`, `playwright.e2e.stage4.config.ts`, `playwright.e2e.custom-cake-form-nav.config.ts`; `tests/e2e/*.spec.ts` | Multiple configs with different scope/webServer behavior |
| CI | `.github/workflows/ci.yml` | typecheck + backend vitest + Playwright `--config=playwright.ci.config.ts` |
| Frontend unit/component | No frontend vitest/jest config or script found in root `package.json` | Gap — UI/component logic relies on E2E/backend tests |

## Playwright config evidence

| Config | Scope | WebServer | Risk |
|---|---|---|---|
| `playwright.config.ts` | all `tests/e2e`, chromium+mobile-chrome | frontend + backend | Broadest; default |
| `playwright.ci.config.ts` | only `custom-cake-form-navigation.spec.ts`, chromium | frontend only, no backend | CI E2E coverage very narrow |
| `playwright.e2e.stage4.config.ts` | `stage4-custom-cake-workflow.spec.ts` | none; env-gated real env | Manual/env dependent; not CI-safe by default |
| `playwright.e2e.custom-cake-form-nav.config.ts` | custom-cake nav isolated | none / isolated baseURL per config (verify before use) | Config fragmentation |

## Existing evidence (historical, not freshly rerun in BLB-05A)

- **Step 7A (2026-11-21, repo docs):** backend typecheck PASS, frontend typecheck PASS, backend suite 45 files / 639 tests / 0 failed. *Source:* `docs/security/BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`. Local evidence only.
- **UAT docs:** plans/results exist under `docs/uat/*`; many CUST/ADM cases blocked/pending. *Sources:* `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `BLB-03-UAT-RESULTS.md`.
- **Playwright report/test-results dirs present:** generated artifacts exist in workspace; staleness unknown — not treated as current evidence.

## Coverage assessment

| Area | Status | Evidence | Gap |
|---|---|---|---|
| Backend auth/security regression | PARTIAL/GOOD LOCAL | securityRemediation tests, auth tests, rate limit tests, CSRF tests in `backend/tests` | Runtime/deployed config not verified |
| Payment backend | PARTIAL/GOOD LOCAL | `backend/tests/payment.test.ts` (per inventory) | No live Razorpay/provider verification; frontend payment E2E gap |
| WhatsApp backend/outbox/consent | PARTIAL | WhatsApp/outbox/consent/webhook tests present in `backend/tests` | No real provider send/webhook runtime verification; frontend consent capture gap (see 04) |
| Checkout E2E | WEAK | CI config only custom-cake form nav; address validation spec exists | No full checkout payment/COD/pay-at-store/guest track E2E in CI |
| Admin E2E | WEAK | stage4 env-gated; isolation smoke exists | Most admin workflows lack deterministic E2E |
| Accessibility/browser smoke | MISSING | no a11y test tooling evidence; Step 7A notes not executed | Release risk for forms/checkout/custom-cake |
| Performance/load | MISSING | no k6/artillery/perf budget evidence | Unknown under load |
| Coverage reporting | MISSING | no coverage thresholds/reporters in vitest config | Coverage unknown |

## Findings

| ID | Severity | Finding | Evidence | Business impact | Remediation | Separate auth |
|---|---|---|---|---|---|---|
| BLB05A-Q01 | HIGH | CI Playwright coverage is narrow (custom-cake form nav only) and lacks backend webServer | `playwright.ci.config.ts` | Regressions in checkout/admin/payment flows may ship | Expand deterministic CI E2E suite; add backend webServer or API mocks strategy | Yes |
| BLB05A-Q02 | HIGH | No frontend unit/component tests | root `package.json` scripts, no frontend test config | UI logic/regressions under-tested | Add Vitest/RTL/component tests for critical flows | Yes |
| BLB05A-Q03 | MEDIUM | Test config fragmentation creates false confidence | 4 Playwright configs, different scopes | Teams may run wrong suite | Consolidate/document canonical test matrix | Yes |
| BLB05A-Q04 | MEDIUM | No coverage thresholds/reporting | `backend/vitest.config.ts` | Unknown coverage, quality drift | Add coverage reporting and minimum thresholds for critical modules | Yes |
| BLB05A-Q05 | MEDIUM | Historical test evidence not same as release/UAT evidence | Step 7A report, UAT docs | Stakeholders may overread local pass as release readiness | Maintain fresh, scoped evidence per release candidate | Process |
| BLB05A-Q06 | LOW | Generated test artifacts present in workspace | `playwright-report/`, `test-results/` | Stale evidence confusion | Clean/ignore as artifacts; publish CI artifacts instead | Yes |

## QA verdict

**NOT READY for client handover sign-off.** Local backend test evidence is a positive signal, but E2E coverage, frontend unit coverage, accessibility/performance evidence, and release-grade UAT evidence are insufficient.