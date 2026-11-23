# BLB-03U — S07 Remediation Report (Step 6C)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (unchanged)  
**Date:** 2026-11-21  
**Scope:** BLB-03U Step 6C only — S07 custom-cake abuse protection. **No S08. No deployment/release.**

## 1. Original S07 finding and residual risk

- **Original finding (BLB-03T-S07):** Public custom-cake submission endpoint accepted unauthenticated requests without dedicated rate limiting (`docs/security/BLB-03T-SECURITY-REVIEW.md:112-122`, Low, Confirmed).
- **Pre-Step 6C state:** S03 P5 added dedicated per-IP rate limiting (10/15 min) on `POST /api/custom-cake-requests`; residual abuse-hardening gap remained (no honeypot, no duplicate/idempotency protection, Origin/Referer compatibility unverified). S07 design documented in `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`.
- **Residual risk addressed:** Low-severity abuse surface (spam/storage/operational noise/duplicate submissions, consent side-effect repetition on retries). Not a confirmed data-breach/auth-bypass exploit.

## 2. Approved decisions implemented

1. **Honeypot:** Generic controlled rejection (400) when `companyWebsite` is filled. No fake success. No request/consent side effects.
2. **Idempotency rollout:** Backward compatible; requests without idempotency key use existing flow.
3. **Dedupe storage failure:** Generic 503; never fall back to unsafe create.
4. **Origin/Referer:** Deferred; no strict allowlist/enforcement added.
5. **Storage design:** Code-level model/index definitions added; no prod/UAT DB writes/index creation/migrations/admin commands executed.

Approved idempotency design: `CustomCakeSubmissionIdempotency`, unique `{idempotencyKey:1}`, TTL `{expiresAt:1, expireAfterSeconds:0}`, 24h from initial claim; same key+same payload replay 201; same key+different payload 409; same key in progress 409 retry; storage failure 503.

## 3. Exact files changed

| File | Change |
|---|---|
| `backend/src/models/CustomCakeSubmissionIdempotency.ts` | **New** code-level model/index definition for S07 idempotency. |
| `backend/src/controllers/customCakeController.ts` | Added honeypot validation, PII-minimal abuse logging, idempotency key validation, durable claim/replay/recovery/conflict/503 logic, fingerprinting, safe response snapshot; preserved P5/validation/consent/reference-number behavior. |
| `backend/src/middleware/rateLimit.ts` | **Unchanged by S07 logic** (P5 preserved; file already in dirty worktree). |
| `backend/src/routes/customCakeRoutes.ts` | **Unchanged by S07 logic** (P5 route already present; file already in dirty worktree). |
| `backend/tests/customCakeAbuseProtection.s07.test.ts` | **New** focused S07 tests. |
| `backend/tests/testDatabase.ts` | Pre-existing modified file; changed MongoMemoryServer -> MongoMemoryReplSet to support transaction-capable test infra. |
| `components/custom-cake/custom-cake-form.tsx` | Added accessible offscreen honeypot field and idempotency key lifecycle (reuse same key for same payload retry; reset on new submission). |
| `lib/api/index.ts` | Added optional `Idempotency-Key` header support. |
| `lib/types.ts` | Added optional `companyWebsite` honeypot field to `CustomCakeRequest` type. |
| `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md` | This report. |
| `docs/security/BLB-03T-SECURITY-REVIEW.md` | Updated S07 status/summary. |

## 4. Atomicity strategy and evidence

**Strategy used:** Durable state-machine with unique constraint and recovery (no process-local lock, no in-memory map). Transactions were not required for the custom-cake idempotency path because the critical safety property is achieved by: unique idempotency key claim, persisting `createdRequestId` before completion, and recovery-on-retry.

**State transitions:** `IN_PROGRESS` (claimed) -> `IN_PROGRESS` with `createdRequestId` (request created) -> `COMPLETED` with minimal response snapshot. `FAILED` only when no request side effect was created. Expired records are reusable after TTL/cleanup check.

**Critical failure window covered:** if request is created and `createdRequestId` persisted but completion update fails, record remains IN_PROGRESS+createdRequestId. A retry with same key+same fingerprint loads the existing request, returns original 201 response snapshot, and marks COMPLETED. No duplicate request is created; consent is not re-granted on recovery replay.

**MongoDB transaction evidence:** Codebase already uses `startSession/withTransaction` in order/payment/custom-cake/product/inventory flows. MongoDB Atlas/prod topology is replica-set class (transaction-capable) by normal deployment assumption; local standalone does not support transactions. `backend/tests/testDatabase.ts` was updated to `MongoMemoryReplSet` so transaction-capable behavior is available in tests; smoke check confirmed replset supports transactions. The S07 idempotency implementation itself relies on atomic unique-index claim + durable recovery, which is safe on replica set and does not require multi-document transactions.

