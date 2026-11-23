# 02 — Frontend & Backend Quality Audit

**Audit:** BLB-05A (read-only)  
**Date:** 2026-11-21

## Evidence basis

Static inspection of `app/`, `components/`, `lib/`, `middleware.ts`, `backend/src/`, configs, and subagent inventory findings (verified against current repo where noted). No runtime/UAT/browser execution performed.

## Frontend quality

### Strengths observed
- Next.js App Router structure with customer/admin separation (`app/account/*`, `app/admin/*`).
- Middleware protects `/admin` with cookie presence, local JWT verification when `JWT_SECRET` exists, and authoritative backend `/api/auth/verify` check (`middleware.ts`).
- Component domain grouping under `components/`.
- TypeScript strict mode in `tsconfig.json`.

### Gaps / risks

| ID | Severity | Area | Evidence | Business impact | Remediation | Separate auth |
|---|---|---|---|---|---|---|
| BLB05A-F01 | HIGH | WhatsApp consent capture missing in frontend | `Select-String` search in `app/components/lib` found no `whatsappConsent`/WhatsApp consent; backend has order/custom-cake consent handling per tests/controllers in repo history | Transactional WhatsApp notifications may not be lawfully/operationally enqueued through normal UI | Add explicit consent UX/copy and wire to backend contract; legal/compliance review | Yes (product/legal) |
| BLB05A-F02 | MEDIUM | Checkout/custom-cake flows not fully E2E-verified in CI | `playwright.ci.config.ts` runs only custom-cake form navigation; default config broader but not same as CI | Regressions in payment/checkout may reach client | Expand deterministic CI E2E coverage | Yes |
| BLB05A-F03 | MEDIUM | Accessibility/browser smoke unverified | No a11y tooling/tests; Step 7A notes no manual a11y/browser smoke | Accessibility/compliance/user experience risk | Run WCAG-focused smoke and keyboard/screen-reader checks | Yes |
| BLB05A-F04 | MEDIUM | Frontend unit/component tests missing | root `package.json` has no frontend unit test script | Harder to maintain/refactor safely | Add component/unit tests for critical flows | Yes |
| BLB05A-F05 | LOW | Generated artifacts and dev files in workspace | `.next/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo` | Confusing handover package | Exclude from delivery; clean under authorization | Yes |

## Backend quality

### Strengths observed
- Express 5 + TypeScript + Zod + Mongoose stack.
- Helmet, cookie-parser, request ID, CSRF middleware, CORS allowlist, rate limiting, UAT safe mode present.
- Raw-body handling for Razorpay and WhatsApp webhooks before JSON parser (`backend/src/server.ts`).
- Separate admin/customer auth middleware and tokenVersion checks (per `backend/src/middleware/auth.ts`, prior audits).

### Gaps / risks

| ID | Severity | Area | Evidence | Business impact | Remediation | Separate auth |
|---|---|---|---|---|---|---|
| BLB05A-B01 | HIGH | Auth route complexity/duplication risk | `backend/src/routes/authRoutes.ts` mounted at `/api/auth` and `/api/admin` (`server.ts`); multiple `/me`/logout semantics reported by backend audit | Auth regressions/customer-admin confusion | Simplify route boundaries, add explicit integration tests, document contracts | Yes |
| BLB05A-B02 | MEDIUM | CORS allows no-origin requests | backend audit finding; common for server-to-server but expands non-browser surface | Relies on other controls for abuse prevention | Document rationale; tighten where possible; ensure CSRF/rate-limit/auth cover all sensitive paths | Yes |
| BLB05A-B03 | MEDIUM | Logging consistency/redaction not uniform | `lib/logger.ts` exists but some controllers use `console.error/warn` per backend audit | Potential sensitive data in logs / inconsistent observability | Standardize logger usage and redaction | Yes |
| BLB05A-B04 | MEDIUM | Large/complex order controller | `orderController.ts` reported ~2009 lines by backend audit | Maintainability and regression risk | Refactor into services/use-cases with targeted tests | Yes |
| BLB05A-B05 | LOW | Backend package metadata/startup mismatch | `backend/package.json` main `index.js`; scripts use `tsx src/server.ts` | Onboarding confusion | Align package metadata/docs | Yes |

## API/contract observations

- Public read endpoints exist (products/settings) by design; ensure no sensitive fields exposed.
- WhatsApp public consent endpoints intentionally disabled/410 per prior docs/audit.
- Error/response format consistency should be verified endpoint-by-endpoint before handover (not fully verified here).

## Verdict

**PARTIAL.** Core structure is professional in places, but there are meaningful maintainability, coverage, and contract-clarity gaps that should be remediated before formal handover.