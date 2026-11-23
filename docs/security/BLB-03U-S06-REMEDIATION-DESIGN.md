# BLB-03U — Step 5B S06 Remediation Design (Design Only)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (unchanged)  
**Design date:** 2026-11-21  
**Mode:** **Design only. No implementation. No source/test/config/env/dependency changes.**  
**Approval record (Step 5C):** `docs/security/BLB-03U-S06-APPROVAL-RECORD.md` — explicit project-owner authorization for S06 Option A recorded 2026-11-21; no separate named CTO/client authorization invented.

> **Safety/compliance:** Read-only inspection of current working-tree source/tests/docs only. No application source, tests, configuration, dependencies, or environment files modified. No services started/stopped/restarted. No production/UAT databases accessed. No WhatsApp/email/OTP/Razorpay/Cloudinary/external-provider operations. No real customer data used and no secrets exposed. UAT Safe Mode/auth/authz/consent/safeguards not changed or bypassed. **No Git mutations performed.** All pre-existing modified and untracked work preserved.

## 1. Executive summary

S06 is a **confirmed, Informational/low-integrity** issue: the inbound WhatsApp `TRACK` handler creates a local `WhatsAppMessage` record with `direction: "OUTBOUND"` and `status: "SENT"` but performs **no Meta WhatsApp Cloud API dispatch** and does **no notification outbox enqueue**. The record is a synthetic local audit artifact, not proof of provider delivery.

**Recommended direction (pending product-owner confirmation): Option A — internal-only tracking/audit semantics.** Represent TRACK as an inbound command/event (or internal tracking audit record) with truthful semantics; do **not** create a synthetic outbound message marked `SENT`; do **not** claim WhatsApp delivery. This corrects audit semantics with minimal external side effects and preserves existing security controls.

**Option B — actual WhatsApp reply** is viable only if product explicitly requires a customer-facing WhatsApp tracking reply. It must use the existing notification outbox + provider-dispatch path and must satisfy consent, approved template, config, UAT Safe Mode, retry, and provider-acceptance semantics. It is higher complexity/risk and requires product/template/consent decisions.

**No implementation is approved by this document.** Historical WhatsAppMessage records must not be mutated/deleted/migrated without explicit approval.

## 2. Original S06 finding and confirmed evidence

### Original finding (BLB-03T-S06)
- **Source:** `docs/security/BLB-03T-SECURITY-REVIEW.md:102-110`
- **Severity:** Informational
- **Status:** Confirmed (source inspection)
- **Claim:** Inbound TRACK flow records an outbound "SENT" message without provider dispatch.

### Confirmed evidence (Step 5A assessment + source recheck)
- **Assessment:** `docs/security/BLB-03U-S06-READ-ONLY-ASSESSMENT.md`
- **TRACK routing:** `backend/src/controllers/whatsappWebhookController.ts:406-417` — `TRACK` / `TRACK <orderNumber>` routes to `trackOrderByNumber` or `trackLatestOrder`.
- **Ownership/correlation:** `:425-445` — latest order by `phone`; specific order by `orderNumber.toUpperCase()` + `phone`; no match returns silently.
- **S06 core:** `:450-463` — `recordTrackResponse` creates `WhatsAppMessage` with `direction:"OUTBOUND"`, `status:"SENT"`, synthetic `messageId: \`track-${orderNumber}-${Date.now()}\``, `bodyText`, `orderNumber`. **No Meta/provider dispatch, no `sendWhatsAppTemplate`, no outbox enqueue.**
- **Inbound logging exists separately:** `:292-306` logs inbound messages as `INBOUND/RECEIVED`.
- **Real dispatch contrast:** `backend/src/services/whatsappService.ts:120-188` sends via Meta Cloud API; `backend/src/services/notificationOutboxService.ts:408-573` enforces UAT/config/consent/template checks, sends, marks SENT only on provider acceptance and successful outbox SENT transition.
- **Webhook controls:** raw parser mount `backend/src/server.ts:86-93,123-125`; webhook routes `backend/src/routes/whatsappWebhookRoutes.ts:24-31`; signature verification/UAT/secret checks `whatsappWebhookController.ts:236-261,545-602`; dedupe via `WhatsAppWebhookEvent` unique `eventId` `:267-290,654-701`, model `backend/src/models/WhatsAppWebhookEvent.ts:28-45,62-66`.
- **Existing test locks behavior:** `backend/tests/whatsappWebhookOutboxCorrelation.test.ts:282-312` asserts TRACK creates synthetic OUTBOUND WhatsAppMessage with `status:"SENT"`.

