# BLB-03W — Origin/Referer Compatibility Review

**Date:** 2026-11-21  
**Scope:** Read-only compatibility review of Origin/Referer/CSRF/CORS behavior relevant to custom-cake and public/authenticated request flows. Documentation/review only; no code/config/env changes and no enforcement implementation.  
**Confirmation status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**  
**Execution authorization status:** **NOT AUTHORIZED**

## Files inspected

- `docs/release/BLB-03V-INTERNAL-CONFIRMATION-REGISTER.md`
- `docs/release/BLB-03T-R-INTERNAL-DECISION-REGISTER.md`
- `docs/release/BLB-03U-R-UAT-READINESS-PLAN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md`
- `docs/security/BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`
- `backend/src/server.ts`
- `backend/src/lib/origin.ts`
- `backend/src/middleware/csrf.ts`
- `backend/src/routes/customCakeRoutes.ts`
- `backend/src/controllers/customCakeController.ts`
- `backend/src/routes/authRoutes.ts` (context)
- `backend/src/routes/orderRoutes.ts`, `backend/src/routes/paymentRoutes.ts` (context; not fully re-read line-by-line in this milestone)
- `backend/.env.example` (referenced by prior evidence)

## Findings (observed vs. assumption)

### Observed

1. **Trusted origin normalization/config** (`backend/src/lib/origin.ts`).
   - `normalizeOrigin` parses URL, normalizes scheme+host, strips path/trailing slash behavior as implemented, returns null for invalid.
   - `getTrustedOrigins` reads `CORS_ORIGIN`, splits commas, normalizes, filters invalid; fallback `http://localhost:3000` when unset/empty.

2. **CORS behavior** (`backend/src/server.ts:60-77`).
   - `origin` callback allows requests with **no Origin** (`!_origin => callback(null, true)`).
   - If Origin present and normalized origin is in trusted list, allows.
   - If Origin present but not trusted, returns `callback(null, false)` (disallows CORS). **Important:** CORS middleware behavior typically omits CORS allow headers; it does not by itself guarantee an application-level 403 rejection for non-browser clients. Browser cross-origin reads are constrained by CORS; server-side request acceptance may still occur unless separately blocked.

3. **CSRF protection behavior** (`backend/src/middleware/csrf.ts`).
   - Safe methods `GET/HEAD/OPTIONS` exempt.
   - `/api/payments/webhook` path exempt.
   - Only requests with auth cookies (`customer-token`, `admin-token`, `otp-registration-token`, `otp-reset-token`) require Origin validation. If no auth cookie present, middleware `next()` passes through.
   - For cookie-authenticated state-changing requests: missing Origin => 403; invalid Origin => 403; untrusted Origin => 403 with warning log.
   - This is CSRF protection for cookie-authenticated requests, not a general Origin allowlist for all public endpoints.

4. **Custom-cake public POST** (`backend/src/routes/customCakeRoutes.ts`, `backend/src/controllers/customCakeController.ts`).
   - `POST /api/custom-cake-requests` is public, rate-limited by P5, no authentication. Normal anonymous submissions do not carry auth cookies; therefore CSRF Origin validation is currently **not applied** to them by `csrfProtection`.
   - S07 design/report explicitly deferred Origin/Referer enforcement pending compatibility review.

5. **Server/proxy context** (`backend/src/server.ts`). `app.set("trust proxy", 1)` is set; actual deployment proxy/CDN topology unverified.

### Assumptions / unverified

- **Unverified:** Production/staging/UAT `CORS_ORIGIN` values and actual frontend origins.
- **Unverified:** Presence of legitimate non-browser clients, embedded integrations, server-to-server callers, or mobile/native clients calling custom-cake/public endpoints without Origin or with unexpected Origin.
- **Unverified:** CDN/WAF/proxy behavior affecting Origin/Referer headers.
- **Unverified:** Whether any endpoint relies on no-origin requests in production beyond same-origin/non-browser tooling.
- **Assumption:** Browser-based cross-site requests with cookies are meaningfully constrained by current CSRF middleware where auth cookies exist; public cookie-less endpoints remain intentionally unauthenticated and are not protected by this CSRF check.

## Compatibility/risk assessment

### Current enforcement behavior

- **CORS:** configured allowlist for browser cross-origin access; no-origin allowed; untrusted origin receives CORS denial (header behavior), not an explicit app 403 in CORS middleware.
- **CSRF:** strict Origin validation for cookie-authenticated state-changing requests; anonymous cookie-less requests exempt.
- **Custom-cake POST:** no CSRF Origin enforcement by current design; protected by validation, P5 rate limit, S07 honeypot/idempotency, and server-side constraints.

### Would additional Origin/Referer enforcement break legitimate flows?

- **Potentially yes, if enforced naively.** Risks include breaking legitimate non-browser clients, server-side integrations, health/tooling, requests with absent Origin, and environments where trusted origin config is incomplete. Referer is especially unreliable (can be absent due to referrer policy/privacy).

### Routes/request types needing compatibility review before enforcement

- `POST /api/custom-cake-requests` (public anonymous, high interest for S07) — must inventory legitimate callers/origins first.
- Public auth/OTP endpoints where no auth cookie is present but state changes occur (review abuse/CSRF model carefully; different from cookie-auth CSRF).
- Any webhook endpoints (already special-cased/exempted as appropriate).
- Checkout/payment/authenticated mutation endpoints — already covered by CSRF cookie-auth check when cookies present; verify no legitimate cookie-auth cross-origin flows exist.

### Evidence required before enforcement

- Confirmed inventory of production/staging/UAT frontend origins and `CORS_ORIGIN` config.
- Inventory of legitimate non-browser/API/embedded/server-side consumers and their Origin/Referer behavior.
- Proxy/CDN/WAF header behavior evidence (Origin preservation, trusted proxy chain).
- Targeted compatibility test plan in isolated authorized environment.
- Explicit decision on behavior for missing Origin (allow with monitoring, block, or conditional) and for public cookie-less endpoints.

## Recommendation

- **Status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**.
- **Do not enforce strict Origin/Referer allowlist now.** Current evidence is insufficient for compatibility-safe enforcement on public anonymous flows.
- **Recommended next decision path:** (1) collect origin/client/topology inventory; (2) define endpoint-specific policy (cookie-auth already enforced; public custom-cake may use conditional Origin check when Origin present, monitor absent-Origin, no Referer hard-fail); (3) authorize isolated compatibility testing before any enforcement change.
- Do not confuse CORS with CSRF. Do not implement enforcement in BLB-03W.

## Limitations

- Read-only inspection only; no runtime traffic observation, no deployment config access, no proxy/WAF/CDN verification.
- No header-capture evidence from production/staging.
- CORS library behavior for `callback(null,false)` noted as observed pattern; runtime confirmation should be obtained before policy enforcement.