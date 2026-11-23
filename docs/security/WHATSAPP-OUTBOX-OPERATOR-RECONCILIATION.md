# WhatsApp Outbox Operator Reconciliation (BLB-35)

**Status:** Documentation grounded in verified source behavior after BLB-35. Not an operations approval, not a monitoring deployment, and not authorization for UAT/production actions.

## Scope

This runbook covers the WhatsApp notification outbox reconciliation condition where the provider accepted a send request but local outbox SENT persistence failed, and the resulting `RECONCILIATION_REQUIRED` hold state.

**Source evidence:**
- `backend/src/models/NotificationOutbox.ts` (`NotificationStatus` includes `RECONCILIATION_REQUIRED`; reconciliation metadata fields)
- `backend/src/services/notificationOutboxService.ts` (`markReconciliationRequired`, `processJob`, `claimJob`, `recoverExpiredLeases`, `getOutboxStats`)
- `backend/src/services/notificationOutboxWorker.ts` (polling/lease recovery; no normal claim of reconciliation-required jobs)
- `backend/src/controllers/adminWhatsAppController.ts` (stats/list/detail expose status; retry rejects `RECONCILIATION_REQUIRED`)
- `backend/src/services/whatsappService.ts` (provider acceptance/providerMessageId only; no delivery guarantee)

## Reconciliation-required status semantics

`RECONCILIATION_REQUIRED` means:

- The WhatsApp provider accepted the message for delivery (`sendWhatsAppTemplate` returned `accepted: true`).
- The local outbox could not be durably transitioned to `SENT`.
- The system **must not assume confirmed delivery**.
- The job **must not be automatically resent** by normal worker claim, retry, or lease recovery.
- Manual reconciliation is required before any authorized customer communication decision.

`RECONCILIATION_REQUIRED` is **not** `SENT`, **not** `DEAD_LETTER`, and **not** a normal retryable failure.

## Verified behavior (BLB-35)

1. **Provider acceptance is not confirmed delivery.** `sendWhatsAppTemplate` returns acceptance/providerMessageId only when Meta accepts the request. It does not guarantee end-user delivery/read.
2. **Duplicate-send safety takes precedence.** If provider acceptance succeeds but `markSent` fails, `processJob`:
   - attempts a narrowly scoped, ownership-aware transition to `RECONCILIATION_REQUIRED` via `markReconciliationRequired`;
   - persists safe reconciliation metadata when the transition succeeds: `reconciliationCode`, `reconciliationReason`, `providerAcceptedAt`, `reconciliationDetectedAt`, `lastError`, and `metaMessageId` when available;
   - logs structured warning `WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED` with `reconciliationRequired=true`, `duplicateSendSuppressed=true`, and `reconciliationHoldPersisted`;
   - does **not** mark failed/retried;
   - does **not** resend in-process;
   - returns.
3. **Claim protection.** `claimJob` only claims `PENDING` and `RETRYING` jobs whose `nextRetryAt` is due. `RECONCILIATION_REQUIRED` is never claimable.
4. **Lease recovery protection.** `recoverExpiredLeases` only resets expired `PROCESSING` jobs to `PENDING`. It does not move `RECONCILIATION_REQUIRED` jobs.
5. **Admin retry protection.** The admin retry endpoint rejects `RECONCILIATION_REQUIRED` with HTTP 409 and does not requeue it to `PENDING`.
6. **Stats/visibility.** Outbox stats include `RECONCILIATION_REQUIRED`. Admin list/detail surfaces reconciliation fields (`reconciliationCode`, `reconciliationReason`, `providerAcceptedAt`, `reconciliationDetectedAt`) and outbox status.

## Secondary reconciliation-write failure / residual limitation

If the reconciliation-hold DB update fails after provider acceptance/SENT-persist failure, the system:

