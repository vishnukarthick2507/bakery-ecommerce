# BLB-12A — Final Technical Gap Report

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-12A — Final Technical Gap Verification & Targeted Remediation Plan  
**Mode:** READ-ONLY inspection (no code/test/config/env/dependency changes; no tests/UAT/DB/provider calls; no deploy/release)  
**Date:** 21 November 2026

## Git status

| | Total | Tracked | Untracked |
|---|---:|---:|---:|
| Before BLB-12A | 107 | 59 | 48 |
| After BLB-12A | 107 | 59 | 48 |

Delta in `git status --short`: 0 (report created inside already-untracked `docs/client-handover/`). No pre-existing file modified, deleted, renamed, staged, or cleaned.

## Scope / evidence inspected

- Repo identity and git status verified.
- Reviewed: BLB-05A, BLB-05C, BLB-09B, BLB-10A, BLB-10B, BLB-11A.
- **17 November F1 implementation report:** **not found in inspected repo materials**. Claims referenced by prompt ("Checkout consent timing fix; 7 regression scenarios passed; backend 517/517; TS checks passed; frontend production build passed") could **not** be re-executed or independently verified in this read-only milestone.
- Code inspected (targeted): `app/checkout/page.tsx`, `backend/src/controllers/orderController.ts`, `backend/src/controllers/customCakeController.ts`, `backend/src/controllers/paymentController.ts`, `backend/src/controllers/customerAuthController.ts`, `backend/src/controllers/whatsappWebhookController.ts`, `backend/src/routes/whatsappRoutes.ts`, `backend/src/routes/whatsappWebhookRoutes.ts`, `backend/src/services/whatsappConsentService.ts`, `backend/src/services/notificationOutboxService.ts`, `backend/src/server.ts`, and git-status evidence for untracked WhatsApp/admin/test files.

## 1) What is already completed? (evidence-based)

| Area | Status | Evidence | Notes |
|---|---|---|---|
| WhatsApp consent service (grant/withdraw/status, category separation, normalisation) | Implemented in working tree | `backend/src/services/whatsappConsentService.ts` | Transactional/marketing separation present; STOP withdraw-all supported. |
| Public consent endpoint privacy hardening | Implemented | `backend/src/routes/whatsappRoutes.ts` returns 410 `CONSENT_ENDPOINT_DISABLED` for public consent read/write routes | Prevents unauthenticated phone-based disclosure/mutation. |
| WhatsApp webhook raw-body + signature verification | Implemented | `backend/src/server.ts` mounts `express.raw` for `/api/whatsapp/webhook` before `express.json`; `whatsappWebhookController.ts` uses HMAC SHA256 + `timingSafeEqual`; verify token handled | Good baseline; runtime/provider config not verified. |
| WhatsApp webhook idempotency & STOP handling | Implemented | `whatsappWebhookController.ts` `recordWebhookEvent`/`markEventProcessed`, status event dedupe, STOP -> `withdrawAllConsent` | Inbound TRACK/HELP are internal/no-reply as coded. |
| Outbox durability/retry/lease/idempotency/consent enforcement | Implemented (code) | `backend/src/services/notificationOutboxService.ts` | Atomic claim, lease recovery, backoff, dead-letter, UAT suppression, transactional consent checks before send, template validation, metaMessageId persistence. |
| Provider delivery status correlation | Implemented (code) | `whatsappWebhookController.ts` `applyOutboundProviderDeliveryCallback`, exact `metaMessageId` correlation; rank/timestamp stale protection | No phone fallback for outbox correlation. |
| Payment webhook raw-body/signature verification | Implemented (code) | `backend/src/server.ts` raw mount `/api/payments/webhook`; `paymentController.ts` HMAC + `timingSafeEqual` | Runtime/provider idempotency not reverified here. |
| Backend consent plumbing in order/custom-cake controllers | Implemented (partial) | `orderController.ts` accepts `whatsappConsent`, grants consent best-effort before ORDER_PLACED; `customCakeController.ts` accepts/persists/grants | Frontend capture missing (see findings). |

## 2) Genuine remaining technical findings

