# Bluebell Bakehouse — Phase 9 Customer Experience & Integrations

Date: 2026-11-10  
Repository: `C:\Users\Admin\Documents\bakery-ecommerce`

## Status: PASS — focused code/test verification; live integrations not exercised

## Customer experience audit

- Registration, password login, Google sign-in code path, customer-only session cookies, logout invalidation, profile/password endpoints, and OTP reset handling are implemented. Existing customer-auth tests cover duplicate registration response consistency, password login, HttpOnly cookie flags, profile secrecy, and logout invalidation.
- Fixed an open-redirect edge case in Google sign-in: protocol-relative (`//...`) and backslash-based destinations now fall back to `/account`; ordinary same-site relative paths remain allowed.
- Guest and authenticated checkout both use the existing order creation endpoint; authenticated orders are tied to the customer identity. Existing order validation and payment suites were used for regression verification.
- Cart is persisted in localStorage after hydration; totals are calculated from backend-loaded product/variant prices, not stored cart prices. The cart page has loading and empty states. No change was needed.
- Customer order list/detail use customer-scoped API routes and display order/payment status and totals. Delivery/pickup rescheduling proposal actions are integrated in the detail page; existing reschedule tests were run.
- Custom-cake request form submits to the existing backend, reports upload/submission errors and a reference number; the customer reference image flow requests a scoped signed upload. Request visibility/status management remains admin-side; there is no customer request-history screen in the current product scope.
- Existing responsive E2E specs cover desktop/tablet/mobile viewports and customer route visibility. They were inspected but not executed because Playwright's configured `webServer` starts/reuses development servers, and service starts/restarts are prohibited for this task.
- Customer pages already provide loading/empty/error/success handling in the inspected flows. No brand redesign or broad navigation changes were made.

## Integrations status

- **Razorpay — code-path verified; live provider blocked/not exercised.** Existing checkout and order retry load the provider script with a user-facing load error; backend amount/signature/webhook handling is covered by mocked payment tests. No payment or provider request was made.
- **Brevo — code-path verified; live provider blocked/not exercised.** API key is read server-side, configuration presence checks do not expose the value, and OTP/email delivery reports configuration/provider errors. Customer auth tests mock email delivery. No email was sent.
- **Cloudinary — code-path verified; live provider blocked/not exercised.** Uploads use short-lived server-signed requests; only the signature, timestamp, public API key, cloud name, and folder are returned. API secret remains server-side. Upload tests assert no secret exposure and test authorization using test-only credentials; no external upload was made.
- **Google authentication — mocked code-path verified; live provider blocked/not exercised.** ID token verification validates audience/issuer/signature/expiry and verified email server-side. Redirect handling is now hardened. No Google network verification was made.
- Environment configuration values were not read into this report or exposed. No provider was added or enabled.

## Verification results

- **PASS:** `backend/tests/customerAuth.test.ts`, `customerUpload.test.ts`, `upload.test.ts` — 31/31.
- **PASS:** `backend/tests/orderValidation.test.ts` — 34/34.
- **PASS:** `backend/tests/reschedule.test.ts` — 33/33.
- **PASS:** `backend/tests/payment.test.ts` — 21/21.
- **PASS:** backend `pnpm run typecheck`.
- **PASS:** root `pnpm exec tsc --noEmit`.
- **PASS:** `git diff --check` (line-ending conversion notices only).
- **NOT RUN:** Playwright responsive/browser suite: configured webServer would start/reuse dev servers, prohibited by task restrictions.
- No real payments, emails, uploads, Google authentication, external transactions, production database mutations, service restarts, commits, pushes, or deployments were performed.

## Blockers / optional improvements

- Live Razorpay, Brevo, Cloudinary, and Google credentials/provider flows cannot be validated without external transactions/communications; mocked or source-level verification only.
- Customer visibility for custom-cake request status is not implemented; customer submissions receive a reference number, while request management is admin-side. Optional future enhancement: a privacy-safe reference-number lookup/history screen.
- Responsive/browser checks remain unexecuted under the no-service-start restriction; existing Playwright specs provide coverage when run in an approved environment.

## Files changed in Phase 9

- `backend/src/controllers/customerAuthController.ts`
- `backend/tests/customerAuth.test.ts`
- `diagnostics/phase-9-customer-experience-integrations-20261110/REPORT.md`

Other existing modified and untracked files were preserved.