# BLB-03U-R — Customer UAT Runbook

**Project:** Bluebell Bakehouse  
**Date:** 2026-11-21  
**Status:** **READY FOR INTERNAL REVIEW**  
**Execution status:** **NOT AUTHORIZED / NOT TESTED**

## 1. Global prerequisites (all CUST cases)

- [ ] Separate operational execution authorization recorded (see `docs/release/BLB-03U-R-OPERATIONAL-AUTHORIZATION-GATES.md`).
- [ ] BLB-03M/AP-01 internal decision confirmed (**RECOMMENDED — NOT CONFIRMED** currently).
- [ ] AP-02/03/04/16 approvals/authorizations recorded for applicable scope.
- [ ] Isolated UAT environment only: frontend/backend pointed at approved local UAT stack.
- [ ] `UAT_SAFE_MODE=true` verified.
- [ ] DB target verified: `127.0.0.1:27018`, DB `bluebell_whatsapp_uat`. **Prohibited:** Atlas, `27017`, `27019`, real customer data.
- [ ] Synthetic data/credentials prepared only under separate authorization.
- [ ] No real email/OTP/WhatsApp/Razorpay/Cloudinary/provider operations.
- [ ] Evidence capture path prepared (sanitized screenshots/logs/notes).

## 2. Case runbook

### CUST-01 — Storefront homepage
- **Source:** BLB-03 UAT Test Plan (`CUST-01`).
- **Readiness:** **READY FOR INTERNAL REVIEW** (execution **NOT AUTHORIZED**).
- **Prereqs:** Global prerequisites; approved local UAT frontend.
- **Steps:** Open homepage; verify layout/navigation/hero/CTAs/content render without errors.
- **Expected:** Homepage loads; no server/client errors; links work.
- **Evidence:** Screenshot, URL, console/network observation, timestamp.
- **Cleanup:** None.
- **Gate:** General UAT execution authorization.

### CUST-02 — Product catalogue
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Products available in UAT dataset; global prereqs.
- **Steps:** Open catalogue; browse categories/listing; verify product cards/pricing/images/placeholders.
- **Expected:** Catalogue displays available products accurately; empty/error states handled.
- **Evidence:** Screenshots, observed counts/categories.
- **Cleanup:** None.

### CUST-03 — Product detail pages
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** At least one active/available product.
- **Steps:** Open product details; verify name/description/price/media/options/availability.
- **Expected:** Correct data and actions for availability state.
- **Evidence:** Screenshot per sampled product.

### CUST-04 — Product availability
- **Readiness:** **READY FOR INTERNAL REVIEW** / data-dependent.
- **Prereqs:** Products with available/unavailable/out-of-stock states (synthetic/approved).
- **Steps:** View catalogue/detail for in-stock and unavailable items; attempt disallowed action.
- **Expected:** Availability reflected; disallowed actions prevented with clear feedback.
- **Evidence:** Screenshots/state observations.

### CUST-05 — Cart add/update/remove
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Purchasable product(s).
- **Steps:** Add items; change quantities; remove items.
- **Expected:** Cart updates correctly; line items/totals consistent.
- **Evidence:** Before/after screenshots.

### CUST-06 — Cart persistence after refresh
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Items in cart.
- **Steps:** Refresh/navigate away/back; reopen tab/session as applicable.
- **Expected:** Cart state persists as designed; no unintended loss/corruption.
- **Evidence:** Screenshots before/after refresh.

### CUST-07 — Price, quantity and total calculations
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Known product prices/fees/settings.
- **Steps:** Add/update quantities; review subtotal/delivery/discounts/total as applicable.
- **Expected:** Calculations accurate and consistent across cart/checkout/order summary.
- **Evidence:** Calculation worksheet/screenshots.

### CUST-08 — Delivery address validation
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Delivery flow enabled; synthetic addresses.
- **Steps:** Enter valid/invalid/incomplete addresses.
- **Expected:** Valid accepted; invalid rejected with clear validation.
- **Evidence:** Field-level screenshots.

### CUST-09 — Delivery date and time-slot validation
- **Readiness:** **READY FOR INTERNAL REVIEW**.
- **Prereqs:** Scheduling rules/slots configured.
- **Steps:** Select valid/invalid/past/unavailable slots.
- **Expected:** Allowed slots accepted; invalid/unavailable blocked.
- **Evidence:** Screenshots/observations.