### Pre-existing working-tree note
WhatsApp controllers/routes/models/services/tests and `docs/security/` are currently **untracked** in the dirty working tree; this assessment/design reflects that current working-tree state. No files were modified.

## 3. Option A versus Option B comparison

| Dimension | Option A — Internal-only tracking/audit semantics (preferred candidate) | Option B — Actual WhatsApp reply |
|---|---|---|
| **Intent** | Correct misleading local audit semantics; do not send WhatsApp reply. | Send an actual WhatsApp tracking reply to customer. |
| **Provider dispatch** | None. Explicitly no Meta API call and no outbox enqueue. | Required via existing `notificationOutboxService`/`whatsappService` flow only. |
| **Audit truthfulness** | High - record can state inbound TRACK command / internal tracking lookup, not provider-sent outbound message. | High if and only if marked SENT after provider acceptance; otherwise worse. |
| **Consent/template requirements** | No new WhatsApp send, so no marketing/template send; still must preserve STOP/consent behavior. | **Required.** Transactional consent, approved template, template registry/taxonomy support, variable mapping, opt-out handling. |
| **UAT Safe Mode** | Existing webhook UAT block remains; no external side effect added. | Must block real send in UAT-safe mode through existing outbox/service controls. |
| **Complexity** | Low-medium. Mainly webhook controller + message semantics/model/audit/UI/test alignment. | Medium-high. Needs event/template/registry/consent/outbox/idempotency/status-correlation/product copy decisions. |
| **Operational risk** | Low. No new external messaging. | Moderate. Misconfigured template/consent/idempotency could cause unwanted messages, duplicates, or compliance issues. |
| **Customer-facing change** | Likely none externally (no reply already). Internal/admin semantics become truthful. | Visible behavior change: customer receives WhatsApp reply (if approved). |
| **Idempotency** | Reuse existing webhook event dedupe; define behavior for duplicate TRACK events and synthetic-record uniqueness. | Must dedupe by provider/webhook event + outbox idempotency key; avoid duplicate customer replies on retries/replays. |
| **Historical data** | Existing synthetic `track-*` OUTBOUND/SENT rows remain historical artifacts unless separately approved for correction. | Same historical concern; plus new real messages create normal outbox/message records. |
| **Test impact** | Update `whatsappWebhookOutboxCorrelation.test.ts:282-312` and add semantics/no-dispatch assertions. | Large test expansion: template/consent/outbox/provider acceptance/UAT/retry/idempotency. |
| **Product-owner decisions** | Confirm no WhatsApp reply is required; confirm desired internal audit representation. | Confirm reply required, approved template/text/variables/language, consent category, event taxonomy, and UX/support expectations. |

### Recommendation
**Recommend Option A** as the default remediation candidate because S06 is an audit-semantics integrity issue and no evidence shows a product requirement for an actual WhatsApp TRACK reply. Option A fixes the confirmed problem without adding external messaging/compliance surface area.

**Option B should be selected only with explicit product-owner approval** and a complete template/consent/ops design.

## 4. Recommended design and rationale

### Recommended design (Option A, pending product-owner confirmation)

1. **Stop creating synthetic outbound `SENT` WhatsAppMessage records for TRACK.** Remove/replace `recordTrackResponse` behavior that writes `direction:"OUTBOUND", status:"SENT"`.
2. **Represent TRACK as an inbound command event with truthful semantics.** Preferred minimal approach: record an inbound WhatsAppMessage/audit entry that reflects a received TRACK command and lookup outcome, without claiming outbound provider delivery. For example, extend inbound logging metadata (structured, non-secret, no raw PII beyond existing phone normalization rules) or add a dedicated internal tracking-event record only if needed.
3. **Do not dispatch or enqueue any WhatsApp reply.** No `sendWhatsAppTemplate`, no `NotificationOutbox` enqueue, no Meta API call.
4. **Preserve existing controls.** Keep signature verification, verify-token checks, UAT webhook block, event dedupe, phone/order correlation, STOP/HELP behavior, and no unsolicited replies for unknown messages.
5. **Preserve admin/customer behavior where possible.** Order lookup logic remains read-only; customer-facing order tracking UI/API unaffected. Admin WhatsApp views should not interpret TRACK as provider-delivered outbound message.
6. **Make tests assert truthful semantics.** Replace "synthetic OUTBOUND SENT" expectation with "no provider dispatch/no outbox enqueue and truthful internal record semantics."

