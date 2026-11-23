# BLB-03U — Step 4A S05 Read-Only Security Assessment

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (unchanged)  
**Assessment date:** 2026-11-20  
**Mode:** Read-only assessment only — **no implementation, no source/test/config/env/dependency changes, no Git mutations, no service/database/provider operations**

> **Safety/compliance:** Branch/HEAD verified and unchanged. Pre-existing modified/staged/untracked work preserved; previous S04 changes remain present. This assessment is based on static source inspection and existing repository artifacts only. No secrets or credential values were read, printed, exposed, or reproduced. No real admin login attempts, no external provider calls, and no production/UAT database operations were performed. **No implementation occurred.**

## 1. Original S05 finding (BLB-03T baseline)

From `docs/security/BLB-03T-SECURITY-REVIEW.md` (S05, Low, Confirmed, source inspection):

- **Finding:** PII/operational detail exposure in admin login alerts and diagnostic/error logging patterns; admin login alert deduplication uses in-memory state.
- **Original cited locations:** `backend/src/controllers/authController.ts:118-126` (passes `ipAddress` and `userAgent` to admin login alert), `backend/src/services/emailService.ts:234-304` (`sendAdminLoginAlert` includes username/UTC time/IP/browser-device in alert email; dedupe in-memory only `305-333`), and representative logging patterns elsewhere.
- **Original concerns:** IP/user-agent are personal/operational data; logs/alerts may accumulate sensitive context; in-memory dedupe is process-local/time-windowed and can be bypassed across restarts/instances, increasing alert volume/noise.

**Assessment focus (this step):** admin login alert implementation/logging/privacy exposure and in-memory deduplication reliability, with authentication/security boundary and test coverage review. Broad unrelated diagnostic/error logging patterns are referenced only where directly relevant to S05.

## 2. Actual implementation and call graph (confirmed, source inspection)

### 2.1 Entry point and authentication flow
- **Route:** `POST /api/auth/login` → `adminLoginLimiter`, `adminLogin` (`backend/src/routes/authRoutes.ts:84`, limiter defined `backend/src/middleware/rateLimit.ts:14-26`, 15m/10 per IP, standard draft-6 headers).
- **Controller:** `adminLogin` in `backend/src/controllers/authController.ts:65-142`.
  - Validates body with Zod (`username`/`password` required trimmed strings; `:52-55`, parse `:70-78`).
  - Looks up admin by username with password selected (`:82-85`), returns generic `401 {"message":"Invalid credentials"}` if not found (`:86-91`) or password invalid (`:93-103`).
  - On success: signs JWT with `adminId`, `username`, `role`, `tokenVersion` (`:105-114`), sets httpOnly admin cookie (`:116`, `setAdminTokenCookie :16-25`), triggers admin login alert best-effort (`:118-126`), returns `200` with success message and non-sensitive admin fields (`id`, `username`, `role`) (`:128-135`).
  - On exception: logs `console.error("Admin login failed:", error)` and returns `500 {"message":"Unable to login"}` (`:136-141`).

### 2.2 Alert trigger and call graph
- **Trigger condition:** only after successful credential validation/JWT issuance/cookie set, and only if request has an `id` (`authController.ts:118-119`). `requestIdMiddleware` assigns a random 16-byte hex ID and sets `X-Request-ID` for every request (`backend/src/middleware/requestId.ts:15-27`), registered early in server middleware chain (`backend/src/server.ts:54`).
- **Call:** `void sendAdminLoginAlertOnce(requestId, { username: admin.username, occurredAt: new Date(), ipAddress?: req.ip, userAgent?: req.get("user-agent") }).catch(() => undefined)` (`authController.ts:120-126`).
  - Uses `req.ip` (Express; server sets `trust proxy = 1`, `backend/src/server.ts:42`) and `User-Agent` header when present.
  - Deduplication key passed is the **request ID** (per-request unique), not account/IP/event-type key.
  - Alert dispatch is fire-and-forget relative to response path (`void` + `.catch`), and `sendAdminLoginAlertOnce` internally catches errors; login success is not blocked by alert delivery failure.

