# BLB-03U — Step 2C S03 Rate-Limiting Remediation Report

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD (verified, unchanged):** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-20  
**Scope:** **BLB-03U Step 2C only** — implement endpoint-specific S03 rate limiting (P1–P5), add focused tests, run verification, and document results. **No S04–S07, no Redis/shared store, no trust-proxy/env/secret/webhook changes, no dependency changes, no production/UAT/provider/database/service mutations, and no Git mutations.**

> **Safety/compliance:** Work performed in the existing dirty/uncommitted working tree. No reset, clean, stash, checkout, switch, stage, commit, push, merge, rebase, amend, pull, rename, or remote changes performed. Pre-existing modified/untracked files preserved. No production or UAT database writes, no real email/OTP/WhatsApp/Razorpay/Cloudinary operations, no service restarts, no secrets exposed, and no auth/authz/CSRF/payment-signature/ownership/validation bypass or weakening.

## 1. Implemented policies and thresholds (P1–P5)

| Policy | Endpoint | Window | Maximum | Keying | Headers | Limiter (middleware export) |
|---|---|---:|---:|---|---|---|
| P1 | `POST /api/orders` | 15 minutes | 20 requests | Per-IP via `ipKeyGenerator(req.ip ?? "127.0.0.1")` | `standardHeaders: "draft-6"`, `legacyHeaders: false` | `createOrderLimiter` |
| P2 | `POST /api/payments/create-order` | 15 minutes | 30 requests | Per-IP via `ipKeyGenerator(req.ip ?? "127.0.0.1")` | `standardHeaders: "draft-6"`, `legacyHeaders: false` | `createPaymentOrderLimiter` |
| P3 | `POST /api/payments/retry` | 15 minutes | 20 requests | Per-IP via `ipKeyGenerator(req.ip ?? "127.0.0.1")` | `standardHeaders: "draft-6"`, `legacyHeaders: false` | `retryPaymentLimiter` |
| P4 | `POST /api/payments/verify` | 15 minutes | 30 requests | Per-IP via `ipKeyGenerator(req.ip ?? "127.0.0.1")` | `standardHeaders: "draft-6"`, `legacyHeaders: false` | `verifyPaymentLimiter` |
| P5 | `POST /api/custom-cake-requests` | 15 minutes | 10 requests | Per-IP via `ipKeyGenerator(req.ip ?? "127.0.0.1")` | `standardHeaders: "draft-6"`, `legacyHeaders: false` | `createCustomCakeRequestLimiter` |

- Each limiter is an **independent** `express-rate-limit` instance with its own in-memory counter/store (process-local default).
- No mutable request-body fields are used as the sole key; no unsafe fallback keying combining unrelated clients.

## 2. Exact middleware and route changes

### `backend/src/middleware/rateLimit.ts`
- Added and exported five endpoint-specific limiters using existing `express-rate-limit`/`ipKeyGenerator` conventions: `createOrderLimiter` (P1), `createPaymentOrderLimiter` (P2), `retryPaymentLimiter` (P3), `verifyPaymentLimiter` (P4), `createCustomCakeRequestLimiter` (P5).
- Each uses `windowMs: 15 * 60 * 1000`, approved `limit`, `standardHeaders: "draft-6"`, `legacyHeaders: false`, IP key generator, and JSON 429 handler/message.
- Existing limiters unchanged.

### `backend/src/routes/orderRoutes.ts`
- Imported `createOrderLimiter`.
- Applied P1 to `POST "/"`: `router.post("/", createOrderLimiter, optionalCustomerAuth, createOrder);` (limiter placed **before** optional auth/controller for early rejection). No other route/order behavior changes.

### `backend/src/routes/paymentRoutes.ts`
- Imported `createPaymentOrderLimiter`, `retryPaymentLimiter`, `verifyPaymentLimiter`.
- Applied P2–P4 before optional auth/controllers:
  - `POST "/create-order"` → `createPaymentOrderLimiter, optionalCustomerAuth, createPaymentOrder`
  - `POST "/retry"` → `retryPaymentLimiter, optionalCustomerAuth, retryPayment`
  - `POST "/verify"` → `verifyPaymentLimiter, optionalCustomerAuth, verifyPayment`
- **`POST "/webhook"` unchanged** (no limiter added; no webhook/signature/raw-body/mounting changes).

### `backend/src/routes/customCakeRoutes.ts`
- Imported `createCustomCakeRequestLimiter`.
- Applied P5 to `POST "/"`: `router.post("/", createCustomCakeRequestLimiter, createCustomCakeRequest);` (limiter placed before controller). No other custom-cake behavior changes.

## 3. 429 response behavior

- **Status:** `429 Too Many Requests`.
- **Headers:** draft-6 standard rate-limit headers enabled (`RateLimit-*`), legacy `X-RateLimit-*` headers disabled.
- **JSON bodies (exact):**
  - P1: `{ "message": "Too many order requests from this IP. Please try again later." }`
  - P2: `{ "message": "Too many payment initiation requests from this IP. Please try again later." }`
  - P3: `{ "message": "Too many payment retry requests from this IP. Please try again later." }`
  - P4: `{ "message": "Too many payment verification requests from this IP. Please try again later." }`
  - P5: `{ "message": "Too many custom cake requests from this IP. Please try again later." }`
- No sensitive information exposed in rate-limit responses.

## 4. Focused S03 tests added

