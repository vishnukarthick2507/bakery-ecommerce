# UAT Safe Mode (BLB-02C)

## Purpose
`UAT_SAFE_MODE` is a centralized, fail-closed backend safety mode for isolated local UAT of Bluebell Bakehouse. When enabled, it prevents real external side effects while preserving safe local application/database behavior where possible.

**Production behavior remains unchanged when `UAT_SAFE_MODE` is disabled or absent** (normal mode).

## Configuration
- **Environment variable:** `UAT_SAFE_MODE`
- **Strict parsing:** only `true` or `false` (case-insensitive, surrounding whitespace allowed) are accepted.
- **Default:** disabled only when the variable is explicitly absent.
- **Invalid values:** fail safely (startup/config validation rejects invalid values).

> Do not add or modify real credentials in `.env` files as part of this implementation. Operators must configure env values explicitly and securely for approved local UAT.

## Required local UAT database target (when enabled)
When `UAT_SAFE_MODE=true`, backend startup/config validation requires a verified local MongoDB target:
- Scheme: `mongodb://` only (**`mongodb+srv://` / Atlas rejected**)
- Host: localhost only (`127.0.0.1`, `localhost`, `::1`)
- Port: **`27018` only** (**`27017` rejected**)
- Database name: **`bluebell_whatsapp_uat` only**
- Remote/multi-host targets: rejected
- No silent fallback to another database

Validation errors are sanitized and **must not log full MongoDB URIs or credentials**. Startup fails safely if validation/connection cannot be verified in UAT mode.

## Blocked external integrations and behavior (UAT mode)
Centralized policy blocks real external side effects across relevant paths (services/controllers/workers/webhooks):

### Email / OTP (Brevo)
- All outbound Brevo API calls blocked (OTP, customer order emails, admin alerts, proposal-expiry alerts).
- OTP flows are handled safely for local UAT without real provider delivery (suppressed, not reported as successful provider delivery).
- Suppressed notifications are **not marked delivered/sent**.

### WhatsApp (Meta Cloud API + webhooks)
- Outbound Meta template/API requests blocked.
- Outbox WhatsApp processing cannot bypass policy; suppressed jobs are released without consuming retries and not marked delivered.
- Live WhatsApp webhook verification/processing rejected in UAT mode.
- Synthetic webhook fixtures, if used, must remain isolated to automated tests or explicitly restricted local-only test mechanisms (not implemented as public bypass).

### Razorpay
- Live Razorpay client/API access and transaction-creating operations blocked.
- Payment create/retry/verify operations and live webhook processing rejected in UAT mode.
- No real payment capture/retry/financial side effects.
- Deterministic mocked payment behavior is permitted only in automated tests; simulated payments must never be reported as real verified payments.

### Cloudinary
- External upload signature generation and destructive media operations blocked in UAT mode.
- Local fixture/mock testing may be used only where already supported by existing tests/code paths.

### Google OAuth
- Accidental use of production OAuth configuration is prevented in UAT mode (blocked).
- Normal production OAuth behavior preserved outside UAT mode.
- No local OAuth mock is claimed unless separately implemented and tested.

## Worker behavior
- **Inventory expiry worker:** may continue DB-only operations on the **verified UAT database**; no external side effects; existing consistency logic preserved.
- **Proposal expiry worker:** auto-start behavior preserved, but external Brevo emails are blocked in UAT mode. Suppressed notifications are not sent, not marked delivered, and retry/state semantics are preserved without consuming attempts.
- **Notification outbox:** no external delivery in UAT mode; suppressed jobs are released for future retry (not consumed, not delivered).

## Webhook protection
- Razorpay and WhatsApp live/external webhook processing is rejected while `UAT_SAFE_MODE` is enabled.
- Production signature validation logic is not weakened.
- No publicly accessible webhook bypass is introduced.

## Testing instructions
From `backend/` (or repository root as applicable, using existing scripts):
- Type check: `npx tsc --noEmit` (backend)
- Targeted UAT safe-mode tests: `npx vitest run tests/uatSafeMode.test.ts`
- Full backend suite: `npx vitest run`

All UAT safe-mode tests must avoid external network calls and use mocks/stubs/in-memory DB as appropriate.

## Known limitations
- UAT mode blocks live external integrations by design; manual UAT of real provider flows (real OTP email delivery, real WhatsApp delivery, real Razorpay transactions/webhooks, real Cloudinary uploads, production Google OAuth) is not possible in this mode.
- Suppressed outbox/proposal notifications remain pending for later non-UAT processing; operational visibility depends on existing admin/DB inspection tooling.
- Existing `.env` files are not modified by this implementation; operators must ensure runtime env values are UAT-safe and isolated.
- Runtime UAT still requires approved startup of the dedicated MongoDB instance on `127.0.0.1:27018`, verified backup/restore posture, and synthetic data controls.

## Production-mode behavior
When `UAT_SAFE_MODE` is `false` or absent (and value is valid), existing integration and worker behavior remains unchanged, subject to normal configuration and provider availability.
## EMAIL_EXTERNAL_DELIVERY_BLOCKED (staging/ops email safety, independent)

`EMAIL_EXTERNAL_DELIVERY_BLOCKED` is a separate, email-only safety control. It does **not** change `UAT_SAFE_MODE` semantics, MongoDB target validation, WhatsApp behavior, template registry/consent gates, or production defaults.

- **Missing/absent:** defaults to `false` (production-compatible).
- **Accepted values:** `true` or `false` (case-insensitive, trimmed).
- **Invalid values:** startup fails with a clear validation error (no silent delivery).
- **No environment inference:** staging is not inferred from `NODE_ENV`.

When `true`:
- All external email provider calls are blocked at the Brevo boundary (OTP, admin login alerts, customer order emails, reschedule expiry alerts, and any future email path using the same boundary).
- Suppressed emails are **not** reported as successfully sent.
- Outbox `EMAIL` jobs are released with the existing non-consuming suppression mechanism: no `SENT`, no `DEAD_LETTER`, no `SKIPPED`, attempt count not consumed, ownership safeguards preserved, job remains retryable for later controlled testing.
- Proposal-expiry email suppression does not consume retry attempts or exhaust retries.
- Independent PII-safe `email.external_delivery.suppressed` diagnostics are emitted for email-block suppression paths (including outbox and proposal-expiry branches) regardless of `UAT_SAFE_MODE`, with minimal non-sensitive fields only (event/channel/context/reason); no recipient, phone, OTP, token, API key, message body, address, or raw order number.
- Admin login alert dedupe: when suppression is specifically due to `EMAIL_EXTERNAL_DELIVERY_BLOCKED`, the claimed event ID is released with ownership-safe claim handling so the same event can be retried after the block is lifted. UAT suppression, missing config, true duplicates, and delivered/failed delivery claims retain their existing claim behavior.
- WhatsApp processing remains independent and unaffected by this flag.

Operational guidance: for Render staging where `UAT_SAFE_MODE=false` is required for Atlas DB connectivity, set `EMAIL_EXTERNAL_DELIVERY_BLOCKED=true` until an authorized controlled email test plan is in place.