### 2.3 Alert delivery and logging implementation
- **`sendAdminLoginAlertOnce`** (`backend/src/services/emailService.ts:313-333`): process-local in-memory dedupe check/add around `sendAdminLoginAlert`; returns `false` for empty/blank event ID or if already seen; on successful send (`sent === true`) records event ID and schedules deletion after 15 minutes; on thrown error returns `false` without affecting caller flow. JSDoc states suppression is per request event within process and best-effort; durable cross-process guarantees require persisted ledger/outbox (`:308-312`).
- **Dedupe state:** module-scope `const sentAdminLoginAlertEvents = new Set<string>()` and `const ADMIN_ALERT_DEDUPE_WINDOW_MS = 15 * 60 * 1000` (`:305-306`). Expiry uses `setTimeout(...).unref?.()` per recorded event (`:326`). No max-size bound/cap/eviction policy beyond expiry timers.
- **`sendAdminLoginAlert`** (`backend/src/services/emailService.ts:229-304`): best-effort email notification.
  - UAT suppression: if `isUatExternalSideEffectsBlocked()` returns true, logs `logUatSuppressed("email.admin_login_alert")` and returns `false` (`:235-238`). `isUatExternalSideEffectsBlocked()` delegates to strict UAT-safe-mode parsing (`backend/src/config/uatSafeMode.ts:174-176,38-39`); `logUatSuppressed` emits console info only when UAT safe mode enabled and redacts context keys containing `secret/token/password/uri/authorization` (`backend/src/services/uatSafetyLog.ts:3-14`).
  - Recipient/config gating: requires non-empty `ADMIN_NOTIFICATION_EMAIL` env var and valid email parse; requires Brevo configured (`isBrevoConfigured()`); otherwise returns `false` (`:240-244`). No explicit log when recipient missing/invalid in this function (contrast: `sendRescheduleExpiryAlert` logs warnings for missing/invalid config at `:437-449`).
  - Builds HTML alert email including **username, UTC timestamp, IP address (or "Unavailable"), browser/device User-Agent (or "Unavailable")** with HTML escaping (`:246-277`); subject `"Admin sign-in alert — Bluebell Bakehouse"` (`:257`). Footer states email does not contain credentials or session information (`:273`).
  - Sends via Brevo transactional API (`fetch` POST with `api-key` header, 15s timeout/abort) to configured recipient (`:279-303`). Returns `response.ok`; on exception returns `false` with comment "Security alerts are best-effort..." (`:298-301`). No success/failure application logging in this function.
- **No failure/success logging of alert dispatch:** `adminLogin` does not log alert send outcome; `sendAdminLoginAlert`/`sendAdminLoginAlertOnce` do not emit success/failure logs (except UAT suppression log path when enabled). Login failure paths (`:86-103`) do not trigger alerts.

### 2.4 Related configuration and environment
- `ADMIN_NOTIFICATION_EMAIL` is consumed in `backend/src/services/emailService.ts` (`:240`, also reused for reschedule expiry alerts `:436`) but is **not present** in inspected `backend/.env.example` or `.env.example` files (read-only inspection).
- `BREVO_API_KEY` / sender config presence controls whether alert can be delivered (`isBrevoConfigured`, `getBrevoConfig`).
- `trust proxy = 1` affects `req.ip` derivation (`backend/src/server.ts:42`), and thus IP included in alerts when available.

## 3. Privacy and sensitive-data assessment

> **Scope note:** Assessment below distinguishes confirmed source behavior from unverified deployed logging/email-provider/infrastructure retention and access controls.

