# WhatsApp Stage 5 Phase A (Architecture/Readiness)

This document captures the **Phase A (readiness only)** deliverables implemented in `feature/whatsapp-business-automation` for Bluebell Bakehouse. Phase A does **not** migrate existing email flows, launch campaigns, send marketing messages, add unsupported workflows, or change existing order/payment/custom-cake/inventory business rules.

## Scope implemented (Phase A)

1. **Additive transactional/marketing consent architecture (separate categories)**
   - `WhatsAppConsent` now stores independent consent for:
     - **TRANSACTIONAL** (legacy/backward-compatible fields preserved): `status`, `source`, `consentText`, `consentTimestamp`, `optOutTimestamp`, `withdrawalReason`, `withdrawalHistory`
     - **MARKETING** (independent, explicit opt-in): `marketingStatus`, `marketingSource`, `marketingConsentText`, `marketingConsentTimestamp`, `marketingOptOutTimestamp`, `marketingWithdrawalReason`, `marketingWithdrawalHistory`
   - Unified auditable `consentHistory` records category/action/timestamp/source/reason.
   - Existing transactional consent **never implies** marketing consent.
   - Marketing opt-in is explicit (`category=MARKETING`).
   - Backward-compatible transactional APIs/behavior preserved (default category TRANSACTIONAL).

2. **STOP / opt-out handling across categories**
   - WhatsApp webhook STOP command now withdraws **both** TRANSACTIONAL and MARKETING consent (`withdrawAllConsent`) to reliably prevent subsequent marketing and transactional WhatsApp messages per applicable consent rules.
   - Withdrawal actions append auditable history/timestamps.

3. **Central template registry + fail-closed validation service**
   - Added `backend/src/services/whatsappTemplateRegistry.ts`.
   - Registry explicitly defines, per template: internal event name, template name, Meta category, required variables, language, approval/configuration state, enabled/disabled state.
   - Validation service fails closed when template is missing, disabled, not confirmed approved, category-mismatched, or required variables are invalid/missing.
   - Approval is **not assumed from code**; registry entries are explicit configuration artifacts.
   - Outbox WhatsApp processing validates templates via registry before send and fails closed (no send attempt on invalid/unapproved/missing/disabled templates).

4. **Validated administrator recipient configuration support (server-side only)**
   - Added `backend/src/services/whatsappAdminRecipients.ts`.
   - Reads explicit env-configured recipients (`ADMIN_WHATSAPP_RECIPIENTS`, comma/newline/semicolon-separated), normalizes and validates phone numbers, removes duplicates, and reports invalid entries.
   - Never exposed to customer-facing endpoints; does not auto-use admin accounts.
   - No production env changes made in Phase A.

5. **Supported business event taxonomy (verified triggers only)**
   - Added `backend/src/services/whatsappEventTaxonomy.ts`.
   - Supported (transactional, consent-gated, verified current triggers): order placed, payment confirmed, order status transitions (confirmed/preparing/ready/out for delivery/completed), order cancelled.
   - Unsupported/deferred events explicitly documented (see below and taxonomy module).

6. **Admin WhatsApp Centre consent visibility (safe)**
   - Admin consent listing/API extended to display separate TRANSACTIONAL and MARKETING consent categories/status/timestamps/source/history metadata safely.
   - No admin bypass to grant/override customer consent added.

7. **Tests**
   - Extended/added tests for consent separation and STOP behavior, backward compatibility, template registry/validation fail-closed behavior, and admin recipient validation.
   - Existing transactional behavior preserved in tests where applicable.

## F2 privacy remediation (implemented after investigation)

- Public unauthenticated WhatsApp consent HTTP endpoints are **disabled** (return `410` with a generic non-sensitive response; no phone/consent existence disclosure):
  - `GET /api/whatsapp/consent/status`
  - `POST /api/whatsapp/consent/grant`
  - `POST /api/whatsapp/consent/withdraw`
- **Internal consent workflows preserved:** checkout/custom-cake server-side `grantConsent(...)`, F1 checkout consent-before-`ORDER_PLACED` sequencing, transactional/marketing consent separation, Meta STOP handling via webhook `withdrawAllConsent(...)`, admin WhatsApp Centre consent listing behind `authenticateAdmin` (`/api/admin/whatsapp/consents`), and outbox transactional-consent enforcement.
- **Future self-service:** any reintroduced public/customer consent read or withdrawal endpoint must use a verified, ownership-bound customer flow (e.g. authenticated session bound to verified phone and/or OTP/token proof) with minimal responses and safeguards before enablement.

## Supported event taxonomy (verified persisted triggers/states)

Backed by existing `notifyCustomerOrder(...)` / order controller flows and outbox WhatsApp mapping:
- `ORDER_PLACED` → `order_received` (TRANSACTIONAL)
- `PAYMENT_CONFIRMED` → `payment_received` (TRANSACTIONAL)
- `STATUS_CHANGED` + `CONFIRMED` → `order_confirmed` (TRANSACTIONAL)
- `STATUS_CHANGED` + `PREPARING` → `order_preparing` (TRANSACTIONAL)
- `STATUS_CHANGED` + `READY`/`READY_FOR_PICKUP` → `order_ready` (TRANSACTIONAL)
- `STATUS_CHANGED` + `OUT_FOR_DELIVERY` → `order_out_for_delivery` (TRANSACTIONAL)
- `STATUS_CHANGED` + `DELIVERED`/`COLLECTED` → `order_completed` (TRANSACTIONAL)
- `CANCELLED` → `order_cancelled` (TRANSACTIONAL)

