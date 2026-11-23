# BLB-03W — AP-08 Custom Cake / Media Technical Review

**Date:** 2026-11-21  
**Scope:** Read-only technical review of AP-08 / CUST-14 custom-cake submission and media/upload behavior under UAT Safe Mode. Documentation/review only; no code/config/test/env changes and no operational execution.  
**Confirmation status:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**  
**Execution authorization status:** **NOT AUTHORIZED**

## Files inspected

- `docs/release/BLB-03V-INTERNAL-CONFIRMATION-REGISTER.md`
- `docs/release/BLB-03T-R-INTERNAL-DECISION-REGISTER.md`
- `docs/release/BLB-03U-R-UAT-READINESS-PLAN.md`
- `docs/uat/BLB-03U-R-CUSTOMER-UAT-RUNBOOK.md`
- `docs/uat/BLB-03U-R-S07-UAT-INDEX-ROLLOUT-RUNBOOK.md` (boundary/context)
- `docs/UAT_SAFE_MODE.md`
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md`
- `backend/src/controllers/customCakeController.ts`
- `backend/src/routes/customCakeRoutes.ts`
- `backend/src/routes/customerUploadRoutes.ts`
- `backend/src/controllers/uploadController.ts`
- `backend/src/services/cloudinary.ts`
- `backend/src/config/uatSafeMode.ts`
- `backend/src/models/CustomCakeRequest.ts` (referenced by controller/tests; schema behavior partially observed through controller usage)
- `backend/src/models/CustomCakeSubmissionIdempotency.ts` (referenced; S07 report evidence)
- `components/custom-cake/custom-cake-form.tsx`
- `lib/api/index.ts`
- `lib/upload.ts`
- `backend/tests/customCakeAbuseProtection.s07.test.ts`
- `backend/tests/customerUpload.test.ts`, `backend/tests/upload.test.ts`, `backend/tests/uatSafeMode.test.ts` (referenced by grep/prior evidence; not re-run)

## Findings (observed vs. assumption)

### Observed

1. **Custom cake submission endpoint remains public/anonymous by design** (`backend/src/routes/customCakeRoutes.ts`, `backend/src/controllers/customCakeController.ts`). S03 P5 rate limiter remains on POST; no auth required.

2. **S07 controls in place** (`customCakeController.ts`, S07 report/design).
   - Honeypot `companyWebsite`: filled non-empty => generic 400, PII-minimal log, no request create, no WhatsApp consent side effect.
   - Idempotency: optional key (`Idempotency-Key` header or body `idempotencyKey`), pattern `[A-Za-z0-9_-]{8,128}`; missing key backward compatible. Same key+same payload replay returns stored 201; different payload 409; in-progress 409; storage failure 503 with no unsafe create fallback; recovery uses `createdRequestId`.
   - Fingerprint uses HMAC-SHA256 with `JWT_SECRET`; no raw PII stored in idempotency record.

3. **Reference image handling is URL-based, not server-side Cloudinary upload in create request** (`customCakeRequestSchema`: `referenceImageUrl` accepts URL/max 500 or empty; controller stores `requestData.referenceImageUrl` as submitted). No server-side fetch/download/upload of the reference image occurs in `createCustomCakeRequest`.

4. **Client-side custom-cake media flow** (`components/custom-cake/custom-cake-form.tsx`, `lib/upload.ts`).
   - Form allows selecting image file (JPG/PNG/WebP, <=5MB), preview, optional upload click, and optional reference image URL input.
   - On submit, if file selected and not yet uploaded, it attempts `uploadReferenceFile()` which calls `fetchUploadSignature('/api/customer/uploads/signature')` then `uploadFileToCloudinary(...)` direct to `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`.
   - Upload failure handling: if auth/sign/login/unauthor message, sets error "Reference photo upload requires sign-in. You can continue without a photo or add an image URL."; otherwise sets upload error message. Submit flow catches upload failure as non-fatal and can continue without uploaded URL if no secure URL obtained (observed code path: it only sets `referenceImageUrlToSubmit` on secure URL; otherwise continues).
   - Honeypot field is rendered offscreen with `aria-hidden`, `tabIndex=-1`, `autoComplete="off"`.
   - Idempotency key is generated/reused per payload signature for retries.

5. **Cloudinary/UAT Safe Mode server controls** (`backend/src/services/cloudinary.ts`, `backend/src/controllers/uploadController.ts`, `backend/src/routes/customerUploadRoutes.ts`).
   - `getUploadSignature` throws in UAT Safe Mode: "External upload operations are blocked in UAT_SAFE_MODE." and logs suppression.
   - `deleteAsset` in UAT Safe Mode logs suppression and returns `{ result: "suppressed_uat_safe_mode", deleted: false }`.
   - Admin upload signature endpoint `POST /api/admin/uploads/signature` requires admin auth; in UAT returns `403` with `UAT_SAFE_MODE_EXTERNAL_BLOCKED` before config/signature.
   - Customer upload signature endpoint `POST /api/customer/uploads/signature` requires `authenticateCustomer`; in UAT returns `403 UAT_SAFE_MODE_EXTERNAL_BLOCKED` before config/signature.
   - Direct browser upload to Cloudinary requires a signature from backend; UAT blocks signature issuance. However, the client `uploadFileToCloudinary` itself performs an external HTTPS POST to Cloudinary if invoked with a signature. Obtaining a signature in a real UAT-safe environment should be impossible by design; this is a key control point.

6. **UAT Safe Mode doc** states Cloudinary external upload signature generation and destructive media operations blocked in UAT mode.

### Assumptions / unverified

- **Unverified:** Runtime behavior of anonymous custom-cake reference-photo upload attempt in UAT (expected: customer signature endpoint returns 401/403 depending on auth/UAT state; form should fall back to non-fatal path). No runtime test executed.
- **Unverified:** Whether any other code path can generate Cloudinary signatures or perform server-side Cloudinary uploads/deletes outside inspected controllers/services.
- **Unverified:** Whether referenceImageUrl user-supplied external URLs are considered acceptable in UAT data policy (they do not trigger Cloudinary upload by backend, but are external references).
- **Unverified:** Production/staging Cloudinary credentials/configuration isolation.
- **Assumption:** Browser-side direct Cloudinary upload cannot occur without backend-issued signature; this is consistent with inspected code.

## Answers to required review questions

1. **Which custom cake behaviors are testable without external side effects?**
   - Form validation (required fields, phone/weight/theme/reference URL format constraints as implemented).
   - Honeypot empty/absent submission path (normal behavior).
   - Honeypot filled rejection behavior (generic 400, no side effect) — testable via API/UI in isolated UAT with authorization.
   - Idempotency missing-key backward compatibility, same-key same-payload replay, same-key different-payload conflict, in-progress conflict — as permitted in isolated UAT DB scope.
   - Submission without reference photo and without external upload.
   - Reference image URL field validation (format) without uploading file to Cloudinary.
   - Consent flag handling as already covered by S07/local tests (subject to UAT scope/authorization).

2. **Does the application block or suppress Cloudinary operations in UAT Safe Mode?**
   - **Yes, for server-controlled Cloudinary operations inspected:** `getUploadSignature` throws/blocked; `deleteAsset` suppressed; admin/customer upload signature endpoints return 403 `UAT_SAFE_MODE_EXTERNAL_BLOCKED` when UAT safe mode blocks external side effects. This prevents backend issuance of upload signatures in UAT Safe Mode.

3. **Is any upload path still capable of reaching an external provider?**
   - **Client direct upload path exists by design** (`lib/upload.ts` posts directly to Cloudinary API). It requires a valid signature object. In UAT Safe Mode, signature endpoints should block issuance (observed). Therefore, the external Cloudinary upload should be unreachable in properly configured UAT Safe Mode, **but this is a control dependency** on signature blocking and environment correctness. A misconfigured environment, leaked signature, or non-UAT environment could still permit direct client upload. This is a **technical review finding requiring confirmation**, not a claim of runtime verification.

4. **Can form validation, honeypot and idempotency be tested without media upload?**
   - **Yes.** These behaviors do not require Cloudinary media upload. Media upload can be avoided by not selecting/uploading a file and not providing a Cloudinary-dependent flow.

5. **What exact CUST-14 scope is safe?**
   - **Recommended safe CUST-14 scope (if separately authorized):** isolated UAT `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`, synthetic data only. Test form load/validation, submit without reference file, honeypot-empty normal path, idempotency replay/conflict/in-progress as approved, consent behavior as approved, confirmation/reference number display. **Exclude** file selection/upload to Cloudinary, external media URL fetches, and any provider operation. ReferenceImageUrl manual external URL entry should be either excluded or explicitly risk-reviewed (no backend upload, but external reference).

6. **What remains blocked pending confirmed media isolation?**
   - Any actual Cloudinary upload/delete/signature success path.
   - Any test requiring real image upload to Cloudinary or verification of stored Cloudinary asset.
   - Any flow where environment/configuration cannot prove UAT Safe Mode signature blocking.
   - Public anonymous custom-cake file upload UX path in UAT until runtime confirmation shows no external request is possible/made.

## Recommendation

- **AP-08 status recommendation:** **TECHNICAL REVIEW COMPLETE — DECISION REQUIRED**. Keep **RECOMMENDED — NOT CONFIRMED / TECHNICAL REVIEW REQUIRED**.
- **CUST-14 safe scope:** allow non-media submission/validation/honeypot/idempotency checks only under isolated UAT, `UAT_SAFE_MODE=true`, explicit authorization, synthetic data, and no-provider-side-effect controls. Treat media upload/external Cloudinary path as **BLOCKED** until runtime isolation is evidenced in an approved UAT run.
- Do not authorize Cloudinary credentials/use, external uploads, or media deletion.

## Limitations

- Read-only inspection only; no runtime UAT, no browser execution, no Cloudinary calls, no DB operations.
- Test files referenced by name from repo/prior evidence; not re-executed in BLB-03W.
- Frontend direct-upload behavior depends on runtime/env; control effectiveness requires authorized runtime verification.