# BLB-03W — Internal Decision Closure Report

**Date:** 2026-11-21  
**Scope:** Read-only internal decision closure and technical-review consolidation after BLB-03V. Documentation/review only; no implementation, DB operations, UAT execution, provider operations, deployment, or Git mutations.  
**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Expected/confirmed HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`

## Files inspected

### Required BLB-03V/03U-R/03T-R/UAT/security docs
- `docs/release/BLB-03V-INTERNAL-CONFIRMATION-REGISTER.md`
- `docs/release/BLB-03V-S07-UAT-EXECUTION-AUTHORIZATION-TEMPLATE.md`
- `docs/release/BLB-03V-CUSTOMER-UAT-AUTHORIZATION-TEMPLATE.md`
- `docs/release/BLB-03V-ADMIN-UAT-AUTHORIZATION-TEMPLATE.md`
- `docs/release/BLB-03V-PRODUCTION-CHANGE-AUTHORIZATION-TEMPLATE.md`
- `docs/release/BLB-03V-AUTHORIZATION-COMPLETENESS-CHECKLIST.md`
- `docs/release/BLB-03T-R-INTERNAL-DECISION-REGISTER.md`
- `docs/release/BLB-03U-R-UAT-READINESS-PLAN.md`
- `docs/release/BLB-03U-R-OPERATIONAL-AUTHORIZATION-GATES.md`
- `docs/uat/BLB-03U-R-CUSTOMER-UAT-RUNBOOK.md`
- `docs/uat/BLB-03U-R-ADMIN-UAT-RUNBOOK.md`
- `docs/uat/BLB-03U-R-S07-UAT-INDEX-ROLLOUT-RUNBOOK.md`
- `docs/uat/BLB-03U-R-UAT-EVIDENCE-CHECKLIST.md`
- `docs/UAT_SAFE_MODE.md`
- `docs/security/BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md`

### Additional read-only evidence inspected
- `docs/uat/BLB-03-UAT-RESULTS.md` (BLB-03M exact options/record; AP/CUST context)
- `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `docs/uat/BLB-03-TEST-DATA-PLAN.md` (existence/context per prior milestone; targeted review)
- `docs/release/BLB-03S-RELEASE-READINESS.md`, `docs/CLIENT_HANDOVER_STATUS.md` (context)
- `backend/src/config/uatSafeMode.ts`
- `backend/src/controllers/customerAuthController.ts`
- `backend/src/services/emailService.ts`
- `backend/src/controllers/customCakeController.ts`
- `backend/src/services/cloudinary.ts`
- `backend/src/controllers/uploadController.ts`
- `backend/src/routes/customCakeRoutes.ts`
- `backend/src/routes/uploadRoutes.ts`
- `backend/src/routes/customerUploadRoutes.ts`
- `backend/src/middleware/csrf.ts`
- `backend/src/lib/origin.ts`
- `backend/src/server.ts`
- `components/custom-cake/custom-cake-form.tsx`
- `lib/api/index.ts`
- `lib/upload.ts`
- `backend/tests/customCakeAbuseProtection.s07.test.ts` (test name/evidence review)
- Prior evidence references: `backend/tests/customerAuth.test.ts`, `backend/tests/otp.test.ts`, `backend/tests/securityRemediation.s01s02.test.ts`, `backend/tests/customerUpload.test.ts`, `backend/tests/upload.test.ts`, `backend/tests/uatSafeMode.test.ts`

## Findings

- **No fabricated approvals.** No approver names, roles, dates, signatures, or decision confirmations were created. All previously unconfirmed items remain unconfirmed unless explicit evidence exists (none found).
- **BLB-03M remains unresolved.** Exact Option A/B definitions reconfirmed from `docs/uat/BLB-03-UAT-RESULTS.md` (BLB-03M record). Option A remains **RECOMMENDED — NOT CONFIRMED**.
- **AP-05 technical review completed** (read-only). Safe observable CUST-11 checks can be separated from blocked OTP-receipt/completion checks. No S02-weakening path is authorized.
- **AP-08 technical review completed** (read-only). Cloudinary server-side signature/delete controls are blocked in UAT Safe Mode by inspected code; client direct-upload path exists but depends on signature issuance. Non-media custom-cake validation/honeypot/idempotency are testable without external upload; media upload remains blocked pending runtime isolation confirmation.
- **Origin/Referer compatibility review completed** (read-only). CSRF protects cookie-authenticated state-changing requests; anonymous custom-cake POST has no cookie-auth Origin enforcement; CORS allows no-origin and trusted origins. Strict enforcement is **not compatibility-safe** without inventory/testing.
- **WAF/CDN/trusted-proxy remains externally unverified.** Repo proves `trust proxy = 1` and app-level controls; edge topology requires infra access/evidence.
- **S05 provenance gap remains.** `docs/security/BLB-03U-S05-REMEDIATION-DESIGN.md` is missing (confirmed absent). No reconstruction performed.

## BLB-03M / AP-01 status