| Field / data element | Collected in source? | Where stored/transmitted (confirmed source behavior) | Necessary for security monitoring? | Can be minimized/masked/pseudonymized? | Retention/access known from source? |
|---|---|---|---|---|---|
| Admin username | Yes | Included in alert email body (`emailService.ts:268`), passed in alert input (`authController.ts:121`), present in login success API response (`authController.ts:131-134`) | Often useful for identifying affected admin account; may be identifiable depending on naming | Possible to reduce (e.g. partial mask/identifier alias) but reduces operator clarity; must preserve usefulness | **Unverified** beyond Brevo/provider delivery and recipient mailbox; no in-app persistence by this feature |
| Occurred-at timestamp (UTC ISO) | Yes | Computed in controller (`new Date()`), included in alert email (`emailService.ts:254,269`) | Yes, relevant for incident correlation | Minimal as-is | **Unverified** externally |
| IP address | Yes (if `req.ip` available) | Passed from controller (`authController.ts:123`), included in alert email as raw value or "Unavailable" (`emailService.ts:255,270`) | Can aid anomaly investigation but is personal/operational data | Yes (truncate/mask/hash/tokenize depending policy), or omit when not needed | **Unverified** externally |
| User-Agent / browser-device string | Yes (if header present) | Passed from controller (`authController.ts:124`), included in alert email as raw value or "Unavailable" (`emailService.ts:256,271`) | Sometimes useful for anomaly context; can be high-entropy/identifying | Yes (reduce to coarse device/browser class or omit) | **Unverified** externally |
| Request ID (dedupe key) | Yes | Passed as dedupe event ID; stored in process-local in-memory `Set` for up to ~15m on successful send scheduling (`emailService.ts:305,317-327`) | Useful only as transient dedupe correlation in current design | N/A as secret; should avoid embedding PII (currently no PII embedded) | In-memory only, process-local, bounded by timeout removal (but see reliability notes) |
| Recipient email (`ADMIN_NOTIFICATION_EMAIL`) | Yes (config) | Read/validated/used as email destination (`emailService.ts:240-244,291`); not included in alert body | Required for delivery | Not applicable (destination config) | **Unverified** (env/config management outside source) |
| Passwords/JWTs/OTP/cookies/reset tokens | **No evidence** of inclusion in alert payload | Not added to alert input/body in inspected paths; footer asserts no credentials/session info (`emailService.ts:273`); admin auth tests assert alert input excludes `password|otp|token|cookie|secret` (`backend/tests/adminAuth.test.ts:120-122`) | Must never be included | N/A | N/A |
| Admin login failure details / account-existence signals in alerts | **No evidence** | Alerts sent only on successful login with valid request ID (`authController.ts:118-126`); failed login test asserts no alert call (`adminAuth.test.ts:135-142`) | N/A | N/A | N/A |
| Application logs for alert events | **No explicit alert-content logging observed** | No `console.*` logging of alert payload/recipient/send result in alert functions (except UAT suppression info log in `logUatSuppressed` when UAT mode enabled, with redaction rules) | Observability may be limited | Could add structured, minimized logs if approved | N/A from current code; platform log retention **unverified** |

**PII/privacy assessment summary (confirmed):** the admin login alert email **does** include username, IP address, and raw User-Agent (plus timestamp) when available. This is more contextual data than strictly minimal in all deployments and can constitute personal/operational data depending on policy/jurisdiction. No credentials/tokens/secrets/OTPs are included in alert content by inspected code. There is **no evidence** of admin login alert data being written to application logs beyond UAT suppression informational logging (UAT-mode only). Deployed log aggregation, email-provider retention, mailbox access controls, and data-retention policies are **unverified**.

## 4. Deduplication reliability assessment

| Aspect | Confirmed behavior (source) | Assessment |
|---|---|---|
| Scope/key | Key is `eventId` (request ID) trimmed; checked/added in `sentAdminLoginAlertEvents` Set (`emailService.ts:317-319,325`) | **Per request-event within process**, not per account, not per IP, not per event type. Because request IDs are generated uniquely per request (`requestId.ts:20`), repeated successful logins generate different request IDs and are **not deduplicated** across logins by this mechanism (only same event ID replay within window would be suppressed). |
| When recorded | Event ID added to Set only after `sendAdminLoginAlert` returns truthy (`emailService.ts:323-327`) | Prevents recording failed delivery attempts as suppressed; but concurrent duplicate calls with same event ID can race before add (see concurrency). |
| Expiry/cleanup | `setTimeout` deletes key after `ADMIN_ALERT_DEDUPE_WINDOW_MS` (15m), `.unref?.()` used (`:326`) | Expiry exists for recorded entries; cleanup is timer-based and process-local. |
| Process restart | In-memory Set/timers only (`:305`) | **Confirmed:** restart resets dedupe state. |
| Multiple instances | No shared store/DB/Redis/coordination in source | **Architecture-dependent/unverified at runtime, but no cross-process coordination implemented:** multiple backend instances/processes/workers will not share dedupe state and can emit duplicate alerts for equivalent events. |
| Concurrency | Check-then-act on Set without synchronization/atomic claim (`:318-327`); send occurs before add | **Potential race (confirmed by code structure):** concurrent invocations with the same `eventId` can both pass the `has` check before either records/adds, resulting in duplicate sends. Current caller uses unique request IDs, so practical impact is limited in current flow, but mechanism is not concurrency-safe for duplicate event IDs. |
| Memory growth | Unbounded Set size; one timer per recorded successful event; entries removed on timeout | **Bounded per recorded event by expiry timers in steady state, but no hard cap:** a burst of many distinct successful-send event IDs creates many entries/timers until expiry. Memory growth is therefore workload-dependent and not explicitly bounded by max cardinality; long-lived processes under abnormal/high event rates could accumulate entries within window. Keys are request-ID strings (no PII embedded). |
| Missing/blank event ID | Returns `false` without recording/sending (`:317-320`) | Prevents invalid-key use; also means no alert attempt if request ID absent. |
| Suppression of important alerts | Dedupe only suppresses same `eventId` seen in Set; failures not recorded (`:318-320,323-327`) | Low risk of suppressing distinct legitimate login alerts given per-request unique IDs; primary reliability limitation is **not suppressing duplicates across requests/instances/restarts** rather than over-suppression. |
| Alert delivery failure handling | Exceptions caught; returns `false`; controller fire-and-forget `.catch` (`emailService.ts:329-332`, `authController.ts:120-126`) | **Confirmed:** delivery failure cannot disrupt admin login response path; but failures are silent (no explicit operational log/metric in code). |

