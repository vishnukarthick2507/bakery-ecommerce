# Browser E2E Execution Safety and Coverage Plan

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Reviewed branch:** `fix/api-product-data-access`  
**Reviewed source baseline:** `40f610f68ddde0b4372e45ee68c221330b876583`  
**Date:** 2026-11-26  
**Status:** Static test review only — no browser suite executed by this review.

## 1. Purpose

Identify which existing Playwright tests are suitable for a safe isolated run, which require extra setup, and which must not be pointed at production or an unknown database. This document is a test-execution plan, not evidence that tests passed.

## 2. Existing configurations

| Config | Scope | Important behavior |
|---|---|---|
| `playwright.ci.config.ts` | Only `custom-cake-form-navigation.spec.ts`, Chromium | Starts Next.js dev server; the test intercepts the custom-cake POST in the browser. |
| `playwright.config.ts` | All `tests/e2e` specs, desktop Chromium and Pixel 5 mobile Chrome | Starts Next.js and backend dev servers on localhost ports 3000 and 5000. Reuses existing servers outside CI. |
| `playwright.e2e.stage4.config.ts` | Stage 4 custom-cake workflow spec, Chromium | Uses externally supplied `E2E_BASE_URL`; no web server is started; workflow requires E2E credentials and a run ID. |
| `playwright.e2e.custom-cake-form-nav.config.ts` | Custom-cake navigation spec, Chromium | Uses externally supplied `E2E_BASE_URL`; no web server is started. |

## 3. Static review of test side effects

| Spec | Observed behavior | Safe-run assessment |
|---|---|---|
| `custom-cake-form-navigation.spec.ts` | Browser intercepts the custom-cake POST and returns a synthetic response; no real request should be sent for that intercepted route. | Suitable for local isolated frontend test with the configured CI server. |
| `checkout-delivery-address-validation.spec.ts` | Mocks product, settings and auth APIs; seeds synthetic browser local storage; validates checkout navigation/fields. | Suitable for isolated local run; confirm every API call used by the tested page is intercepted before broadening. |
| `cart-consistency.spec.ts` | Mocks product API and seeds synthetic local storage; exercises cart reconciliation. | Suitable for isolated local run; confirm all relevant API requests are mocked. |
| `customer-admin-isolation.spec.ts` | Mocks `/api/auth/me` with a synthetic customer; checks protected-route redirects and customer pages. | Suitable for isolated local run; confirm no unmocked endpoint is configured to mutate external systems. |
| `bluebell.spec.ts` | Includes UI checks, but also sends OTP and Google auth requests and posts a custom-cake request through the relative API path. | Do not run against production or an unknown DB/provider configuration. Split or mock the request-based cases before broad suite execution. |
| `stage4-custom-cake-workflow.spec.ts` | Requires admin/customer credentials and a run ID; submits custom cake requests, proposes/accepts/declines, converts requests into orders and checks tracking. | State-mutating workflow. Only run against a dedicated disposable staging database with synthetic accounts/data and written authorization. Never point at production. |
| `screenshots.spec.ts` | Captures visual screenshots and writes screenshot files into the test working directory. | Local-only visual run; ensure output location is ignored or intentionally collected. |

## 4. Required safe execution sequence

1. Confirm the test environment is local or a dedicated isolated staging environment; never infer this from a URL or environment name.
2. Confirm backend `MONGODB_URI` resolves to a disposable test database, not production or a shared client database. Do not print credentials or URI values in logs.
3. Confirm payment, email, WhatsApp, OAuth and Cloudinary calls are mocked or configured to non-delivering sandbox/test destinations. No real messages or payments.
4. Start with mocked, non-mutating specs: cart consistency, checkout delivery-address validation, customer/admin isolation and custom-cake form navigation.
5. Split the request-based OTP, Google-auth and custom-cake submission cases from `bluebell.spec.ts`; mock their endpoints or provide isolated test doubles before including them.
6. Run desktop Chromium and mobile Chrome separately or through the default config only after all prerequisites above are met.
7. Run the state-mutating Stage 4 workflow only after synthetic credentials, disposable DB reset/cleanup, test-data retention rules and written approval are confirmed.
8. Save test reports and screenshots without real customer information, tokens, cookies, OTPs or secrets.
9. Record exact commit SHA, config, project/browser, command, environment classification, result, skipped tests and artifacts.

## 5. Current coverage limitations

- The CI Playwright config only executes the custom-cake form navigation spec in Chromium.
- The default Playwright config defines desktop Chromium and Pixel 5 mobile Chrome, but its presence does not prove either full project has been run.
- The Stage 4 workflow is a separate credentialed, state-mutating test and is not equivalent to browser-only UI validation.
- A passing browser test does not establish provider sandbox readiness, production behavior, business UAT or client acceptance.

## 6. Approval gates

| Action | Current status |
|---|---|
| Static inspection of Playwright source/config | Completed for this plan |
| CI-configured Chromium smoke test | CI evidence tracked separately by workflow run |
| Full mocked desktop/mobile suite | Not run by this review; safe environment verification required |
| Credentialed Stage 4 workflow | Not authorized / not run |
| Production browser testing | Not authorized / prohibited by this plan |
| Customer/admin UAT | Requires separate written authorization and client participation |

**Conclusion:** The next safe browser-testing milestone is the fully mocked local suite, after verifying the local backend database and provider isolation. The credentialed Stage 4 workflow and any request paths that create records must remain out of production.