| Field | Value |
|---|---|
| Option A (exact) | Require guest **name, valid email, and phone** before progression from Customer details to fulfilment, with **field-specific validation errors** at step 1 (Continue). *(Source: `docs/uat/BLB-03-UAT-RESULTS.md`, BLB-03M decision record)* |
| Option B (exact) | Allow progression after **phone validation** (current step-1 behavior), with guest **name/email enforced during final order placement** (client-side final validation) and **backend validation** (authoritative). *(Source: `docs/uat/BLB-03-UAT-RESULTS.md`, BLB-03M decision record)* |
| Existing recommendation | Option A **RECOMMENDED — NOT CONFIRMED** (BLB-03T-R/BLB-03V/BLB-03U-R). |
| UX impact | Option A gives earlier step-1 field-specific feedback; Option B defers name/email feedback to final submit while preserving authoritative validation. |
| Implementation impact | Option A is a minimal checkout step-1 validation change (frontend), with focused e2e/browser regression; backend/final validation must remain authoritative. Option B requires no behavior change but leaves UX inconsistency unresolved. |
| Regression requirements | Guest checkout Customer details Continue, field-specific errors, step progression, fulfilment/schedule/payment preflight, final `handlePlaceOrder()`/backend validation, CUST-08/09/10-related flows. |
| Current decision status | **RECOMMENDED — NOT CONFIRMED**. No explicit internal decision evidence found. |
| Execution authorization | **NOT AUTHORIZED**. |

## AP-02–AP-10 / AP-16 decision status

| AP | Scope | Recommendation / technical evidence | Unresolved questions | Confirmation status | Execution authorization |
|---|---|---|---|---|---|
| AP-01 / BLB-03M | Guest checkout Continue UX | Option A recommended; exact options confirmed in UAT-RESULTS. | Explicit internal approver/date/option selection? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-02 | Synthetic customer/admin access, secure out-of-band credentials, least privilege | Required for CUST/ADM UAT; policy docs prepared. | Named testers/roles, secure delivery channel, revocation window? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-03 | Isolated UAT DB write permissions only on `127.0.0.1:27018/bluebell_whatsapp_uat` | Mandatory isolation boundary; no 27017/27019/Atlas/prod. | Approved collections/actions/window/operator/rollback per run? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-04 | Synthetic data provisioning/cleanup/rollback | Manifest, before/after evidence, cleanup required. | Data manifest owner, retention, cleanup verification? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-05 | Registration/OTP policy (CUST-11) | Technical review complete: split safe observable checks vs blocked OTP-receipt; no S02 weakening. | Accept split scope or formally defer CUST-11 completion? | **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED** | **NOT AUTHORIZED** |
| AP-06 | Guest checkout order submission (CUST-10) | Depends on AP-01/02/03/04/05/07/10 as applicable; isolated UAT only. | Final CUST-10 scenario and evidence path after dependencies? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-07 | Payment testing restrictions | No live Razorpay/real txns/webhooks; safe-mode boundaries documented. | Any approved non-live payment simulation scope? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-08 | Custom cake submission/media (CUST-14) | Technical review complete: non-media safe scope possible; Cloudinary signature/deletes blocked in UAT by code; direct client upload depends on signature; runtime isolation unverified. | Accept non-media CUST-14 scope and block media path? | **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED** | **NOT AUTHORIZED** |
| AP-09 | Admin workflow testing ADM-01–13 | Read-only first, mutating with rollback; least privilege. | Approved mutation matrix/case owners? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-10 | Notification/WhatsApp suppression expectations | Suppressed != sent/delivered; UAT Safe Mode blocks external providers. | Evidence wording/checklist acceptance? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |
| AP-16 | Synthetic data/credentials operational handling (as tracked) | Same control intent as AP-02/AP-04; no real creds/PII; out-of-band secure handling. | Confirm AP-16 owner mapping in execution records? | **RECOMMENDED — NOT CONFIRMED** | **NOT AUTHORIZED** |

## AP-05 technical findings and safe CUST-11 scope

See `docs/security/BLB-03W-AP05-OTP-TECHNICAL-REVIEW.md`.

- **Safe testable in UAT Safe Mode (if separately authorized):** registration validation, sendOtp suppression response (`uatSuppressed`, no OTP), cooldown/429 behavior, generic anti-enumeration responses, forgot-password generic behavior, no OTP disclosure.
- **Cannot be fully tested without real OTP delivery:** external OTP receipt and completion steps dependent on it.
- **CUST-11 split:** **Yes** — safe observable checks vs blocked OTP-receipt/completion checks.
- **Unsafe paths:** dev/test OTP-return shortcut, OTP disclosure, bypass/hardcoded OTP, real delivery, disabling safe mode.
- **Status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**; execution **NOT AUTHORIZED**.

## AP-08 technical findings and safe CUST-14 scope

See `docs/security/BLB-03W-AP08-CUSTOM-CAKE-MEDIA-TECHNICAL-REVIEW.md`.

