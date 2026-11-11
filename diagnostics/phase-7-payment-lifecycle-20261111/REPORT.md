# Bluebell Bakehouse — Phase 7 Payment Lifecycle Verification

Date: 2026-11-11  
Repository: `C:\Users\Admin\Documents\bakery-ecommerce`

## Status: PASS — focused mocked lifecycle verification

### Scope and findings

- Razorpay order creation uses the persisted `Order.totalAmount`, converts rupees to integer paise, validates a positive safe integer, and rejects non-ONLINE orders. Frontend amount/status fields are not authoritative.
- Checkout signatures are HMAC-SHA256 verified server-side using the configured secret and timing-safe comparison. Webhooks verify the exact raw body using the separate webhook secret. Secrets are not returned in API responses.
- Success state is updated only after a valid checkout signature or a valid signed `payment.captured` webhook. Updates are transactional. Repeated same-payment events are no-ops; a distinct capture after an order is paid is recorded for manual reconciliation rather than silently ignored.
- A late capture after a failed attempt is recorded as paid evidence and flagged `REVIEW_REQUIRED`; it does not automatically restore already released inventory or send a success email. Failed webhooks release inventory once and do not send payment-success notifications. Stale failed-attempt webhooks are ignored.
- Gateway order-creation interruption leaves the order pending (no fabricated failed gateway evidence); it does not mark paid or send a payment confirmation.
- COD/Pay-at-Store remain distinct from ONLINE; Razorpay creation, confirmation, and failure processing are scoped to ONLINE orders. Pay-at-Store has its existing admin-controlled mark-paid lifecycle.
- Customer order history already returns persisted `paymentStatus`; the customer order type/detail view includes and displays it. No UI or schema change was needed for this phase.
- Email confirmation is triggered only on a newly committed ordinary pending-to-paid online transition. Replays, failures, and late captured-after-failure reconciliation do not generate a payment-confirmed email. Existing successful order-placement notification remains separate.

### Tests and checks

- **PASS:** `backend/tests/payment.test.ts` — 21/21 passed. Uses mocked Razorpay client/key values and an isolated MongoMemoryServer replica set. Covers server amount, valid/invalid signature, captured/failed webhooks, duplicate callbacks, superseded failure, inventory release once, retry, gateway interruption, and captured-after-failed reconciliation.
- **PASS:** `backend/tests/reschedule.test.ts` — 33/33 passed (relevant shared regression suite; Phase 6B run).
- **PASS:** `backend/tests/emailService.test.ts` — 21/21 passed (relevant shared notification transport regression suite; Phase 6B run).
- **PASS:** backend `pnpm run typecheck`.
- **PASS:** `git diff --check` (line-ending conversion notices only).
- No real payment, refund, Brevo email, live customer database write, service restart, commit, push, or deployment was performed.

### Security findings / limitations

- Payment state relies on checkout HMAC or the signed Razorpay webhook as evidence; request-supplied status and amount are not trusted.
- A late captured payment after inventory release requires staff reconciliation/fulfillment-or-refund action. Refund execution is intentionally not automated.
- Duplicate capture detection is order-document based. There is no separate durable provider-event ledger; notifications retain the Phase 6 process-local best-effort suppression limitation.
- Razorpay credentials must be configured operationally for production. Tests use mock credentials and mocked responses only.

### Changed files in this phase

- `backend/src/controllers/paymentController.ts`
- `backend/tests/payment.test.ts`
- `diagnostics/phase-7-payment-lifecycle-20261111/REPORT.md`

Existing working-tree edits and untracked files were preserved; payment controller/tests already had baseline modifications before Phase 7.