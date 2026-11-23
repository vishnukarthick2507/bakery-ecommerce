# BLB-03W — AP-05 Registration and OTP Technical Review

**Date:** 2026-11-21  
**Scope:** Read-only technical review of AP-05 / CUST-11 registration and OTP behavior, UAT Safe Mode constraints, and safe testable UAT scope. Documentation/review only; no code/config/test/env changes and no operational execution.  
**Confirmation status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**  
**Execution authorization status:** **NOT AUTHORIZED**

## Files inspected

- `docs/release/BLB-03V-INTERNAL-CONFIRMATION-REGISTER.md`
- `docs/release/BLB-03T-R-INTERNAL-DECISION-REGISTER.md`
- `docs/release/BLB-03U-R-UAT-READINESS-PLAN.md`
- `docs/release/BLB-03U-R-OPERATIONAL-AUTHORIZATION-GATES.md`
- `docs/uat/BLB-03-UAT-RESULTS.md`
- `docs/uat/BLB-03-UAT-TEST-PLAN.md`
- `docs/uat/BLB-03-TEST-DATA-PLAN.md`
- `docs/uat/BLB-03U-R-CUSTOMER-UAT-RUNBOOK.md`
- `docs/uat/BLB-03U-R-SYNTHETIC-DATA-AND-CREDENTIALS.md`
- `docs/UAT_SAFE_MODE.md`
- `backend/src/controllers/customerAuthController.ts` (registration/sendOtp/verifyOtp/forgot/reset sections inspected)
- `backend/src/services/emailService.ts` (OTP email, Brevo config, UAT suppression)
- `backend/src/services/otpService.ts` (referenced by controller imports; behavior inferred from controller/tests/docs where not directly re-read in full)
- `backend/src/config/uatSafeMode.ts`
- `backend/src/routes/authRoutes.ts` (referenced by prior evidence; route wiring/limiters)
- `backend/src/middleware/rateLimit.ts` (OTP/send/register rate-limit presence referenced by prior evidence)
- `backend/tests/customerAuth.test.ts`, `backend/tests/otp.test.ts`, `backend/tests/securityRemediation.s01s02.test.ts` (test names/evidence referenced from prior Step 7A/BLB-03U reports; no tests executed in BLB-03W)

## Findings (observed vs. assumption)

### Observed

1. **OTP/send behavior is environment and UAT-safe-mode gated** (`backend/src/controllers/customerAuthController.ts:690-808`).
   - Cooldown check exists before send (`checkOtpCooldown` + `claimOtpSendCooldown`).
   - When `isUatExternalSideEffectsBlocked()` is true, controller logs `auth.otp.send` suppression, commits cooldown claim, creates OTP session, and returns `200` with `message: "OTP prepared for UAT (external email delivery suppressed)."`, `uatSuppressed: true`. **No OTP value returned.**
   - In non-`test`/non-`development` environments, controller requires Brevo configuration; missing config returns `503 EMAIL_CONFIG_MISSING`, delivery failure returns `502 EMAIL_DELIVERY_FAILED`; on success creates session and returns generic success **without OTP**.
   - Only explicit `test`/`development` convenience path returns `{ message: "OTP sent successfully", otp }` (lines 787-796). This is an environment-specific convenience behavior, not a safe isolated UAT evidence path.

2. **OTP verification behavior** (`customerAuthController.ts:821-910`).
   - `verifyOtpCode` validates OTP; invalid/expired returns `401 "Invalid or expired OTP"`.
   - REGISTER purpose with pending registration can create account and set customer JWT cookie on successful verification. LOGIN purpose authenticates existing user by email; missing/inactive user returns generic `401 "Invalid or expired OTP"` (anti-enumeration).
   - Other purposes set registration/reset token cookie flow as implemented.

3. **Forgot-password behavior** (`customerAuthController.ts:920-1011`).
   - Invalid body returns generic `200 GENERIC_FORGOT_RESPONSE`.
   - Unknown user returns generic `200`.
   - Cooldown/rate-limit returns `429` with retry messaging (operational signal; not account existence disclosure by email lookup response body on unknown user).
   - When UAT external side effects blocked: suppresses external delivery, commits cooldown, creates PASSWORD_RESET OTP session, returns generic `200` **without OTP disclosure**.
   - In production: missing Brevo config or delivery failure logs server-side error, releases cooldown, returns generic `200` (Option A anti-enumeration behavior per S04/S05-era evidence).
   - Catches return generic `200` after cooldown release attempt.

4. **Reset/verify-reset flows** (`customerAuthController.ts:1020+`).
   - `verifyResetOtp` verifies OTP and sets reset token cookie; invalid returns `401 "Invalid or expired OTP"`.
   - `resetPassword` requires valid reset token cookie/JWT purpose/accountType/jti; invalid/missing returns generic `401 INVALID_RESET_PROOF_MESSAGE` (S04 C4).