Reschedule customer events are currently **email-only** in existing behavior (no approved/supported WhatsApp template mapping).

## Deferred / unsupported (not implemented in Phase A)

- Refund workflows
- Invoice generation
- Order rejection states/workflows
- Custom cake production states / custom cake lifecycle WhatsApp notifications beyond existing consent capture
- Stock subscription workflows
- Marketing campaign sends / marketing message delivery
- WhatsApp templates/sends for reschedule requested/accepted/rejected (until separately approved/registered and migrated safely)
- Any workflows not backed by verified persisted triggers/states

## Existing email/outbox migration plan (no migration performed in Phase A)

### Current state (observed)
- **Customer order emails**: sent directly via `sendCustomerOrderEmailOnce` in `customerOrderNotifications.notifyCustomerOrder(...)` (best-effort, in-memory dedupe in email service scope; not durably outboxed). Existing templates/recipients/behavior preserved.
- **Customer order WhatsApp**: enqueued to durable `NotificationOutbox` with consent checks and template mapping (transactional). Existing behavior preserved.
- **Admin operational emails**: separate direct mechanisms (e.g. `sendAdminOrderNotification`, `sendCancellationAlert`, `sendCustomCakeRequestAlert`, `sendRescheduleAdminAlert`, `sendContactEnquiryAlert`) — not unified into outbox.
- **Proposal-expiry admin alerts**: separate persisted/retry/lease mechanism in `proposalExpiry.ts` (state stored on order proposal fields; direct Brevo send via `sendRescheduleExpiryAlert`) with at-least-once semantics and explicit backoff/claim behavior.
- **Outbox worker/processing**: currently invoked per-job in code paths/tests as available; no evidence of a unified always-on production outbox worker loop in Phase A scope. Migration must account for runtime processing guarantees.

### Migration principles (approved constraints)
- Gradually unify WhatsApp and email notifications through the existing persistent notification outbox.
- Preserve all existing email templates, recipients, and business behavior.
- Avoid duplicate emails.
- Migrate **one event at a time**.
- Do **not** remove existing email mechanisms until equivalent functionality and regression tests are proven.
- Keep all notification delivery non-blocking for business operations.

### Proposed phased migration sequence (future phases, assessment only)

1. **Foundation hardening (pre-migration prerequisite)**
   - Ensure a reliable, restart-safe outbox worker/runtime exists for all environments where migrated events will run.
   - Define idempotency keys that unify "same business event + channel + recipient intent" across direct and outbox paths during transition windows.
   - Add observability/reconciliation for dual-run periods (without exposing secrets/PII).

2. **Pilot event: one low-risk customer order email event**
   - Candidate: `ORDER_PLACED` customer email (after confirming idempotency parity and recipient resolution parity).
   - Dual-write/guard strategy to prevent duplicates (e.g. single authoritative send path per event with feature-guarded cutover, or durable dedupe key shared across legacy/outbox paths). Remove legacy path only after proven parity and regression tests.

3. **Incremental customer email events**
   - Migrate `PAYMENT_CONFIRMED`, `STATUS_CHANGED`, `CANCELLED`, then reschedule customer emails one-by-one with per-event parity checks (template, recipient, timing, idempotency, non-blocking behavior).

4. **Admin/operational emails assessment and staged migration**
   - Inventory each admin email type (order/cancellation/custom-cake/reschedule/contact) for recipient/config parity and idempotency requirements.
   - Migrate individually with dedicated outbox event types and compatibility tests.

5. **Proposal-expiry email migration assessment (special case)**
   - Current `proposalExpiry` flow is tightly coupled to proposal expiry sweep, atomic claim leases, and per-proposal persisted retry state (`expiryNotificationStatus/Attempts/NextRetryAt/LastError/SentAt`) with at-least-once delivery tradeoff.
   - Migration to outbox requires careful parity design:
     - Preserve sweep/claim semantics that mark proposals expired exactly once.
     - Preserve retry schedule/backoff and terminal failure behavior (or explicitly improve with equivalent guarantees).
     - Preserve at-least-once/no-silent-loss behavior and avoid duplicate admin alerts where feasible (provider lacks native idempotency key today).
     - Maintain persisted auditability of notification attempts/outcomes per proposal.
   - **Recommendation:** treat proposal-expiry as a later, dedicated migration after customer/admin direct-email migrations, with explicit parity tests for lease recovery, retry timing, config-failure handling, and duplicate-on-crash behavior.

### Duplicate-prevention strategy during migration (future)
- Use deterministic per-event/per-channel idempotency keys.
- During cutover, ensure only one path is authoritative for sending a given event instance (feature flag/config gate per event) before removing legacy path.
- Add regression tests proving no duplicate email for retries/restarts/concurrent processing.

## Non-goals / safety confirmations (Phase A)
- No existing email flows migrated.
- No marketing messages or campaigns launched.
- No unsupported business workflows added.
- No changes to existing order, payment, custom cake, or inventory business rules.
- No real customer WhatsApp messages sent and no production env/webhook/settings/data changes performed as part of Phase A implementation.
- WhatsApp delivery remains best-effort/non-blocking; failures must not block core business operations.