### Rationale
- Directly fixes confirmed S06 semantics mismatch.
- Avoids new external-provider, consent, template, and rate/abuse concerns.
- Minimizes schema/migration risk; can be implemented with small reviewable code/test changes.
- Aligns with existing evidence: TRACK currently has no provider send and no product/template support in WhatsApp event taxonomy/registry.

## 5. Product-owner decisions still required

1. **Is an actual WhatsApp TRACK reply required?** If yes, Option B is required and this Option A design is insufficient.
2. **If Option A:** what is the desired internal representation for TRACK?
   - A. Keep only inbound RECEIVED message log and no extra tracking record.
   - B. Add internal tracking metadata/event record (recommended for audit clarity) without OUTBOUND/SENT semantics.
   - C. Add a new WhatsAppMessage status/type for internal command handling (schema change; needs careful enum/migration consideration).
3. **Should admins see TRACK command activity in WhatsApp/admin audit views?** If yes, define where (existing WhatsApp Centre, order timeline, audit log, or none).
4. **Historical data handling:** leave existing synthetic `track-*` OUTBOUND/SENT records as-is, label in reports, or run an explicitly approved one-time correction/migration? **Default recommendation: leave as-is; no destructive migration.**
5. **If Option B ever chosen:** approved template name/language/variables, consent category, taxonomy/registry entry, idempotency key shape, and copy/support wording.
6. **Should duplicate TRACK commands for same order/phone within a window be deduped/suppressed beyond webhook event dedupe?** (optional product/ops noise control, not required for S06 fix).

## 6. Proposed code touchpoints and expected changes

| Area | File(s) | Expected change (design only) | Notes |
|---|---|---|---|
| TRACK handler semantics | `backend/src/controllers/whatsappWebhookController.ts` | Replace `recordTrackResponse` (`:450-463`) with truthful internal handling; adjust `trackLatestOrder`/`trackOrderByNumber` (`:425-445`) to return lookup result metadata; ensure no OUTBOUND/SENT synthetic record. | Core S06 fix. Keep phone/order correlation and silent no-match behavior unless product wants different UX (no external reply added in Option A). |
| Inbound command logging | `backend/src/controllers/whatsappWebhookController.ts` | Optionally enrich `logInboundMessage`/event metadata to capture command=`TRACK` and lookup outcome in a safe, non-secret, bounded form. | Avoid raw PII/secrets; consider existing `WhatsAppWebhookEvent.command` field. |
| Webhook event metadata | `backend/src/models/WhatsAppWebhookEvent.ts`, `whatsappWebhookController.ts:267-290` | Optionally set `command`, `phone`, `processedAt` consistently; consider handling duplicate-key create race as idempotent no-op. | `command`/`phone` fields already exist in schema. |
| Message schema/audit model | `backend/src/models/WhatsAppMessage.ts` | **Preferred:** no enum change; avoid OUTBOUND/SENT for TRACK. **Alternative:** only if product approves, add explicit internal status/type in a backward-compatible way. | Schema enum currently only SENT/DELIVERED/READ/FAILED/RECEIVED; adding values has wider impact. |
| Admin WhatsApp controller/UI | `backend/src/controllers/adminWhatsAppController.ts`, `app/admin/whatsapp/page.tsx` | Verify no UI/report assumes TRACK appears as outbox OUTBOUND/SENT. If TRACK activity surfaced, label clearly as inbound/internal command, not provider-delivered outbound message. | Admin controller currently focuses on NotificationOutbox; WhatsAppMessage display may be limited. Verify before implementation. |
| Outbox/service/taxonomy/registry | `backend/src/services/notificationOutboxService.ts`, `whatsappService.ts`, `whatsappEventTaxonomy.ts`, `whatsappTemplateRegistry.ts` | **Option A:** no behavioral change expected. **Option B only:** add approved TRACK reply event/template/consent/dispatch path. | Option A should not touch provider dispatch logic. |
| Tests | `backend/tests/whatsappWebhookOutboxCorrelation.test.ts`, `backend/tests/whatsappWebhook.test.ts`, `backend/tests/whatsappWebhookHttpIntegration.test.ts`, possibly new focused test | Update TRACK expectation; add no-dispatch/no-outbox/idempotency/failure assertions. | `whatsappWebhookOutboxCorrelation.test.ts:282-312` must be deliberately updated. |