5. **Email/OTP delivery controls** (`backend/src/services/emailService.ts`).
   - `sendOtpEmail` returns `false` and logs UAT suppression when `isUatExternalSideEffectsBlocked()`; does not treat as successful provider delivery.
   - Brevo config presence checks exist; credentials/secret values not exposed by designed diagnostics.
   - OTP email includes OTP in email body by design for real delivery path; in UAT safe mode external call is blocked before fetch.

6. **UAT Safe Mode** (`docs/UAT_SAFE_MODE.md`, `backend/src/config/uatSafeMode.ts`).
   - Blocks external Brevo/OTP/email delivery, WhatsApp, Razorpay, Cloudinary external ops, production Google OAuth misuse. Requires verified local Mongo target `127.0.0.1:27018/bluebell_whatsapp_uat` when enabled.

7. **Prior test evidence (not re-run in BLB-03W):** Step 7A reported full backend suite 45 files/639 tests/0 failed including S01/S02/S04 OTP/auth regressions. S02 specifically addressed OTP disclosure/fail-closed behavior.

### Assumptions / unverified

- **Unverified:** Actual runtime behavior in an approved isolated UAT environment for this milestone (no UAT executed).
- **Unverified:** Whether an approved secure non-production mechanism exists outside repo-observed `test/development` OTP response behavior that would be acceptable for UAT evidence without weakening S02.
- **Unverified:** Current deployment env values, Brevo account state, rate-limit store behavior across instances.
- **Assumption:** `otpService.ts` stores OTPs non-recoverably/plaintext-not-returned in normal flows, consistent with prior docs; code-level confirmation should be included in any execution-readiness review.

## Answers to required review questions

1. **Which registration behaviors can be tested safely in UAT Safe Mode?**
   - Form/API validation for registration fields (name/email/phone/password schema/format/rules as implemented).
   - Generic/non-enumerating responses for duplicate/pending/conflict flows per S04 behavior.
   - `POST /api/auth/otp/send` in UAT Safe Mode returns `200` with suppression message and `uatSuppressed: true`, no OTP value.
   - Cooldown/rate-limit generic 429 behavior (where safely triggerable in isolated UAT).
   - Absence of OTP plaintext in API responses/UI/log evidence (sanitized evidence only).
   - Forgot-password generic 200 behavior for known/unknown/config-missing/delivery-failure/UAT-suppressed paths.
   - Reset/verify-reset invalid/expired/generic error handling.

2. **Which behaviors cannot be fully tested without real OTP delivery?**
   - End-to-end registration completion requiring receipt of OTP code by external email/SMS/WhatsApp channel.
   - End-to-end forgot-password reset completion requiring external OTP receipt, unless an explicitly approved secure non-bypass internal evidence path exists (none authorized).
   - Any claim of successful external email/OTP delivery.

3. **Can CUST-11 be split into safe observable checks and blocked OTP-receipt checks?**
   - **Yes (recommended).**
   - **Safe observable checks (candidate):** registration form validation; OTP send request in UAT Safe Mode returns suppression response with no OTP; cooldown/429 generic behavior; no OTP disclosure in response/body/UI; generic anti-enumeration responses; forgot-password generic response behavior.
   - **Blocked OTP-receipt checks:** entering received OTP from real external delivery; completing account verification/creation dependent on real OTP receipt; any bypass/hardcoded OTP/test-secret extraction.

4. **Is there any test path that would weaken S02 or disclose OTP?**
   - **Unsafe/forbidden paths:** using dev/test convenience OTP-return behavior in UAT as a shortcut; exposing OTP plaintext from DB/logs/debug; hardcoded/bypass OTP; disabling UAT Safe Mode; real email delivery to real recipients. These would weaken S02/safety boundaries and are **NOT AUTHORIZED**.
   - The `NODE_ENV=test|development` sendOtp response includes `otp` (observed in code) — this must not be used as a UAT-safe evidence shortcut.

5. **What is the safest documented CUST-11 scope?**
   - **Recommended safe scope:** isolated UAT only, `UAT_SAFE_MODE=true`, synthetic data, no real provider contact. Validate registration input rules, sendOtp suppression response (`uatSuppressed`, no OTP), cooldown/rate-limit behavior, generic/anti-enumeration responses, and absence of OTP disclosure. Mark OTP-receipt/verification-completion steps as **BLOCKED/DEFERRED** unless a separately approved secure non-bypass evidence mechanism is documented.

## Recommendation

- **AP-05 status recommendation:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**. Maintain **RECOMMENDED — NOT CONFIRMED** policy direction; do not mark execution authorized.
- **CUST-11 recommendation:** split into **safe observable checks** and **blocked OTP-receipt/completion checks**. Do not attempt full CUST-11 completion by weakening S02, exposing OTPs, bypassing auth, or using real delivery.
- Any UAT execution requires separate internal confirmation and explicit execution authorization per BLB-03V templates/gates.

## Limitations

- Read-only code/doc inspection only; no runtime UAT, no DB inspection, no provider calls, no email/OTP sent.
- Existing test evidence referenced from prior reports; not re-executed in BLB-03W.
- Deployment/environment-specific behavior outside inspected repo cannot be verified.