**Deduplication assessment summary:** current design provides **best-effort, process-local, per-request-event suppression** with 15-minute expiry for successfully sent events. It does **not** provide dedupe for distinct successful admin logins, is **not** cross-process/multi-instance reliable, is **not** concurrency-safe for identical event IDs, and has **no explicit max-cardinality bound** (though timers expire entries). These characteristics are partially documented in code comments (`:308-312`).

## 5. Authentication and security boundaries

| Boundary/question | Evidence (confirmed) | Assessment |
|---|---|---|
| Alerts on failed login / account existence leakage via alerts | `adminLogin` returns generic `401` for unknown user and bad password (`authController.ts:86-103`); alert trigger occurs only after successful auth and cookie set (`:105-126`); failed-login test verifies no alert call (`adminAuth.test.ts:135-142`) | **No evidence** that alerting reveals account existence or occurs on authentication failure. Public API responses remain generic on failure. |
| Credentials/tokens/secrets in alerts or responses | Alert payload contains username/time/IP/UA only (`emailService.ts:229-234,268-271`); no password/JWT/OTP/cookie/reset token fields passed; login response excludes password and does not include token body (`authController.ts:128-135`); test asserts alert input free of sensitive terms (`adminAuth.test.ts:120-122`) | **No evidence** of secret/token/password exposure in admin login alert payload or login success response. |
| Login success/failure behavior impact | Alert sent via `void ...catch` after response preparation begins post-auth; delivery functions are best-effort and swallow failures (`authController.ts:120-126,116,128-135`; `emailService.ts:298-301,329-332`); test confirms login remains successful when alert delivery rejects (`adminAuth.test.ts:124-133`) | **Confirmed:** alert delivery failure does not change login success/failure outcome in inspected code paths. |
| Authentication/account status checks bypass | Alert logic runs only after successful password verification and does not alter auth decisions/DB checks/JWT issuance (`authController.ts:82-117`) | **No evidence** of auth bypass or account-status check weakening. |
| Admin rate limiting interaction | Route applies `adminLoginLimiter` before `adminLogin` (`authRoutes.ts:84`, `rateLimit.ts:14-26`) | **Confirmed:** existing admin login rate limiting remains in place; alerting does not bypass it. Alert dispatch occurs only for requests that reach successful controller handling. |
| Customer authentication interference | Alert code is in admin login controller/service path only; customer auth routes/controllers separate (`authRoutes.ts`, customer flows) | **No evidence** of interference with customer authentication. |
| Error handling / information leakage | Login exception path logs `console.error("Admin login failed:", error)` and returns generic 500 message (`authController.ts:136-141`); alert send path avoids logging payload/recipient details | Login failure API responses are generic. Exception logging may include error objects/stack context in server logs (operational concern, partly broader than S05 core) — **log sink exposure unverified**. No public API leakage from alert subsystem observed. |
| UAT safety | External alert email suppressed in UAT safe mode with safe suppression log (`emailService.ts:235-238`, `uatSafetyLog.ts`) | **Confirmed control:** prevents external alert side effect in UAT-safe mode per current config logic. |