- `backend/tests/orderRateLimit.s03.test.ts` — P1 below-threshold pass-through (non-429), 429/body/headers after 20 requests, combined guest+authenticated counting against same endpoint limiter, limiter isolation/reset.
- `backend/tests/paymentRateLimit.s03.test.ts` — P2/P3/P4 below-threshold pass-through (non-429), 429/body/headers after approved thresholds (30/20/30), independent limiters across create/retry/verify, limiter isolation/reset.
- `backend/tests/customCakeRateLimit.s03.test.ts` — P5 below-threshold pass-through (non-429), 429/body/headers after 10 requests, limiter isolation/reset.
- Tests follow existing conventions (Vitest/supertest/Express), use CSRF-aware app setup where applicable, reset in-memory limiter keys between tests, and introduce no new dependencies.

## 5. Test evidence and results

- **New S03 focused tests:** `cd backend && npx vitest run tests/orderRateLimit.s03.test.ts tests/paymentRateLimit.s03.test.ts tests/customCakeRateLimit.s03.test.ts` → **PASS** — `Test Files 3 passed (3), Tests 9 passed (9), Duration 52.30s`.
- **Relevant regressions:** `cd backend && npx vitest run tests/orderValidation.test.ts tests/payment.test.ts tests/customCake.test.ts tests/csrf.test.ts` → **PASS** — `Test Files 4 passed (4), Tests 119 passed (119), Start at 02:07:12, Duration 84.93s`.
  - `orderValidation.test.ts` initially exposed S03-caused 429 leakage from the new in-memory P1 limiter across existing tests/requests; resolved with **minimal test-only isolation** in `backend/tests/orderValidation.test.ts` (limiter resets in relevant setup/tests, no weakening of auth/CSRF/validation/ownership/payment controls or business assertions). Re-verified: `npx vitest run tests/orderValidation.test.ts` → **PASS** (`1 file / 38 tests`, `29.17s`).
- **Backend typecheck:** `cd backend && npm run typecheck` (`tsc --noEmit`) → **PASS** (exit code 0). Initial run failed only due to supertest type annotations in newly added S03 tests; fixed in those test files and re-verified PASS.
- **Full backend suite (initial):** `cd backend && npx vitest run` → **FAIL** — `Test Files 1 failed | 42 passed (43), Tests 1 failed | 595 passed (596), Start at 02:08:47, Duration 361.75s`.
  - Failure: `tests/pagination.test.ts > Custom cake requests pagination > returns paginated requests with metadata` (`expected ... length 10 but got 5`) caused by new P5 limiter blocking HTTP fixture creates to `POST /api/custom-cake-requests` (S03 interaction, not a runtime control regression). Resolved with **minimal test-only adaptation** in `backend/tests/pagination.test.ts` (pagination fixtures created via `CustomCakeRequest.insertMany` instead of rate-limited public POSTs; test intent preserved; runtime security controls unchanged).
- **Full backend suite (final, rerun):** `cd backend && npx vitest run` → **PASS** — `Test Files 43 passed (43), Tests 596 passed (596), Start at 02:23:51, Duration 371.67s, 0 failed`. (Increase from prior Step 1 baseline 40 files / 587 tests reflects 3 new S03 test files / 9 tests.) 
- **Frontend:** not rerun in this milestone (out of scope). No external providers invoked. No DB/UAT/provider/service mutations.

## 6. Limitations and deployment verification notes

- **In-memory / process-local:** counters are stored in the default in-memory store and are **not globally consistent across multiple backend instances, processes, workers, or restarts**. This implementation does **not** claim production multi-instance protection is solved.
- **Proxy topology:** `backend/src/server.ts` sets `trust proxy = 1` (unchanged). Correct client-IP derivation and limiter effectiveness depend on trusted reverse-proxy/LB configuration; deployment topology and proxy-header correctness **still require deployment/environment verification**.
- **Compensating controls:** infrastructure/WAF/gateway rate limits and bot protections remain unverified from repository evidence.

## 7. Explicit confirmations

- **Payment webhook unchanged:** `POST /api/payments/webhook`, webhook signature verification, raw-body handling, and webhook mounting were **not modified**.
- **Preserved controls/behavior:** existing auth/OTP/CSRF/idempotency/payment-signature/ownership/validation behavior preserved in scope; no weakening of security controls.
- **No out-of-scope work:** no S04–S07, no dependency/Redis/shared-store/trust-proxy/env/secret changes, no service restarts, no DB/provider/UAT mutations, no Git mutations.
- **Release posture:** production release **NOT READY** (unchanged); BLB-03M unconfirmed, AP-01–AP-10 pending, CUST/ADM UAT blocked.

## 8. Files changed (Step 2C S03 scope)

- `backend/src/middleware/rateLimit.ts` (added/exported P1–P5 limiters)
- `backend/src/routes/orderRoutes.ts` (applied P1)
- `backend/src/routes/paymentRoutes.ts` (applied P2–P4; webhook unchanged)
- `backend/src/routes/customCakeRoutes.ts` (applied P5)
- `backend/tests/orderRateLimit.s03.test.ts` (new)
- `backend/tests/paymentRateLimit.s03.test.ts` (new)
- `backend/tests/customCakeRateLimit.s03.test.ts` (new)
- `backend/tests/orderValidation.test.ts` (test-only isolation: reset `createOrderLimiter` to prevent cross-test/intra-test 429 leakage from new S03 limiter; no weakening of controls/behavior assertions)
- `backend/tests/pagination.test.ts` (test-only adaptation: custom-cake pagination fixtures created via model inserts instead of rate-limited public POST endpoint; pagination intent preserved; no runtime control weakening)
- `docs/security/BLB-03U-S03-RATE-LIMIT-REMEDIATION.md` (new, this report)
- `docs/security/BLB-03T-SECURITY-REVIEW.md` (S03 remediation/status update)

**Git/workspace state at completion:** branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` unchanged; working tree remains dirty/uncommitted/unpushed with all pre-existing and prior Step 1 changes preserved plus Step 2C S03 changes above; **no Git mutations performed**.
