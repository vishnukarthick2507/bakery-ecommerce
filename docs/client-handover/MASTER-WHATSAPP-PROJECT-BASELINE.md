# MASTER WHATSAPP PROJECT BASELINE

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Audit date:** 2026-11-22  
**Audit type:** Phase 0 read-only audit (no source/config/test/env/dependency/DB/provider/Meta/deploy/Git mutation changes)  
**Project status:** **NOT READY / NO-GO**

---

## 1. Executive Summary

This baseline consolidates the current repository, documentation, code, test inventory, notification/WhatsApp implementation, decision register, and external blockers for the WhatsApp Business Automation project. It is an evidence baseline only; it does **not** authorize implementation, testing, UAT, Meta submission, deployment, production release, or external provider actions.

**Key facts (verified):**
- Git baseline is preserved: branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`, dirty worktree `107 total / 58 tracked / 49 untracked` (before and after audit). `docs/client-handover/` remains untracked.
- WhatsApp stack exists in code: template registry, consent service/model, outbox model/service, WhatsApp Cloud API service, webhook verify/receive controller/routes, admin WhatsApp routes/controller, notification preference model, UAT-safe external side-effect blocking.
- **Critical gaps remain:** no outbox worker/processor loop is started in `backend/src/server.ts`; all 18 WhatsApp templates are not Meta-submitted/approved; D20-08 is partially approved and BLB-21 is NOT AUTHORIZED; D20-08-C approved Option B (2026-11-22, generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link); D20-08-D/E/F and D20-05-B/E/F remain NOT DECIDED; D20-01/D20-09 remain NOT DECIDED; legal/compliance/external gate evidence remains unresolved; no live WhatsApp delivery verified.
- **Documentation/code discrepancy observed:** BLB-18/19 state all 18 templates `NOT_SUBMITTED`/`enabled:false`; current `backend/src/services/whatsappTemplateRegistry.ts` shows 8 templates `APPROVED`/`enabled:true` and 10 `NOT_SUBMITTED`/`enabled:false`. Registry `APPROVED` in code is **not** Meta approval and must not be treated as send readiness.

---

## 2. Git Baseline / Worktree Preservation

| Item | Observed value | Evidence |
|---|---|---|
| Branch | `feature/whatsapp-business-automation` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` | `git rev-parse HEAD` |
| Status before audit | `107 total / 58 tracked / 49 untracked` | `git status --short` counts |
| Status after audit/docs creation | `107 total / 58 tracked / 49 untracked` | `git status --short` counts; `docs/client-handover/` already untracked |
| Git mutations performed | **None** | No add/commit/push/pull/merge/rebase/reset/clean/stash/checkout/switch/restore/amend/cherry-pick |

**Constraint:** Preserve all pre-existing dirty/staged/untracked files. Do not assume untracked files are disposable.

---

## 3. Architecture Snapshot

### 3.1 Frontend
- **Framework:** Next.js 16.3.3 App Router, React 19, TypeScript 5.7.3, Tailwind CSS 4, shadcn/base-ui/lucide/sonner/swr. (`package.json`)
- **Key areas:** checkout, account orders, track order, custom cake form, admin orders/customers/products/settings/analytics. Public track page: `app/track/page.tsx`; authenticated customer order detail: `app/account/orders/[orderNumber]/page.tsx`.

### 3.2 Backend
- **Framework:** Express 5, TypeScript, Node ESM, tsx, Mongoose 9, Zod, JWT cookie auth, helmet, cors, cookie-parser, rate limiting, CSRF middleware. (`backend/package.json`, `backend/src/server.ts`)
- **Key integrations/services present in code:** MongoDB/Mongoose, Razorpay, Cloudinary, Nodemailer/Brevo email service, WhatsApp Cloud API service, Google auth, PDF/Excel reporting.