## 6. Tests and coverage assessment

### 6.1 Existing coverage (confirmed)
- **`backend/tests/adminAuth.test.ts`** (Vitest/supertest, `createAuthTestApp`; email service mocked: `sendAdminLoginAlertOnce` mocked, `getBrevoPresenceChecks` mocked) covers, relevant to S05/admin login alerts:
  - Successful login triggers alert once with request/event ID and expected metadata shape (`username`, `occurredAt` Date) and asserts alert input string excludes `password|otp|token|cookie|secret` (`:95-122`).
  - Login remains successful when alert delivery rejects (`:124-133`).
  - No alert sent for failed login (`:135-142`).
  - Broad admin auth/session/token/logout/verify/rate-limit-bucket reset behaviors unrelated to alert privacy/dedupe internals.

### 6.2 Gaps / not covered
- **No tests for `sendAdminLoginAlert` / `sendAdminLoginAlertOnce` implementation behavior** (dedupe Set logic, expiry timing/cleanup, blank event ID handling, `sent === false` not recorded, UAT suppression, recipient/config gating, HTML content fields/escaping, Brevo request behavior, timeout/fetch failure paths) — email service module is mocked in admin auth tests.
- **No tests asserting alert email body minimization/privacy properties** (e.g. absence/presence expectations for IP/User-Agent/username) or that IP/User-Agent are not logged to application logs.
- **No tests for request ID missing/unavailable path** (`adminLogin` skips alert when `req.id` absent).
- **No tests for dedupe expiry or process-local reset semantics** (`ADMIN_ALERT_DEDUPE_WINDOW_MS`, `setTimeout` cleanup, restart behavior).
- **No concurrency/race-condition tests** for duplicate same-event delivery attempts.
- **No tests for unbounded growth/maximum dedupe cardinality behavior** (workload/timing-sensitive; not directly asserted).
- **No multi-instance/distributed dedupe tests** — **untestable/unverified in current process-local architecture** without shared-state infrastructure or multi-process harness.
- **No tests for silent delivery failure observability** (currently no logs/metrics expected by implementation).
- Original S05 also mentioned broader diagnostic/error logging patterns; this assessment does not find dedicated tests proving redaction/safety of all representative `console.error` patterns outside the alert payload assertion above.

## 7. Risk classification

