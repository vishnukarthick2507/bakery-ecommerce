# BLB-03U — S07 Remediation Design (Design Only)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (unchanged at design time)  
**Date:** 2026-11-21  
**Mode:** **Design only. No implementation. No source/test/config/env/dependency/deployment changes.**

> **Safety/compliance:** Read-only inspection only. Only this design document was created. No Git mutations. No DB writes, external provider calls, deployment, or service restarts. No secrets/credential values exposed. All pre-existing modified and untracked files preserved.

## 1. S07 original finding and current status

### Original finding (source of truth)
- **ID:** BLB-03T-S07 — “Public custom-cake submission endpoint accepts unauthenticated requests without dedicated rate limiting” (`docs/security/BLB-03T-SECURITY-REVIEW.md:112-122`).
- **Original severity:** Low.
- **Original status:** Confirmed (source inspection).
- **Original evidence:** `backend/src/routes/customCakeRoutes.ts:18` POST `/` had no auth/rate-limit middleware; `backend/src/controllers/customCakeController.ts:13-56,115-194` validated input, generated reference number, created request, optional best-effort WhatsApp consent capture; no ownership/auth requirement.
- **Original risk:** Public unauthenticated write-adjacent intake without endpoint-specific throttling can be abused for spam, storage growth, or operational noise/DoS attempts.

### Current status (revalidated 2026-11-21)
- **Narrow original gap (no dedicated rate limiting): mitigated by S03 P5.** Current route is `router.post("/", createCustomCakeRequestLimiter, createCustomCakeRequest);` (`backend/src/routes/customCakeRoutes.ts:14,18`). `createCustomCakeRequestLimiter` is 10 req/15 min/IP, draft-6 headers, process-local in-memory store (`backend/src/middleware/rateLimit.ts:236-249`). S03 report confirms P5 (`docs/security/BLB-03U-S03-RATE-LIMIT-REMEDIATION.md`).
- **Residual S07 concern: open (abuse-hardening).** BLB-03T line 150 states S07 remains open because broader anti-automation/abuse-hardening considerations may still apply despite P5. Step 6A read-only assessment (provided in conversation; `docs/security/BLB-03U-S07-READ-ONLY-ASSESSMENT.md` does **not** exist in repo) reached the same conclusion.
- **Discrepancy note:** BLB-03T title still says “without dedicated rate limiting”; current source has P5. Design is based on **current source** and treats rate limiting as existing protection, not a missing control to duplicate.

## 2. Project-owner decisions and scope constraints

Recorded as **project-owner design decisions** (not CTO/client approvals):

1. **Customer access:** Keep anonymous public custom-cake submissions. Do not require customer authentication.
2. **Anti-bot protection:** Use a honeypot/lightweight protection approach. Do **not** introduce CAPTCHA or Turnstile in this milestone.
3. **Duplicate protection:** Add carefully designed duplicate-submission protection. Design behavior and UX before implementation.
4. **Origin/Referer:** Review compatibility before enforcing. Do **not** assume a strict allowlist is safe without investigating actual frontend, deployment, and integration flows.

**Scope constraints:** Design only. No implementation, no code/test/config/env/dependency/deployment changes, no DB objects/indexes, no external provider calls, no Step 6C.

## 3. Current source evidence (revalidated)