### 3.3 Server/runtime wiring (`backend/src/server.ts`)
- Raw body parsing for Razorpay webhook (`/api/payments/webhook`) and WhatsApp webhook (`/api/whatsapp/webhook`) before `express.json()` — required for signature verification.
- Routes mounted: products, orders, custom-cake, payments, auth/admin auth, analytics/admin, admin orders/customers/inventory/uploads, customer uploads, settings, admin WhatsApp, WhatsApp routes, WhatsApp webhook routes.
- UAT-safe mode enforced on startup when enabled; blocks unsafe Mongo target and external side effects.
- Workers started: inventory expiry, proposal expiry. **No notification outbox worker started.**

### 3.4 Data/notification components (code-observed)
- **WhatsApp models:** `WhatsAppConsent`, `WhatsAppMessage`, `WhatsAppWebhookEvent`, `WhatsAppNotificationPreference`, `NotificationOutbox`.
- **Services:** `whatsappTemplateRegistry.ts`, `notificationOutboxService.ts`, `customerOrderNotifications.ts`, `customCakeNotifications.ts`, `whatsappService.ts`, `whatsappConsentService.ts`, `uatSafetyLog.ts`, `proposalExpiry.ts`.
- **Routes/controllers:** `whatsappRoutes.ts` (public consent endpoints disabled 410), `whatsappWebhookRoutes.ts`, `adminWhatsAppRoutes.ts`, `whatsappWebhookController.ts`, `adminWhatsAppController.ts`.

---

## 4. WhatsApp/Notification Implementation Status

| Area | Status | Evidence | Notes / Risk |
|---|---|---|---|
| Template registry | **Implemented, fail-closed validation present** | `whatsappTemplateRegistry.ts` | 18 entries. 8 `APPROVED/enabled:true`: order_received, payment_received, order_confirmed, order_preparing, order_ready, order_out_for_delivery, order_completed, order_cancelled. 10 `NOT_SUBMITTED/enabled:false`: payment_failed, custom cake 6, reschedule requested/accepted/rejected. Registry approval != Meta approval. |
| Outbox model/service | **Implemented (partial)** | `notificationOutboxService.ts` | Durable enqueue, claim, lease, retry/backoff, dead-letter, UAT suppression, consent checks, template validation, WhatsApp/EMAIL dispatch. **No worker loop/scheduler started in server**; `claimJob/processJob/recoverExpiredLeases` not wired into runtime. |
| Customer order notifications | **Implemented for mapped events** | `customerOrderNotifications.ts` | Maps ORDER_PLACED, PAYMENT_CONFIRMED, STATUS_CHANGED (CONFIRMED/PREPARING/READY/READY_FOR_PICKUP/OUT_FOR_DELIVERY/DELIVERED/COLLECTED), CANCELLED, PAYMENT_FAILED, RESCHEDULE_REQUESTED/ACCEPTED/REJECTED. No RESCHEDULE_PROPOSED WhatsApp mapping. |
| Custom cake notifications | **Implemented in service layer (inspect for trigger completeness)** | `customCakeNotifications.ts` (present) | Registry entries for 6 custom-cake templates exist but are NOT_SUBMITTED/disabled. |
| WhatsApp Cloud API send | **Implemented best-effort** | `whatsappService.ts` | Uses env vars `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`; timeout; no secret logging; normalizes phone; UAT-safe blocked. No confirmed live credentials. |
| Webhook verify/receive | **Implemented** | `whatsappWebhookController.ts`, `whatsappWebhookRoutes.ts`, `server.ts` raw body | GET verify, POST receive, `x-hub-signature-256` HMAC verification, idempotent event recording, STOP withdraw-all, TRACK/HELP internal handling, status callback correlation to outbox by exact `metaMessageId`, UAT-safe blocked. |
| Public consent endpoints | **Disabled (good)** | `whatsappRoutes.ts` | GET/POST consent routes return 410 `CONSENT_ENDPOINT_DISABLED`; no unauthenticated phone-based consent disclosure/mutation. |
| Admin WhatsApp UI/API | **Implemented** | `adminWhatsAppRoutes.ts`, `adminWhatsAppController.ts` | Stats, message list/detail, retry, consents, notification preferences. Correlation uses exact metaMessageId only. |
| Consent capture | **Partially implemented** | `whatsappConsentService.ts`, checkout/custom-cake flows | Transactional/marketing separation, grant/withdraw/withdrawAll, STOP via webhook. Checkout has `whatsappConsent` checkbox (`app/checkout/page.tsx:128,542,1415`). Needs full audit of all capture points and legal/compliance validation. |
| UAT safety | **Implemented** | `uatSafeMode.ts`, server/outbox/whatsapp/webhook checks | Blocks external side effects when UAT_SAFE_MODE enabled; requires verified local UAT Mongo target `127.0.0.1:27018/bluebell_whatsapp_uat`. |
| Notification preferences | **Implemented** | `WhatsAppNotificationPreference` model/controller | Admin can list/update event preferences; outbox/notification paths consult preferences (observed in notification services). |