| Finding ID | Severity | Confidence | Affected files (paths/lines) | Evidence (actual behavior) | Impact (realistic) | Existing mitigation | Remaining gap | Recommendation |
|---|---|---|---|---|---|---|---|---|
| **S05-C1** | **Low** | **Confirmed** | `backend/src/controllers/authController.ts:118-126`; `backend/src/services/emailService.ts:229-234,246-277,289-294` | Successful admin login alert email includes username, UTC time, raw IP address, and raw User-Agent/browser-device string when available, sent to `ADMIN_NOTIFICATION_EMAIL` via Brevo (subject/body contain these fields). | Unnecessary personal/operational data exposure in notification channel (mailbox/provider) increases privacy/compliance footprint if fields exceed monitoring need or are broadly accessible/retained. No credentials/tokens included. | Alert sent only on successful login; HTML escaping applied; footer states no credentials/session info; UAT-safe-mode suppresses external send; recipient must be explicitly configured/valid. | Data minimization/masking/pseudonymization policy not enforced in code for IP/UA/username; downstream recipient/provider retention and access controls unverified. | Minimize/mask or coarse-grain IP and User-Agent where feasible; include only fields necessary for response/investigation; document retention/access expectations; keep secrets excluded (already true). |
| **S05-C2** | **Low** | **Confirmed** | `backend/src/services/emailService.ts:305-333`, `308-312`, `317-327`; caller `backend/src/controllers/authController.ts:118-126`; request ID source `backend/src/middleware/requestId.ts:15-27` | Dedupe is process-local in-memory `Set` keyed by request/event ID with 15m timeout cleanup, add-on-success-only, no max-cardinality cap, and non-atomic check/send/add for identical IDs. Caller passes unique per-request IDs. | Limited in current flow (distinct logins get distinct IDs) but dedupe does not prevent duplicate alerts across process restarts or multiple instances and can race for identical event IDs; alert noise/reliability guarantees are weak in scaled/restarted deployments. Potential workload-dependent memory/timer growth within window (no hard cap). | Expiry timers remove recorded entries; failures not recorded; best-effort behavior does not affect login; comments acknowledge process-local limitation. | No cross-process coordination; no concurrency-safe claim; no bounded max size; silent delivery failures/duplicate behavior may reduce operational confidence. | Keep best-effort semantics; define required dedupe guarantee (per login/account/window vs per request); add concurrency-safe/idempotent handling and bounded state; consider durable/shared dedupe only if cross-instance guarantee is required (infrastructure/config approval needed). |
| **S05-C3** | **Informational** | **Partially confirmed** | `backend/src/controllers/authController.ts:118-126`; `backend/src/services/emailService.ts:313-333,229-304` | If request ID is missing, alert is skipped; alert delivery outcomes are not logged/metriced in application code (except UAT suppression log when enabled). | Reduced observability for alert delivery/suppression can hinder detection of notification pipeline issues; missing request ID (unexpected given middleware ordering) would silently omit alert. | Best-effort isolation protects login; UAT suppression is logged in safe mode. | No explicit success/failure telemetry or structured security-event logging for alert dispatch decisions. | Add minimal structured, non-sensitive logging/metrics for send attempted/sent/suppressed/failed/config-missing outcomes (without PII/secrets) if approved. |
| **S05-C4** | **Informational** | **Partially confirmed / unverified operationally** | `backend/src/services/emailService.ts:240-244,289-294`; `.env.example`; `backend/.env.example` | `ADMIN_NOTIFICATION_EMAIL` required but not documented in inspected env example files; recipient/provider/mailbox retention and access controls not represented in source. | Misconfiguration can silently disable alerting; operational handling/retention of alert PII is unknown from repository evidence. | Invalid/missing recipient prevents send; Brevo config required. | Documentation/config visibility and external retention/access posture unverified. | Document required config (without secrets) and define operational retention/access controls for alert recipients/channels (policy/process). |

**Severity reassessment:** the original **Low** severity remains appropriate for the confirmed core issues (S05-C1, S05-C2). Exposed alert fields are contextual PII/operational metadata (not credentials) sent on successful admin login to a configured recipient, and dedupe limitations primarily affect reliability/noise rather than directly enabling authentication compromise. S05-C3/S05-C4 are informational/operational visibility gaps.

## 8. Remediation design recommendations (design only — not implemented)

| Proposed change | Likely files | Expected behavior change | Compatibility/operational risks | Required tests | Config/infrastructure approval? |
|---|---|---|---|---|---|
| **Data minimization in alert payload**: reduce or mask IP/User-Agent (e.g. omit, truncate, coarse user-agent class, or pseudonymize) and confirm username necessity | `backend/src/services/emailService.ts` (`sendAdminLoginAlert` input/HTML), possibly `backend/src/controllers/authController.ts` (fields passed) | Alert email contains fewer/less-specific identifiers | Reduced forensic detail for responders; stakeholder/security-operations acceptance needed | Unit/integration tests for rendered/sent payload content (no secrets/PII beyond approved fields), snapshot/field assertions, successful-login alert behavior unchanged | **Policy/product/security approval** for acceptable fields |
| **Structured, non-sensitive security-event logging** for alert dispatch decisions (attempt/sent/suppressed/failure/config-missing/UAT-suppressed) without logging PII/secrets/tokens | `backend/src/services/emailService.ts`, possibly `backend/src/controllers/authController.ts`, logging utility usage conventions | Improved observability; no change to login/auth outcomes or public responses | Log volume/noise; must avoid logging raw IP/UA/recipient/credentials; log sink handling unverified | Tests asserting no sensitive fields logged and expected event outcomes; existing login tests remain green | **Logging/ops review**; no new external service required |
| **Bounded, concurrency-safer in-memory dedupe** (if requirement remains per-process best-effort): atomic claim pattern for same event ID, explicit max-size/eviction or bounded structure, clear key definition | `backend/src/services/emailService.ts` (`sendAdminLoginAlertOnce`, dedupe state) | Fewer race duplicates for identical IDs; bounded memory/timer growth | Current key is per-request unique so functional behavior may appear unchanged; eviction policy can drop suppression state | Unit tests for concurrent same-ID calls, max-cap behavior, expiry, add-on-success-only | **No new infra** if kept in-memory; behavior approval if key semantics change |
| **Define effective dedupe semantics** (e.g. per admin account within window) if alert-noise reduction is desired | `backend/src/controllers/authController.ts` and/or `backend/src/services/emailService.ts` | May suppress multiple rapid successful logins for same account; different from current per-request behavior | Could reduce visibility of repeated legitimate logins; key choice must avoid unnecessary PII and handle concurrency | Tests for same-account rapid logins, different accounts, expiry, restart/process-local limits | **Security/ops approval** (tradeoff) |
| **Durable/cross-instance dedupe** only if multi-instance reliability is required | Likely `backend/src/services/emailService.ts` plus new persistence/outbox/store integration and config/wiring | Consistent suppression across instances/restarts (depending design) | Complexity, failure modes, latency, dependency availability; must not affect login path | Integration tests with store abstraction/mocks; failure-open/failure-safe behavior tests | **Infrastructure/config/dependency approval required**; do not introduce Redis/DB/queue/external service without explicit approval and need |
| **Configuration/documentation hygiene**: document `ADMIN_NOTIFICATION_EMAIL` in env examples/docs (no secret values), clarify behavior when unset | `.env.example`, `backend/.env.example`, docs (and possibly non-secret code comments) | Clearer operator setup; no runtime behavior change unless code also changes | None significant if documentation-only | N/A or doc checks | **Approval for doc/config-surface changes** |
| **Alert delivery failure handling visibility** (non-disruptive) | `backend/src/services/emailService.ts`, `backend/src/controllers/authController.ts` | Explicit non-sensitive logs/metrics on failure; login remains successful | Must not leak recipient/PII/secrets/provider credentials | Tests for failure path logging/metrics hooks and preserved login success | **Ops/logging approval** |