## 7. Data model and audit implications

### Current model fit
- **`WhatsAppMessage`** (`backend/src/models/WhatsAppMessage.ts`): supports INBOUND/RECEIVED and OUTBOUND provider statuses; `messageId` unique; stores redacted body/meta. It does **not** have a clean "internal command handled / no provider dispatch" outbound semantic. Using OUTBOUND/SENT for TRACK is misleading.
- **`WhatsAppWebhookEvent`** (`backend/src/models/WhatsAppWebhookEvent.ts`): already has `eventId` unique, `eventType`, `processed`, `processedAt`, optional `phone`, optional `command`. This is the most natural existing place to record TRACK command occurrence idempotently.
- **`NotificationOutbox`**: for real provider dispatch lifecycle; not appropriate for Option A since no dispatch should occur.

### Recommended Option A data/audit shape
- **Do not create `WhatsAppMessage` OUTBOUND/SENT for TRACK.**
- **Minimum truthful record:** keep inbound WhatsAppMessage (`INBOUND/RECEIVED`) as today; mark webhook event as `command="TRACK"` (and optionally phone) in `WhatsAppWebhookEvent` when processing succeeds. This uses existing fields with low schema risk.
- **If richer audit is required by product:** add a dedicated, bounded internal audit/event field or model (e.g., tracking lookup outcome) in a separate approved design; avoid overloading provider-delivery statuses.
- **Synthetic message IDs:** eliminate `track-${orderNumber}-${Date.now()}` synthetic outbound IDs for Option A. If any internal record needs an ID, use deterministic/idempotent event-based IDs only with clear non-provider semantics.
- **Historical records:** existing `track-*` OUTBOUND/SENT WhatsAppMessage rows may remain. **No destructive migration/correction** without explicit approval. Reporting/UI should be careful not to present them as confirmed provider deliveries if surfaced.

### Option B data implications (only if approved)
- Requires NotificationOutbox job with idempotency key tied to inbound webhook event/message; WhatsAppMessage OUTBOUND should move through real provider lifecycle (accepted/SENT/DELIVERED/READ/FAILED) based on provider callbacks. No synthetic SENT before acceptance.

## 8. Idempotency and failure-handling design

| Scenario | Existing protection (confirmed) | Proposed Option A behavior | Notes |
|---|---|---|---|
| Duplicate webhook delivery (same Meta message id) | `recordWebhookEvent` checks existing `WhatsAppWebhookEvent.eventId`; skips if already processed (`whatsappWebhookController.ts:267-283,654-661`). | Keep as primary idempotency guard; ensure TRACK side effects occur only on first successful processing. | Existing behavior is good baseline. |
| Concurrent duplicate delivery / unique-key race | `eventId` unique in schema; controller `create` has no explicit duplicate-key catch (`:276-283`). | Handle duplicate-key create race as idempotent no-op/skip (safe improvement). | Design improvement; requires careful error-type check. |
| Partial failure after event record created but before TRACK handling complete | `markEventProcessed` called after handling in current flow (`:663-670`); create happens before handling. | Define transaction/order: either process-and-mark with retry-safe semantics, or use idempotent command audit write. Prefer idempotent writes keyed by eventId. | Current behavior may mark processed even on partial handling depending on exceptions; verify in implementation. |
| Retry behavior (Meta retries webhook) | Dedupe by eventId prevents reprocessing once recorded. | No provider dispatch in Option A; retries should not create duplicate audit artifacts. | For Option B, outbox idempotency key required. |
| Repeated TRACK messages with different provider event IDs | Each inbound message has different Meta message ID; dedupe is per event ID. | Treat as separate inbound commands; optionally add product-approved noise dedupe window, but not required for S06. | Avoid cross-event suppression that hides legitimate user commands unless approved. |
| TRACK lookup no-match / phone mismatch | Current code returns silently (`:427,443`). | Preserve no-match no-dispatch behavior; do not create misleading outbound record. Optionally record internal "lookup_not_found/not_owned" outcome only in safe bounded audit if approved. | No sensitive disclosure. |
| WhatsAppMessage unique `messageId` collision | Synthetic `track-${orderNumber}-${Date.now()}` currently risks same-ms collision; unique index exists. | Eliminate synthetic outbound TRACK message IDs in Option A. | Low likelihood but easy to remove. |

## 9. Security and UAT safeguards

