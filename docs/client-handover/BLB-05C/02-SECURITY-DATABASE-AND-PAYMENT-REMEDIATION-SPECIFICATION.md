# 02 — Security, Database & Payment Remediation Specification

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-05C — DOCUMENTATION ONLY — NO IMPLEMENTATION / NO EXECUTION AUTHORIZATION  
**Date:** 2026-11-21

## Status legend

VERIFIED STATIC EVIDENCE | VERIFIED DOCUMENTARY EVIDENCE | NOT VERIFIED | EXTERNAL EVIDENCE REQUIRED | BUSINESS/CLIENT DECISION REQUIRED | EXECUTION AUTHORIZATION REQUIRED | PROPOSED — NOT APPROVED

## A. S07 `CustomCakeSubmissionIdempotency` index readiness

| Item | Detail |
|---|---|
| Static evidence | `backend/src/models/CustomCakeSubmissionIdempotency.ts:1-50` — `idempotencyKey` required unique indexed; `expiresAt` indexed with `expires: 0`; `status/index` present; `createdRequestId` ref. |
| Verified documentary evidence | BLB-05A DB01 (HIGH), BLB-05B R-005, BLB-03X/03Y-PREP D-11 NOT AUTHORIZED. |
| Runtime verification still required | Confirm indexes exist in target DB; confirm duplicate key behavior, TTL expiry, invalid/missing `expiresAt` handling, rollback. |
| External infra evidence required | Access to approved UAT DB environment and backup/restore capability. |
| Database operation required | Prechecks + index creation/verification only if separately authorized. |
| Separate authorization required | **D-11 explicit execution authorization**. |
| Mandatory constraint | Future authorized UAT DB op only on `127.0.0.1:27018/bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true`. No 27017/27019/Atlas/prod. |
| Proposed prechecks (NOT APPROVED) | Backup/restore readiness; duplicate `idempotencyKey`; null/invalid `expiresAt`; existing index spec; disk/lock window; rollback script reviewed. |
| Acceptance criteria | Prechecks pass; unique+TTL indexes verified; no data loss; rollback documented; evidence captured. |

## B. Database schema/index verification requirements

| Item | Detail |
|---|---|
| Static evidence | Models in `backend/src/models/*` (Order, Product, User, Admin, CustomCakeRequest, WhatsApp*, NotificationOutbox, etc.) define schemas/indexes in code. |
| Not verified | Actual deployed DB indexes, drift, migration history, collection stats, data integrity in any env. |
| External evidence required | DBA/hosting access, backup/restore evidence, migration history. |
| DB operation required | Read-only schema/index inspection in authorized env; any fixes require separate auth. |
| Separate authorization required | Read-only DB inspection auth; any write/migration/index auth separate. |
| Proposed deliverable | Schema/ERD/data dictionary/invariant doc generated from code + authorized runtime verification. |

## C. CORS and no-origin request policy

| Item | Detail |
|---|---|
| Static evidence | `backend/src/server.ts:31,42,60-70` — `trust proxy=1`; `getTrustedOrigins()`; CORS allows no-origin requests; allows normalized trusted origins; `credentials: true`. `backend/src/lib/origin.ts` normalizes origin. `backend/src/middleware/csrf.ts` protects cookie-auth state-changing requests. |
| Risk | No-origin requests bypass origin allowlist (common for server-to-server/curl) but increase reliance on auth/CSRF/rate-limit/idempotency. |
| Not verified | Production proxy/header behavior, actual origin inventory, browser/client compatibility. |
| External evidence required | D-14 topology, CDN/WAF/proxy config, client origin inventory. |
| Separate authorization required | Any policy/code change; any infra change. |
| Proposed remediation (NOT APPROVED) | Document threat model; classify endpoints by auth mode; maintain strict allowlist for browser credentialed requests; evaluate no-origin restrictions per route class; add integration tests. |

## D. Rate limiting and multi-instance deployment considerations

| Item | Detail |
|---|---|
| Static evidence | `backend/src/middleware/rateLimit.ts` uses in-process `express-rate-limit` (prior audit). `server.ts` sets `trust proxy`. |
| Not verified | Multi-instance behavior, proxy client-IP correctness, WAF/CDN edge limits, Redis/distributed store. |
| External evidence required | D-14 infra topology, scaling model, trusted proxy chain, WAF/CDN config. |
| Separate authorization required | Any code/infra/config change; load/rate testing. |
| Proposed remediation (NOT APPROVED) | Document current limits; validate `trust proxy` against real topology; add distributed store/edge rate limiting for prod; alert on 429 spikes. |

## E. Sensitive-data logging and redaction

| Item | Detail |
|---|---|
| Static evidence | `backend/src/lib/logger.ts` has redaction (prior audit); several controllers use `console.error/warn` (BLB-05A B03/S04). |
| Not verified | Production log sinks, retention, access controls, actual emitted PII/secrets. |
| External evidence required | Log platform config, retention/access policy. |
| Separate authorization required | Code changes, logging platform changes. |
| Proposed remediation (NOT APPROVED) | Standardize logger; lint rule banning console in backend; redact phone/email/address/OTP/token/secret/cookie/auth headers; log review checklist. |

## F. Secret ownership, transfer, and rotation

| Item | Detail |
|---|---|
| Static evidence | `.env.example`, `backend/.env.example`, `render.yaml`, `vercel.json` contain names/refs only; no secret values documented. |
| Not verified | Actual secret owners, rotation dates, storage, transfer process. |
| External evidence required | Client/ops secret ownership, vault/platform access. |
| Separate authorization required | Any secret rotation/transfer/access change. |
| Proposed remediation (NOT APPROVED) | Names-only secret matrix: owner, env, rotation cadence, storage, transfer checklist, incident rotation trigger. No values in docs. |

## G. Razorpay webhook verification and idempotency

| Item | Detail |
|---|---|
| Static evidence | `backend/src/controllers/paymentController.ts`: `verifySignature` uses HMAC SHA256 and `crypto.timingSafeEqual` (lines ~48-67,701-709); webhook uses raw body, `x-razorpay-signature`, `RAZORPAY_WEBHOOK_SECRET` (lines ~753-784); idempotent/reconciliation paths noted (prior audit, lines ~226,660+ observed). `server.ts` mounts raw parsers before JSON for webhook routes. |
| Not verified | Live Razorpay webhook delivery, replay/order edge cases in prod, dashboard config. |
| External evidence required | Razorpay sandbox/prod dashboard config, webhook secret ownership, event logs. |
| DB operation required | None for spec; any data fix requires auth. |
| Separate authorization required | Sandbox/provider testing; any code change; any prod operation. |
| Proposed remediation (NOT APPROVED) | Maintain raw-body signature verification; ensure idempotency by event/payment/order IDs; structured audit log; reconciliation runbook; sandbox test cases. |

## H. Payment failure, duplicate callback, and reconciliation scenarios

| Item | Detail |
|---|---|
| Static evidence | `paymentController.ts` handles create/retry/verify/webhook; duplicate/superseded/released-inventory/review paths per prior audit; amount sourced from DB order. |
| Not verified | Real provider failure modes, webhook retries, delayed capture, refund flows. |
| External evidence required | Razorpay sandbox behavior, business refund policy. |
| Separate authorization required | Sandbox testing, any refund/capture/live operation. |
| Proposed scenarios (NOT APPROVED) | Invalid signature -> 400/reject; duplicate webhook -> idempotent 200; amount mismatch -> reject/review; capture after cancel -> reconciliation; verify failure -> no paid state; duplicate callback -> no double inventory transition. |