| ID | Actual problem | Evidence/file | Severity | Required fix | Dependency |
|---|---|---|---|---|---|
| BLB12A-01 | Checkout UI does not capture explicit WhatsApp transactional consent; `whatsappConsent` is never submitted by frontend. Backend can grant only when field is true. | `app/checkout/page.tsx` (no `whatsappConsent`/opt-in UI; grep shows no consent control); `backend/src/controllers/orderController.ts:81-83,545-556` accepts/grants optional boolean; frontend grep `app/components/lib` returned no `whatsappConsent` | **HIGH** | Add explicit unchecked-by-default WhatsApp transactional consent checkbox + clear copy at checkout; include `whatsappConsent` in checkout payload only when user affirmatively opts in; show status clearly (no implied consent). Keep order placement possible without consent where business rules allow. | W01 legal/compliance validation for final wording; BLB-09B W01 policy already recorded. |
| BLB12A-02 | Custom cake frontend has no explicit WhatsApp consent capture; backend supports `whatsappConsent` but UI cannot supply it. | `backend/src/controllers/customCakeController.ts:13,57,142,261` accepts/grants; frontend grep no `whatsappConsent` in `app/components/lib` | **MEDIUM** | Add explicit opt-in control/copy to custom cake submission flow; pass boolean to API; do not infer from phone number. | W01 legal/compliance validation for final wording. |
| BLB12A-03 | Previously reported F1 "checkout consent timing fix / 517/517 / 7 scenarios / TS/build pass" is not verifiable in inspected repo materials and current checkout still lacks consent UI. | Prompt claims vs repo inspection: no 17 Nov F1 report found; `app/checkout/page.tsx` lacks consent UI; git log shows unrelated recent fixes | **NOT VERIFIED** | Locate original F1 report/artifacts or re-run authorized verification in controlled scope; reconcile report claims with current branch state before handover. | Separate authorization for test/build execution (Group 5 Op 3/related) if re-verification needed. |
| BLB12A-04 | Dirty/unreviewed release boundary (107/59/48) includes many tracked modifications and untracked feature/docs/test artifacts; handover/release candidate is not clean. | `git status --short` count 107/59/48; modified core files + untracked WhatsApp/admin/test/docs paths | **HIGH** | Create reviewed release-scope manifest; classify keep/exclude/move; obtain separate authorization before any git cleanup/packaging. | Owner decision OD-04; separate execution authorization. |
| BLB12A-05 | No verified runtime/provider/UAT evidence for WhatsApp, Razorpay, email/OTP, Cloudinary, deployment/DR. | BLB-10A/11A; no new external evidence; read-only milestone cannot verify runtime | **NOT VERIFIED** | Obtain/record external evidence and run separately authorized sandbox/UAT checks. | W01 legal, D-14, Group 5 auths, provider sandbox access. |

## 3) Detailed finding notes (required fields)

### BLB12A-01 — Checkout WhatsApp consent capture missing
- **Exact file/function:** `app/checkout/page.tsx` (checkout form/payload construction; no consent state/field). Backend counterpart: `backend/src/controllers/orderController.ts:createOrder` / schema `createOrderSchema` (`whatsappConsent` optional boolean) and consent grant block at ~545-556.
- **What is wrong:** UI never collects explicit transactional WhatsApp consent; payload cannot communicate opt-in.
- **Why it matters:** Prevents compliant opt-in capture, creates audit gap, and can block WhatsApp notifications even when customer intended them; also conflicts with W01 business-policy requirement for explicit opt-in.
- **Smallest recommended correction:** Add a single unchecked checkbox with W01-approved transactional copy, persist its boolean in form state, send `whatsappConsent: true` only when checked; keep backend best-effort grant but only on explicit true.
- **How to verify:** Authorized UI test/manual UAT: unchecked -> order places, no consent grant; checked -> order places, consent record GRANTED TRANSACTIONAL with source CHECKOUT/audit history; existing order flow unaffected.

### BLB12A-02 — Custom cake consent capture missing
- **Exact file/function:** Custom cake frontend form (no `whatsappConsent` field found by grep in `app/components/lib`); backend `backend/src/controllers/customCakeController.ts` schema/`mapToRequestData`/grant block accepts `whatsappConsent`.
- **What is wrong:** No explicit opt-in UI for custom-cake WhatsApp updates.
- **Why it matters:** Same compliance/audit/operability gap for custom-cake notifications.
- **Smallest recommended correction:** Add explicit unchecked opt-in checkbox and pass `whatsappConsent` boolean; no phone-based inference.
- **How to verify:** Authorized test: submit with/without opt-in; confirm consent record/audit behavior and no notification without valid consent.

### BLB12A-03 — Prior F1/report claims not reverified
- **Exact file/function:** N/A (documentation/evidence gap).
- **What is wrong:** Claimed F1 report/results not found in repo; current code contradicts "checkout consent timing fix" claim.
- **Why it matters:** Handover decisions could rely on stale/incorrect evidence.
- **Smallest recommended correction:** Locate F1 artifact or re-run targeted verification after separate authorization.
- **How to verify:** Produce dated test/build logs with command scope, commit/worktree identity, and pass/fail counts.