---

## 5. Known Defects / Risks / Gaps (Evidence-Based)

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| G-01 | **Critical** | No notification outbox worker/processor is started by server. | `server.ts` starts inventory/proposal expiry workers only; no outbox worker import/start; `notificationOutboxService.ts` exposes claim/process/recover but no loop. | Enqueued WhatsApp/email outbox jobs may never be delivered. |
| G-02 | **Critical** | RESCHEDULE_PROPOSED has no WhatsApp template/registry/outbox mapping. | `customerOrderNotifications.ts` has no case; `notificationOutboxService.ts` direct/status mapping lacks RESCHEDULE_PROPOSED; `whatsappTemplateRegistry.ts` has no reschedule_proposed template. `orderController.ts` emits STATUS_CHANGED/RESCHEDULE_PROPOSED. | Admin-initiated reschedule proposal cannot send WhatsApp via current mapped path. |
| G-03 | **High** | Reschedule acceptance UTC formatting inconsistency (D20-06-F). | Previously recorded in decision register/BLB-20M/N evidence; `orderController.acceptProposal` writes UTC ISO date / UTC HH:MM:SS (known). | Customer-facing schedule formatting/semantics can be wrong until separately authorized fix. |
| G-04 | **High** | Template registry state conflicts with BLB-18/19 docs. | `whatsappTemplateRegistry.ts` shows 8 templates APPROVED/enabled:true, 10 NOT_SUBMITTED/enabled:false; BLB-18/19 report all 18 NOT_SUBMITTED/enabled:false. | Risk of accidental sends if WhatsApp configured and worker existed; governance/documentation drift; must be reconciled before any enablement. |
| G-05 | **High** | No verified Meta WhatsApp credentials/live delivery; all templates not Meta-submitted/approved. | Decision register/external status; env not inspected for secrets (forbidden). | Cannot claim real WhatsApp delivery. |
| G-06 | **High** | D20-08-D/E/F unresolved; BLB-21 not authorized. D20-08-C approved (Option B, 2026-11-22). | BLB-20W/20X, decision register. | Cannot implement/administer D20-08 compliant reschedule-proposed notification until remaining sub-decisions/authorizations resolved. |
| G-07 | **Medium** | Public track page cannot respond to reschedule proposals. | `app/track/page.tsx` no proposal UI/fields; track endpoints omit proposal fields; account page has response UI. | D20-08-C Option A was unsafe as-is; owner approved Option B (2026-11-22) — generic contact S.V. Sweets & Bakers, no tracking-page response mechanism/button/direct acceptance link. |
| G-08 | **Medium** | Consent/compliance/legal evidence incomplete. | W01 not received; D-14/D-16-D-18 unresolved; Group 5 0/13 granted; D-19 NO-GO. | No production/legal clearance. |
| G-09 | **Medium** | Webhook processes commands/status callbacks but no provider reply sending path for HELP/TRACK by design; ensure product expectation clear. | `whatsappWebhookController.ts` handles STOP/HELP/TRACK; TRACK does DB lookup only, no reply. | Customer experience may expect reply; currently internal/audit only. |
| G-10 | **Medium** | Outbox retry/admin retry endpoints need operational hardening review before production. | `adminWhatsAppController.retryWhatsAppMessage` resets attempts and requeues; worker missing. | Retry semantics incomplete without worker; potential abuse/ops risk if exposed without controls. |