| File:line | Evidence | Notes |
|---|---|---|
| `backend/src/routes/customCakeRoutes.ts:14,18` | `POST /` uses `createCustomCakeRequestLimiter, createCustomCakeRequest`; no auth. | Public by design. |
| `backend/src/middleware/rateLimit.ts:236-249` | P5: 15 min, limit 10, IP key `ipKeyGenerator(req.ip ?? "127.0.0.1")`, draft-6 headers, legacy off, 429 JSON message. | Process-local in-memory; not duplicated by this design. |
| `backend/src/server.ts:42` | `app.set("trust proxy", 1)` | IP keying depends on trusted proxy topology. |
| `backend/src/server.ts:60-83` (observed) | CORS uses trusted origins from `CORS_ORIGIN`; allows requests with no Origin (`!_origin` => allow). | CORS is not CSRF protection. |
| `backend/src/lib/origin.ts:21-47` | `normalizeOrigin` scheme+host; `getTrustedOrigins` from `CORS_ORIGIN`, fallback `http://localhost:3000`. | Production origins unverified from repo. |
| `backend/src/middleware/csrf.ts:17-24,45-64` | CSRF validates Origin for cookie-authenticated state-changing requests; requests without auth cookies exempt. | Anonymous custom-cake POST is cookie-less in normal case, so CSRF exemption applies by design. |
| `backend/src/controllers/customCakeController.ts:13-56` | Zod schema bounds fields: name 2-100, Indian 10-digit phone, flavour 2-100, weight 0.1–5kg, theme 2-200, messageOnCake <=200, instructions <=1000, referenceImageUrl URL<=500 or empty, optional `whatsappConsent` boolean. | Strong input validation present. |
| `backend/src/controllers/customCakeController.ts:115-194` | Validates, creates `CustomCakeRequest` with retry on duplicate referenceNumber (5 attempts), best-effort `grantConsent` when `whatsappConsent && phone`, returns 201 with limited fields; catch logs error and returns generic 500. | DB write + optional consent side effect. No honeypot, no dedupe key. |
| `backend/src/models/CustomCakeRequest.ts` | Required trimmed fields; `referenceNumber` unique; status/customerConfirmed enums; adminNotes maxlength 1000; timestamps. | No schema max lengths for most strings (Zod covers request path). |
| `components/custom-cake/custom-cake-form.tsx:64-328,847-853` | Multi-step form; client-side validation; disables submit while `submitting || referenceUploading`; submits once via `submitCustomCakeRequest`; on success shows reference number. | Client prevents accidental double click in normal UI; no idempotency key, no honeypot. |
| `lib/api/index.ts:222-250` | `submitCustomCakeRequest` POSTs JSON to `/api/custom-cake-requests`, no auth header/idempotency key, generic network error handling. | No retry/idempotency semantics. |
| `components/home/custom-cake-section.tsx` | Marketing section links to `/custom-cake` / WhatsApp; no direct submission form. | Not a submission entry point. |
| `backend/tests/customCakeRateLimit.s03.test.ts` | Confirms P5 threshold/429/body/headers/isolation. | Existing coverage for rate limit. |
| `backend/tests/customCake.test.ts` | Exists (modified in worktree; spot check showed auth tests for other routes). | POST/create abuse-path coverage should be reviewed/extended during Step 6C. |
| `tests/e2e/custom-cake-form-navigation.spec.ts`, `tests/e2e/stage4-custom-cake-workflow.spec.ts` | E2E custom-cake specs exist. | Compatibility/regression candidates for Step 6C. |

## 4. Existing protections (including S03 P5)

- **S03 P5 rate limit:** 10 requests/15 min/IP on public POST, independent in-memory limiter, draft-6 headers, 429 JSON. **Keep as-is; do not duplicate.**
- **Zod request validation:** strict field bounds, phone regex, weight range, URL max length, optional boolean.
- **Generic errors:** 500 message generic; server-side console error logging.
- **Reference number uniqueness retry:** 5 attempts on duplicate `referenceNumber`.
- **Consent side effect constrained:** only on explicit `whatsappConsent`; best-effort; no block on request creation failure.
- **Auth on sensitive routes:** admin/customer/ownership checks for non-public custom-cake endpoints.
- **CSRF for cookie-auth requests:** cookie-auth state-changing requests validated; anonymous cookie-less requests exempt by design.
- **CORS allowlist:** configured trusted origins; no-origin allowed by CORS middleware (browser CORS is not a server-side CSRF control).

## 5. Honeypot design and UX

### Goal
Add a lightweight, accessible, server-validated honeypot to reduce low-effort automated submissions without CAPTCHA/Turnstile and without blocking legitimate customers.

