# 01 — Project Inventory & Architecture

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Audit:** BLB-05A — Full Project Quality & Client Handover Readiness (read-only)  
**Date:** 2026-11-21

## Audit boundary

- **Verified:** static inspection of repository files, configs, docs, and source paths named below.
- **Not tested:** runtime behavior, live deployment, database connectivity/records, external providers (Razorpay/WhatsApp/email/OTP/Cloudinary), UAT execution, production infrastructure.
- **No changes made.** No code/config/env/dependency/DB/provider/deploy/service/Git mutation operations performed.

## 1. Repository state (mandatory pre-check)

| Check | Result |
|---|---|
| Repository path | `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp` (matches expected) |
| Branch | `feature/whatsapp-business-automation` (matches expected) |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (matches expected) |
| Working tree | Dirty — **106** modified/untracked entries at audit start; pre-existing changes preserved |
| Audit output | Only `docs/client-handover/BLB-05A/` files created by this audit |

**Finding BLB05A-001 (HIGH, Repository cleanliness/handover):** Repository is not in a clean, releasable delivery state (106 dirty/untracked entries including source, tests, docs, reports). *Evidence:* `git status --short` at audit start. *Impact:* Client cannot identify authoritative release content; risk of accidental inclusion/exclusion. *Remediation:* Separate authorized remediation to triage, commit/revert/split, and produce clean release/tag. *Separate authorization required:* Yes for any git/file cleanup.

## 2. Technology stack (evidence-based)

| Layer | Evidence | Notes |
|---|---|---|
| Frontend | `package.json`: Next `16.3.3`, React `^19`, TypeScript `5.7.3`, Tailwind `^4.3.3`, shadcn/base-ui, SWR, Sonner, jose | App Router structure under `app/` |
| Backend | `backend/package.json`: Express `^5.2.1`, TypeScript `^7.0.2`, Mongoose `^9.10.3`, Zod `^4.6.5`, JWT/bcrypt/cookie-parser/cors/helmet/rate-limit | ESM (`type: module`), `tsx` runtime |
| DB | Mongoose models in `backend/src/models/`; `.env.example` refs Mongo URI | No DB connection/inspection performed |
| Auth | `jsonwebtoken`, `jose`, cookie-parser, Google auth lib; `backend/src/middleware/auth.ts`, `backend/src/controllers/*Auth*` | Customer/admin separation requires code review (see 03) |
| Payments | `razorpay` dependency; `backend/src/controllers/paymentController.ts`, `backend/src/services/razorpay.ts` | No live payment verification |
| Media | `cloudinary` dependency; `backend/src/services/cloudinary.ts`, upload routes/controllers | No external media ops |
| Email/OTP | `nodemailer`, Brevo env vars in `backend/.env.example`; `backend/src/services/emailService.ts`, `otpService.ts` | No real provider calls |
| WhatsApp | `backend/src/controllers/whatsappWebhookController.ts`, `adminWhatsAppController.ts`, `services/whatsapp*`, models | No real provider calls |
| Testing | Vitest/Supertest backend; Playwright E2E frontend; `backend/tests/*`, `tests/e2e/*` | Historical/local evidence only unless rerun |
| Deployment | `vercel.json`, `render.yaml`, `.github/workflows/ci.yml`, `DEPLOYMENT_WORKFLOW.md` | Config present; not deployment-verified |

## 3. Top-level inventory

| Path | Type | Purpose / observation |
|---|---|---|
| `app/` | Frontend | Next.js App Router pages, admin/customer routes, `api/auth/me/route.ts` |
| `components/` | Frontend | UI/domain components (admin, cart, custom-cake, customer, layout, product, ui) |
| `lib/` | Frontend | API client, types, format, site config, upload helpers |
| `backend/` | Backend | Express TS app, tests, env example, tsconfig |
| `docs/` | Docs | handover/UAT/security/release/uat docs, screenshots, reference media |
| `tests/` | E2E | Playwright specs |
| `scripts/` | Scripts | `prep-deploy.mjs`, `health-check.mjs` |
| `.github/workflows/ci.yml` | CI | typecheck, backend vitest, Playwright CI |
| `vercel.json` | Deploy | Vercel Next.js config, region bom1, env refs, CORS headers |
| `render.yaml` | Deploy | Render backend service, secrets via dashboard |
| `README.md` | Doc | Basic overview; limited ops/handover depth |
| `DEPLOYMENT_WORKFLOW.md` | Doc | Deployment workflow (reviewed by name; content detail in 06) |
| `TODO.md`, `AGENTS.md`, `CLAUDE.md` | Dev docs | Development/agent instructions; delivery suitability review needed |
| `package-lock.json`, `pnpm-lock.yaml`, `backend/package-lock.json` | Lockfiles | Multiple lockfiles/package managers present — risk |
| `playwright-report/`, `test-results/`, `.next/`, `node_modules/` | Generated/artifacts | Should not be treated as client source deliverables |

## 4. Frontend route/module inventory (static)