---

## 6. Decision Register / Owner-Decision Status

Source of truth: `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md` (and BLB-20A/B/W/X). Do not invent/assume approvals.

| Decision | Status | Notes |
|---|---|---|
| D20-01 Production domain | **NOT DECIDED / EXTERNAL CONFIRMATION REQUIRED** | Canonical domain/ownership/URL destination unresolved. |
| D20-02 Payment amount formatting | **APPROVED BY PROJECT OWNER** | ₹, Indian grouping, 2 decimals, order amount semantics; documentation decision only. |
| D20-03 Payment method labels | **APPROVED BY PROJECT OWNER** | COD→Cash on delivery, ONLINE→Online payment, PAY_AT_STORE→Pay at store. |
| D20-04 Order confirmation wording | **APPROVED BY PROJECT OWNER** | Remove `{{status}}`; approved wording/emojis; retain `{{customerName}}/{{orderNumber}}`. |
| D20-05 Custom cake quote | **PARTIALLY APPROVED** | A/C approved; D resolved via D20-06; B/E/F NOT DECIDED. `{{trackingUrl}}` unresolved. |
| D20-06 Date/time/timezone | **APPROVED BY PROJECT OWNER** | DD MMM YYYY, 12-hour AM/PM, IST display; preserve ranges; no IST double-append; storage unchanged; D20-06-F UTC reschedule inconsistency is implementation prerequisite. |
| D20-07 Customer alternative-time request | **APPROVED BY PROJECT OWNER** | Requested alternative only; pending review/availability confirmation; existing schedule unchanged until confirmed; approved content NOT IMPLEMENTED; `{{requestedAlternativeDateTime}}` proposed/not registered; implementation NOT GRANTED. |
| D20-08 Admin reschedule proposal | **PARTIALLY APPROVED** | A approved Option B (dedicated template); B approved Option A (`{{proposedSchedule}}` per D20-06, proposed/not registered/mapped); C approved Option B (2026-11-22, generic contact S.V. Sweets & Bakers; no tracking-page response mechanism/button/direct acceptance link/unverified specific channel); **D/E/F NOT DECIDED**. BLB-21 NOT AUTHORIZED. |
| D20-09 Custom-cake tracking URL | **NOT DECIDED** | List vs detail destination unresolved; depends on D20-01/access/route confirmation. |

**D20-08-C current review state:** **APPROVED BY PROJECT OWNER — Option B (2026-11-22).** Decision: instruct customers to contact S.V. Sweets & Bakers to discuss the proposed schedule; do not direct customers to public tracking page as response mechanism; do not invent WhatsApp button/direct acceptance link/unverified specific contact channel. Evidence: BLB-20W/20X and explicit owner approval (2026-11-22). D20-08-D/E/F remain NOT DECIDED; BLB-21 NOT AUTHORIZED. |

---

## 7. External Dependencies / Blockers