### Recommended design
- **Field:** Add an optional form field named with a plausible but non-user-facing name, e.g. `companyWebsite` (final name to be chosen during implementation to avoid common autofill collisions; avoid `email`, `name`, `phone`). Do not use a name that advertises “honeypot”.
- **Frontend placement/UX:** Render in the DOM inside the form but visually hidden and removed from normal interaction. Use a wrapper that is `aria-hidden="true"`, `tabindex={-1}` on input, `autoComplete="off"` (and consider a nonstandard autocomplete token only if tested; do not rely on it for security). Do not place it adjacent to real fields in a way that confuses keyboard users. Ensure it is not focusable by keyboard tab order. Do **not** rely on `display:none` alone as the only signal; use a combination of offscreen/hidden presentation and server-side validation.
- **Accessibility:** Because the field is hidden from assistive tech (`aria-hidden` on container and not labelled as a real user field), it should not be announced. Implementation must be manually checked with keyboard-only and screen-reader smoke tests. If any accessibility risk is found, prefer a time-to-complete/lightweight behavioral check alternative in a revised design (but not CAPTCHA).
- **Server-side validation:** Treat the honeypot as optional in Zod schema for backward compatibility during rollout? Prefer strict: accept field as optional string; if present and non-empty after trim, classify as automated/spam signal. Client hiding is **not** security. Server must validate regardless of client behavior.
- **Abuse classification response:** **Recommended: controlled rejection with generic 400/422-style response** (e.g., same generic “Unable to submit your request...” or a neutral validation-style response) rather than fake success. Rationale: fake success can confuse legitimate users affected by autofill/browser extensions and creates support ambiguity; generic rejection avoids exposing honeypot logic while keeping behavior observable. Alternative (silent 200 fake success) may be considered only if product accepts false-positive UX risk; not recommended as default.
- **No side effects on abuse:** When honeypot triggers, do **not** create `CustomCakeRequest`, do **not** call `grantConsent`, do **not** log raw PII/cake instructions.
- **Logging/monitoring:** Log a structured, PII-minimal event (e.g., `custom_cake.honeypot_triggered`, timestamp, coarse outcome, requestId/correlation id if available, no phone/name/message/instructions/image URL). Rate-limit metrics can count triggers.
- **Autofill/browser-extension resilience:** Choose field name/attributes to reduce autofill; accept that some legitimate false positives are possible. Provide clear generic error and preserve form state client-side so user can retry. Include an implementation note to monitor false-positive rate before tightening.

### Honeypot test cases (Step 6C)
| Case | Expected |
|---|---|
| Normal submission, honeypot absent/empty | Normal 201 flow, request created. |
| Honeypot present with empty/whitespace | Treated as empty; normal flow. |
| Honeypot filled | No DB create, no consent, no provider call; generic controlled rejection; minimal log event. |
| Honeypot malformed type (array/object/very long) | Validation handles safely (400 or generic rejection); no crash; no DB side effect. |
| Keyboard-only/screen-reader smoke | No focus trap/confusing announcement; form remains submittable. |
| Browser autofill regression | Monitor/manual test; legitimate user can correct and submit. |

## 6. Duplicate-submission design and race handling

### Problem
Current frontend disables submit button during in-flight request, but users can refresh, double-click across tabs/devices, retry after network timeout, or automated scripts can replay. Backend has no idempotency/dedupe key; each accepted request creates a new `CustomCakeRequest` and may attempt consent capture.

### Options compared

| Option | Summary | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A. Client-generated idempotency key** | Frontend generates UUID per submission attempt; sends as header/body field; backend stores key with TTL and enforces uniqueness. | Precise for accidental retries/timeouts; no phone-based inference; supports safe retry. | Requires storage (new collection/index/model or equivalent) and careful TTL/race handling; client must persist key for retry of same attempt. | **Recommended** as primary mechanism. |
| **B. Short-lived payload/phone fingerprint cooldown** | Hash normalized phone + key payload/time bucket; reject duplicates within window. | Simple concept. | Risks blocking legitimate different requests or exposing behavioral inference; fingerprinting/PII concerns; hard to tune. | Not recommended as primary. |
| **C. Phone+normalized payload cooldown** | Block same phone+similar payload for X minutes. | Can reduce spam. | Privacy/UX risk, false positives, race complexity, leaks “already submitted” semantics if mishandled. | Avoid. |
| **D. Existing DB uniqueness** | Reuse referenceNumber unique. | Already exists. | Only prevents referenceNumber collision, not duplicate submissions. | Not sufficient. |