- **Safe testable without external side effects (if separately authorized):** form validation, no-file submission, honeypot empty/filled behavior, idempotency replay/conflict/in-progress, consent handling as scoped; no Cloudinary upload/delete.
- **Cloudinary blocking in UAT Safe Mode:** server-side signature issuance and delete operations blocked/suppressed by inspected code; customer/admin signature endpoints return 403 in UAT Safe Mode.
- **Residual path:** client direct-to-Cloudinary upload code exists but requires backend signature; runtime isolation remains unverified.
- **CUST-14 safe scope:** non-media submission/validation/honeypot/idempotency only in isolated UAT with `UAT_SAFE_MODE=true`.
- **Blocked:** any real Cloudinary upload/delete/signature success, external media side effects, unverified environment.
- **Status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**; execution **NOT AUTHORIZED**.

## Origin/Referer compatibility findings

See `docs/security/BLB-03W-ORIGIN-REFERER-COMPATIBILITY-REVIEW.md`.

- **Current behavior:** CORS allows no-origin and trusted origins; disallowed origins get CORS denial behavior. CSRF enforces Origin only for cookie-authenticated state-changing requests; anonymous cookie-less requests pass through. Custom-cake POST is public/anonymous and not covered by cookie-auth CSRF Origin check.
- **Risk:** naive strict Origin/Referer enforcement could break legitimate absent-Origin/non-browser/unknown-origin flows. Referer unreliable.
- **Decision:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**. Do not enforce now.

## WAF/CDN/trusted-proxy evidence status

| Area | Status | Evidence |
|---|---|---|
| App trust proxy setting | **Proven by source code** | `backend/src/server.ts` sets `app.set("trust proxy", 1)`. |
| Process-local rate limiting / IP keying | **Proven by source code** | S03/S07 limiters use IP-based process-local limits; S05 dedupe process-local. |
| CORS/CSRF/app-level origin handling | **Proven by source code** | `server.ts`, `lib/origin.ts`, `middleware/csrf.ts`. |
| Actual edge/CDN/WAF/proxy topology, real client IP propagation, TLS/WAF rules | **Unverified / external access required** | No deployment infra evidence inspected. |
| Origin/Referer header preservation at edge | **Unverified** | Requires runtime/infra evidence. |

## S05 provenance recommendation

- **Observed gap:** `docs/security/BLB-03U-S05-REMEDIATION-DESIGN.md` is missing. Existing S05 assessment/remediation/report/test/code evidence exists.
- **Option A (recommended):** Accept missing historical design doc as a documented provenance gap; reference S05 assessment, remediation report, code, and tests as evidence.
- **Option B:** Commission a retrospective reconstruction **clearly labeled reconstructed** with source evidence, actual creation date, author, and known limitations. **Do not backdate.**
- **BLB-03W action:** No reconstruction created. Status **RECOMMENDED — NOT CONFIRMED**.

## Remaining internal decisions

1. BLB-03M/AP-01 Option A/B explicit internal confirmation (approver/date/scope/evidence).
2. AP-02/AP-03/AP-04/AP-06/AP-07/AP-09/AP-10/AP-16 explicit internal confirmations (scope/approver/date/evidence).
3. AP-05 decision: accept safe observable CUST-11 split and defer OTP-receipt completion, or approve another secure non-bypass path (no weakening).
4. AP-08 decision: accept non-media CUST-14 safe scope and block external media path until isolation evidence exists.
5. Decision 13 Origin/Referer: defer/investigate/enforce-after-compatibility with evidence.
6. Decision 14 WAF/CDN/trusted-proxy: obtain external infra evidence/access.
7. Decision 15 accessibility/browser smoke scope/authorization.
8. Decision 16 synthetic UAT data/credentials provisioning authorization (separate from policy).
9. Decision 17/18 CUST/ADM UAT execution authorizations (separate, gated).
10. Decision 19 production Go/No-Go — remains DEFERRED/NO-GO.
11. S05 provenance: Option A or B.

## Limitations

- Read-only documentation/code review only; no runtime execution, no DB access, no provider calls, no UAT.
- Prior test results cited from existing reports; not re-executed in BLB-03W.
- External infrastructure and production configuration are unverified.
- Dirty/untracked worktree preserved as-is.

## Recommendation

- **Next recommended milestone:** **BLB-03X — Internal Decision Confirmation Record & Execution Authorization Preparation (documentation/control only)**. Record explicit internal confirmations for BLB-03M and AP decisions where owners provide evidence; accept/defer AP-05 CUST-11 split and AP-08 non-media scope; record S05 provenance choice; prepare but do not sign execution authorizations. After BLB-03X confirmations, only separately authorized controlled operations may proceed (S07 UAT index precheck/rollout on `127.0.0.1:27018/bluebell_whatsapp_uat`, then scoped UAT runs).
- **Execution authorization status:** **NOT AUTHORIZED** for all operational actions.

**CURRENT RELEASE STATUS: NOT READY**