**Not recommended without separate approval/evidence:** introducing external/shared infrastructure by default, changing login/auth semantics, exposing alert details in public APIs, or broad unrelated logging refactors bundled into S05.

## 9. Authentication boundary review (summary)

- Admin login alerts are generated only on successful admin authentication and are best-effort/non-blocking (`authController.ts:105-141`, `emailService.ts:229-333`).
- Failed/unknown/invalid-credential admin logins return generic errors and do not trigger alerts (confirmed by source and tests).
- No evidence of password/JWT/OTP/cookie/reset-token exposure in alert payloads or public responses.
- Admin login rate limiting (`adminLoginLimiter`) remains applied at route level (`authRoutes.ts:84`).
- No evidence of customer-auth impact or auth/account-status bypass.

## 10. Existing test coverage and gaps (summary)

- **Covered:** successful-login alert trigger/call shape, sensitive-field exclusion in alert input assertion, login success despite alert delivery rejection, no alert on failed login (`backend/tests/adminAuth.test.ts:95-142`).
- **Missing:** direct tests for `sendAdminLoginAlert`/`sendAdminLoginAlertOnce` internals (PII field content/minimization, UAT/config gating, delivery/error/timeout paths), dedupe expiry/cleanup/reset, concurrency, boundedness, request-ID-missing path, and non-sensitive dispatch observability. Multi-instance dedupe untestable/unverified in current architecture.

## 11. Unverified assumptions and limitations

- Deployed log aggregation, retention, redaction, and access controls for application logs are **unverified** from repository source.
- Email provider (Brevo) retention, recipient mailbox access controls, and downstream handling of alert emails are **unverified**.
- Multi-instance/process deployment topology and real-world duplicate-alert behavior are **unverified/architecture-dependent** (source shows no shared dedupe state).
- Runtime behavior of `req.ip`/proxy chain beyond configured `trust proxy = 1` is deployment-dependent.
- Alert delivery success/failure rates and operational alert fatigue in production are **unverified**.
- `ADMIN_NOTIFICATION_EMAIL` operational configuration presence/value is **unverified** (env-specific); env examples do not currently document it.

## 12. Explicit statement

- **No implementation occurred.** No application source, tests, dependencies, environment/configuration, services, or database state were modified for remediation. No Git mutations were performed. No real admin logins, external notifications, or provider/database operations were executed.

## 13. Status

**S05: ASSESSED — AWAITING REMEDIATION DESIGN REVIEW AND USER APPROVAL**