**Customer/public (`app/`):** `/`, `/about`, `/contact`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/custom-cake`, `/track`, `/account/login`, `/account/register`, `/account/forgot-password`, `/account/reset-password`, `/account/change-password`, `/account/edit-profile`, `/account/orders`, `/account/custom-cake-requests`.

**Admin (`app/admin/`):** `/admin/login`, `/admin/dashboard`, `/admin/analytics/*`, `/admin/products`, `/admin/orders`, `/admin/custom-cakes`, `/admin/customers`, `/admin/inventory`, `/admin/payments`, `/admin/settings`, `/admin/whatsapp`.

**API route (Next):** `app/api/auth/me/route.ts` (proxy/route handler — verify behavior in 02/03).

## 5. Backend inventory (static)

**Entrypoints/config:** `backend/src/server.ts`, `backend/src/config/db.ts`, `jwt.ts`, `uatSafeMode.ts`.

**Route files:** `adminRoutes.ts`, `adminWhatsAppRoutes.ts`, `analyticsRoutes.ts`, `authRoutes.ts`, `customCakeRoutes.ts`, `customerUploadRoutes.ts`, `orderRoutes.ts`, `paymentRoutes.ts`, `productRoutes.ts`, `settingsRoutes.ts`, `uploadRoutes.ts`, `whatsappRoutes.ts`, `whatsappWebhookRoutes.ts`.

**Controllers:** admin/auth/customer/custom-cake/order/payment/product/settings/upload/whatsapp/adminWhatsApp controllers.

**Models (observed):** `Admin.ts`, `User.ts`, `Product.ts`, `Order.ts`, `CustomCakeRequest.ts`, `CustomCakeSubmissionIdempotency.ts`, `Settings.ts`, `Otp.ts`, `InventoryLedger.ts`, `NotificationOutbox.ts`, `WhatsAppConsent.ts`, `WhatsAppMessage.ts`, `WhatsAppNotificationPreference.ts`, `WhatsAppWebhookEvent.ts`.

**Services:** analytics, Cloudinary, email, Google auth, inventory/expiry, notification outbox, OTP, PDF reports, proposal expiry, Razorpay, slot validation, UAT safety/log, WhatsApp admin recipients/consent/event taxonomy/service/template registry.

**Middleware:** `auth.ts`, `csrf.ts`, `rateLimit.ts`, `requestId.ts`.

## 6. Environment variable references (names only, no values)

**Root `.env.example`:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `BACKEND_INTERNAL_URL`, `JWT_SECRET`.

**Backend `.env.example`:** `MONGODB_URI`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `OTP_SECRET`, Razorpay keys/secrets/webhook, Brevo/admin notification vars, Cloudinary vars.

**Risk:** env docs are partial relative to deployment/handover needs; verify completeness in 06/07. No secret values reported.

## 7. Architecture observations

```text
[Browser/Next.js App Router] --HTTP/cookies--> [Next API/auth proxy? + direct backend calls via lib/api]
                                             \--> [Express 5 backend /api/*]
                                                    |-- Mongoose --> MongoDB
                                                    |-- Razorpay SDK/API/webhook
                                                    |-- Cloudinary
                                                    |-- Email/Brevo/Nodemailer
                                                    |-- WhatsApp services/webhooks
                                                    \-- Notification outbox / UAT safety controls
```

**Verified:** separate frontend/backend packages, Next frontend, Express backend, Mongo models, payment/WhatsApp/media/email integrations present in code.  
**Inferred:** production topology, reverse proxy/TLS/WAF, actual runtime env completeness, scaling behavior — not verified.

## 8. Key inventory findings

| ID | Severity | Finding | Evidence | Impact | Remediation | Separate auth |
|---|---|---|---|---|---|---|
| BLB05A-001 | HIGH | Dirty/unreleasable worktree | `git status` 106 entries | Unclear deliverable boundary | Authorized release triage/cleanup | Yes |
| BLB05A-002 | MEDIUM | Multiple lockfiles/package-manager signals | `package-lock.json`, `pnpm-lock.yaml`, `backend/package-lock.json`, `packageManager=pnpm` | Non-deterministic installs | Standardize one package manager/lockfile policy | Yes |
| BLB05A-003 | MEDIUM | Generated/artifact dirs present in repo workspace | `.next/`, `node_modules/`, `playwright-report/`, `test-results/` | Delivery bloat/confusion; accidental inclusion risk | Define delivery exclusions; clean under authorization | Yes |
| BLB05A-004 | MEDIUM | No root LICENSE file; backend package says ISC | root listing, `backend/package.json` | Legal/delivery ambiguity | Add appropriate LICENSE and third-party notices | Yes (legal/client input) |
| BLB05A-005 | LOW | `backend/package.json` `main=index.js` while runtime uses tsx `src/server.ts` | `backend/package.json` | Packaging/entrypoint confusion | Align package metadata and startup docs | Yes |
| BLB05A-006 | INFO | Documentation sprawl across `docs/`, root md files, untracked release/security docs | repo listing, git status | Hard for client to find authoritative handover set | Create curated handover index; archive/suppress drafts under authorization | Yes |