### CUST-10 — Guest checkout (end-to-end)
- **Readiness:** **BLOCKED** (execution **NOT AUTHORIZED**).
- **Prereqs:** BLB-03M confirmed; AP-02/03/04/06/07/10 as applicable; synthetic cart/guest inputs; approved payment-safe path; no real provider ops.
- **Steps:** Add product to cart → checkout → complete customer details per approved BLB-03M behavior → fulfilment/address or pickup → valid schedule → approved payment option/path → submit order only if explicitly authorized → observe confirmation/order state.
- **Expected:** Order placed/recorded per approved safe path; correct totals/customer/fulfilment/schedule/status; validations enforced; no real payment/OTP/email/WhatsApp side effects.
- **Negative cases:** missing required fields, invalid phone/email/address, invalid slot, unauthorized payment path.
- **Evidence:** Sanitized screenshots, order ID/reference (synthetic), DB read evidence only if separately authorized, suppression evidence.
- **Cleanup/Rollback:** Per AP-04 cleanup plan; record created synthetic records; no ad-hoc DB cleanup without authorization.
- **Gate:** Separate CUST-10 execution authorization.

### CUST-11 — Customer registration and OTP
- **Readiness:** **BLOCKED / DEFERRED (technical confirmation required)**.
- **Technical finding (AP-05):** S02 removed OTP disclosure; UAT Safe Mode suppresses external OTP/email delivery and OTP plaintext is not exposed/recoverable. This protects security but limits full registration/OTP completion evidence.
- **Safe testable scope (if separately authorized):** registration form validation; generic non-enumerating responses; safe-mode suppressed behavior where observable; rate-limit/cooldown generic responses; no OTP disclosure in responses/logs/UI.
- **Not safely testable without weakening safeguards:** receiving real OTP, exposing plaintext OTP, bypassing OTP verification, external email delivery.
- **Expected:** No real OTP/email sent; no OTP disclosure; no auth bypass; generic/safe responses preserved.
- **Evidence:** Sanitized UI/API responses, logs showing suppression only if approved/sanitized.
- **Cleanup:** Approved synthetic account cleanup only if creation was separately authorized.
- **Gate:** AP-05 policy decision + technical review + separate execution authorization.

### CUST-12 — Customer login
- **Readiness:** **BLOCKED** (credentials/provisioning not authorized).
- **Prereqs:** AP-02/04; pre-provisioned synthetic customer credentials delivered securely out-of-band.
- **Steps:** Login with valid/invalid credentials; verify session/logout behavior.
- **Expected:** Valid login succeeds; invalid rejected; session/cookies handled correctly.
- **Evidence:** Sanitized screenshots (no secrets).
- **Cleanup:** Session logout; credential handling per policy.

### CUST-13 — Customer account and order history
- **Readiness:** **BLOCKED**.
- **Prereqs:** Authenticated synthetic customer with associated synthetic orders (AP-02/03/04).
- **Steps:** Open account/profile/order history/details.
- **Expected:** Correct authorized data only.
- **Evidence:** Sanitized screenshots.

### CUST-14 — Custom cake request submission
- **Readiness:** **BLOCKED** (AP-08 technical confirmation required).
- **Prereqs:** AP-03/04/08/10; synthetic inputs; UAT Safe Mode; no external Cloudinary side effects.
- **Safe testable scope:** form validation; honeypot empty submission path in isolated UAT if authorized; idempotency key replay/conflict behavior if authorized and safe; consent capture behavior as designed; no external upload.
- **Blocked scope:** any flow requiring external Cloudinary upload/delete or real provider side effect; media upload if safe isolation cannot be confirmed.
- **Expected:** Request persisted/acknowledged appropriately under approved safe conditions; no false success; no external media side effects.
- **Evidence:** Sanitized UI response, request/reference, DB read evidence only if authorized.
- **Cleanup:** Synthetic request cleanup per AP-04.

## 3. Customer UAT readiness statement

- **Documentation readiness:** **READY FOR INTERNAL REVIEW**.
- **Execution readiness:** **NOT AUTHORIZED / NOT TESTED**.
- **Release status:** **NOT READY**.