### Recommended design (Option A + UX guard)
- **Primary:** Client-generated idempotency key (UUID v4/random) created when user enters Review/submit attempt and reused for retries of the same submission attempt. Sent in a dedicated field/header (e.g., `Idempotency-Key` header or `idempotencyKey` body field - final choice during implementation; header preferred for clarity). 
- **Server behavior:** If key seen with same normalized payload fingerprint/hash and request completed, return the original 201 response payload (safe replay) **without** creating a second request or re-running consent side effects. If key seen with different payload, return 409/conflict-style generic error. If in-progress, handle with atomic claim/lock to avoid concurrent duplicates.
- **No login required.** Key is per submission attempt, not per account.
- **No phone existence disclosure.** Responses must not say “phone already has request”.
- **Different cake request allowed:** New submission attempt generates a new idempotency key; legitimate different requests are unaffected.
- **Race handling:** Use atomic insert/unique key on dedupe record (future implementation) or transactional claim. On duplicate-key insert race, read existing record: if same payload hash and completed, return stored response; if in-progress, return controlled 409/processing response with retry-after guidance; if different payload, 409.
- **Failure behavior:** If DB write succeeds but response lost, same idempotency key replay returns original result. If dedupe store unavailable, fail closed for duplicate protection? Prefer fail open to availability only with explicit risk acceptance, or fail closed with generic 503 - **project-owner decision required**; default recommendation: fail closed for the specific dedupe check with generic 503 and server log, because duplicate request/consent side effects are worse than occasional submission friction.
- **Expiry/retention:** Short TTL (e.g., 24 hours) for dedupe records; enough for retry/replay window, not long-term PII storage. Store only key, payload hash, status, minimal response snapshot (referenceNumber/id), timestamps.
- **Data minimization:** Do not store raw form payload or raw PII in dedupe record. Payload hash should be over normalized non-sensitive-equivalent fields where possible; if phone included in hash input, hash with server-side secret pepper and treat as sensitive internal data with TTL. Avoid logging raw key with PII.
- **UX:** On network timeout/error, client keeps same idempotency key for retry button; on “submit another request”, generate new key. Show clear generic message: “If you already submitted this request, please check your reference number or wait before retrying.”
- **Frontend current state:** Form currently prevents double click while submitting (`submitting` guard, disabled button). No idempotency key/retry persistence.

### Duplicate-protection test cases (Step 6C)
| Case | Expected |
|---|---|
| Same idempotency key + same payload replay after success | Same 201 response/referenceNumber; no second DB record; no second consent capture. |
| Same idempotency key + different payload | 409/generic conflict; no overwrite. |
| Concurrent identical requests same key | Exactly one CustomCakeRequest created; both return safe outcome. |
| Different idempotency key, same phone/payload | Allowed as separate attempt only if product decides; default: allowed (different attempt) but P5 still limits abuse. |
| Missing idempotency key during rollout | Backward-compatible: accept and process (or generate server-side fallback) — decision needed. |
| Dedupe store error | Generic 503/fail-closed behavior as approved; no duplicate side effect. |
| TTL expiry | After TTL, new request treated normally; old key not retained. |

## 7. Origin/Referer compatibility findings and recommendation

### Findings
- **CORS:** `backend/src/server.ts` allows no-origin requests and allows origins from `getTrustedOrigins()` (`CORS_ORIGIN`, fallback `http://localhost:3000`) (`backend/src/lib/origin.ts`). CORS controls browser cross-origin reads, not server-side request acceptance.
- **CSRF:** `csrfProtection` exempts requests without auth cookies (`backend/src/middleware/csrf.ts:58-64`). Anonymous custom-cake POST is normally cookie-less; therefore CSRF Origin check is currently not applied to it. This is by design but means cross-site anonymous submission is technically possible.
- **Frontend flow:** Next.js frontend submits same-origin to `/api/custom-cake-requests` via `fetch` (`lib/api/index.ts:225-229`). In local dev, frontend likely `localhost:3000` and backend `localhost:5000` with proxy or direct CORS config - **deployment topology unverified**.
- **Trusted origins config:** `.env.example` has `NEXT_PUBLIC_API_URL=http://localhost:5000`; `backend/.env.example` has `CORS_ORIGIN=http://localhost:3000`. Production/staging/UAT origins are **unverified**.
- **Non-browser/absent Origin:** CORS currently allows no Origin. Any strict Origin allowlist on endpoint would break legitimate non-browser clients, server-to-server calls, health checks? (not applicable), or integrations if they exist. No embedded/external client evidence found in repo; **unverified**.
- **Referer:** Less reliable than Origin; can be absent due to privacy/referrer-policy.

