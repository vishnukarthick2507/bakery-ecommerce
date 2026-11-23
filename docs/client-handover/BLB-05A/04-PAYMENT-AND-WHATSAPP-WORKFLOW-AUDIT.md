# 04 — Payment & WhatsApp Workflow Audit

**Audit:** BLB-05A (read-only)  
**Date:** 2026-11-21

## Scope

Static code/docs review only. No live Razorpay transactions/webhooks, no real WhatsApp/email/OTP/provider calls, no Cloudinary ops.

## Payment / Razorpay

### Evidence
- `backend/src/services/razorpay.ts`, `backend/src/controllers/paymentController.ts`, `backend/src/routes/paymentRoutes.ts`
- `backend/tests/payment.test.ts` (backend test inventory indicates extensive coverage; not rerun in BLB-05A)
- UAT Safe Mode blocks external side effects (`backend/src/config/uatSafeMode.ts`)

### Observed controls (from backend audit/static inspection)
- Amount sourced from DB order, not client.
- Ownership checks for customer-linked orders.
- Signature verification uses HMAC SHA256 + timing-safe compare.
- Webhook raw body parsing before JSON; signature verification.
- Idempotency/reconciliation paths for duplicate/superseded/interrupted capture.
- UAT-safe blocking for external Razorpay operations.

### Findings

| ID | Severity | Category | Affected file/module | Evidence | Business impact | Recommended remediation | Separate auth |
|---|---|---|---|---|---|---|---|
| BLB05A-P01 | HIGH | Production verification gap | payment controllers/services/routes | No live provider/webhook end-to-end verification in audited evidence | Payment failures/refunds/reconciliation issues may surface in production | Controlled staging/provider test with evidence and rollback | Yes |
| BLB05A-P02 | MEDIUM | Frontend payment E2E gap | `app/checkout/page.tsx`, Playwright CI config | CI E2E narrow; no full checkout payment flow in CI | UI regression in Razorpay/COD/pay-at-store | Add deterministic payment-flow E2E (mocked provider) | Yes |
| BLB05A-P03 | MEDIUM | Operational runbook missing | docs | No payment incident/reconciliation/webhook replay runbook found | Slow incident response | Create payment ops runbook and alerting | Yes |
| BLB05A-P04 | INFO | Strong local test signal | `backend/tests/payment.test.ts` | Backend audit reports extensive payment tests | Positive but not production proof | Keep regression suite in release criteria | No |

## WhatsApp automation

### Evidence
- `backend/src/services/whatsappService.ts`, `whatsappConsentService.ts`, `whatsappTemplateRegistry.ts`, `notificationOutboxService.ts`
- `backend/src/controllers/whatsappWebhookController.ts`, `adminWhatsAppController.ts`
- `backend/src/routes/whatsappWebhookRoutes.ts`, `whatsappRoutes.ts`, `adminWhatsAppRoutes.ts`
- `backend/src/models/WhatsApp*.ts`, `NotificationOutbox.ts`
- `app/admin/whatsapp/page.tsx` (admin UI exists)
- Frontend search: no `whatsappConsent` in `app/components/lib`

### Observed controls
- Template registry fail-closed validation.
- Consent model separates transactional/marketing; STOP withdrawal support.
- Outbox idempotency/lease/retry/dead-letter/stale recovery.
- Webhook signature verification, raw body, idempotency ledger, status correlation by metaMessageId.
- UAT-safe mode suppresses/blocks external sends.

### Findings

| ID | Severity | Category | Affected file/module | Evidence | Business impact | Recommended remediation | Separate auth |
|---|---|---|---|---|---|---|---|
| BLB05A-W01 | CRITICAL | Consent/UI contract gap | `app/checkout`, `components/custom-cake/custom-cake-form.tsx`, `lib/*`; backend consent/order/custom-cake controllers | No WhatsApp consent capture found in frontend; backend supports consent sequencing/tests | Notifications may be non-compliant or never enqueued; customer/admin expectations broken | Implement explicit consent UX, copy, persistence, and E2E tests; legal review | Yes |
| BLB05A-W02 | HIGH | Provider/runtime verification missing | WhatsApp services/webhooks | No real Meta/provider send/webhook runtime evidence | Template/delivery/webhook failures in production | Controlled sandbox/provider verification with evidence | Yes |
| BLB05A-W03 | MEDIUM | Notification state clarity | admin WhatsApp UI/outbox models | Need to ensure suppressed/dead-letter/retrying/sent/delivered states are distinct in UI and reports | Support/admin confusion; false delivery claims | Audit UI labels/status mapping and add tests | Yes |
| BLB05A-W04 | MEDIUM | Public consent endpoints disabled but UX implications unclear | `backend/src/routes/whatsappRoutes.ts` returns 410; frontend has no consent UI | Endpoint design may be intentional, but end-user consent journey is incomplete | Compliance/operability gap | Document intended consent journey and align API/UI | Yes |
| BLB05A-W05 | INFO | Outbox/webhook hardening present | webhook/outbox/consent services and tests | Static evidence indicates good baseline controls | Positive foundation | Maintain with runtime verification | No |

## Verdict

**NOT READY.** Payment backend has positive local signals but lacks production-grade verification evidence. WhatsApp has serious consent journey/compliance-operability gaps and no runtime provider verification.