### BLB12A-04 — Release boundary not clean
- **Exact file/function:** Repository working tree.
- **What is wrong:** 107 dirty entries; mix of feature, fix, tests, docs, generated/untracked artifacts.
- **Why it matters:** Cannot create auditable release candidate or client handover package.
- **Smallest recommended correction:** Owner-approved release-scope manifest + separate git-cleanup/packaging authorization.
- **How to verify:** Clean reviewed branch/worktree or tagged release candidate with manifest and checksum/reproducible build evidence.

### BLB12A-05 — Runtime/provider/UAT evidence missing
- **Exact file/function:** N/A (external/operational).
- **What is wrong:** No verified live/sandbox provider behavior, no authorized UAT, no D-14/DR evidence.
- **Why it matters:** Code presence is not production/handover readiness.
- **Smallest recommended correction:** Complete BLB-11A OD-01/OD-02, then separately authorize narrow sandbox/UAT operations.
- **How to verify:** Authorized evidence packages with provenance, dates, named operators, redacted outputs.

## 4) What still needs coding?

**Minimum code changes (if authorized):**
1. **BLB12A-01 (HIGH):** Checkout explicit WhatsApp transactional consent capture + payload wiring + UI copy/state.
2. **BLB12A-02 (MEDIUM):** Custom-cake explicit WhatsApp consent capture + payload wiring.
3. **Optional hardening only after defect confirmed:** any issue found during authorized test run/review (do not preemptively refactor).

**No major redesign/rewrite indicated** by this inspection. WhatsApp backend/outbox/webhook/consent plumbing appears substantially present in working tree.

## 5) What needs testing? (requires separate authorization)

- Frontend build/typecheck and targeted tests for checkout/custom-cake consent flows.
- Backend tests covering consent grant on checkout/custom-cake, no grant when unchecked, STOP withdrawal, webhook idempotency/signature, outbox consent suppression/retry.
- Authorized sandbox/UAT: WhatsApp template/send/status, Razorpay sandbox, email/OTP, Cloudinary, admin/customer flows. **Not executed here.**

## 6) What requires external evidence or specialist verification?

- **W01 legal/compliance validation** (wording/capture/retention/withdrawal/legal basis) — Category B/external.
- **D-14 infrastructure/operational evidence** (hosting/WAF/CDN/proxy/TLS/rate-limit/secrets/logging/backup/restore/rollback/monitoring/incident ownership) — Category B.
- **Provider evidence/config verification** (Meta WhatsApp Business/sender/templates, Razorpay sandbox/prod, email/OTP, Cloudinary) — external/provider.
- **Authorized UAT evidence** (D-16/D-17/D-18; synthetic data; isolated env) — execution authorization required.
- **DR/backup/restore/rollback verification** — operational evidence.
- **Client acceptance & D-19 production release authorization** — owner/client decision.

## 7) Exact remaining blockers to client handover

1. **W01 legal/compliance validation missing** (external).
2. **D-14 infra/ops evidence missing** (external).
3. **Checkout/custom-cake explicit consent UI gaps** (code, HIGH/MEDIUM).
4. **Unverified prior F1/test/build claims; no fresh authorized verification** (evidence gap).
5. **Dirty release boundary / no reviewed release candidate** (release governance).
6. **No authorized UAT/runtime/provider/DR evidence** (execution + external).
7. **Group 5 all DEFER / D-19 NO-GO** (authorization).

## 8) Smallest practical sequence to finish the project

1. **Owner decisions (no execution):** OD-01 W01 legal validation engagement; OD-02 D-14 evidence owners; OD-03 acceptance criteria; OD-04 release scope boundary.
2. **Code (separate Op 1 auth):** Fix BLB12A-01 and BLB12A-02 only - add explicit consent capture in checkout/custom-cake UI and payload wiring; use W01-approved copy once available (or placeholder clearly marked pending legal approval, not sent to production).
3. **Verification (separate Op 2/3 auth):** Run targeted tests/typecheck/build for touched areas; capture dated evidence.
4. **External evidence:** Obtain W01 legal approval and D-14 package.
5. **Authorized isolated UAT/sandbox (separate Op 4-9 auths):** Synthetic data, D-11 UAT DB only if needed (`127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`), provider sandboxes, CUST/ADM UAT.
6. **Release readiness (separate Op 10-12 as applicable):** DR/backup/rollback/monitoring/runbooks, release candidate packaging, deployment readiness evidence.
7. **Final acceptance + D-19 (separate Op 13):** client sign-off and explicit production release authorization.

## Final control statement

- Read-only inspection only. No code/tests/config/env/deps changed. No tests/UAT/DB/provider calls/deploy/release performed.
- No prior milestone records changed.
- BLB-09B Group 5 remains **13/13 DEFER, 0/13 granted**. D-19 remains **NO-GO**.
- This report identifies minimum remaining work; it does **not** authorize implementation or execution.