| Blocker | Status | Owner / Type | Notes |
|---|---|---|---|
| D20-08-D/E/F, D20-05-B/E/F, D20-01, D20-09 | **NOT DECIDED** | Project Owner | Required before corresponding implementation/content finalization. D20-08-C approved Option B (2026-11-22). |
| BLB-21 implementation authorization | **NOT AUTHORIZED** | Project Owner | No implementation until explicit authorization. |
| W01 legal/compliance written validation | **NOT RECEIVED** | Legal/compliance/external | Required before production-facing WhatsApp consent/content use. |
| D-14, D-16/D-17/D-18, BLB-11A OD-01–OD-05 | **NOT RECEIVED/UNRESOLVED** | External/project evidence | Do not fabricate. |
| Group 5 | **0/13 granted, 13/13 DEFER** | Owner/governance | D-19 NO-GO. |
| Meta developer/business setup | **Incomplete** | External | Developer app onboarding incomplete; no verified API credentials; no live WhatsApp delivery verified. |
| Meta template submission/approval | **Not started / not approved** | External + owner authorization | All 18 templates not Meta-submitted/approved; registry code state must be reconciled. |
| Production/UAT DB/provider/deploy | **Not authorized** | Owner/ops | No prod/27017/27019/Atlas writes; no provider calls; no deploy. |

---

## 8. Test / Verification Evidence (Baseline, No New Runs)

| Evidence | Status | Source |
|---|---|---|
| Earlier baseline (pre-BLB-20 docs) | PASS | Backend typecheck PASS; frontend typecheck PASS; frontend build PASS 40/40; backend tests PASS 45 files / 639 tests / 0 failed / 0 skipped. |
| Phase 0 audit runs | **Not run** | Read-only audit only; no tests/builds executed. |
| WhatsApp-related backend test files present | Present | `backend/tests/whatsapp*.test.ts`, `notificationOutbox.test.ts`, `orderCheckoutWhatsappConsent.test.ts`, `reschedule.test.ts`, `payment.test.ts`, etc. |
| Playwright E2E files present | Present | `tests/e2e/*.spec.ts` (7 files). |

**Caveat:** Existing pass evidence is historical baseline; it does not cover unimplemented D20-08 work, unresolved decision-dependent behavior, or live Meta integration.

---

## 9. Environment / Configuration Surface (Names Only, No Values)

Observed by code inspection (names only; values not read/exposed):
- DB/config: `MONGODB_URI`, `PORT`, `NODE_ENV`, `UAT_SAFE_MODE`, `JWT_*` (via `getJwtSecret`/auth config)
- URLs/origins: `NEXT_PUBLIC_SITE_URL`, trusted origins config
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`
- Payments: Razorpay envs (via `razorpay.ts`/payment controller)
- Email/OTP: Brevo/SMTP/email envs (via `emailService.ts`)
- Cloudinary/uploads: Cloudinary envs
- Google auth: Google client envs

**No `.env` files read; no secrets exposed.**

---

## 10. Audit Scope Executed

- Read-only inspection of docs, code, routes, services, controllers, models, configs, test inventory, and git baseline.
- No application source/test/config/env/dependency/DB/provider/Meta/deployment changes.
- No tests/builds run.
- No external calls.

---

## 11. Recommended Immediate Next Actions (Authorized / Owner-Dependent)

1. **Owner decision (highest priority):** prepare D20-08-D owner decision review/capture (read-only, docs-only) using BLB-20R/20S/20W/20X/20Y evidence: should the notification mention proposal expiry/deadline? Present options, evidence, recommended safest option, and explicit NOT DECIDED/NOT AUTHORIZED boundaries.
2. **Documentation/control:** after D20-08-D owner selection, proceed in priority order through remaining owner decisions (D20-08-E/F, D20-05-B/E/F, D20-01, D20-09) with documentation-only capture of explicit approvals only.
3. **Implementation authorization gate:** obtain explicit BLB-21 authorization before any code changes. Scope must include reconciliation of template registry state, outbox worker design, D20-08 behavior, D20-06-F UTC fix verification, and tests.
4. **External gates (not executable now):** legal/compliance W01, Meta app/business/credentials/template submission/approval, production readiness checklist.

*End of MASTER-WHATSAPP-PROJECT-BASELINE.md (Phase 0 read-only audit).*