### Recommendation
- **Do not enforce strict Origin allowlist now.** Compatibility is unverified (production origins, UAT, possible non-browser/embedded flows).
- **Recommended Step 6C-compatible design:** conditional browser-origin check as defense-in-depth only when Origin is present and request appears browser-like; if Origin present and not in trusted allowlist, reject with generic 403. If Origin absent, **do not hard-fail by default** until deployment/integration inventory confirms safe. Log absent-origin rate for monitoring.
- **Do not confuse CORS with CSRF.** CORS remains response-header policy; endpoint-level Origin check would be request acceptance control.
- **Before any enforcement:** verify Render/Vercel/CDN/proxy topology, actual frontend origins, UAT origins, mobile/embedded/API consumers, and whether legitimate clients omit Origin.

## 8. Operational verification checklist

| Check | Why | Evidence needed | Status |
|---|---|---|---|
| Actual proxy/CDN/WAF topology (Render/Vercel/Cloudflare/etc.) | `trust proxy = 1` and IP limiter correctness depend on it | Deployment config/runbook/screenshot | Unverified |
| `req.ip` trustworthiness in production | P5 keyed by IP | Observed request logs / header chain review | Unverified |
| Multiple instances/restarts | Process-local limiter resets and is per-instance | Render/service scaling config | Unverified |
| WAF/bot/edge rate limiting | Compensating control for R2 | WAF/dashboard/config evidence | Unverified |
| Abuse monitoring capability | Detect spam spikes without PII logging | Log sink/alerting config | Unverified |
| Alert thresholds (conceptual) | Trigger review on abnormal volume | Define after baseline: e.g., spikes in 429s, honeypot triggers, dedupe conflicts, 5xx on custom-cake POST; no invented prod metrics | Unverified |
| PII-safe logging | Avoid phone/name/message/instructions/image URL in abuse logs | Log schema/review | Design requirement |

## 9. Proposed source/test files for future Step 6C implementation

**Potential source files (exact set depends on approved design):**
- `backend/src/controllers/customCakeController.ts` — honeypot validation, dedupe/idempotency handling, safe logging.
- `backend/src/routes/customCakeRoutes.ts` — possible middleware ordering (no P5 duplication).
- `backend/src/middleware/rateLimit.ts` — only if limiter config message/behavior needs adjustment (avoid unnecessary change).
- `backend/src/models/CustomCakeRequest.ts` — no change expected for honeypot; dedupe may require separate model/collection (approval needed).
- `backend/src/models/*` or new dedupe model — only if idempotency-key design approved.
- `backend/src/services/*` — optional dedupe/abuse-log helper.
- `components/custom-cake/custom-cake-form.tsx` — honeypot field, idempotency key generation/retry UX, accessibility checks.
- `lib/api/index.ts` — send idempotency key/header; handle conflict/replay responses.
- `backend/tests/customCake.test.ts`, `backend/tests/customCakeRateLimit.s03.test.ts` — extend coverage.
- New focused tests e.g. `backend/tests/customCakeAbuseProtection.s07.test.ts` (name TBD).
- E2E specs `tests/e2e/custom-cake-form-navigation.spec.ts`, `tests/e2e/stage4-custom-cake-workflow.spec.ts` as needed.

## 10. Detailed test matrix (Step 6C)

