# BLB-03U — Proposal Expiry Test Reliability Fix Report

**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD (unchanged):** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-21  
**Scope:** Test-only fixture correction in `backend/tests/proposalExpiry.test.ts` (three affected tests only). No S05 changes, no S06/S07, no production source code changes.

## 1. Why the original fixtures failed

As documented in `docs/security/BLB-03U-PROPOSAL-EXPIRY-REGRESSION-INVESTIGATION.md`, the three tests used a hardcoded proposed slot `2026-11-20T12:00:00.000Z` (Fri 17:30 IST, within bakery hours). When run on/after 2026-11-21, that timestamp became past relative to current time. `validateSlot` (`backend/src/services/slotValidation.ts`) rejects past slots with `valid:false, error:"Slot must be in the future."`, and `proposeSlot` (`backend/src/controllers/orderController.ts`) returns HTTP 400, causing the tests to fail with `expected 200 to be 400`. This was not attributable to S05 or a proposal-expiry logic regression.

## 2. Exact test changes

**File changed:** `backend/tests/proposalExpiry.test.ts` (only the three affected tests inside `describe("Response window (admin-selectable)", ...)`)

For each affected test:
1. `defaults to 3 hours when responseWindowHours is omitted`
2. `uses 1 hour when responseWindowHours is 1`
3. `uses 72 hours when responseWindowHours is 72`

Changes applied (identical deterministic strategy, per-test isolation):
- Added `vi.useFakeTimers();`
- Added `vi.setSystemTime(new Date("2026-11-20T09:00:00.000Z")); // Deterministic "now" before proposed slot`
- Wrapped existing test body in `try { ... } finally { vi.useRealTimers(); }` to restore real timers/system time after each affected test.
- Kept the existing valid proposed slot `new Date(Date.UTC(2026, 10, 20, 12, 0, 0))` (2026-11-20T12:00:00.000Z, Fri 17:30 IST) so it remains future relative to the fixed "now" and satisfies existing slot-validation/bakery operating-hour rules.

**Unchanged (as required):** original test intent and assertions (default 3h, explicit 1h, explicit 72h), other tests in the file, test timeouts, Vitest config, dependencies, environment files, production source code, and S05 remediation.

## 3. Verification (actual results)

| Command | Result |
|---|---|
| `cd backend; npx vitest run tests/proposalExpiry.test.ts -t "defaults to 3 hours when responseWindowHours is omitted"` | **PASS** — `Test Files 1 passed (1), Tests 1 passed | 27 skipped (28), Duration 14.72s` |
| `cd backend; npx vitest run tests/proposalExpiry.test.ts -t "uses 1 hour when responseWindowHours is 1"` | **PASS** — `Test Files 1 passed (1), Tests 1 passed | 27 skipped (28), Duration 14.85s` |
| `cd backend; npx vitest run tests/proposalExpiry.test.ts -t "uses 72 hours when responseWindowHours is 72"` | **PASS** — `Test Files 1 passed (1), Tests 1 passed | 27 skipped (28), Duration 14.66s` |
| `cd backend; npx vitest run tests/proposalExpiry.test.ts` | **PASS** — `Test Files 1 passed (1), Tests 28 passed (28), Duration 26.44s` |
| `cd backend; npx vitest run tests/reschedule.test.ts` (relevant order rescheduling regression) | **PASS** — `Test Files 1 passed (1), Tests 42 passed (42), Duration 43.82s` |
| `cd backend; npm run typecheck` | **PASS** — `tsc --noEmit`, exit 0 |

## 4. Files changed

- `backend/tests/proposalExpiry.test.ts` — test-only deterministic fixture/time-control fix for the three affected tests.
- `docs/security/BLB-03U-PROPOSAL-EXPIRY-TEST-FIX-REPORT.md` — this report (created).

## 5. Confirmations and limitations

- **Production source code not modified.** No changes to `slotValidation.ts`, `orderController.ts`, proposal-expiry implementation/services, routes, middleware, config, dependencies, env files, or other tests. S05 remediation unchanged.
- **HEAD/branch unchanged:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`.
- **All unrelated dirty/untracked work preserved.** No Git mutations performed (no reset/clean/stash/checkout/switch/stage/commit/push/merge/rebase/amend/pull).
- **No external side effects:** no production/UAT DB access, no service start/stop/restart, no email/WhatsApp/Razorpay/external provider contact, no secrets/customer data exposed.
- **Remaining limitations:** full backend suite not re-run as part of this narrow fix (only requested/targeted verification executed). Previously reported unrelated full-suite `proposalExpiry` failures are resolved by this fixture correction; other unrelated full-suite failures, if any, were not evaluated here. No S06/S07 begun.