## 5. Honeypot implementation

- **Backend:** `companyWebsite` optional in Zod schema (max 200). If trimmed non-empty, server logs PII-minimal `honeypot_triggered` event and returns generic 400 `{message:"Please check the form and try again"}`. No `CustomCakeRequest` create, no `grantConsent`, no other side effects.
- **Frontend:** offscreen `aria-hidden` container, `tabIndex=-1`, `autoComplete="off"`, plausible label/input name `companyWebsite`; value bound to form state but not user-visible.
- **Accessibility:** hidden from keyboard/screen reader by aria-hidden offscreen container; normal form flow unchanged. Manual a11y smoke still recommended in real browser assistive tech.
- **Diagnostics:** structured console warning with event name/path/outcome only; no submitted name/phone/email/instructions/raw payload.

## 6. Idempotency implementation

- **Key input:** `Idempotency-Key` header and optional body `idempotencyKey`. Validated pattern `[A-Za-z0-9_-]{8,128}`; invalid => generic 400.
- **Missing key:** backward-compatible existing flow.
- **Fingerprint:** HMAC-SHA256 using existing `JWT_SECRET` over canonical JSON of normalized business fields (name, phone, flavour, normalized weight, theme, messageOnCake, instructions, referenceImageUrl, whatsappConsent). No new env var added; no secret/fingerprint secret logged; no raw PII stored in idempotency record.
- **Claim:** create IN_PROGRESS record with unique idempotencyKey and 24h `expiresAt`. Duplicate key race (`11000`) reads existing record.
- **Replay/conflict/recovery:** same fingerprint + COMPLETED => replay stored response. Same fingerprint + IN_PROGRESS with `createdRequestId` => recover existing request response, mark COMPLETED. Same fingerprint + IN_PROGRESS without `createdRequestId` => 409 retry. Different fingerprint => 409 conflict. FAILED with no `createdRequestId` allows safe same-payload retry by cleanup/reclaim.
- **Storage failure:** generic 503; no unsafe create fallback.
- **Consent side effects:** `grantConsent` called only on first successful creation path; not called on replay/recovery.
- **Response snapshot:** minimal `buildCustomCakeSuccessResponse` fields only; no raw submitted PII.

## 7. P5 preservation and Origin/Referer

- **P5 preserved:** `createCustomCakeRequestLimiter` unchanged: 10 req/15 min/IP, draft-6 headers, legacy off, existing 429 body. No second competing limiter added.
- **Origin/Referer:** deferred; no strict allowlist or missing/unfamiliar header rejection added.

## 8. Verification results

### Backend typecheck
- `cd backend; npx tsc --noEmit` — **PASS** (exit 0).

### Frontend typecheck
- `npx tsc --noEmit --project tsconfig.json` — **PASS** (exit 0).

### Focused S07 / custom-cake
- `npx vitest run tests/customCakeAbuseProtection.s07.test.ts tests/customCake.test.ts tests/customCakeRateLimit.s03.test.ts` — **PASS: 3 files, 47 tests, 0 failed** (39.85s).

### Relevant consent regressions
- `npx vitest run tests/orderCheckoutWhatsappConsent.test.ts tests/whatsappConsent.test.ts tests/whatsappConsentRoutes.test.ts` — **PASS: 3 files, 38 tests, 0 failed** (17.88s).

### Full backend suite
- `cd backend; npm run test` — **PASS: 45 files passed (45), 639 tests passed (639), 0 failed** (396.55s, start 01:58:55).

## 9. Remaining limitations / operational verification

- Code-level Mongo index definitions added; **no prod/UAT index creation/migration executed**. Real deployment index creation/verification is a separate approved ops step.
- Honeypot is lightweight and bypassable by sophisticated bots; P5 remains process-local/per-instance.
- Origin/Referer enforcement intentionally deferred pending compatibility inventory.
- TTL cleanup relies on Mongo TTL monitor; expired-record handling in code also treats expired records as reusable.
- Idempotency fingerprint uses `JWT_SECRET`; in environments where it is missing/misconfigured, endpoint fails closed with 503 (no unsafe create).
- Test infra changed to MongoMemoryReplSet for transaction-capable behavior; this affects local test execution environment but full suite passed.
- No browser assistive-technology manual smoke test executed in this run.

## 10. Safety confirmations

- **No production/UAT DB writes, no index creation/migrations/admin commands, no external provider operations, no customer submissions, no email/OTP/WhatsApp/Razorpay operations, no deployment/service restart.**
- **No secrets/credential values printed.**
- **Branch/HEAD unchanged:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`.
- **All pre-existing dirty/untracked work preserved. No Git mutations performed.**