### Must preserve
- **Webhook signature verification:** HMAC SHA256 over raw body with timing-safe compare; reject invalid signature (`whatsappWebhookController.ts:236-261,588-602`).
- **Verify-token check:** GET verification challenge/token validation (`:545-569`).
- **App secret presence check:** POST returns 503 when `WHATSAPP_APP_SECRET` missing (`:588-592`).
- **UAT Safe Mode:** GET/POST webhook endpoints blocked with 403 when `isUatExternalSideEffectsBlocked()` (`:549-586`); no external sends in UAT.
- **Event dedupe:** `WhatsAppWebhookEvent` unique `eventId` and processed guard.
- **Phone/order correlation:** TRACK lookup constrained by sender phone / order+phone.
- **No unsolicited reply:** unrecognized messages return no reply; HELP currently no reply.
- **STOP/consent safeguards:** STOP withdraws all consent via existing service; Option A must not bypass this.
- **Consent/template safeguards for real outbound messaging:** if Option B ever chosen, must use `notificationOutboxService`/`whatsappService`/template registry/consent checks; never mark sent before provider acceptance.

### Additional safeguards / operational work items
- **Webhook rate limiting / edge/WAF protection:** not observed in inspected app controller/routes. Assess as separate operational work item; do not implement infra changes in S06 code fix.
- **Audit log hygiene:** no secrets/tokens/raw Meta secrets; keep bodies redacted/bounded as existing model comment requires.
- **No historical destructive edits:** no DB cleanup/migration without explicit approval.

## 10. Detailed regression test matrix

| # | Scenario | Option A expected result | Relevant test file / proposed file |
|---|---|---|---|
| 1 | Valid TRACK by order number for owned order | Inbound RECEIVED message logged; webhook event processed; no `WhatsAppMessage` created as OUTBOUND/SENT for TRACK; lookup uses orderNumber+phone correlation; no provider dispatch; no outbox enqueue. If command audit added, it is truthful/internal. | Update `backend/tests/whatsappWebhookOutboxCorrelation.test.ts` (replace `:282-312`); optionally add case in `backend/tests/whatsappWebhook.test.ts`. |
| 2 | Valid TRACK latest order for owned phone | Same as #1, but latest-order-by-phone lookup path used. No synthetic OUTBOUND/SENT record. | `backend/tests/whatsappWebhook.test.ts` or new `backend/tests/whatsappWebhookTrackSemantics.test.ts`. |
| 3 | TRACK processing does not call Meta provider dispatch | `sendWhatsAppTemplate` / provider HTTP call spy not invoked; `notificationOutboxService` send path not invoked. | `whatsappWebhookOutboxCorrelation.test.ts` or new focused webhook test with mocks/spies. |
| 4 | TRACK processing does not enqueue outbound notification | `NotificationOutbox.countDocuments()` unchanged; no WhatsApp/EMAIL outbox job created for TRACK. | Same as #3. |
| 5 | Unknown order number or phone mismatch | No outbound record, no outbox, no provider dispatch; no sensitive order details leaked; handler returns safely. | `backend/tests/whatsappWebhook.test.ts` / new semantics test. |
| 6 | Invalid webhook signature | POST returns 400; no event/message/audit side effects from payload processing. | Existing `backend/tests/whatsappWebhookHttpIntegration.test.ts`; add/confirm assertion. |
| 7 | Duplicate event is idempotent | Same inbound webhook event delivered twice results in one processed effect; no duplicate TRACK audit record; no duplicate outbox/provider actions. | `whatsappWebhookOutboxCorrelation.test.ts` dedupe pattern; extend for TRACK. |
| 8 | Concurrent duplicate event behavior | Duplicate-key race on `WhatsAppWebhookEvent.eventId` handled as idempotent no-op (if implemented); no duplicate side effects. | New unit/integration test with mocked concurrent create/duplicate-key error; mark runtime DB behavior as verification if needed. |
| 9 | Partial failure and retry behavior | If command audit write fails after dedupe record, behavior is deterministic and documented (retry-safe/idempotent). No false OUTBOUND/SENT record created. | New focused test with mocked failure injection around audit write. |
| 10 | UAT Safe Mode blocks external side effects | GET/POST webhook endpoints return 403 `UAT_SAFE_MODE_EXTERNAL_BLOCKED`; no DB processing/dispatch. | Existing webhook/UAT tests; confirm coverage in `whatsappWebhookHttpIntegration.test.ts` / `uatSafeMode` related tests. |
| 11 | Existing real outbound notification flow still marks sent only after provider acceptance | Outbox/template send path unchanged: `markSent` only on provider acceptance; provider callback correlation still updates outbox/message statuses. | Existing `backend/tests/notificationOutbox.test.ts`, `backend/tests/whatsappWebhookOutboxCorrelation.test.ts` non-TRACK cases. |
| 12 | Existing admin order tracking and customer-facing behavior remain correct | TRACK command does not alter order status/data; admin/customer order tracking APIs/UI unaffected; WhatsApp admin views do not mislabel TRACK as provider-sent outbound notification. | Existing order/admin tests; manual/targeted UI verification after implementation approval; add API/UI assertions where practical. |