- does **not** claim the hold was persisted;
- emits high-priority structured error logs with `WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED`, `reconciliationHoldPersisted=false`, and `duplicateSendSuppressed=true`;
- does **not** automatically resend.

**Residual limitation:** if the hold cannot be persisted and the job remains `PROCESSING` until lease expiry, existing lease recovery may reset it to `PENDING` and a later worker may resend it. This is a crash/database-failure limitation, not normal behavior. Treat any `reconciliationHoldPersisted=false` or missing hold transition as an urgent reconciliation/escalation event.

## Safe identifiers for investigation

Use only safe correlation identifiers from logs/DB records in an authorized, audited environment:
- `jobId` (outbox document id)
- `idempotencyKey`
- `eventType`
- `templateName`
- `channel`
- `workerId`
- `providerMessageIdPresent` (boolean log field)
- `metaMessageId` (if persisted)
- `reconciliationCode`, `reconciliationReason`
- `providerAcceptedAt`, `reconciliationDetectedAt`
- `reconciliationRequired`, `reconciliationHoldPersisted`, `duplicateSendSuppressed`

**Do not log or expose:** access tokens, app secrets, raw phone numbers in public logs, customer message content, OTPs, payment data, or raw provider payloads.

## Operator decision rules (verified/safe)

| Condition | Safe action | Do not do |
|---|---|---|
| `RECONCILIATION_REQUIRED` outbox job | Treat as provider-accepted but local state uncertain. Correlate by safe IDs and confirm provider-side state through an authorized process before any customer communication decision. | Do not blindly resend. Do not manually edit production records. Do not mark delivered without evidence. |
| `WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED` with `reconciliationHoldPersisted=true` | Investigate the outbox record and provider state. Escalate per authorized ops process. | Do not resend automatically. |
| `WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED` with `reconciliationHoldPersisted=false` | Treat as urgent. Hold may not be persisted; duplicate-send risk remains if lease recovery occurs. Escalate immediately through authorized ops/security/engineering owner. | Do not resend. Do not assume hold exists. |
| Provider acceptance unknown | Investigate using authorized logs/provider evidence. Escalate if uncertain. | Do not assume sent or not sent. |
| Job in `DEAD_LETTER` | Investigate `lastError`, attempts, event/template/consent/config cause. Resolve root cause before any authorized replay. | Do not manually mutate status in production DB. |
| Ordinary `PROCESSING` past lease | Allow lease recovery only through normal system behavior; investigate if repeated. | Do not force-delete or force-SENT. |

## Conditions requiring manual investigation / escalation

- Any `RECONCILIATION_REQUIRED` job.
- Any `WHATSAPP_PROVIDER_ACCEPTED_SENT_PERSISTENCE_FAILED` warning/error, especially `reconciliationHoldPersisted=false`.
- Repeated lease recovery for same ordinary job.
- Dead-letter growth or repeated permanent template/config failures.
- Any suspected duplicate send or missing customer notification.
- Any case where provider acceptance and local state disagree.

## Unresolved / not yet verified (do not invent)

- **Monitoring/alerting channel:** Not configured/verified in this milestone. Code emits structured logs only.
- **Operational ownership/support contacts/escalation roster:** Unresolved (OD-03/D-14/ops ownership).
- **Database repair commands/manual state mutations:** Not authorized/documented here. Direct production record edits are prohibited by default.
- **UAT/production reconciliation procedure:** Requires D-16/D-17/D-18, D-14, W01, Meta readiness, and explicit authorization.
- **Provider delivery confirmation workflow:** Requires Meta dashboard/API access under authorized ops process; not performed here.
- **Manual customer communication:** Requires appropriate authorization and confirmed provider/customer state.

## Stop conditions

Stop and escalate (authorized ops/security/engineering owner) if:
- there is any chance of duplicate customer messaging;
- provider state cannot be confirmed;
- evidence indicates consent/opt-out/template approval uncertainty;
- the required action would touch production DB, Meta, or customer messaging outside authorized process.