| ID | Area | Scenario | Expected | Type |
|---|---|---|---|---|
| T1 | Baseline | Valid anonymous custom-cake submission | 201, request created, referenceNumber returned, no auth required | Integration |
| T2 | P5 | 11th request within window from same IP | 429, existing message/headers; no extra request created | Integration |
| T3 | Honeypot | Empty/missing honeypot | Normal success | Integration |
| T4 | Honeypot | Filled honeypot | Generic rejection; no CustomCakeRequest; no grantConsent; no PII-heavy log | Integration |
| T5 | Honeypot | Malformed honeypot type/oversized | Safe 400/generic rejection; no crash | Integration |
| T6 | Duplicate | Same idempotency key same payload replay | Same success response; no duplicate DB record; no duplicate consent | Integration |
| T7 | Duplicate | Same key different payload | 409/generic conflict; no overwrite | Integration |
| T8 | Duplicate | Concurrent same-key requests | One record; no double side effects | Integration/concurrency |
| T9 | Duplicate UX | Network retry after timeout uses same key | No duplicate request created | Frontend/E2E/mock |
| T10 | Validation | Existing Zod bounds still enforced | 400 with field errors as before | Regression |
| T11 | Consent | `whatsappConsent=true` legitimate submission | Consent capture attempted best-effort; no duplicate on replay | Integration |
| T12 | Origin/Referer | No Origin header (if conditional policy) | Behavior matches approved design; legitimate non-browser not broken if deferred | Integration |
| T13 | Origin/Referer | Disallowed Origin (if enforced) | Generic 403; no DB side effect | Integration |
| T14 | A11y | Honeypot field keyboard/screen-reader smoke | Not focusable/announced confusingly; form usable | Manual/E2E a11y smoke |
| T15 | Regression | Admin/customer custom-cake routes | Existing auth/ownership behavior unchanged | Integration |
| T16 | Observability | Honeypot/duplicate/rate-limit events | Structured minimal logs/metrics, no raw PII | Unit/integration |

## 11. Security, privacy, accessibility, and compatibility risks

- **Security:** Honeypot bypassable by sophisticated bots; dedupe key misuse/race bugs could cause duplicate or lost submissions; Origin checks can be spoofed by non-browser clients.
- **Privacy:** Dedupe fingerprints/logs could accidentally capture phone/payload PII; must minimize/hash/TTL. No phone existence disclosure.
- **Accessibility:** Hidden honeypot can harm screen-reader/keyboard users if implemented poorly; must be aria-hidden, non-focusable, and smoke-tested.
- **Compatibility:** Strict Origin/Referer enforcement may break legitimate flows; idempotency-key requirement can break old clients if not backward-compatible; duplicate replay semantics must not surprise users.

## 12. Rollout and rollback plan

### Rollout (Step 6C, after approval)
1. Implement honeypot + server validation (no side effects on trigger) with feature flag/config guard if feasible.
2. Implement idempotency/dedupe with backward-compatible missing-key behavior (if approved).
3. Add structured PII-minimal logging/metrics.
4. Run focused tests, relevant regressions, typecheck, and full backend suite as practical.
5. Staged deploy: monitor 429 rate, honeypot triggers, dedupe conflicts, submission success rate, 5xx.

### Rollback
- Disable honeypot/dedupe checks via config/flag or revert commit; keep P5 intact.
- Do not roll back P5.
- If dedupe collection added, retain data per TTL; no destructive cleanup without approval.

## 13. Residual risks and explicitly unverified assumptions

- **Unverified:** production/staging/UAT frontend origins; embedded/non-browser API consumers; Render/proxy/CDN/WAF topology; `req.ip` trustworthiness; instance scaling/restarts; actual abuse volume.
- **Residual:** distributed bot abuse across IPs can still pass P5+honeypot; process-local limiter not globally consistent; honeypot false positives possible; dedupe storage outage behavior needs explicit decision; Origin absent remains ambiguous until inventory complete.
- **No CAPTCHA/Turnstile by owner decision** limits anti-bot strength.

## 14. Exact acceptance criteria for Step 6C

Step 6C may be considered complete only when:
1. Explicit implementation approval is recorded (project owner/governance as required).
2. Honeypot implemented as accessible, server-validated, no-side-effect-on-trigger, no PII-heavy logging.
3. Duplicate-submission protection implemented per approved design with race handling, TTL, and privacy-safe UX; no phone-existence disclosure.
4. P5 remains unchanged and effective; no duplicate rate limiter added.
5. Origin/Referer handling follows approved compatibility decision; no unverified strict allowlist enforced.
6. Focused + relevant regression tests pass; backend typecheck passes; full backend suite run and actual result recorded.
7. S07 remediation report/design-status docs updated with exact evidence; master security review updated only as authorized.
8. No historical data migration/cleanup without approval; no external provider calls; no deployment unless separately authorized.

## 15. Approval required before implementation

**Project-owner decisions above authorize design only.** Before Step 6C implementation, obtain explicit implementation approval confirming: honeypot rejection vs fake-success behavior, idempotency-key rollout/backward-compatibility, dedupe store failure mode (fail-open vs fail-closed), Origin/Referer enforcement mode, and any new storage/index/model creation. Do not implement without that approval.