## 11. Rollout, rollback, and historical-data considerations

### Rollout (if approved for implementation)
1. Confirm product-owner decision: Option A vs Option B.
2. Implement small code change for TRACK semantics (no provider/outbox path).
3. Update/add tests, run focused WhatsApp/webhook/outbox suites, then broader backend regression.
4. Review admin WhatsApp/audit surfaces for misleading labels.
5. Deploy only through normal approved release process; no unapproved config/env/DB migration.

### Rollback
- Code rollback is low risk for Option A because it removes synthetic misleading record creation and adds no external side effect. Reverting would restore old misleading semantics, not preferred.
- If a new audit field/model is added, rollback must consider backward compatibility for readers; prefer additive fields.

### Historical data
- **Default:** leave existing synthetic `track-*` `WhatsAppMessage` OUTBOUND/SENT rows unchanged. No destructive cleanup/migration.
- **If correction requested later:** require explicit approval, backup, dry-run/report, and reversible migration plan. Do not silently rewrite audit history.
- **Reporting:** during transition, support/ops should be aware old TRACK rows may be synthetic; new behavior should be documented.

## 12. Risks, limitations, and unresolved operational questions

### Risks / limitations
- **Product intent ambiguity:** if customers expect WhatsApp TRACK replies, Option A may be functionally insufficient (but semantically truthful). Do not guess.
- **Schema evolution risk:** adding new WhatsAppMessage enum/status values can affect validators, UI filters, analytics, and tests. Prefer no enum change for Option A.
- **Dedupe race handling:** current create-then-check pattern may have unique-key race edge case; needs careful idempotent implementation.
- **Admin/UI dependency unknown:** some admin/reporting path may assume TRACK appears as OUTBOUND/SENT; verify before implementation.
- **Historical data ambiguity:** old synthetic records remain unless explicitly approved for correction.

### Unresolved operational questions
1. Do production logs/alerts/ops dashboards rely on TRACK `WhatsAppMessage` OUTBOUND/SENT records?
2. Are webhook endpoints protected by edge/WAF/rate limits in deployed environments?
3. Is there any support workflow telling customers to use WhatsApp TRACK and expecting a WhatsApp reply? (product/ops confirmation needed)
4. Should TRACK command audit be visible in admin WhatsApp Centre or only internal logs/events?
5. For Option B only: which approved WhatsApp template, language, consent basis, and idempotency policy are authorized?

## 13. Implementation sequence broken into small reviewable steps

1. **Approval gate:** obtain explicit product-owner decision on Option A vs Option B; confirm historical-data policy and admin visibility expectations.
2. **Design confirmation:** if Option A, confirm minimal audit representation (WebhookEvent command metadata only vs additional internal audit record). No schema enum churn unless approved.
3. **Code change (small):** update `whatsappWebhookController.ts` TRACK path to remove synthetic OUTBOUND/SENT WhatsAppMessage creation; preserve signature/UAT/dedupe/ownership/STOP/HELP behavior; optionally set `WhatsAppWebhookEvent.command="TRACK"` and safe metadata.
4. **Idempotency hardening (small, optional but recommended):** handle duplicate-key race for webhook event creation as idempotent no-op; add tests.
5. **Tests:** update `whatsappWebhookOutboxCorrelation.test.ts` TRACK expectation; add no-dispatch/no-outbox/unknown-order/duplicate-event assertions; keep real outbox/provider-acceptance tests green.
6. **Verification:** run focused webhook/outbox/consent/admin WhatsApp tests, then broader backend suite; run typecheck. Document any unrelated failures separately.
7. **Docs/status update:** update security review/status docs only after implementation verification and explicit approval.
8. **Do not do without approval:** Option B provider reply implementation, schema migrations, historical data correction, infra rate-limit changes, or S07 work.
