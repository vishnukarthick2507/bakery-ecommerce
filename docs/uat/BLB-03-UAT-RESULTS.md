# BLB-03 — UAT Results (Execution Tracker)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Execution status:** **NOT STARTED** (preparation only; no MongoDB/backend/frontend/seed/UAT runtime started)

## Execution context (to fill when approved execution begins)
- **Date/time window:** 
- **Tester:** 
- **Environment:** local isolated UAT only (`127.0.0.1:27018`, `bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`, frontend → local backend)
- **Build/commit evidence:** 
- **Startup evidence:** DB/backend/frontend/health/connectivity logs or screenshots (sanitized)
- **Dataset/synthetic data evidence:** 
- **Safety confirmations:** no 27017/27019 use, no Atlas/prod, no real provider contacts/payments/notifications/uploads

## BLB-03B Read-only inspection record (verified 2026-11-19, no workflow UAT executed)
- **Runtime (read-only verified):** UAT MongoDB PID 23580 active on `127.0.0.1:27018`; backend `GET /health` = 200 (`service":"bakery-api","database":"connected"`); frontend `GET /` = 200; frontend `GET /api/products` proxy = 200 to local UAT backend. No services restarted.
- **Database inspection:** read-only, existing authenticated backend config/credentials (in-process, `UAT_SAFE_MODE=true`, no secrets exposed), target exclusively `127.0.0.1:27018/bluebell_whatsapp_uat`, `ping` OK, `connectedDb=bluebell_whatsapp_uat`. No DB writes/seeds/migrations/imports/account creation.
- **Verified counts (sanitized):** `admins=1`, `users=0`, `products=5` (aggregate: active/unspecified=5, stock>0 indicator=5, priced>0 indicator=5), `orders=0`, `customcakerequests=0`, `settings=1`, `inventorymovements=0`, `notificationoutboxes=0`, `whatsappconsents=0`, `whatsappmessages=0`, `whatsappnotificationpreferences=0`, `whatsappwebhookevents=0`, `customerotpproofs=0`, `otpsessions=0`, `pendingregistrations=0`, `otpsendcooldowns=0`, `customermetrics=0`. No other collections observed.
- **Interpretation (facts vs assumptions):** admin record exists but credential access unverified (fact: count 1). No customer users/orders/custom-cake records (facts). Products/settings present but workflow/flag suitability not fully verified by execution (fact: counts/aggregate indicators only). WhatsApp/OTP-related collections empty (facts). **No test cases marked PASS; workflow UAT remains NOT STARTED.**

## BLB-03D Customer storefront & checkout preflight (read-only runtime, verified 2026-11-19, no writes)
- **Method/limits:** HTTP runtime fetches via frontend proxy/pages + sanitized backend/API responses + source implementation review. **No interactive browser DevTools/console/network capture or real mobile-viewport visual verification performed** (tooling limitation); no checkout submission, no cart/localStorage mutations, no DB writes, no service restarts.
- **Phase 1 environment:** `GET /` = 200; `GET /health` = 200 `{"status":"ok","service":"bakery-api","database":"connected"}`; UAT MongoDB PID 23580 running on `127.0.0.1:27018`; backend target exclusively `mongodb://127.0.0.1:27018/bluebell_whatsapp_uat` (sanitized, `exclusiveUatOk=true`, `UAT_SAFE_MODE=true` forced in-process for check).
- **Public/API integration (read-only):** `GET /api/products` = 200 (5 products, all active/AVAILABLE with stock>0/prices/images `[]`); `GET /api/products/slug/{slug}` = 200 for all 5 (`classic-chocolate-cake`, `red-velvet-cake`, `black-forest-cake`, `chocolate-brownie`, `blueberry-cheesecake`); `GET /api/settings` = 200 (`onlineOrdersEnabled=true`, `deliveryEnabled=true`, `pickupEnabled=true`, `codMaxAmount=null`); `GET /api/categories` = **404** (no dedicated public categories route observed; frontend category derivation implemented from product data).
- **Page availability:** `/products` = 200, all 5 `/products/{slug}` = 200, `/cart` = 200, `/checkout` = 200 (no server error markers detected in fetched HTML).
- **Verified presentation/data gap:** all 5 products have empty `images` arrays; UI/mapping include placeholder/fallback handling (`/placeholder.svg`) — **PRESENTATION_GAP** (no broken page/API observed).
- **Preflight assessment (implementation + HTTP):** cart/checkout flows implement validations, stock/catalog reconciliation, settings-gated fulfilment/payment options, scheduling/idempotency and UAT-safe constraints in code; interactive add-to-cart, responsive rendering, and browser console/network behavior **not fully runtime-verified**. **No workflow executed; no PASS claims for unexecuted flows.**

## Summary
| Metric | Count |
|---|---:|
| PASS | 0 (formal plan test-case pass accounting not fully populated; see BLB-03H-R1/BLB-03I phase outcomes below) |
| FAIL | 1 original in BLB-03H-R1 (invalid delivery pincode accepted, **BLB-03H-R1-D01**) — **retested PASS in BLB-03I** |
| BLOCKED / NOT TESTABLE | 2 (BLB-03H-R1: missing time-slot option not testable in UI; unavailable/invalid slot feedback not safely testable) |
| NOT TESTED | Remaining BLB-03 plan cases pending (admin/synthetic-data/provider-dependent and unexecuted flows) |
| Defects logged | 6 (BLB-03G-D01, BLB-03H-D01, BLB-03H-R1-D01 verified/resolved; others open/monitoring — see `BLB-03-DEFECT-REGISTER.md`) |

## BLB-03F Hydration investigation, verification & cart-follow-up (2026-11-19, no backend/DB/code changes)

- **Objective:** Investigate and resolve confirmed BLB-03E React hydration mismatch on `/products` search input (reported `caret-color` server/client style difference). No cart implementation modified.
- **Root-cause investigation (completed):** Inspected target files and working-tree diffs before editing: `components/products/products-browser.tsx`, `components/ui/input-group.tsx`, `components/ui/input.tsx`, `components/ui/field.tsx` (no local diffs/modifications). Traced render chain: `ProductsBrowser` (`'use client'`, controlled `search` state, `useDeferredValue`) → `InputGroup`/`InputGroupInput` → `Input` (`@base-ui/react/input` `InputPrimitive`) → Base UI `Field.Control` (`FieldControl`) with field validation/labelable internals. Reviewed SSR/client consistency factors (deterministic initial state `''`, no conditional attributes/styles in app code, no `suppressHydrationWarning`). Searched repo and `node_modules/@base-ui/react` for `caret`/`caret-color`/inline style sources (no matching implementation located in inspected package files). 
- **Root-cause conclusion:** **Exact transient cause not conclusively identified** from available code/library artifacts. BLB-03E previously captured hydration mismatch in dev runtime; BLB-03F fresh isolated-browser verifications could **not reproduce** the mismatch.
- **Minimal corrective change:** **None.** No `suppressHydrationWarning` added and no source refactor applied without a confirmed root cause (per constraints). **Files changed:** none (application/source/config). Documentation updated: `docs/uat/BLB-03-DEFECT-REGISTER.md`, `docs/uat/BLB-03-UAT-RESULTS.md`.
- **TypeScript/test/build results:**
  - `pnpm typecheck` (`tsc --noEmit`): **FAILED (unrelated baseline/generated artifact)** — errors in `.next/dev/types/validator.ts` (`? expected`, `Declaration or statement expected`), not in source components.
  - Frontend production build `pnpm build` (Next.js 16.3.3 Turbopack): **Compiled successfully in ~27.8s**, then **FAILED TypeScript/type-check** with same `.next/dev/types/validator.ts` errors. Existing `middleware` deprecation warning observed (unrelated). No source changes made.
  - Existing applicable automated tests: **not fully executed** in this run (frontend has Playwright E2E suite; cart/UI verification performed via controlled isolated-browser runtime checks below instead of modifying/running broad suites). No backend/DB-affecting tests run.
- **Browser hydration verification (isolated contexts, 2026-11-19):** `/products` loaded successfully (“5 products” rendered), search input present/usable (`aria-label="Search products"`, value empty, inline `style` attribute `null`), product listing/category rendering intact, navigation to product detail/cart/checkout functional in prior/session checks. **Console:** 0 errors, 1 warning (LCP `/placeholder.svg`) in fresh checks — **no hydration mismatch emitted** for search input. Evidence (sanitized): `C:\Users\Admin\AppData\Local\Temp\opencode\blb03f_products_no_hydration.png` (+ earlier `blb03f_check`).
- **Regression results:** No code regressions introduced (no source changes). Observed existing non-blocking items remain: placeholder imagery/LCP warnings and previously noted dev/runtime console warnings unrelated to this fix. Unrelated baseline: `.next/dev/types/validator.ts` type errors block `typecheck`/build type-check phase.
- **Cart verification follow-up (Phase 4, separate isolated browser context `blb03f_cartverify`; no cart implementation modified):** Reliable method demonstrated using Playwright role-based actions in a single run-code flow with post-action waits and DOM/localStorage assertions (avoids BLB-03E fragile ref/eval-escaping issues). **Verified:** Classic Chocolate Cake add → cart qty 1 (`₹650`, subtotal/total `₹650`, cart label “Open cart, 1 items”); increase **1→2** = **`₹1,300`** (line/subtotal/total, cart label “Open cart, 2 items”, storage qty 2); decrease **2→1** = **`₹650`**. **Controlled refresh persistence (proven):** page reload on `/cart` preserved Classic Chocolate Cake qty 1 / `₹650` / storage state in isolated context. Evidence: `C:\Users\Admin\AppData\Local\Temp\opencode\blb03f_cart_verify.png`. (Isolated test cart cleared after verification.)
- **Remaining limitations:** Hydration mismatch root cause not reproduced/confirmed in current runtime; monitor for recurrence. `.next/dev/types/validator.ts` generated-type errors are an unrelated baseline blocking clean typecheck/build type-check. Broader cart scenarios (stock/unavailable restrictions, catalog reconciliation failure paths) remain unexercised per constraints/data. No checkout submission or order/payment workflows executed.

## BLB-03G Frontend generated artifact recovery & clean build verification (2026-11-19, diagnosis + preservation; regeneration blocked pending approval)

- **Objective:** Investigate/resolve frontend typecheck/build failure involving `.next/dev/types/validator.ts`; distinguish generated vs application-source errors and perform safe recovery/regeneration if approved.
- **Phase 1 — Read-only diagnosis (completed):**
  - **Repo/config state:** branch `feature/whatsapp-business-automation`, HEAD `60d24dc`; working tree dirty/untracked preserved (63 changed entries observed). `package.json` scripts: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`). `tsconfig.json` includes `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`; excludes `node_modules`, `backend`.
  - **Generated artifact inspection:** `.next/dev/types/validator.ts` present (15,107 bytes, older dev timestamp) and **malformed/corrupted** around previously reported locations (~404/409): truncated fragment `sExpected<Specific extends AppPageConfig<"/products">> = Specific` (missing block header/opening) and duplicated layout validation blocks/tail. `.next/types/validator.ts` (14,861 bytes, generated by prior BLB-03F build) is **well-formed**. Dev/prod `routes.d.ts`, `cache-life.d.ts`, `root-params.d.ts` present.
  - **`.next` contents:** `build/`, `cache/`, `dev/`, `diagnostics/`, `server/`, `static/`, `types/` plus build manifests/trace artifacts; sampled contents consistent with generated Next.js/Turbopack output (manifests, `.ts/.d.ts/.js/.json/.map`, turbopack cache `.sst`, etc.). **No obvious custom/user-owned files identified** in `.next`.
  - **Concurrency/processes (sanitized):** active Next.js dev server running on `localhost:3000` (listening PID 25940, launched via pnpm/next dev chain; `.next/dev/lock` and dev manifests present). Backend running (`npm start`/tsx, `127.0.0.1:5000`, `/health` = `{"status":"ok","service":"bakery-api","database":"connected"}`); MongoDB service `Running` (untouched). Prior `pnpm build` executed while dev server was active (updated `.next/types`/build outputs) — **concurrent dev/build writes to `.next` subtrees possible**.
  - **Classification:** failure is in **generated artifacts** (`.next/dev/types/validator.ts`), **not** an application-source TypeScript/build defect.
- **Root cause (exact, diagnosed):** corrupted/malformed **generated** dev type validator `.next/dev/types/validator.ts` (stale/inconsistent generation state, plausibly impacted by concurrent dev-server ownership of `.next/dev` and earlier production build activity), causing syntax errors during type validation because `tsconfig` includes `.next/dev/types/**/*.ts`.
- **Phase 2 — Safe recovery preparation (completed within allowed scope):** preserved existing `.next` by **copying** (non-destructive; original retained in place) to backup: **`C:\Users\Admin\AppData\Local\Temp\opencode\.next-backup-blb03g-20261119`** (backup target did not previously exist; top-level items copied; `dev/types/validator.ts` present in backup). No existing backup overwritten. **No application source, package manifests, lockfiles, environment files, deployment config, or generated originals modified.** Copy performed while dev server was running (snapshot may be momentary-consistency-limited) to avoid destroying the active `.next`.
- **Phase 3 — Controlled artifact regeneration:** **NOT EXECUTED (blocked; operator approval required).** Per restrictions, approval is required before stopping/restarting the existing frontend development server. Safe regeneration requires stopping frontend dev/build writers so `.next` (especially `.next/dev`) is not concurrently modified, then regenerating artifacts and running `pnpm typecheck` and `pnpm build` **sequentially**. MongoDB/backend must remain running and were not stopped.
- **Phase 4 — Verification after regeneration:** **PENDING** (dependent on approved Phase 3). Current runtime spot-checks remain healthy/available: frontend `GET /` = 200, backend `/health` connected, MongoDB service running; full clean-build/typecheck and route regression verification (`/`, `/products`, one product detail, `/cart`, `/checkout` load without submission) to be completed post-regeneration.
- **TypeScript result (current):** **FAIL** — `pnpm typecheck` (`tsc --noEmit`) errors in generated `.next/dev/types/validator.ts` (TS1005/TS1128), unrelated to application source.
- **Production build result (current baseline):** **Compiled successfully (~27.8s, Turbopack) but FAILED type-check phase** with same generated `.next/dev/types/validator.ts` errors (BLB-03F/BLB-03G evidence). `middleware` deprecation warning noted (unrelated).
- **Preservation confirmation:** backend and MongoDB preserved/running; **no application source, package manifests, lockfiles, env files, or deployment config modified**; existing `.next` original preserved in place and backup created (not deleted); all dirty/untracked Git changes preserved; no Git actions performed.
- **Remaining limitations/defects:** BLB-03G-D01 open pending approved regeneration; `.next` backup is a live-copy snapshot taken during active dev server; unrelated items remain (middleware deprecation warning, placeholder imagery/LCP warnings, BLB-03D-D01/D02, BLB-03E-D01 not currently reproducible, admin/synthetic-data UAT blockers). No production-readiness claim.

## BLB-03G.1 Controlled Next.js artifact recovery & build verification (2026-11-19, operator-approved frontend stop/restart completed)

- **Approval/scope:** operator authorized temporary stop/restart of local frontend dev server for corrupted generated artifact recovery only. No backend/DB/source/package/lockfile/env/config changes; no login/checkout submission/orders/payments/reservations/external-provider operations; no Git actions.
- **Prechecks (reconfirmed):** branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`, working tree preserved (64 changed entries at verification). Backup present and intact: `C:\Users\Admin\AppData\Local\Temp\opencode\.next-backup-blb03g-20261119` (original generated files incl. dev/types artifacts). Backend `127.0.0.1:5000/health` = `{"status":"ok","service":"bakery-api","database":"connected"}`; MongoDB service `Running`.
- **Frontend stop/restart:** identified verified frontend dev chain on `localhost:3000` (`cmd` wrapper, `corepack pnpm dev`, `pnpm-native`, `next dev`, Next start-server, turbopack workers) and stopped **only** those processes/verified children. Port `3000` cleared; no bakery Next dev/build processes remained (backend `tsx/node` preserved). After recovery/build, restored dev server with existing command (`set "BACKEND_INTERNAL_URL=http://127.0.0.1:5000" && pnpm dev`) and confirmed readiness (HTTP 200 on `/`).
- **Recovery procedure & backup integrity:** preserved original `.next` and backup (backup **not deleted/overwritten**). Removed corrupted generated dev artifacts (`\.next\dev`) while no frontend dev/build writer was active; regenerated artifacts via existing toolchain/config. `\.next\types\validator.ts` and regenerated `\.next\dev` present after recovery.
- **TypeScript result:** `pnpm typecheck` (`tsc --noEmit`) **PASS** (exit code **0**).
- **Production build result:** `pnpm build` (Next.js 16.3.3, Turbopack) **PASS** (exit code **0**) — compiled successfully, TypeScript finished, static pages/data generated and page optimization completed (40/40 pages). Non-blocking warning remained: deprecated `middleware` convention (unrelated; no config/source change).
- **Runtime route verification (restored dev server, load only, no submission):** `/` **200** (content verified), `/products` **200** (page loaded), `/products/classic-chocolate-cake` **200** (Classic Chocolate Cake detail/content verified), `/cart` **200** (cart/empty-state content verified), `/checkout` **200** (checkout/empty-state content verified). No login, no checkout submission, no order/payment/inventory/external-provider actions.
- **Backend/database preservation:** backend and MongoDB remained running/healthy and unchanged throughout (backend health connected; MongoDB service `Running`; no backend/DB modifications or restarts).
- **Git state preservation:** branch/HEAD unchanged (`60d24dc`), all existing dirty/untracked files preserved (no staging/commit/push/merge/reset/clean/stash/branch switch). Only UAT documentation updated in workspace as reporting artifacts.
- **Outcome:** BLB-03G-D01 recovered (generated-artifact issue resolved; not an application-source defect). Clean typecheck/build baseline restored.

## BLB-03H Interactive customer checkout validation (no order submission, 2026-11-19) — **BLOCKED by frontend proxy runtime issue**

- **Objective:** validate checkout experience via real browser interactions in isolated context (no submission/order/payment/external ops). **Not completed** due to environment blocker.
- **Phase 1 (safety/prep):** frontend `GET /` 200; backend `GET /health` = `{"status":"ok","service":"bakery-api","database":"connected"}`; MongoDB service `Running`; sanitized backend target check confirmed exclusive `mongodb://127.0.0.1:27018/bluebell_whatsapp_uat` (`UAT_SAFE_MODE` forced in-process for check). Fresh isolated Playwright context created (`blb03h_checkout`).
- **Blocking finding:** frontend proxied APIs failed — `GET /api/products` and `GET /api/settings` via `localhost:3000` returned **500**. Direct backend `GET http://127.0.0.1:5000/api/products` = **200**. Dev server logs showed repeated `TypeError: Invalid URL` with malformed rewrite destination (`http://127.0.0.1:5000 /api/__ESC_COLON_path*`), consistent with broken `/api/:path*` proxy resolution in current dev runtime (post BLB-03G.1 authorized restart). Browser/cart showed **“Unable to load your cart”**; catalog/settings-dependent checkout entry/validation could not be reliably executed.
- **Phases 2–6 execution:** **NOT EXECUTED / BLOCKED** (product add→cart→checkout, customer field validation, fulfilment/address validation, scheduling validation, payment preflight interactions not completed as planned).
- **Phase 7 safety verification (confirmed by non-execution):** **no checkout submission, no order created, no inventory reserved, no payment initialized, no email/OTP/WhatsApp/external-provider operations, no DB writes** performed.
- **Evidence (sanitized):** `C:\Users\Admin\AppData\Local\Temp\opencode\blb03h_01_checkout_details.png` (cart/catalog-load failure state), console/network errors showing `/api/products` 500/failures, dev server log excerpt (Invalid URL rewrite destination), HTTP checks (frontend proxy 500 vs backend 200). Isolated browser closed; no normal profile/cart data used.

## BLB-03H.1 Controlled frontend runtime proxy recovery (2026-11-19, runtime-only, no checkout rerun)

- **Objective:** resolve BLB-03H-D01 frontend `/api/*` proxy failure and verify frontend correctly proxies to existing local UAT backend. **No checkout validation rerun performed.**
- **Phase 1 — Runtime inspection (evidence):** inspected running frontend dev chain (PowerShell/cmd/pnpm/Next start-server + turbopack workers; no multiple/stale bakery Next dev servers identified). `next.config.mjs` rewrite definition read-only/unchanged (`/api/:path*` → `${backendUrl.replace(/\/+$/, '')}/api/:path*`). Prior dev server logs showed malformed rewrite destination (`Invalid URL ... http://127.0.0.1:5000 /api/__ESC_COLON_path*`) causing frontend `/api/products` and `/api/settings` 500 while direct backend APIs were healthy. Backend `GET /health` = `{"status":"ok","service":"bakery-api","database":"connected"}` and direct `GET /api/products` = 200 before/through recovery.
- **Root cause (established from evidence):** incorrect/stale **frontend dev runtime process configuration** for `BACKEND_INTERNAL_URL`/rewrite destination in the instance started during BLB-03G.1, yielding a malformed proxy URL at runtime. **Not** a `next.config.mjs`, source, package, lockfile, env-file, or deployment-config defect (no such files edited).
- **Phase 2 — Controlled frontend-only restart:** stopped only verified frontend dev-server process tree; confirmed port `3000` released. Backend (`:5000`) and MongoDB (`:27018`) untouched. Restarted frontend using existing package manager/dev command with explicit process-scoped variable **`BACKEND_INTERNAL_URL=http://127.0.0.1:5000`** (no extra whitespace, not persisted to any env file). New Next.js dev server started successfully.
- **Phase 3 — Proxy recovery verification:** `GET /` = **200**; `GET 127.0.0.1:5000/health` = **200**; `GET 127.0.0.1:5000/api/products` = **200**; `GET localhost:3000/api/products` = **200** (valid JSON, count matched backend: 5); `GET localhost:3000/api/settings` = **200** (valid JSON, key flags matched backend: `onlineOrdersEnabled/deliveryEnabled/pickupEnabled` consistent). Frontend-proxied responses correspond to local UAT backend. New dev server log tail showed normal startup/requests with **no prior `TypeError: Invalid URL` rewrite errors** observed.
- **Phase 4 — Preservation:** backend and MongoDB remained running/unchanged (MongoDB service `Running`; backend health connected). No unintended backend/MongoDB restarts. Branch/HEAD unchanged (`feature/whatsapp-business-automation` @ `60d24dc`), working tree preserved (64 changed entries), and no source/env/package/deployment config files modified during this task.
- **Remaining errors:** no active proxy/Invalid URL errors observed in recovered runtime; unrelated dev warning `middleware` deprecation remains (pre-existing, not modified).
- **BLB-03H rerun readiness:** **Yes** — frontend is healthy and both frontend-proxied API endpoints return valid 200 JSON from the isolated UAT backend in safe mode; BLB-03H can be safely rerun (fresh isolated browser context, no submission/order/payment/provider operations).

## BLB-03H-R1 Interactive customer checkout validation (post-proxy recovery, 2026-11-19) — **COMPLETED (no submission/order/payment/external ops)**

- **Objective:** rerun previously blocked BLB-03H customer checkout validation in fresh isolated Playwright context with reliable browser-interaction evidence.
- **Browser context:** fresh isolated context **`blb03hr1_rerun`** (previous partial context cleaned up; browser closed at end). **No normal profile/cart used.**
- **Phase 1 — Preflight (reconfirmed):** `GET /` = **200**; frontend-proxied `GET /api/products` = **200** (valid JSON, count 5); frontend-proxied `GET /api/settings` = **200** (valid JSON, `onlineOrdersEnabled/deliveryEnabled/pickupEnabled=true`, `codMaxAmount=null`); backend `GET /health` = **200** `{"status":"ok","service":"bakery-api","database":"connected"}`. Effective UAT target exclusively `mongodb://127.0.0.1:27018/bluebell_whatsapp_uat` (sanitized, user info present, exclusive check OK) with `UAT_SAFE_MODE=true` context verified. Branch/HEAD unchanged (`feature/whatsapp-business-automation` @ `60d24dc`).
- **Phase 2 — Storefront and cart (browser-interaction evidence):**
  - Homepage and `/products` loaded in browser (5 products visible). All 5 detail pages visited: `blueberry-cheesecake` (₹800), `red-velvet-cake` (₹750), `black-forest-cake` (₹700), `chocolate-brownie` (₹120), `classic-chocolate-cake` (₹650) — each showed name/price/availability and “Add 1 to cart” control.
  - Using **Classic Chocolate Cake**: add to cart verified (cart label “Open cart, 1 items”, localStorage entry present, toast/confirmation text observed). Cart page showed qty 1 with line/subtotal/total **₹650**.
  - Quantity **increase 1→2** verified: cart label “Open cart, 2 items”, line/subtotal/total **₹1,300**. Quantity **decrease 2→1** verified: **₹650**.
  - **Refresh persistence** verified (controlled page reload on `/cart`, qty 1): item, qty, subtotal/total (**₹650**), and cart storage persisted.
  - **Remove item** verified: cart became empty (“Your cart is empty”, “Open cart, 0 items”, storage cleared).
  - **Add item again and proceed to checkout** verified: item re-added and `/checkout` loaded with Customer details step and order summary showing Classic Chocolate Cake ×1 / **₹650** (no redirect to empty cart).
  - **Screenshots (sanitized, temp):** `blb03hr1_r2_01_home.png`, `blb03hr1_r2_02_products.png`, `blb03hr1_r2_03_detail_{slug}.png` (all 5), `blb03hr1_r2_04_add_debug.png`, `blb03hr1_r2_04_cart_after_nav.png`, `blb03hr1_r2_05_cart_qty_ops_refresh.png`, `blb03hr1_r2_06_cart_empty_then_checkout.png` (under `C:\Users\Admin\AppData\Local\Temp\opencode\`).
- **Phase 3 — Customer details validation (browser, synthetic values only):** 
  - **Empty required fields (Continue):** stayed on Customer details; validation shown **“Please enter your phone number.”** (progression prevented). No explicit separate name/email required-message captured in that attempt (partial feedback observed).
  - **Invalid email + invalid Indian mobile** (`uat-invalid-email`, `12345`) with name filled: stayed on Customer details; validation shown **“Enter a valid 10-digit Indian mobile number.”** (progression prevented). No explicit invalid-email message captured (mobile validation blocked progression).
  - **Valid synthetic values** (name `UAT Test Customer`, email `uat.customer@example.test`, mobile `9876543210`): progression to **Delivery or pickup** step succeeded.
  - **Screenshot:** `blb03hr1_r2_07_customer_validation.png`.
- **Phase 4 — Fulfilment and address (browser):**
  - **Delivery, empty fields:** blocked with validation messages **“Please enter your delivery address.”**, **“Please enter your city.”**, **“Please enter your pincode.”** (progression prevented).
  - **Delivery, invalid pincode:** address `12 UAT Test Street`, city `Chennai`, pincode **`123`** (3 digits) — **no validation message observed and flow progressed to Schedule step** (invalid progression **not prevented**). **FAIL/defect logged (BLB-03H-R1-D01).**
  - **Delivery, valid synthetic city/pincode:** `Chennai`, **`600044`** (6 digits) — progression to Schedule step succeeded.
  - **Pickup:** selecting Pickup hid delivery address/city/pincode fields and allowed progression to Schedule without delivery-specific fields (appropriate behavior observed).
  - **Screenshots:** `blb03hr1_r2_08_fulfilment_retry.png` (intermediate), `blb03hr1_r2_08a_delivery_empty_invalidpin.png`, `blb03hr1_r2_08b_pickup_valid_delivery.png`.
- **Phase 5 — Scheduling (browser):** date input observed with `min=2026-11-20` (at test time), default/prefilled state showed `2026-11-19` with message “Please select today or a future date.”; time slots available (10:00–12:00, 12:00–14:00, 14:00–16:00, 16:00–18:00, 18:00–20:00, none disabled).
  - **Missing date:** blocked with **“Please select today or a future date.”** (progression prevented).
  - **Past date (`2026-11-18`):** blocked with **“Please select today or a future date.”**
  - **Current date (`2026-11-19`, “where available”):** **not accepted/available** in this runtime (blocked by same validation/min constraint; progression prevented). Recorded as tested with observed unavailability.
  - **Future date (`2026-11-21`) + valid available time slot (`10:00 AM - 12:00 PM`):** progression to **Payment method** step succeeded.
  - **Missing time slot:** **NOT TESTABLE/BLOCKED (UI constraint)** — no empty/select-placeholder option; all exposed slots are concrete selectable values.
  - **Unavailable/invalid slot feedback:** **NOT SAFELY TESTABLE** — no disabled/unavailable slot options exposed in UI.
  - **Screenshots:** `blb03hr1_r2_09a_missing_date.png`, `blb03hr1_r2_09b_past_date.png`, `blb03hr1_r2_09c_current_date.png`, `blb03hr1_r2_09d_future_valid_to_payment.png`.
- **Phase 6 — Payment preflight (inspection only, no init/clicks to trigger external ops):**
  - **Visible methods:** **Cash on Delivery** (“Pay when your order arrives”, appeared selected by default styling) and **Online Payment** (“Pay securely via Razorpay — UPI, cards & netbanking”).
  - **Pay at Store:** **not visible** in this flow/state (NOT VERIFIED as available method in UI).
  - **COD-limit/availability messages:** none observed (settings `codMaxAmount=null`).
  - **Safety:** did **not** click controls that initialize a payment session, call Razorpay, or submit an order; “Place Order” present but not clicked.
  - **Screenshot:** `blb03hr1_r2_10_payment_preflight.png`.
- **Browser console/network (sanitized):** Playwright console capture reported **0 errors, 0 warnings** at sampled checks; API network activity observed as proxied `/api/products`, `/api/settings`, `/api/auth/me` requests returning **200** during flow (no checkout/order/payment/provider calls). No “Invalid URL” proxy errors observed in recovered runtime.
- **Phase 7 — Final safety/preservation verification:** **no checkout submission, no order created, no inventory reserved, no DB writes, no payment initialized, no OTP/email/WhatsApp/external-provider operations** performed. Read-only UAT DB counts (sanitized) remained **`orders=0`, `users=0`, `customcakerequests=0`, `whatsapp_outbox_messages=0`, `notification_attempts=0`**. Backend `GET /health` = **200/connected**; effective target remained exclusive `127.0.0.1:27018/bluebell_whatsapp_uat` in Safe Mode. **No services restarted/modified.** Browser context closed. Branch/HEAD unchanged (`60d24dc`), working tree preserved (64 changed entries), **no source/env/package/deployment config changes** made by BLB-03H-R1.
- **Outcome:** customer checkout flow validated through payment preflight (UI) in isolated local UAT; **1 defect found** (invalid 3-digit delivery pincode accepted). “Missing time slot” and “unavailable slot feedback” not testable due to UI/options constraints; “Pay at Store” not visible. No production-readiness claim.

## Results by test case

| Test ID | Workflow | Result (PASS/FAIL/BLOCKED/NOT TESTED) | Actual result | Evidence (screenshots/log refs/IDs, sanitized) | Defect ID | Retest status | Notes |
|---|---|---|---|---|---|---|---|
| BLB-03H-R1-P1 | Preflight (frontend/backend/proxy/DB target/safe mode) | PASS | Homepage/proxied APIs/health healthy; exclusive `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` confirmed (sanitized). | HTTP checks, sanitized backend target check, git/HEAD verification. | — | N/A | Browser-interaction preconditions satisfied. |
| BLB-03H-R1-P2 | Storefront browse + detail pages (5) | PASS | Home, catalogue, and all 5 product detail pages loaded with expected name/price/availability/add-to-cart UI. | Browser interaction + screenshots `blb03hr1_r2_01_home.png`, `02_products.png`, `03_detail_*.png`. | — | N/A | Fresh isolated context. |
| BLB-03H-R1-P2 | Cart add/qty/subtotals/refresh/remove/empty/re-add/checkout entry | PASS | Classic add (qty1 ₹650), increase to qty2 ₹1,300, decrease to ₹650, refresh persistence (qty1), remove→empty, re-add and proceed to `/checkout` verified. | Browser interaction + `04_add_debug.png`, `04_cart_after_nav.png`, `05_cart_qty_ops_refresh.png`, `06_cart_empty_then_checkout.png`, localStorage/UI assertions. | — | N/A | No submission/order/reservation/DB write. |
| BLB-03H-R1-P3 | Customer details: empty required fields | PASS (partial feedback observed) | Continue blocked on step 1 with “Please enter your phone number.”; progression prevented. | Browser interaction + `07_customer_validation.png`. | — | N/A | No explicit separate name/email required message captured in this attempt. |
| BLB-03H-R1-P3 | Customer details: invalid email + invalid mobile | PASS (progression prevented) | Invalid mobile triggered “Enter a valid 10-digit Indian mobile number.” and blocked progression; invalid-email-specific message not explicitly captured. | Browser interaction + `07_customer_validation.png`. | — | N/A | Synthetic values only; no OTP/account actions. |
| BLB-03H-R1-P3 | Customer details: valid synthetic values | PASS | Valid name/email/mobile allowed progression to Delivery/Pickup step. | Browser interaction + `07_customer_validation.png`. | — | N/A | Browser-only synthetic data. |
| BLB-03H-R1-P4 | Delivery: empty address/city/pincode | PASS | Blocked with “Please enter your delivery address/city/pincode.” messages. | Browser interaction + `08a_delivery_empty_invalidpin.png`. | — | N/A | — |
| BLB-03H-R1-P4 | Delivery: invalid pincode (`123`) | FAIL (original) / PASS (retest BLB-03I) | **Original:** no validation message; progressed to Schedule. **BLB-03I retest:** blocked with "Please enter a valid 6-digit pincode.", schedule not shown, entered values preserved. | Original: `08_fulfilment_retry.png`, `08a_delivery_empty_invalidpin.png`. BLB-03I: Playwright MCP browser regression result (no submit). | BLB-03H-R1-D01 | Verified (BLB-03I) | See BLB-03I section for implementation/tests and safety confirmation. |
| BLB-03H-R1-P4 | Delivery: valid city + 6-digit Indian pincode | PASS | `Chennai` + `600044` allowed progression to Schedule step. | Browser interaction + `08b_pickup_valid_delivery.png`. | — | N/A | — |
| BLB-03H-R1-P4 | Pickup: delivery-specific fields hidden/optional | PASS | Pickup selection hid delivery address/city/pincode fields and allowed progression without them. | Browser interaction + `08b_pickup_valid_delivery.png`. | — | N/A | No persistent settings changed. |
| BLB-03H-R1-P5 | Scheduling: missing date | PASS | Blocked with “Please select today or a future date.” | Browser interaction + `09a_missing_date.png`. | — | N/A | — |
| BLB-03H-R1-P5 | Scheduling: past date | PASS | Blocked with “Please select today or a future date.” | Browser interaction + `09b_past_date.png`. | — | N/A | — |
| BLB-03H-R1-P5 | Scheduling: current date (where available) | NOT TESTABLE (not available in runtime) | `2026-11-19` rejected by UI/min constraint (`min=2026-11-20`) with “Please select today or a future date.”; today not available to accept. | Browser interaction + `09c_current_date.png`, schedule state evidence. | — | N/A | Tested and observed unavailable/blocked by constraint. |
| BLB-03H-R1-P5 | Scheduling: future date + valid available time slot | PASS | Future date `2026-11-21` with valid slot progressed to Payment method step. | Browser interaction + `09d_future_valid_to_payment.png`. | — | N/A | — |
| BLB-03H-R1-P5 | Scheduling: missing time slot | BLOCKED (UI constraint) | No empty/select-placeholder slot option exposed; all options concrete/selectable. | Browser state/evidence (`09_scheduling_results` attempt context, slot options). | — | N/A | Cannot safely create “missing slot” state in current UI. |
| BLB-03H-R1-P5 | Scheduling: unavailable/invalid slot feedback | NOT SAFELY TESTABLE | No disabled/unavailable slot options exposed to select/trigger feedback. | Browser state/evidence (slot options all enabled). | — | N/A | — |
| BLB-03H-R1-P6 | Payment preflight: visible methods/messages | PASS (inspection) | Cash on Delivery and Online Payment (Razorpay) visible; COD appeared selected; no COD-limit/unavailable messages observed. | Browser interaction + `10_payment_preflight.png`, network/console snapshots (sanitized). | — | N/A | No payment/session init, no submit/order. |
| BLB-03H-R1-P6 | Payment preflight: Pay at Store | NOT VERIFIED (not visible) | “Pay at Store” not visible in this checkout flow/state. | Browser interaction + `10_payment_preflight.png`. | — | N/A | Cannot confirm availability without changing settings/state (out of scope). |
| _Pending execution_ | — | NOT TESTED | Remaining formal plan cases not executed in this run. | — | — | — | Populate additional cases from `BLB-03-UAT-TEST-PLAN.md` after approved runs. |

## Evidence rules
- **Do not mark PASS** based solely on static source inspection.
- Every executed case must include preconditions, steps performed, expected vs actual result, and sanitized evidence.
- Record blocked-provider behavior as **expected suppression** only when verified safe and not reported as successful customer-facing delivery/payment; otherwise log a defect.
- Never include secrets, OTPs, tokens, credential-bearing URIs, or real PII in results.
## BLB-03I Delivery pincode validation repair and regression tests (2026-11-19)

- **Objective:** fix **BLB-03H-R1-D01** (delivery pincode `123` accepted/progressed) with smallest safe client+server validation, focused automated regression tests, controlled browser regression, and UAT doc updates. **No checkout submission/order creation/payment/DB writes/external-provider operations performed.**
- **Baseline/preservation:** branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` unchanged; existing dirty/untracked work preserved (no reset/clean/stash/rebase/branch switch/stage/commit/push/merge/deploy). No env/deployment config/source-config changes; no backend/MongoDB restarts. `UAT_SAFE_MODE=true`, frontend `http://localhost:3000`, backend `http://127.0.0.1:5000`, UAT DB `127.0.0.1:27018/bluebell_whatsapp_uat`; MongoDB `27017` untouched; temp restore `27019` not used.
- **Root cause (confirmed):** `app/checkout/page.tsx` fulfilment-step Continue handler and `handlePlaceOrder()` only checked delivery pincode for non-empty value (allowing malformed values like `123` to progress in UI). Backend `backend/src/controllers/orderController.ts` `createOrderSchema` validated delivery `address.pincode` as `z.string().trim().min(4)` (not exactly 6 numeric digits), so malformed/short/long/non-numeric values were not consistently constrained to Indian 6-digit format.
- **Implementation (smallest safe fix):**
  - `app/checkout/page.tsx`: delivery pincode now requires trimmed value to match `/^\d{6}$/` in fulfilment Continue and final `handlePlaceOrder` validation. Empty -> "Please enter your pincode."; invalid/malformed (short/long/alpha/whitespace-only/non-numeric, including `123`) -> "Please enter a valid 6-digit pincode." Progression blocked and entered form values preserved on failure. **Pickup unchanged** (delivery address/pincode checks apply only when `fulfilment === 'delivery'`).
  - `backend/src/controllers/orderController.ts`: `createOrderSchema.address.pincode` tightened from `z.string().trim().min(4)` to `z.string().trim().regex(/^\d{6}$/)` so malformed delivery addresses cannot bypass frontend during checkout/order creation. Delivery still requires address object; pickup orders without delivery address remain valid.
- **Focused automated regression tests added/updated:**
  - `backend/tests/orderValidation.test.ts` (BLB-03I): rejects delivery malformed pincodes `[\"123\",\"12345\",\"1234567\",\"ABCDEF\",\"abcdef\",\"12 345\",\"60004a\"]` and empty/whitespace-only pincodes with 400 `\"Invalid order data\"`; accepts valid delivery pincode `\"600044\"` (201, stored on order); preserves valid pickup order without delivery address (201, `fulfillmentType: \"PICKUP\"`, no address). Existing delivery-address invalid case and an unrelated delivery+`PAY_AT_STORE` case updated to use valid 6-digit `600044` where a valid address shape was required.
  - `tests/e2e/checkout-delivery-address-validation.spec.ts`: updated valid delivery progression/pickup-toggle cases to use `600044`; added invalid-format progression block for `123`, `12345`, `1234567`, `ABCDEF` expecting "Please enter a valid 6-digit pincode." and no schedule progression, then `600044` progresses.
- **Automated/type/build results:**
  - `pnpm typecheck` (frontend/root, `tsc --noEmit`): **PASS** (exit 0).
  - `pnpm -C backend typecheck` (`tsc --noEmit`): **PASS** (exit 0).
  - `pnpm -C backend exec vitest run tests/orderValidation.test.ts` (after correcting BLB-03I test assertions): **PASS** - 1 file, **38 tests passed** (0 failed), including BLB-03I delivery pincode/pickup regression cases.
  - `pnpm -C backend test` (full backend suite, required because shared backend validation in `orderController.ts` was changed): prior run (started 11:12:33, duration 414.09s) reported **38/39 files passed, 576/579 tests passed, 3 failed** — all 3 failures confined to `tests/orderValidation.test.ts` BLB-03I cases reflecting **pre-fix test assertions** from before correction; corrected `orderValidation.test.ts` reran to **38/38 PASS**. **BLB-03J clean full-suite confirmation (2026-11-19, `pnpm -C backend test`): PASS — 39 test files passed (39), 579 tests passed (579), 0 failed, duration 375.22s.**
  - Frontend Playwright spec `tests/e2e/checkout-delivery-address-validation.spec.ts` updated for regression coverage (mocked-route UI test); not executed as a separate Playwright command in this session beyond code/test updates.
- **Controlled browser regression (existing local UAT, isolated Playwright MCP context, 2026-11-19; no checkout submit/order/DB/external-provider ops):**
  - Flow: home -> add Classic Chocolate Cake -> `/checkout` -> customer details (synthetic `UAT Checkout Tester`, `uat-checkout@example.test`, `9000000001`) -> Delivery step -> address `12 UAT Test Street`, city `Chennai`.
  - **`123` (invalid):** blocked with **"Please enter a valid 6-digit pincode."** visible, **still on "Delivery or pickup"**, **Schedule not shown**, entered values preserved (`12 UAT Test Street`, `Chennai`, `123`). **PASS (defect no longer reproducible).**
  - **`600044` (valid):** progressed to **"Schedule your order"**. **PASS.**
  - **Pickup:** returned to fulfilment, selected Pickup; delivery address/city/pincode fields not shown (count 0) and Continue progressed to Schedule with no pincode/address error. **PASS (existing behavior preserved).**
  - Evidence (sanitized, structured): `invalid123={stillOnFulfilment:true,scheduleVisible:false,errorVisible:true,addressValue:\"12 UAT Test Street\",cityValue:\"Chennai\",pincodeValue:\"123\"}`, `valid600044={scheduleVisible:true,fulfilmentHeadingVisible:false}`, `pickup={addressFieldCount:0,cityFieldCount:0,pincodeFieldCount:0,progressedToSchedule:true,stillOnFulfilment:false,pincodeErrorVisible:false}`. Browser closed after regression.
- **Safety/preservation confirmation:** no checkout submission, no order created, no inventory reserved, no payment initialized, no email/OTP/WhatsApp/Cloudinary/Razorpay/external-provider operations, no account creation/admin credential changes, no DB writes/seeds/restores/migrations/imports performed. `UAT_SAFE_MODE` remained enabled; MongoDB/backend not restarted; no env/deployment changes. Git branch/HEAD and all existing dirty/untracked work preserved.
- **BLB-03H-R1-D01 status:** **Verified/resolved with complete regression evidence** — focused automated regression/typechecks passed, controlled browser regression passed (no submit/order/DB/external ops), and **BLB-03J clean full backend suite passed (39 files, 579 tests, 0 failed, 375.22s)**. No unrelated defects fixed.

## BLB-03K Remaining customer checkout pre-submission validation (2026-11-19)

- **Objective:** continue customer-facing UAT to verify remaining checkout behaviours previously not testable/not verified (payment option availability, scheduling follow-up, customer validation follow-up). **No code/config/env/service/Git changes. No checkout submission/order/account/login/DB writes/inventory reservation/payment initialization/external-provider operations.**
- **Browser context:** fresh isolated Playwright MCP browser context/session (2026-11-19); browser closed after validation. **No normal profile/cart used.**
- **Phase 1 — Preflight (PASS, stop criteria not triggered):**
  - Frontend `GET http://localhost:3000` = **200**.
  - Backend `GET http://127.0.0.1:5000/health` = **200** `{"status":"ok","service":"bakery-api","database":"connected"}`.
  - Frontend-proxied `GET /api/products` = **200** (valid JSON, 5 active products observed).
  - Frontend-proxied `GET /api/settings` = **200** (`onlineOrdersEnabled=true`, `deliveryEnabled=true`, `pickupEnabled=true`, `codMaxAmount=null`).
  - Runtime target/evidence (sanitized): backend process connected to MongoDB on `127.0.0.1:27018` (established connections observed; no `27019` listener/connection evidence). Operating context `UAT_SAFE_MODE=true` / exclusive local UAT DB `bluebell_whatsapp_uat` on `127.0.0.1:27018` consistent with prior verified BLB-03 runtime baseline. Branch/HEAD unchanged (`feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`).

### Phase 2 — Payment option availability (implementation-condition + browser evidence)

- **Observed (browser, no payment initialization/clicks to trigger external ops):**
  - **Delivery fulfilment → Payment step:** `Cash on Delivery` visible ("Pay when your order arrives"), `Online Payment` visible ("Pay securely via Razorpay — UPI, cards & netbanking"), **`Pay at Store` not visible**.
  - **Pickup fulfilment → Payment step:** `Online Payment` visible, **`Pay at Store` visible** ("Pay when you collect your order"), `Cash on Delivery` not visible.
- **Implementation/business-rule conditions traced (read-only):**
  - `app/checkout/page.tsx`: payment options rendered conditionally by fulfilment. When `fulfilment === 'delivery'` UI shows COD + Online Payment; when pickup it shows Online Payment + `Pay at Store` (`payment='pay_at_store'`). COD limit warning applies in delivery context when `codMaxAmount` exceeded (settings `codMaxAmount=null` in this run).
  - `backend/src/controllers/orderController.ts`: `PAY_AT_STORE` accepted in schema but explicitly rejected for non-pickup orders (`"Pay at Store is only available for pickup orders."`); pickup-specific handling present.
  - `backend/src/models/Order.ts`: payment methods include `COD | ONLINE | PAY_AT_STORE`.
- **Why Pay at Store was not visible in BLB-03H-R1:** conditionally unavailable in **delivery** fulfilment/payment context by implemented UI/business rules; available in **pickup** fulfilment/payment context. BLB-03H-R1 inspection likely observed delivery-context payment options (or not pickup payment state). **Not a defect** — conditional availability matches traced implementation/rules.
- **Result:** **OBSERVATION / PASS (conditional behavior verified).** No settings changed; no new payment method invented; no Razorpay/payment initialization.

### Phase 3 — Scheduling follow-up (implementation-condition + browser evidence)

- **Observed (browser, 2026-11-19 runtime):** schedule step date input `min="2026-11-20"`, initial value empty. Client-evaluated IST-today (`getTodayInIST()` logic) returned **`2026-11-20`**.
  - Empty date + Continue: stayed on schedule, message **"Please select your order date."**
  - Past date `2026-11-18`: stayed on schedule, message **"Please select today or a future date."**
  - "Today" candidate per IST-today implementation (`2026-11-20`, equal to `min`): progressed to Payment step.
  - Future date `2026-11-21`: progressed to Payment step.
  - Time slots: fixed UI options **10:00 AM–12:00 PM, 12:00 PM–2:00 PM, 2:00 PM–4:00 PM, 4:00 PM–6:00 PM, 6:00 PM–8:00 PM** (5 options, **0 disabled**); no empty placeholder.
- **Implementation/business-rule conditions traced (read-only):**
  - `app/checkout/page.tsx`: `getTodayInIST()` computes date using IST offset (UTC+5:30) and sets `min`; `isPastDate` blocks dates < `getTodayInIST()` with "Please select today or a future date." Continue allows progression when date present and not past (concrete slot always selected from fixed options).
  - `backend/src/services/slotValidation.ts`: authoritative parsing/validation (`parseCheckoutSlot`, `validateSlot`) uses Asia/Kolkata rules; rejects invalid/past slots (`"Slot must be in the future."`) and enforces bakery hours (Mon–Fri 07:00–21:00, Sat 07:00–22:00, Sun 08:00–20:00). Client/browser time not trusted for authoritative validity.
- **Findings (not automatically defects):**
  - **Minimum/current-day date:** UI minimum follows implementation's IST "today" (`getTodayInIST()`); in this runtime evaluated to `2026-11-20` and that date was selectable. Consistent with implemented rule; intended business/timezone requirement not asserted — **OBSERVATION**.
  - **Slot availability calculation:** UI uses a static slot list (no dynamic filtering/disabling by current time/day/hours edge cases). Backend enforces authoritative future/business-hours validation on parse/submit — **OBSERVATION**.
  - **Missing slot / unavailable-invalid slot feedback:** **NOT TESTABLE** in UI (no empty/disabled slot states).
- **No bookings created, no settings modified, no system clock manipulated.**

### Phase 4 — Customer validation follow-up (browser evidence, no submit/account/OTP)

All checks via **step-1 "Continue" (Customer details)** interactions only (no checkout submission/account creation/OTP). Guest checkout context.

| Case | Input (synthetic) | Progression | Exact validation messages observed (field-specific) | Notes |
|---|---|---|---|---|
| Empty customer name/email/mobile | name `""`, email `""`, phone `""` | Stayed on Customer details | **"Please enter your phone number."** (visible) | No name/email required message shown at step-1 Continue (step-1 handler validates phone only). |
| Invalid email + invalid mobile | name `UAT Test Customer`, email `uat-invalid-email`, phone `12345` | Stayed on Customer details | **"Enter a valid 10-digit Indian mobile number."** (visible) | **Invalid email not reported as mobile validation failure**; email error not shown at step-1 (phone validation blocked progression). |
| Empty email + valid mobile | name `UAT Test Customer`, email `""`, phone `9876543210` | Progressed to Delivery or pickup | (none shown) | Step-1 Continue does not enforce guest email required/empty at this point (final validation path not exercised). **OBSERVATION**. |
| Invalid email + valid mobile | name `UAT Test Customer`, email `bad@`, phone `9876543210` | Progressed to Delivery or pickup | (none shown) | **Confirmed: invalid email not accidentally reported as mobile validation failure.** Email format not enforced at step-1 Continue. **OBSERVATION**. |
| Valid synthetic details | name `UAT Test Customer`, email `uat.customer@example.test`, phone `9876543210` | Progressed to Delivery or pickup | (none shown) | **PASS**. |

- **Result:** **PASS (specific requirement met):** invalid email was not reported as a mobile validation failure. **OBSERVATIONS:** step-1 Continue validates phone but does not surface guest name/email required/format errors, so empty/invalid email cases can progress past step 1 (final submit validation applies but was not exercised). No forms submitted that create accounts or send OTP.

### Phase 5 — Safety and preservation (confirmed)

- No checkout submission, **no order created**, **no inventory reserved**, **no payment initialized** (no Razorpay/provider calls), **no account creation/login**, **no database writes/synthetic record creation**, **no email/OTP/WhatsApp/Cloudinary/external-provider operations**.
- Browser context closed. Backend and MongoDB remained running/untouched; post-run checks healthy (`GET /` 200, `GET /health` 200 connected).
- Branch/HEAD unchanged (`feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`), existing dirty/untracked workspace preserved. No source/config/environment changes, no service restarts, no Git operations.

### BLB-03K outcome summary
- **PASS:** valid customer details progression; pickup shows Pay at Store (and not COD), delivery shows COD+Online (and not Pay at Store) per conditional rules; empty/past date blocked with expected messages; IST-today (per implementation) and future date accepted; invalid email not misreported as mobile validation failure.
- **OBSERVATION:** Pay at Store visibility is fulfilment-conditional (pickup-only) — explains BLB-03H-R1 non-visibility in delivery context (not a defect). Scheduling min-date/current-day behavior follows `getTodayInIST()` implementation (IST-today evaluated to `2026-11-20` in this run). UI time slots static/not dynamically filtered by availability. Step-1 Continue does not surface guest name/email required/format errors (final validation path not exercised).
- **NOT TESTABLE:** missing slot selection and unavailable/invalid slot feedback in UI (no empty/disabled slot states).
- **FAIL:** none confirmed. **Defect register not updated** (no genuine defect confirmed).

## BLB-03L Guest customer details validation review (2026-11-19)

- **Objective:** determine whether guest customer name and email validation is correctly enforced before an order can be placed, and whether current checkout UX provides appropriate field-level feedback. **Read-only implementation/test review + isolated browser validation (no submit). No fixes.**
- **Baseline:** branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`; frontend `http://localhost:3000`, backend `http://127.0.0.1:5000`, UAT DB `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`. No source/config/env/service/Git changes.
- **Browser context:** fresh isolated Playwright MCP context (2026-11-19), synthetic values only, closed after validation.

### Phase 1 — Read-only implementation review (guest name/email)

- **Frontend (`app/checkout/page.tsx`):**
  - **Customer details step Continue:** validates **phone only** (`validatePhone(phone)`); on phone error sets `fieldErrors.phone` and stays on details, otherwise clears phone error and advances to fulfilment. It does **not** validate guest name or guest email.
  - **`handlePlaceOrder()` (final client validation, runs on Place Order click):** enforces `customerName` required for checkout with **"Please enter your full name."**; enforces email for **guest** checkout when `!isAuthenticated` and email does not match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` with **"Enter a valid email address."** (authenticated customers may omit email per comment: e.g. phone-only OTP customers). Also enforces phone, delivery address/pincode rules, schedule, etc.; on validation failure sets field errors, moves to first error step, and returns without submitting.
  - UI labels/placeholders: "Full name" / "Enter your name", "Email address" / "Enter your email address".
- **Backend (`backend/src/controllers/orderController.ts`):**
  - `createOrderSchema`: `customerName` and `email` are `.optional()` in schema shape, but controller enforces required checkout fields after parse: `if (!data.customerName || !data.email || !data.phone) return 400 { message: "Checkout requires a name, valid email, and valid phone number" }` (comment: "All checkouts (guest and authenticated) require a name, email, and phone."). Schema validates email format when provided (`z.string().trim().email()...`) and name constraints when provided.
- **Existing automated tests (read-only):** `backend/tests/orderValidation.test.ts` includes **"rejects guest order with missing email"** expecting 400 with message containing `"Checkout requires a name, valid email, and valid phone number"`. Base payloads in backend tests include `customerName` and `email` for valid checkout cases.
- **Documented business rule:** no separate product/requirements document found in reviewed code/docs explicitly stating step-level UX enforcement text beyond implementation/comments/messages above. **Not assumed.** Based on implementation and tests: guest checkout requires **name, valid email, and valid phone** before order creation; backend rejects missing name/email/phone.

### Phase 2 — Isolated browser validation (fresh context, synthetic values, no Place Order/submit)

Method: step-1 **Continue** clicked for each case (no Place Order, no final submit, no account/login/OTP/payment/order/DB write).

| Case | Input | Step progression | Field-specific errors shown (step 1) | Values retained | Notes |
|---|---|---|---|---|---|
| 1. Empty name, valid email, valid mobile | name `""`, email `uat.customer@example.test`, phone `9876543210` | **Progressed to Delivery or pickup** | None shown (`Please enter your full name` not visible) | Not directly re-captured on details after navigation-back in this run (state expected preserved by SPA; explicit post-back value assertion not captured) | Step-1 Continue does not validate name. |
| 2. Valid name, empty email, valid mobile | name `UAT Test Customer`, email `""`, phone `9876543210` | **Progressed to Delivery or pickup** | None shown (`Enter a valid email address` not visible) | Not directly re-captured post-back in this run | Step-1 Continue does not validate guest email required. |
| 3. Valid name, malformed email, valid mobile | name `UAT Test Customer`, email `bad-email`, phone `9876543210` | **Progressed to Delivery or pickup** | None shown (`Enter a valid email address` not visible) | Not directly re-captured post-back in this run | Step-1 Continue does not validate guest email format. |
| 4. Valid name, valid email, valid mobile | name `UAT Test Customer`, email `uat.customer@example.test`, phone `9876543210` | **Progressed to Delivery or pickup** | None shown | N/A | **PASS** for progression with valid inputs. |

- **Final client-side validation (`handlePlaceOrder`) exercisable without placing order:** **No / BLOCKED by safety constraint.** `handlePlaceOrder` runs on Place Order click and performs client-side checks before API submission (per code), but clicking Place Order/submit is prohibited; therefore field-level feedback from final client validation path could not be exercised in-browser.
- **Observed UX gap (evidence-based):** step-1 Continue provides phone validation feedback only; guest name-required and guest email-required/format feedback are not surfaced at step 1 for the tested cases, allowing progression to fulfilment despite missing/malformed guest name/email. Final enforcement exists in client final-validation code and backend/tests, but pre-submission UX feedback at step 1 is incomplete.

### Phase 3 — Backend validation review (no UAT DB requests)

- **Read-only code:** controller requires `customerName`, `email`, and `phone` for checkout requests (400 `"Checkout requires a name, valid email, and valid phone number"` when missing). Zod schema validates email format/name constraints when provided.
- **Existing automated tests:** `backend/tests/orderValidation.test.ts` → "rejects guest order with missing email" **expects 400** with required-fields message (test present; previously passing in BLB-03J clean suite context / established suite). No order-creation requests sent to `127.0.0.1:27018/bluebell_whatsapp_uat` during BLB-03L.
- **Conclusion:** backend order schema/controller rejects missing guest email (and missing required checkout identity fields per enforced check) before order creation in application logic/tests.

### Results classification

| Check | Result | Rationale |
|---|---|---|
| Guest name/email required for order placement (enforcement before order creation) | **PASS (by code/tests), final UI path BLOCKED from exercise** | `handlePlaceOrder` and backend controller enforce; backend missing-email rejection covered by existing test; final client path not clickable under safety constraint. |
| Step-1 Continue field-level feedback for empty guest name | **OBSERVATION** | No "Please enter your full name." shown; progression allowed. |
| Step-1 Continue field-level feedback for empty guest email | **OBSERVATION** | No "Enter a valid email address." shown; progression allowed. |
| Step-1 Continue field-level feedback for malformed guest email | **OBSERVATION** | No "Enter a valid email address." shown; progression allowed. |
| Valid guest details progression | **PASS** | Progressed to fulfilment. |
| Genuine defect established against documented requirement | **No (not established)** | No explicit documented step-1 requirement located; behavior recorded as observation/gap. Defect register not updated. |

### Safety and preservation (confirmed)

- No checkout submission/order creation, no DB writes, no account creation/login/OTP, no payment initialization, no external-provider calls. Browser context closed. No source/config/environment changes, no service restarts, no Git operations. Branch/HEAD and existing dirty/untracked workspace preserved.

### What remains blocked by no-submission constraint

- Exercising `handlePlaceOrder()` client-side final validation messages/step-redirection in-browser (requires Place Order click).
- End-to-end guest rejection at API boundary in live UAT runtime via actual order-creation request (prohibited; covered instead by existing automated tests and read-only code review).

## BLB-03M Guest checkout UX requirement confirmation (2026-11-19)

- **Objective:** determine whether guest checkout must validate customer name and email on the **Customer details** step's **Continue** action, rather than only during final order validation. **Read-only discovery/classification only; no source/config/env/service/Git changes.**
- **Baseline:** branch `feature/whatsapp-business-automation`, HEAD `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`. No checkout submission/order creation, no DB writes, no account/OTP/payment/external-provider operations.

### Phase 1 — Existing requirement discovery (repository evidence)

- **UAT/requirements/planning docs reviewed:**
  - `docs/uat/BLB-03-UAT-TEST-PLAN.md`: defines customer journey cases at workflow level (e.g. `CUST-10 Guest checkout` **BLOCKED**; `CUST-08/CUST-09` address/scheduling validation expectations stated). No explicit acceptance criterion requiring **guest name/email validation before progressing/leaving the Customer details step (step 1 Continue)**.
  - `docs/uat/BLB-03-UAT-RESULTS.md` (BLB-03K/L): records observed behavior/observations for step-1 Continue vs final enforcement; BLB-03L notes no separate documented product/requirements document found explicitly stating step-level UX enforcement.
  - `docs/CLIENT_HANDOVER_STATUS.md`, `docs/WHATSAPP_STAGE5_PHASE_A.md`, `docs/UAT_SAFE_MODE.md`: no explicit step-1 Customer details name/email validation UX requirement found.
- **Checkout implementation (read-only):**
  - `app/checkout/page.tsx`: step-1 **Continue** validates **phone only** and advances to fulfilment when phone valid; `handlePlaceOrder()` (final client validation on Place Order click) enforces guest `customerName` (`"Please enter your full name."`) and guest `customerEmail` format/presence (`"Enter a valid email address."` when unauthenticated and invalid/empty) with field errors/step redirection, and returns without submitting on validation failure.
  - `backend/src/controllers/orderController.ts`: controller enforces required checkout identity fields (`customerName`, `email`, `phone`) → 400 `"Checkout requires a name, valid email, and valid phone number"`; schema validates formats when provided.
- **Existing automated tests (read-only):**
  - `backend/tests/orderValidation.test.ts`: asserts backend rejection for missing guest email with required-fields message (enforcement before order creation). No test asserts step-1 UI Continue must block on missing/malformed guest name/email.
  - `tests/e2e/checkout-delivery-address-validation.spec.ts`: `goToFulfilment()` fills **valid** name/email/phone and clicks Continue from "Customer details" to reach fulfilment; validates delivery/pickup/fulfilment-step behaviors only. No e2e case asserts step-1 name/email validation or blocking progression on invalid guest name/email.
  - Other e2e specs searched showed no Customer details name/email step-1 validation assertions.
- **Design decisions:** no ADR/design note found in repository establishing intended step-1 vs final-only validation UX for guest name/email.

### Phase 2 — Requirement classification

**Classification: `UNCONFIRMED`**

- **Rationale:** Repository evidence establishes that guest name, valid email, and phone are **required for order creation** and are enforced at final client validation and backend (and covered by backend tests), but it does **not** explicitly establish whether the intended UX requires **field-level validation/blocking on the Customer details step Continue action** (before leaving step 1) versus allowing progression with enforcement/feedback at final order placement (or another intended flow). Existing e2e flow uses valid details and does not codify step-1 name/email blocking; no requirements/acceptance criteria/UX doc found mandating step-1 enforcement.
- **Exact supporting evidence (files/locations):**
  - `docs/uat/BLB-03-UAT-TEST-PLAN.md` (workflow-level cases; no step-1 guest name/email Continue-validation criterion)
  - `docs/uat/BLB-03-UAT-RESULTS.md` (BLB-03K/L observations: step-1 Continue validates phone only; final enforcement exists; no documented step-level requirement located)
  - `app/checkout/page.tsx` (step-1 Continue phone-only; `handlePlaceOrder` guest name/email validation/messages; guest email required when unauthenticated)
  - `backend/src/controllers/orderController.ts` (required `customerName`/`email`/`phone` enforcement; 400 message)
  - `backend/tests/orderValidation.test.ts` (missing guest email rejected at API/order boundary)
  - `tests/e2e/checkout-delivery-address-validation.spec.ts` (valid customer details used to progress; no step-1 name/email invalid-case assertions)

### Phase 3 — Implementation decision

- **Decision:** **No source-code changes justified at this time.** Intended step-1 UX behavior is **UNCONFIRMED** in repository evidence; modifying behavior without confirmed requirement risks unintended UX/design change.
- **If later classified REQUIRED (after confirmation):** implement minimal step-1 validation in `app/checkout/page.tsx` Customer details Continue handler to enforce guest name required and guest email required/format (aligned with existing `handlePlaceOrder` rules/messages), preserve entered values, prevent progression on invalid fields, keep phone validation and existing final/backend enforcement; add/update focused frontend/e2e regression tests and run relevant checks/typechecks (and browser regression) without submitting orders.
- **If later classified NOT REQUIRED:** retain current behavior (final/backend enforcement) and document decision.
- **Client/owner decision needed:** confirm intended guest checkout UX — **must Customer details Continue block progression and show field-specific errors for missing/malformed guest name and email (step-1), or is final order-placement validation (with existing backend enforcement) the intended behavior?**

### Documentation / defect register
- `docs/uat/BLB-03-UAT-RESULTS.md` updated with discovery and decision.
- **Defect register not updated:** no actual requirement violation established (requirement unconfirmed).

### Safety and preservation (confirmed)
- No source-code changes, no checkout submission/order creation, no database writes, no account creation/OTP/payment/external-provider operations, no service restarts or environment changes, no Git operations. Existing working tree preserved.

## BLB-03N Remaining customer UAT execution & blocker assessment (2026-11-19)

- **Objective:** continue Stage 3 Customer UAT by reviewing `CUST-*` cases, classifying each by current evidence/safe executability, executing only safely verifiable remaining customer-facing cases in isolated local UAT, assessing genuine defects (no fixes), and documenting results/blockers. **Continuation of existing project; no new application/replacement functionality.**
- **Baseline verification (read-only, 2026-11-19):**
  - Repo/docs reviewed: `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `docs/uat/BLB-03-UAT-RESULTS.md`, `docs/uat/BLB-03-DEFECT-REGISTER.md`, `docs/CLIENT_HANDOVER_STATUS.md`.
  - Branch/HEAD: `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (verified). Working tree dirty/untracked preserved; no Git operations performed.
  - Frontend: `GET http://localhost:3000` = **200**.
  - Backend: `GET http://127.0.0.1:5000/health` = **200** `{"status":"ok","service":"bakery-api","database":"connected"}`.
  - Frontend-proxied APIs: `GET /api/products` = **200**, `GET /api/settings` = **200** (valid responses).
  - UAT database/connectivity evidence (sanitized): backend established connections to `127.0.0.1:27018` observed (`netstat`, no `27019` listener/connection evidence observed in this check); prior verified sanitized runtime checks confirm exclusive target `mongodb://127.0.0.1:27018/bluebell_whatsapp_uat`. Explicit `UAT_SAFE_MODE=` line not found in checked env files during BLB-03N baseline scan; runtime/operating context consistent with prior verified `UAT_SAFE_MODE=true` baseline. **No environment/config changes made.**
- **Constraints observed:** no order submission/account creation/login/credential access-reset-change/OTP/payment initialization/Razorpay/external-provider calls (email/WhatsApp/Cloudinary/webhooks), no DB writes/seeds/restores/migrations/imports/inventory changes, no service restarts, no source/config/env/deployment changes, no Git operations. Fresh isolated Playwright browser contexts used; browser closed after execution. MongoDB `27017` untouched; temp restore `27019` not used.

### Phase 2 — CUST-* case classification (status by sufficient evidence / safe executability)

| Test ID | Business workflow | Status | Rationale / evidence | Dependency / limitation (if not fully complete) |
|---|---|---|---|---|
| CUST-01 | Storefront homepage | **PASS** | Homepage loaded and rendered in browser with navigation/header/content (BLB-03H-R1-P2). BLB-03N reverified homepage reachability and storefront navigation to About/Contact/Custom Cakes/Track (fresh isolated context). | Full visual/mobile design review not exhaustive; no client/server errors observed in safe checks. |
| CUST-02 | Product catalogue | **PASS** | Catalogue displayed 5 products (BLB-03H-R1/BLB-03N). BLB-03N: search present; "Chocolate" returned 3 matching product links; "zzznomatchuat" returned 0 links with no-results message visible. Category derivation/filter UI implementation exists; empty-catalogue state not testable with current dataset. | No approved data changes to force empty/error states. |
| CUST-03 | Product detail pages | **PASS** | All 5 product detail pages loaded with expected name/price/availability and add-to-cart UI (BLB-03H-R1-P2). | — |
| CUST-04 | Product availability | **PASS** (available-state scope verified) | Available/in-stock products correctly presented and add/purchase actions available where expected (BLB-03H-R1, BLB-03N). | Unavailable/out-of-stock states and disallowed-action attempts **not testable** with current dataset (5 active in-stock products); no approved synthetic state/data/inventory changes. |
| CUST-05 | Cart add/update/remove | **PASS** | Add to cart, quantity increase/decrease, line/subtotal/total updates, remove-to-empty verified (BLB-03H-R1). | — |
| CUST-06 | Cart persistence after refresh | **PASS** | Controlled refresh on `/cart` preserved item/qty/totals/storage (BLB-03H-R1). BLB-03N checkout refresh preserved cart item/order-summary presence (form fields reset). | Cross-session persistence beyond exercised scenarios not separately re-tested. |
| CUST-07 | Price, quantity and total calculations | **PASS** | Cart/checkout summary calculations consistent (e.g. ₹650 ×1/×2 = ₹650/₹1,300) (BLB-03H-R1). | Fees/discounts not applicable in observed settings/data. |
| CUST-08 | Delivery address validation | **PASS** | Empty delivery address/city/pincode blocked with field messages (BLB-03H-R1). Invalid pincode `123` now correctly blocked with "Please enter a valid 6-digit pincode." and progression prevented (BLB-03I retest; BLB-03H-R1-D01 verified/resolved). Valid 6-digit pincode accepted; Pickup hides delivery-specific fields and progresses without them (BLB-03H-R1). | — |
| CUST-09 | Delivery date and time-slot validation | **PASS** (verifiable behaviors) | Missing/past dates blocked with expected validation (BLB-03H-R1/BLB-03K). IST-today (per implementation) and future dates accepted with valid slot progression observed (BLB-03K/H-R1). Static slot options presented. | **NOT TESTABLE (UI constraint):** missing time-slot state (no empty/placeholder). **NOT SAFELY TESTABLE:** unavailable/invalid slot feedback (no disabled/unavailable slots exposed). "Current date" acceptability depends on IST-today/min behavior (observed; not asserted as business requirement violation). |
| CUST-10 | Guest checkout | **BLOCKED** | End-to-end workflow requires order submission/recording and may involve verification/payment/provider steps; submission, order creation, OTP/verification, payment initialization, and external-provider operations prohibited or constrained in UAT safe context. Pre-submission guest navigation/validation extensively evidenced (CUST-08/09/payment presentation, BLB-03K/L/M). | **Dependencies:** explicit approval + safe path for submission/order creation, OTP/verification strategy (if required), payment/external-provider handling, and any required synthetic/pre-provisioned data; BLB-03M step-1 name/email UX requirement remains **UNCONFIRMED** (client/owner decision). |
| CUST-11 | Customer registration and OTP | **BLOCKED** | Requires account creation and OTP/verification flows; external email/OTP delivery suppressed under UAT safe mode and OTP non-recoverable by design. No approved safe UAT mechanism or account-creation approval. | **Dependencies:** approved safe/non-bypass OTP/account-creation test mechanism and policy, or pre-provisioned flow; no external sends. |
| CUST-12 | Customer login | **BLOCKED** | Requires valid pre-provisioned synthetic customer credentials (secure out-of-band). No approved credentials available; login/credential access/reset/change prohibited. | **Dependencies:** pre-provisioned synthetic customer account + securely provided credentials and session/logout test approval. |
| CUST-13 | Customer account and order history | **BLOCKED** | Requires authenticated synthetic customer with associated synthetic orders and authorized data visibility. Dataset/users/orders unavailable for this flow and authentication/account creation prohibited. | **Dependencies:** synthetic customer credentials, synthetic associated orders/data on `127.0.0.1:27018/bluebell_whatsapp_uat`, and approved authenticated access. |
| CUST-14 | Custom cake request submission | **BLOCKED** | Workflow expects request persisted/acknowledged (and safe upload handling); submission, DB writes, and external uploads/provider operations prohibited. BLB-03N safely verified custom cake page accessible (`/custom-cake`, "Custom Cakes", interactive form elements present) but did not submit. | **Dependencies:** approved safe submission path without real external uploads/providers, synthetic data/write approval, and acknowledgement/persistence verification method. |

### Phase 3 — Tests executed in BLB-03N (safe, fresh isolated browser contexts)

| Executed check | Preconditions | Exact actions (high level) | Expected result | Actual result | Result | Evidence (sanitized) | Defect |
|---|---|---|---|---|---|---|---|
| BLB-03N-NAV-01 Storefront navigation/pages | UAT stack healthy, unauthenticated browser | Open `/`, `/about`, `/contact`, `/custom-cake`, `/track`; observe load/headings/interactive elements | Pages load without server/client-blocking failure; key content/forms/lookup controls present as applicable | Home reached (header present); About H1 "Your cart is empty" state observed in captured text context, Contact H1 "Contact Us", Custom Cakes H1 "Custom Cakes" with interactive form elements, Track Order H1 "Track Your Order" loaded (interactive lookup presence not conclusively captured by locator heuristic) | **PASS** (pages reachable; minor heuristic ambiguity on track input locator only) | Playwright MCP isolated run (`page.url`/headings/visibility booleans/text snapshots). | — |
| BLB-03N-CAT-01 Catalogue search + no-match state | Products available (5) | Open `/products`; search "Chocolate"; search "zzznomatchuat" | Matching results filtered; no-match shows empty/no-results feedback | "Chocolate" → 3 product links; "zzznomatchuat" → 0 links and no-results message visible; catalogue H1 "All products", 5 links baseline, search UI present | **PASS** | Playwright MCP isolated run (counts/visibility/text). | — |
| BLB-03N-ERR-01 Invalid product detail (error state) | Frontend healthy | Navigate to `/products/this-product-does-not-exist-uat` | Customer-facing not-found/error state shown (no crash) | Rendered 404 page: URL unchanged to slug, H1 "404", main text "404 / This page could not be found.", not-found indicator visible | **PASS** | Playwright MCP isolated run (URL/H1/main text/visibility). | — |
| BLB-03N-AUTH-01 Unauthenticated account access | No login/credentials used | Navigate to `/account`; observe redirect/behavior | Protected account area requires sign-in or redirects safely (no unauthorized data exposure) | Redirected to `/account/landing` with account sign-in/create prompt content observed | **PASS** (safe access control/redirect behavior observed) | Playwright MCP isolated run (final URL/redirect/text). | — |
| BLB-03N-AUTH-02 Unauthenticated order-history access | No login/credentials used | Navigate to `/account/orders`; observe redirect/behavior | Protected orders/history requires sign-in or redirects safely | Redirected to `/account/login` ("Welcome back" sign-in page) | **PASS** (safe access control/redirect behavior observed) | Playwright MCP isolated run (final URL/redirect/H1/text). | — |
| BLB-03N-CHK-01 Checkout refresh behavior (cart/form state) | Item in cart, checkout reachable | Add product, open `/checkout`, reload page (no submit) | Cart/order summary persists per design; form state behavior observed without corruption/submission | After reload: remained on `/checkout`, cart not empty, order-summary item still visible, customer details step visible with name/email/phone fields empty (form values not retained across refresh) | **PASS** (observed behavior recorded; cart persisted, form reset on refresh) | Playwright MCP isolated run (URL/visibility/field values booleans-text). | — |
| BLB-03N-CHK-02 Checkout back-navigation + entered-value retention | Item in cart, checkout reachable | Attempt multi-step entry/back/forward retention checks across details/fulfilment/schedule (no submit) | Entered values retained when navigating back/forward between steps (if intended) | **Inconclusive in this run** due browser-interaction automation issues (step/field visibility and interaction sequencing not reliably evidenced despite multiple attempts). No reliable PASS/FAIL evidence produced. | **NOT RUN (inconclusive automation evidence)** | Prior partial attempt results (not relied upon for pass/fail). Earlier accumulated runs evidence step progression/validation but not this specific retention assertion conclusively in BLB-03N. | — |

### Phase 4 — Defect assessment

- **Confirmed defects (new, BLB-03N):** **None.**
- **Observations (not confirmed requirement violations):** custom-cake and track pages reachable (CUST-14/UI support only; submission blocked); unauthenticated account routes redirect to landing/login; catalogue no-match handled; invalid product slug returns 404; checkout refresh resets form fields but preserves cart/summary (behavior recorded, not asserted as defect). BLB-03M guest step-1 name/email Continue UX remains **UNCONFIRMED** (not converted to REQUIRED/NOT REQUIRED and not logged as requirement violation).
- **Defect register update:** **none** (no genuine defect established). Existing register remains unchanged (`BLB-03D-D01/D02`, `BLB-03E-D01/D02` open/monitoring; `BLB-03G-D01`, `BLB-03H-D01`, `BLB-03H-R1-D01` verified/resolved).

### Blocked tests and exact dependencies

| Test ID / area | Status | Exact dependency blocking safe completion |
|---|---|---|
| CUST-10 Guest checkout (full workflow) | BLOCKED | Explicit approval/safe method for order submission and order creation/persistence verification; OTP/contact verification path (if required) compatible with UAT safe mode/non-recoverable OTP; payment flow handling without real transactions/provider side effects; synthetic test inputs/data as required. BLB-03M UX requirement decision (client/owner) still unconfirmed for step-1 guest name/email validation. |
| CUST-11 Customer registration and OTP | BLOCKED | Approved safe/non-bypass registration+OTP test mechanism or pre-provisioned equivalent; account creation approval; external OTP/email remains suppressed/unavailable for real delivery in UAT safe mode. |
| CUST-12 Customer login | BLOCKED | Pre-provisioned synthetic customer credentials provided securely out-of-band; approval to perform login/session validation without credential exposure/change/reset. |
| CUST-13 Customer account and order history | BLOCKED | Authenticated access to synthetic customer with associated synthetic orders on `127.0.0.1:27018/bluebell_whatsapp_uat`; credentials and approval for authenticated read-only verification. |
| CUST-14 Custom cake request submission | BLOCKED | Approval for safe submission/DB write or equivalent verification; safe handling for any media/upload fields without external Cloudinary/provider calls or false success; synthetic request lifecycle data/acknowledgement path. |
| CUST-04 (unavailable/out-of-stock/disallowed-action states) | Scope-limited | Approved synthetic dataset/state changes or prepared products in unavailable/out-of-stock states (no inventory/DB writes permitted now). |
| CUST-09 (missing-slot UI state, unavailable/invalid slot feedback) | NOT TESTABLE | UI does not expose empty/disabled slot states to exercise; would require controlled data/config/state or UI path not currently available without prohibited changes. |
| Admin UAT (ADM-*) | BLOCKED (context) | Authorized existing admin credentials unavailable/unconfirmed; pre-provisioned/synthetic admin/customer/order/WhatsApp/outbox data and approved flows as applicable. |

### Documentation updated

- Appended **BLB-03N** section to `docs/uat/BLB-03-UAT-RESULTS.md` (earlier results preserved).
- `docs/uat/BLB-03-DEFECT-REGISTER.md` **not updated** (no genuine defect established in BLB-03N).

### Safety and preservation confirmation

- **No prohibited operations occurred:** no checkout/order submission, no order creation, no account creation/login/credential access-reset-change, no OTP/email/WhatsApp/Cloudinary/Razorpay/external-provider requests, no payment initialization/transactions, no DB writes/seeds/restores/migrations/imports, no inventory/stock changes, no `UAT_SAFE_MODE` disablement, no service restarts/modifications, no source/config/environment changes. MongoDB `27017` untouched; temp restore `27019` not used. Fresh isolated browser contexts used and closed.
- **Workspace/Git preserved:** branch/HEAD unchanged (`feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`); existing dirty/untracked work preserved; no staging/commit/push/merge/branch switch/reset/clean/stash performed.

### Current Stage 3 completion assessment

- **Safely executable customer-facing tests (in current isolated UAT constraints):** substantially covered for storefront navigation/content, catalogue/search/no-match, product details, available-state presentation, cart operations/persistence/calculations, guest checkout pre-submission navigation/validation (customer/fulfilment/address/pincode/scheduling/payment presentation), error/404 handling, and unauthenticated account-route access behavior. **No new confirmed defects identified in BLB-03N.**
- **Not complete:** **Customer UAT is NOT complete.** Business workflows/cases remain blocked or not fully exercisable: end-to-end guest checkout submission/recording (CUST-10), registration/OTP (CUST-11), authenticated customer login/account/order history (CUST-12/13), custom cake request submission/persistence (CUST-14), unavailable/out-of-stock state scenarios, missing/unavailable slot UI states, and all admin UAT dependent on credentials/synthetic data. BLB-03M guest step-1 name/email UX requirement remains **UNCONFIRMED** pending client/owner decision.
- **Evidence quality:** completed items are supported by prior and BLB-03N browser/runtime evidence (sanitized). Blocked items are distinguished from passed tests; no 100% completion claimed.

## BLB-03O UAT prerequisite & business decision planning (2026-11-19)

- **Objective:** prepare a clear approval and prerequisite plan for completing remaining customer and admin UAT workflows. **Read-only planning and documentation only; no implementation.** Continuation of existing Bluebell Bakehouse project (no new application/replacement functionality).
- **Baseline verification (read-only, 2026-11-19):**
  - **Repo/docs reviewed:** `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `docs/uat/BLB-03-UAT-RESULTS.md` (through BLB-03N), `docs/uat/BLB-03-DEFECT-REGISTER.md`, `docs/CLIENT_HANDOVER_STATUS.md`, `docs/UAT_SAFE_MODE.md`.
  - **Branch/HEAD:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (verified).
  - **UAT environment / Safe Mode status (sanitized available evidence):** prior and BLB-03N runtime checks confirm frontend `http://localhost:3000` and backend `http://127.0.0.1:5000` healthy/connected with proxied `/api/products` and `/api/settings` responsive; backend connected to `127.0.0.1:27018` (`bluebell_whatsapp_uat`) per sanitized runtime evidence; `UAT_SAFE_MODE=true` operating context consistent with prior verified baseline and `docs/UAT_SAFE_MODE.md` policy (blocks real Brevo/email/OTP delivery, Meta WhatsApp outbound/live webhooks, Razorpay live operations/webhooks, Cloudinary external ops, production Google OAuth; enforces isolated local DB target). **No environment/config/service changes made in BLB-03O.**
  - **Existing blockers (summary):** CUST-10–14 and ADM-* remain blocked/not fully executable due to missing approvals/prerequisites (order submission/DB writes, synthetic accounts/data/credentials, OTP/account-creation constraints, payment/provider-safe verification paths, admin access). BLB-03M guest step-1 name/email Continue UX requirement remains **UNCONFIRMED**.
  - **Previously recorded results / outstanding defects:** BLB-03N shows substantial safe-executable customer coverage with no new confirmed defects; open defects `BLB-03D-D01` (Low/P3), `BLB-03D-D02` (Low/P4), `BLB-03E-D01` (Medium/P2, monitoring), `BLB-03E-D02` (Low/P4); verified/resolved `BLB-03G-D01`, `BLB-03H-D01`, `BLB-03H-R1-D01`. **All prior documentation preserved.**

### Phase 2 — BLB-03M business decision requirement (client/owner)

**Decision required (do not assume/select): Guest checkout — Customer details step “Continue” action**

| Option | Meaning |
|---|---|
| **A** | Require guest **customer name, valid email, and phone** before allowing progression from Customer details to fulfilment, showing **field-specific validation errors** at step 1 (Continue). |
| **B** | Allow progression after **phone validation** (current step-1 behavior), with guest **name/email enforced during final order placement** (client-side final validation) and by the **backend** (authoritative). |

- **Current classification:** **`UNCONFIRMED`** (no explicit repository requirement/acceptance criterion/ADR mandates step-1 name/email blocking before Continue; see BLB-03L/M evidence).
- **Existing implementation behavior (factual):**
  - `app/checkout/page.tsx`: Customer details **Continue** validates **phone only** and advances when valid; missing/malformed guest name/email can progress to fulfilment (BLB-03K/L observations). `handlePlaceOrder()` (runs on Place Order click; not exercised by submission in UAT) enforces guest name required (`"Please enter your full name."`) and guest email required/format for unauthenticated checkout (`"Enter a valid email address."`) and blocks submission client-side with field/step errors.
  - `backend/src/controllers/orderController.ts`: requires `customerName`, `email`, and `phone` for checkout requests (400 `"Checkout requires a name, valid email, and valid phone number"`); schema validates formats/constraints when provided.
  - `backend/tests/orderValidation.test.ts`: includes rejection for missing guest email (existing coverage); no test asserts step-1 Continue must block on missing/malformed guest name/email.
- **Existing final frontend/backend protections:** guest name/email/phone enforced at final client validation path and backend request validation (authoritative) before order creation; pre-submission step-1 UX feedback for guest name/email is currently incomplete.
- **Who must approve:** **Client/owner (product/business decision-maker)**, with implementation/QA implications acknowledged by technical owner as needed.
- **Where approved decision should be recorded:** `docs/uat/BLB-03-UAT-RESULTS.md` (BLB-03M decision record / subsequent execution note) as the primary UAT evidence trail; reflect in `docs/CLIENT_HANDOVER_STATUS.md` and/or agreed requirements/acceptance artifact if maintained for handover. Do **not** infer or record A/B without explicit written approval.
- **Action constraint:** **No checkout behavior modified in BLB-03O.** Defect register not changed (no confirmed requirement violation while unconfirmed).

### Phase 3 — Controlled UAT prerequisite matrices

#### 3A. Customer workflows (CUST-10–CUST-14)

| Workflow | Why currently blocked | Minimum required test data | Required credentials/access | DB writes needed? | External providers involved? | Safe verification requirements | Required client/owner approval | Evidence needed to mark PASS |
|---|---|---|---|---|---|---|---|---|
| **CUST-10 Guest checkout and order creation** | End-to-end placement requires order submission/recording; may require verification/payment/provider side effects. UAT constraints prohibit submission/order creation, OTP/payment/external-provider ops; verification/OTP paths constrained by safe mode (no real OTP delivery, non-recoverable). Pre-submission navigation/validation evidenced but workflow incomplete. BLB-03M UX decision unconfirmed. | Synthetic cart items/products (existing 5 OK), synthetic guest identity/contact/address/schedule inputs; dedicated UAT dataset state allowing order persistence visibility without affecting production. | Tester access to local UAT frontend/backend only; no real customer contact details. Any verification mechanism must be explicitly approved (no real OTP to customers). | **Yes** (order creation/persistence, possible inventory reservation/state changes) if executed end-to-end. | **Potentially/conditionally:** Razorpay (blocked in UAT safe mode; live transactions/webhooks prohibited), Brevo/OTP/email and WhatsApp notifications (blocked/suppressed in safe mode) — must not be contacted as real providers/customers. | Execute only in isolated local UAT (`127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`), no real payments, no real OTP/email/WhatsApp, suppressed notifications not claimed delivered, controlled/approved write+cleanup plan, sanitized evidence. | Explicit approval for: DB writes/order creation (and reservation effects if applicable), any approved verification path, payment-safe test method (no real transactions), and acceptance of BLB-03M decision impact on expected UX. | Steps + expected/actual showing order placed/recorded per approved safe path with correct totals/customer/fulfilment/schedule/state; no real provider side effects; sanitized screenshots/logs/DB evidence (read-only capture of created synthetic records) and pass/fail recorded. |
| **CUST-11 Customer registration and OTP** | Registration/OTP flows constrained: UAT safe mode suppresses external email/OTP delivery and OTP plaintext not exposed/recoverable; account creation implies DB writes. No approved safe non-bypass UAT mechanism. | Synthetic registrant identity (non-real), minimal profile fields; isolated UAT user space. | Controlled test access to registration UI/API flow; no credentials exposed in repo/chat. Any OTP verification method must be separately approved and non-bypass. | **Yes** (user/account/registration records, OTP/session artifacts as applicable). | **Brevo/email (OTP)** suppressed/blocked in UAT safe mode — no real messages to customers. | No real OTP/email sent; no auth bypass/hardcoded OTP; no secret/token exposure; verify supported UAT-safe behavior only; controlled write+cleanup. | Explicit approval for account creation/DB writes and an approved, secure, non-bypass UAT-safe OTP/registration verification approach (or formal scope limitation). | Evidence of supported registration+OTP behavior under approved safe method (or documented limitation if approved out-of-scope), with no real delivery and correct auth state handling. |
| **CUST-12 Customer login** | No approved pre-provisioned synthetic customer credentials available; login requires known account; credential handling restricted. | Pre-provisioned synthetic customer account (and password) in UAT DB. | Synthetic customer credentials delivered **securely out-of-band** (not in chat/repo); tester access to customer login UI. | **Provisioning:** yes (DB write, prior approved step). **Login/session:** typically read/auth-state operations; session persistence may involve storage/cookies/tokens depending on implementation (treat as controlled runtime activity). | None required for password login path; no OAuth/external auth. | Valid/invalid credential checks, session/logout behavior, no credential exposure in evidence; isolated UAT only. | Approval to provision synthetic account and to perform login/logout testing with securely delivered credentials. | Valid login succeeds, invalid rejected, session/cookies/logout behave correctly; sanitized evidence (no secrets/PII beyond approved synthetic identity). |
| **CUST-13 Customer account and order history** | Requires authenticated synthetic customer with associated synthetic orders; `users/orders` currently absent for this flow and auth/account creation prohibited. | Synthetic customer profile + associated synthetic orders (multiple states if needed) linked to that account. | Approved authenticated customer session (per CUST-12). | **Provisioning:** yes. **Viewing:** read-only. | None expected for viewing; notifications must remain suppressed if incidental triggers occur. | Verify only authorized data visible; correct order history/details rendering; sanitized evidence. | Approval for provisioning customer+orders and authenticated read-only verification. | Account/profile and order history/details display correct, authorized synthetic data only. |
| **CUST-14 Custom cake request submission** | Submission/persistence/acknowledgement requires DB writes and may involve media uploads; external Cloudinary ops blocked in safe mode (must not report false success). Submission/writes/uploads prohibited in current state. UI page reachable only. | Synthetic request inputs (occasion/size/date/details), optional safe test media only if approved; target records in UAT DB. | Tester access to custom cake UI; no real customer contact details required beyond synthetic/approved values. | **Yes** (request record persistence/state). | **Cloudinary/media upload** blocked externally in UAT safe mode — external upload/delete must not occur; avoid false-success UX. Other notifications suppressed per safe mode. | Submit only via approved safe path; confirm persistence/acknowledgement matches safe-mode behavior; no unintended external uploads; sanitized evidence. | Approval for DB writes/submission and explicit policy for media fields (none, local-only/fixture if supported, or accepted limitation) without external uploads. | Request persisted/acknowledged appropriately under approved safe conditions; no external upload side effects; evidence of stored synthetic request/state. |

#### 3B. Admin workflows (ADM-01–ADM-13 and related)

| Workflow | Why currently blocked | Minimum required test data | Required credentials/access | DB writes needed? | External providers involved? | Safe verification requirements | Required client/owner approval | Evidence needed to mark PASS |
|---|---|---|---|---|---|---|---|---|
| **ADM-01 Admin authentication** | Admin record exists but authorized credentials/access not securely available/verified for UAT execution. | Existing/provisioned admin account in UAT context. | Secure, authorized admin credentials (out-of-band), admin login access. | Typically no for login validation itself (session/auth handling may vary); no credential reset/change in scope. | None. | Valid/invalid login behavior, authorized session, no secret exposure. | Approval to use/provide secure admin credentials for UAT. | Valid admin login establishes authorized session; invalid rejected; sanitized evidence. |
| **ADM-02 Authorization & protected routes** | Requires both admin and ordinary customer sessions/accounts; customer creds/data not provisioned. | Admin account + synthetic customer account/session. | Admin and customer credentials/access (secure out-of-band). | Provisioning may require DB writes (if new synthetic users); route checks are read/auth. | None. | UI and API enforcement verified for admin/customer/unauthenticated; no privilege escalation. | Approval for credentials/sessions and any provisioning. | Protected admin routes/APIs inaccessible to customer/unauthenticated and accessible to authorized admin (evidence for UI+API). |
| **ADM-03 Dashboard data and metrics** | Requires sufficient dataset/orders/metrics or valid empty-state baseline; limited synthetic orders/metrics. | Synthetic orders/customers/products/metrics as needed for meaningful display. | Admin session (ADM-01). | Provisioning/data setup yes (if needed); viewing read-only. | None. | Data accuracy vs underlying records or correct empty states; sanitized metrics evidence. | Approval for any required data provisioning and dashboard access. | Dashboard renders and reflects underlying data correctly or shows valid empty states. |
| **ADM-04 Product creation and editing** | Requires admin session and safe handling of images; external Cloudinary ops blocked in safe mode. Changes imply DB writes. | Synthetic product payloads; optional images handled per safe-mode policy. | Admin session. | **Yes** (product create/edit persistence). | **Cloudinary** external upload/delete blocked/suppressed in UAT safe mode. | No external image side effects/false success; validate DB-backed persistence and validation/errors. | Approval for DB writes and image-handling policy in safe mode. | Valid create/edit persisted and reflected; validation handled; no external media side effects. |
| **ADM-05 Product availability** | Requires admin session and products/state to modify. | Existing or synthetic products. | Admin session. | **Yes** (availability/active state updates). | None direct (storefront reflects DB state). | Consistency across admin/storefront views. | Approval for DB writes/state changes. | Availability toggles persist and behave consistently. |
| **ADM-06 Inventory adjustments** | Inventory-managed products and permissions required; adjustments write DB/movements. | Inventory-enabled products, initial stock/movement baseline. | Admin session with inventory permissions. | **Yes** (stock/movement records). | None. | Correct levels/movements, audit behavior as designed, no unintended leakage. | Approval for inventory-affecting DB writes. | Adjustments persisted with consistent counts/movements. |
| **ADM-07 Order listing and filtering** | Requires synthetic orders across statuses/types/dates. | Synthetic orders dataset. | Admin session. | Provisioning yes; listing/filtering read-only. | None. | Correct results for filters/search/sort/pagination. | Approval for order data provisioning. | Correct orders returned/displayed per filters. |
| **ADM-08 Order status changes** | Requires orders in valid transitional states; transitions may trigger notifications/state side effects. | Synthetic orders in relevant states. | Admin session. | **Yes** (status/state transitions). | Email/WhatsApp notifications **suppressed/blocked** in UAT safe mode (must not be delivered/claimed sent). | Allowed transitions succeed, invalid blocked; suppressed notifications not reported delivered; state/audit consistent. | Approval for DB writes/status transitions and notification-suppression expectations. | Allowed/invalid transitions behave correctly with safe, verifiable side-effect handling. |
| **ADM-09 Customer management** | Requires synthetic customer records and admin visibility rules. | Synthetic customer records. | Admin session. | Provisioning yes; viewing read-only. | None. | Authorized visibility only; no unauthorized exposure; sanitized evidence. | Approval for data provisioning/access. | Correct customer data visible to authorized admin. |
| **ADM-10 Custom cake request management** | Requires synthetic custom cake requests and lifecycle actions. | Synthetic custom cake requests in relevant states. | Admin session. | Provisioning yes; updates **yes** if lifecycle changes tested. | Notifications/uploads subject to safe-mode suppression/blocks. | Correct state/detail updates; no external side effects claimed. | Approval for provisioning and any update/write actions. | Request lifecycle/details update correctly per workflow. |
| **ADM-11 WhatsApp Centre** | Requires WhatsApp-related data/UI context and admin access; live sends/webhooks blocked in UAT safe mode. | Synthetic WhatsApp conversations/messages/templates/status records (as applicable) or accepted empty/suppressed-state verification scope. | Admin session. | Provisioning may require DB writes; viewing read-only. | **Meta WhatsApp** outbound/live webhooks blocked in UAT safe mode. | UI/data renders safely; no real sends/webhook side effects; suppressed actions not shown as delivered. | Approval for data provisioning/scope and admin access. | Centre renders safely with accurate state/suppression behavior (no real provider contact). |
| **ADM-12 Notification and outbox monitoring** | Requires notification/outbox records or safely generated events to inspect. | Synthetic outbox/notification records or approved safe event generation. | Admin session. | Provisioning/event generation may require DB writes; monitoring read-only. | Email/WhatsApp delivery suppressed in UAT safe mode. | Status/retry/error views reflect stored state; suppressed deliveries not shown as sent/delivered. | Approval for data/event generation and monitoring scope. | Monitoring accurately reflects UAT-safe outbox/notification states. |
| **ADM-13 Settings management** | Requires admin access and controlled changes to settings singleton; changes affect system behavior. | Baseline settings snapshot/rollback plan; synthetic/test-safe values. | Admin session. | **Yes** (settings persistence). | Indirect (settings may gate flows) — no external provider calls by this action alone. | Validate persistence, authorization, validation, and controlled effect; restore/record final state. | Approval for settings writes and specific change set with rollback/restore plan. | Settings changes persist/apply correctly with validation/authorization enforced. |

### Phase 4 — Proposed safe test-data and access policy (proposal only; no creation/actions in this task)

- **Dedicated synthetic UAT customer identity:** use clearly synthetic, non-real person data (e.g. reserved test name/email/phone pattern) provisioned only in `127.0.0.1:27018/bluebell_whatsapp_uat`; never reuse real customer identities/contact details.
- **Dedicated synthetic admin access:** use a designated UAT-only admin account/context for testing; credentials issued/rotated/managed securely and separately from production; least privilege for testers.
- **Synthetic products/orders/custom cake requests:** create only the minimum synthetic records needed per workflow (orders across states, custom cake requests, inventory baselines, outbox/WhatsApp-related records as required) within isolated UAT DB; avoid unnecessary volume; label/track as UAT synthetic where possible.
- **Separation from production data:** strict isolation — local UAT DB on `127.0.0.1:27018` / `bluebell_whatsapp_uat` only; never `27017`, never temp restore `27019` for app UAT, never Atlas/production; `UAT_SAFE_MODE=true` enforced per policy.
- **Controlled database write and cleanup permissions:** explicit, time-bounded approval for who may perform writes, which collections/records, and for what purpose; pre-approved cleanup/rollback plan (including restoration of settings/baselines) executed only under separate authorization; no ad-hoc writes.
- **Secure credential delivery outside chat and repository files:** share credentials only via approved secure out-of-band channel (not in chat transcripts, tickets pasted into repo, committed files, screenshots, or logs); prohibit exposure in evidence.
- **OTP verification without sending real messages to customers:** do **not** send real OTPs to real recipients. Given `UAT_SAFE_MODE` suppresses external Brevo/OTP delivery and OTP plaintext is not exposed/recoverable, any OTP/registration/guest-verification testing requires a **separately approved, secure, non-bypass UAT mechanism/policy** (or formal deferral). **No proposal to bypass authentication, OTP validation, or security controls.**
- **Payment testing without real transactions:** no live Razorpay operations/webhooks/captures in UAT safe mode; do not claim real verified payments. Limit to approved safe/local behavior inspection consistent with safe mode (and automated deterministic mocks only where applicable in tests, not as real payment evidence).
- **WhatsApp/email verification without contacting real recipients:** no outbound Meta/Brevo delivery and no live WhatsApp webhooks in UAT safe mode; verify suppression/state/outbox behavior only as designed (not marked delivered/sent when suppressed). No messages to real recipients.
- **Custom cake image upload testing without unintended external uploads:** Cloudinary external upload/signature/delete blocked in safe mode; do not attempt flows that would cause external uploads or report false success. Limit to approved safe inputs (e.g. no media) unless a separately supported safe local/fixture mechanism is explicitly approved.
- **Audit trail and cleanup/retention expectations:** record who/when/what was approved and executed (sanitized), retain evidence in `docs/uat/` as appropriate, capture before/after state for modified synthetic records/settings, and perform/verify approved cleanup or document retained synthetic artifacts with retention rationale.

### Phase 5 — Approval checklist (review before blocked workflows begin)

**A. Decisions requiring client/owner confirmation**
- [ ] **BLB-03M:** select **A** or **B** for guest checkout Customer details Continue (name/email/phone step-1 validation vs phone-only step-1 with final/backend enforcement) and record approved decision in `docs/uat/BLB-03-UAT-RESULTS.md` (and handover/requirements artifact as agreed).
- [ ] Confirm scope/priority for blocked workflows (CUST-10–14, ADM-01–13 subsets) and acceptance of any deferred items.

**B. Technical prerequisites**
- [ ] Verified isolated UAT runtime: frontend `http://localhost:3000`, backend `http://127.0.0.1:5000`, DB `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true` (no `27017`/`27019`/Atlas/prod).
- [ ] Approved synthetic dataset/provisioning plan (customers, orders, custom cake requests, inventory/outbox/WhatsApp records as needed) with rollback/cleanup plan.
- [ ] Defined evidence capture method (sanitized screenshots/logs/DB read evidence, test IDs, pass/fail criteria).

**C. Security/access approvals**
- [ ] Secure out-of-band delivery of synthetic **customer** credentials (for CUST-12/13) and authorized **admin** credentials (for ADM-*), with no secrets in chat/repo/evidence.
- [ ] Approved non-bypass policy for OTP/registration/verification flows (or explicit deferral) — **no bypass of authentication/OTP/payment/authorization/security controls**.
- [ ] Least-privilege tester access and prohibition on credential reset/change/inspection beyond approved scope.

**D. Operations requiring explicit permission**
- [ ] Permission for specific **database writes** (provisioning, order creation/submission tests, status/inventory/settings/product/request changes) and for **cleanup/restore** actions.
- [ ] Permission for any **checkout/order submission** test execution (CUST-10) under approved safe conditions.
- [ ] Permission for any **account creation/provisioning** actions (CUST-11/12/13, ADM-related) under approved controls.
- [ ] Explicit prohibition maintained: no real payments/transactions, no real OTP/email/WhatsApp to real recipients, no live Razorpay/Cloudinary/Google OAuth/provider webhooks, no Safe Mode disablement, no production access.

**E. Work that can continue under existing Safe Mode (without above write/submission/auth approvals)**
- [ ] Read-only/browse/validation UI checks already covered or safely repeatable (storefront/catalogue/details/cart/calculations, pre-submission guest checkout navigation/validation, error/empty states, refresh/back observation where reliable, unauthenticated access/redirect checks) — subject to no-regression need and existing constraints.
- [ ] Documentation, planning, evidence consolidation, and defect triage based on confirmed evidence.

**Note:** **Missing approval is not approval.** Do not proceed with blocked operations without explicit, recorded authorization.

### Documentation / safety (BLB-03O)

- **Updated:** appended **BLB-03O** to `docs/uat/BLB-03-UAT-RESULTS.md` (prior results preserved). `docs/CLIENT_HANDOVER_STATUS.md` updated only with a factual status/blocker clarification to reflect BLB-03N progress and BLB-03O planning (no completion claims). `docs/uat/BLB-03-DEFECT-REGISTER.md` **not altered** (no genuine confirmed defect established).
- **No prohibited operations performed:** no source-code changes, no checkout/order submissions, no customer/admin account creation, no DB writes/seeds/migrations/imports/cleanup, no credential inspection/reset/modification, no OTP/email/WhatsApp/provider requests, no Razorpay/payment operations, no Safe Mode disabling, no service restarts or environment changes, no production deployment, no Git stage/commit/push/merge/reset/clean/stash/branch switch. Existing dirty/untracked files preserved.

### Current Stage 3 completion assessment (BLB-03O)

- **Customer UAT is NOT complete.** BLB-03N provided substantial evidence for safely executable customer-facing/pre-submission scenarios, but genuine business workflow completion remains blocked pending client/owner decisions and controlled prerequisites/approvals for CUST-10–14 (and scoped gaps) and all dependent admin workflows. BLB-03M remains **UNCONFIRMED**. No 100% completion claimed.

## BLB-03P Client/owner decision capture & controlled UAT enablement package (2026-11-19)

- **Objective:** prepare the existing Bluebell Bakehouse project for the next phase of genuine customer and admin business workflow UAT by consolidating BLB-03O decisions, approvals, technical prerequisites, and execution procedures. **Approval-readiness and documentation task only.** No credentials/synthetic accounts/test records/database entries created; no blocked business workflows executed.
- **Baseline verification (read-only, 2026-11-19):**
  - **Docs reviewed:** `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `docs/uat/BLB-03-UAT-RESULTS.md` (through BLB-03O), `docs/uat/BLB-03-DEFECT-REGISTER.md`, `docs/CLIENT_HANDOVER_STATUS.md`, `docs/UAT_SAFE_MODE.md`.
  - **Branch/HEAD:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (verified).
  - **Existing UAT environment / Safe Mode policy (documented, sanitized):** isolated local UAT target `127.0.0.1:27018` / `bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true` policy per `docs/UAT_SAFE_MODE.md` and prior verified runtime evidence (frontend `http://localhost:3000`, backend `http://127.0.0.1:5000` healthy/connected in recent runs). Safe Mode blocks real external side effects (Brevo/email/OTP, Meta WhatsApp outbound/live webhooks, Razorpay live ops/webhooks, Cloudinary external ops, production Google OAuth) and rejects unsafe DB targets. **No services/env/config changes made.**
  - **BLB-03M / BLB-03O status:** BLB-03M guest checkout step-1 Continue UX requirement remains **`UNCONFIRMED`** (pending client/owner decision). BLB-03O documented prerequisites, matrices, proposed safe test-data/access policy, and approval checklist.
  - **Current blockers:** CUST-10–14 and ADM-01–13 remain blocked/not fully executable pending explicit decisions/approvals, secure synthetic credentials/data, approved DB-write/cleanup permissions, and UAT-safe non-bypass approaches/policies for OTP/verification/payment/upload/submission flows. All earlier evidence and workspace changes preserved.

### Phase 2 — BLB-03M decision record (pending)

**Decision:** Guest checkout — Customer details step “Continue” behavior

| Field | Record |
|---|---|
| **Decision ID** | BLB-03M (linked approval AP-01) |
| **Option A** | Require guest **name, valid email, and phone** before progression from Customer details to fulfilment, with **field-specific validation errors** at step 1 (Continue). |
| **Option B** | Allow progression after **phone validation** (current step-1 behavior), with guest **name/email enforced during final order placement** (client-side final validation) and **backend validation** (authoritative). |
| **Current status** | **`PENDING CLIENT/OWNER DECISION`** |
| **Decision owner** | Client/Owner (product/business decision-maker). Technical owner/QA to acknowledge implementation and regression impact as applicable. |
| **Decision date** | _(blank until confirmed)_ |
| **Selected option** | _(blank until confirmed — A or B only upon explicit written approval; do not infer)_ |
| **Written approval reference/evidence** | _(blank until confirmed; record approver, date/time, channel/reference, and exact approved wording/scope)_ |
| **Implementation and regression impact** | **If A approved:** minimal change in `app/checkout/page.tsx` (Customer details Continue) to validate guest name/email aligned with existing `handlePlaceOrder`/backend rules/messages, preserve values, block progression on invalid fields, retain final/backend enforcement; requires focused frontend/e2e regression tests and browser verification (no submit). **If B approved:** retain current step-1 behavior (phone-only) with final/backend enforcement; document as intended and ensure no requirement-violation defect logged. **Current evidence:** step-1 Continue validates phone only; `handlePlaceOrder()` and backend enforce guest name/email/phone before order creation. No checkout code modified in BLB-03P. |

> **Constraint:** no option selected and no checkout behavior modified in this task.

### Phase 3 — Approval register (all pending; no approvals granted)

| Approval ID | Approval required | Approval owner/role | Exact decision or permission required | Scope and limitations | Current status | Evidence required for approval | Dependencies |
|---|---|---|---|---|---|---|---|
| **AP-01** | Guest checkout UX decision (BLB-03M) | Client/Owner (business/product); Technical owner acknowledgment | Explicitly approve **Option A** or **Option B** for Customer details Continue behavior and expected UX/messages/outcomes. | Applies to guest checkout step-1 UX only; must not weaken final/backend validation or security controls. | **PENDING** | Written approval record (approver, date, selected option, scope) stored/referenced in `docs/uat/BLB-03-UAT-RESULTS.md` (and agreed handover artifact). | BLB-03M evidence (BLB-03K/L/M); impacts CUST-10 expected UX/regression criteria. |
| **AP-02** | Synthetic customer and admin access | Client/Owner + Security/Technical owner | Permission to provision/use designated **UAT-only synthetic customer and admin identities** and to receive/use credentials **securely out-of-band** for authorized testing. | Synthetic/non-real identities only; least privilege; no credential exposure in chat/repo/screenshots/logs; no credential reset/change/inspection beyond approved scope. | **PENDING** | Written approval of identities/roles/access scope; evidence of secure out-of-band delivery method (without exposing secrets); approved tester list/roles. | AP-03/AP-04 for provisioning (if DB writes needed); AP-09 for admin scope. |
| **AP-03** | Isolated UAT database write permissions | Client/Owner + Technical/DB owner | Permission for specific, controlled **DB writes** on `127.0.0.1:27018/bluebell_whatsapp_uat` only for approved UAT activities. | Explicit collections/records/actions/time window; no `27017`, no `27019` app use, no Atlas/prod; no ad-hoc writes; rollback/cleanup required per AP-04. | **PENDING** | Written approval specifying allowed write operations, scope, owner, window, and rollback/cleanup plan reference. | `UAT_SAFE_MODE=true`, verified isolated target, AP-04 provisioning/cleanup plan. |
| **AP-04** | Synthetic data provisioning and cleanup | Client/Owner + Technical/DB owner | Permission to **provision** required synthetic data/accounts/orders/requests and to perform approved **cleanup/restore** actions. | Minimum necessary synthetic data only; documented before/after state; approved cleanup/retention; no real customer/production data. | **PENDING** | Written provisioning manifest + cleanup/rollback plan, approver/date, and post-execution cleanup evidence template. | AP-02, AP-03; informs CUST-10–14 and ADM-* runbooks. |
| **AP-05** | Registration and OTP testing policy | Client/Owner + Security/Technical owner | Define approved policy for **CUST-11 registration/OTP** (and any OTP-dependent guest verification if in scope): approved secure **non-bypass** UAT-safe mechanism or formal deferral/out-of-scope. | No real OTP/email/WhatsApp to real recipients; no auth bypass/hardcoded OTP; no secret/token exposure; compliant with `UAT_SAFE_MODE` (OTP delivery suppressed, plaintext non-recoverable). | **PENDING** | Written policy/decision, approved mechanism (if any), scope/limitations, and evidence criteria; or explicit deferral approval. | AP-02/AP-03/AP-04 if account creation/provisioning involved; AP-10 notification expectations. |
| **AP-06** | Guest checkout order submission | Client/Owner + Technical owner | Permission to execute **CUST-10** order submission/order-creation steps in isolated UAT under approved safe conditions. | Authorized scenarios/data only; no real customer details; no real payment transactions/provider side effects; controlled DB writes and cleanup per AP-03/AP-04. | **PENDING** | Written approval of exact submission scenarios, data, payment-safe handling, verification path, and evidence requirements. | AP-01, AP-02–AP-05 as applicable, AP-07, AP-10. |
| **AP-07** | Payment testing restrictions | Client/Owner + Technical/Security owner | Confirm permitted **payment-safe** verification scope (no live Razorpay ops/webhooks/captures, no real transactions, no claims of real verified payment). | `UAT_SAFE_MODE=true` constraints enforced; UI/state inspection and approved safe behavior only; no external payment provider contact. | **PENDING** | Written restriction/permission statement and accepted evidence boundaries for payment-related checks. | AP-06 (if CUST-10 includes payment-step outcomes), `docs/UAT_SAFE_MODE.md`. |
| **AP-08** | Custom cake submission and media policy | Client/Owner + Technical owner | Permission/scope for **CUST-14** submission and **media/upload handling** under Safe Mode. | No unintended external Cloudinary uploads/deletes; no false-success reporting; DB writes/cleanup controlled; synthetic inputs only. | **PENDING** | Written policy for submission and media fields (none/local-only/fixture if supported/approved, or limitation), plus evidence/cleanup criteria. | AP-03/AP-04, AP-10. |
| **AP-09** | Admin workflow testing scope | Client/Owner + Technical owner | Approve which **ADM-01–ADM-13** workflows/actions are in scope and permitted mutation level. | Least privilege; per-workflow authorization; settings/inventory/order-status/product changes require explicit scope and rollback; no unauthorized exposure. | **PENDING** | Written scope matrix (workflows, allowed actions, exclusions), approver/date, and evidence requirements. | AP-02, AP-03, AP-04, AP-10. |
| **AP-10** | Notification and WhatsApp suppression expectations | Client/Owner + Technical owner | Confirm expected handling/evidence for **suppressed** email/OTP/WhatsApp/outbox behavior in UAT Safe Mode. | Suppressed deliveries must not be claimed sent/delivered; no real recipients contacted; live webhooks blocked; monitoring reflects stored/suppressed state. | **PENDING** | Written acceptance of suppression behavior, monitoring evidence criteria, and non-delivery assertions. | `docs/UAT_SAFE_MODE.md`, AP-05/AP-06/AP-08/AP-09 as applicable. |

### Phase 4 — Controlled UAT execution runbooks (approval-gated; do not execute until authorized)

> **Global precondition for all runbooks:** approvals for the specific workflow/scope recorded (AP-* as applicable), isolated local UAT only (`127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`), sanitized evidence, and no prohibited operations. **Approval of one workflow does not authorize others.**

#### 4A. Customer workflows

##### CUST-10 — Guest checkout and order creation
1. **Prerequisites:** BLB-03M decision recorded (AP-01); AP-02–AP-04/AP-06/AP-07/AP-10 as applicable; verified healthy frontend/backend/UAT DB; synthetic guest/cart inputs ready; no real customer data.
2. **Required synthetic data:** purchasable in-stock product(s) in cart; synthetic name/email/phone/address/schedule/payment-choice inputs per approved scenario.
3. **Required secure access:** tester access to local UAT storefront/checkout; no real credentials/contacts; approved verification/payment-safe path if in scope.
4. **Test steps:** add product to cart → proceed to checkout → complete customer details per approved BLB-03M behavior → select fulfilment/address or pickup → select valid schedule → choose approved payment option/path → submit order only if explicitly authorized → observe confirmation/order state; verify suppressed notifications not claimed delivered.
5. **Expected outcomes:** order placed/recorded per approved safe path with correct items/totals/customer/fulfilment/schedule/status; validations enforced; no real payment/OTP/email/WhatsApp side effects.
6. **Database write/read requirements:** **Writes** expected for order creation/persistence (and possible reservation/state) only if authorized; **reads** for verification of stored synthetic order.
7. **External provider restrictions:** no live Razorpay/transactions/webhooks; no real Brevo/OTP/email; no real WhatsApp; no unintended Cloudinary ops.
8. **Rollback/cleanup requirements:** pre-approved cleanup/remediation plan for created synthetic orders/reservations/inventory effects; record before/after state.
9. **Evidence needed to pass:** sanitized step log, expected vs actual, screenshots/UI evidence, order identifier/state evidence (read-only), confirmation of no real provider side effects.
10. **Explicit approval required before execution:** AP-01, AP-03, AP-04, AP-06, AP-07, AP-10 (+ AP-02/AP-05 if verification/account elements apply).

##### CUST-11 — Registration and OTP
1. **Prerequisites:** AP-02–AP-05/AP-10 approved (including secure non-bypass UAT-safe OTP/registration policy or explicit deferral); verified UAT runtime.
2. **Required synthetic data:** synthetic non-real registrant identity/profile inputs.
3. **Required secure access:** tester access to registration flow; approved OTP/verification mechanism (if any) without secret exposure.
4. **Test steps:** initiate registration with synthetic data → perform approved OTP/verification steps per policy (if in scope) → observe account/session outcome; verify no real OTP/email sent and no bypass used.
5. **Expected outcomes:** supported UAT-safe registration/OTP behavior verified per approved policy; invalid/bypass paths not used; correct auth-state handling.
6. **Database write/read requirements:** **Writes** likely for account/registration/OTP-session artifacts (approved only); **reads** to verify stored state as permitted.
7. **External provider restrictions:** no real Brevo/email/OTP delivery to real recipients; no external auth bypass.
8. **Rollback/cleanup requirements:** remove/neutralize approved synthetic accounts/artifacts per AP-04 plan.
9. **Evidence needed to pass:** sanitized flow evidence showing approved safe behavior, no real delivery, and correct outcomes/limitations.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-05, AP-10.

##### CUST-12 — Customer login
1. **Prerequisites:** AP-02 (and AP-04 if provisioning performed) approved; synthetic customer pre-provisioned; credentials delivered securely out-of-band.
2. **Required synthetic data:** pre-provisioned synthetic customer account with known password.
3. **Required secure access:** customer login UI access with approved credentials (no exposure in evidence).
4. **Test steps:** attempt valid login → verify session/profile access behavior → logout; attempt invalid login → verify rejection; confirm no credential leakage.
5. **Expected outcomes:** valid password login succeeds, invalid rejected, session/cookies/logout handled correctly.
6. **Database write/read requirements:** **Read/auth** primary; session persistence may involve controlled runtime state/cookies/tokens; provisioning writes covered by AP-03/AP-04 (separately authorized).
7. **External provider restrictions:** no external OAuth/provider auth; no real notifications.
8. **Rollback/cleanup requirements:** cleanup of provisioned synthetic account/data per AP-04 if required.
9. **Evidence needed to pass:** sanitized evidence of valid/invalid outcomes and session/logout behavior (no secrets).
10. **Explicit approval required before execution:** AP-02, AP-04 (provisioning), AP-03 if provisioning writes in scope.

##### CUST-13 — Customer account and order history
1. **Prerequisites:** CUST-12 access approved; AP-02–AP-04 approved; synthetic orders associated to synthetic customer provisioned.
2. **Required synthetic data:** synthetic customer profile + associated synthetic orders across relevant states (minimum needed).
3. **Required secure access:** authenticated synthetic customer session.
4. **Test steps:** login as approved synthetic customer → open account/profile → open order history/list/details → verify data correctness and authorization boundaries.
5. **Expected outcomes:** profile and order history/details display correct, authorized synthetic data only.
6. **Database write/read requirements:** **Provisioning writes** under AP-03/AP-04; workflow verification **read-only**.
7. **External provider restrictions:** none for viewing; incidental notifications must remain suppressed/not claimed delivered.
8. **Rollback/cleanup requirements:** cleanup of synthetic customer/orders per AP-04 plan.
9. **Evidence needed to pass:** sanitized screenshots/records showing correct authorized data visibility and values.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04.

##### CUST-14 — Custom cake request submission
1. **Prerequisites:** AP-03/AP-04/AP-08/AP-10 approved; verified UAT runtime; safe-mode upload behavior understood.
2. **Required synthetic data:** synthetic request inputs (occasion/size/date/details); media only if explicitly approved safe.
3. **Required secure access:** tester access to custom cake request UI; synthetic/non-real contact inputs only.
4. **Test steps:** open custom cake flow → enter approved synthetic inputs → handle media fields per AP-08 policy → submit only if authorized → verify persistence/acknowledgement and suppression behavior.
5. **Expected outcomes:** request persisted/acknowledged appropriately under approved safe conditions; no external upload side effects and no false success.
6. **Database write/read requirements:** **Writes** for request persistence/state (authorized); **reads** to verify stored synthetic request.
7. **External provider restrictions:** no Cloudinary external upload/delete; notifications suppressed/not claimed delivered per safe mode.
8. **Rollback/cleanup requirements:** cleanup of synthetic request records/artifacts per AP-04.
9. **Evidence needed to pass:** sanitized submission/acknowledgement evidence and stored-record verification with no external side effects.
10. **Explicit approval required before execution:** AP-03, AP-04, AP-08, AP-10.

#### 4B. Admin workflows (ADM-01–ADM-13)

##### ADM-01 — Admin authentication
1. **Prerequisites:** AP-02/AP-09 approved; authorized admin credentials available securely out-of-band.
2. **Required synthetic data:** existing/provisioned admin account in UAT context.
3. **Required secure access:** admin login UI/API access with approved credentials.
4. **Test steps:** attempt valid admin login → verify authorized session/access → logout as applicable; attempt invalid login → verify rejection.
5. **Expected outcomes:** authorized admin session for valid creds; invalid rejected; no secrets exposed.
6. **Database write/read requirements:** read/auth primary (session handling may vary); no credential reset/change.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** n/a beyond session/logout; no credential artifacts retained.
9. **Evidence needed to pass:** sanitized evidence of valid/invalid outcomes and authorized session behavior.
10. **Explicit approval required before execution:** AP-02, AP-09.

##### ADM-02 — Admin authorization and protected routes
1. **Prerequisites:** ADM-01 and CUST-12 contexts available as approved; AP-02–AP-04/AP-09 approved.
2. **Required synthetic data:** admin account and synthetic customer account/session.
3. **Required secure access:** admin and customer sessions/credentials (secure out-of-band), unauthenticated browser context.
4. **Test steps:** access admin routes/APIs as admin, as customer, and unauthenticated; compare UI and API enforcement.
5. **Expected outcomes:** admin-only functions inaccessible to customer/unauthenticated and accessible to authorized admin.
6. **Database write/read requirements:** provisioning writes if needed (approved); checks primarily read/auth.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** cleanup any provisioned synthetic identities per AP-04.
9. **Evidence needed to pass:** sanitized UI/API evidence for each role/context showing correct enforcement.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning), AP-04, AP-09.

##### ADM-03 — Dashboard data and metrics
1. **Prerequisites:** ADM-01 approved; AP-04/AP-09 approved; sufficient dataset or accepted empty-state baseline.
2. **Required synthetic data:** synthetic orders/customers/products/metrics as needed (or documented empty baseline).
3. **Required secure access:** authorized admin session.
4. **Test steps:** open dashboard → inspect widgets/counts/charts/summaries → compare against known synthetic data or validate empty states.
5. **Expected outcomes:** dashboard renders and reflects underlying data correctly or shows valid empty states.
6. **Database write/read requirements:** provisioning writes if needed (approved); dashboard verification read-only.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** cleanup/restore provisioned data if required per AP-04.
9. **Evidence needed to pass:** sanitized screenshots/values mapped to source data or documented empty-state behavior.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning), AP-04, AP-09.

##### ADM-04 — Product creation and editing
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-08(image policy context if applicable)/AP-09 approved.
2. **Required synthetic data:** synthetic product fields/values; media only per approved safe-mode policy.
3. **Required secure access:** authorized admin session with product management access.
4. **Test steps:** create and/or edit product → save → verify persistence in admin and storefront/list/detail views; validate errors/handling; confirm no external image side effects.
5. **Expected outcomes:** valid changes persisted/reflected; validation/errors handled; external image ops safely suppressed (no false success).
6. **Database write/read requirements:** **Writes** for create/edit; **reads** for verification.
7. **External provider restrictions:** no Cloudinary external upload/delete/signature side effects.
8. **Rollback/cleanup requirements:** revert/delete synthetic product changes or restore baseline per AP-04.
9. **Evidence needed to pass:** sanitized before/after admin and storefront evidence, persistence confirmation, no external side effects.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-08 (if media), AP-09.

##### ADM-05 — Product availability
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09 approved; target products available.
2. **Required synthetic data:** existing or synthetic products with availability states to toggle.
3. **Required secure access:** authorized admin session.
4. **Test steps:** toggle/set availability/active states → verify admin persistence → verify storefront/catalogue/detail effects.
5. **Expected outcomes:** availability changes behave correctly and consistently across views.
6. **Database write/read requirements:** **Writes** for state changes; **reads** for verification.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** restore original availability states per AP-04.
9. **Evidence needed to pass:** sanitized admin/storefront before/after evidence showing consistent behavior.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-09.

##### ADM-06 — Inventory adjustments
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09 approved; inventory-managed products/permissions available.
2. **Required synthetic data:** inventory-enabled products with known baseline stock/movements.
3. **Required secure access:** authorized admin session with inventory permissions.
4. **Test steps:** perform approved stock/inventory adjustments → verify updated levels/movements/audit behavior as designed.
5. **Expected outcomes:** inventory updates persisted correctly with consistent counts/movements.
6. **Database write/read requirements:** **Writes** to stock/movement records; **reads** for verification.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** restore baseline stock/movements or document retained synthetic changes per AP-04.
9. **Evidence needed to pass:** sanitized before/after levels and movement evidence.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-09.

##### ADM-07 — Order listing and filtering
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09 approved; synthetic orders provisioned.
2. **Required synthetic data:** synthetic orders across statuses/types/dates sufficient for filters.
3. **Required secure access:** authorized admin session.
4. **Test steps:** open orders list → apply filters/search/sort/pagination → verify returned/displayed results against known data.
5. **Expected outcomes:** correct orders returned/displayed; filters accurate.
6. **Database write/read requirements:** provisioning writes if needed; verification **read-only**.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** cleanup synthetic orders per AP-04 if provisioned.
9. **Evidence needed to pass:** sanitized filter inputs and matching result evidence.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning), AP-04, AP-09.

##### ADM-08 — Order status changes
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09/AP-10 approved; synthetic orders in valid transitional states.
2. **Required synthetic data:** synthetic orders prepared for allowed and invalid transition checks.
3. **Required secure access:** authorized admin session.
4. **Test steps:** perform allowed status transitions → verify state/side effects; attempt invalid transitions → verify blocked; confirm notifications suppressed/not claimed delivered.
5. **Expected outcomes:** allowed transitions succeed with correct state; invalid blocked; suppressed notifications handled safely per UAT mode.
6. **Database write/read requirements:** **Writes** for status/state changes; **reads** for verification.
7. **External provider restrictions:** no real email/WhatsApp delivery; suppressed notifications not marked/claimed delivered.
8. **Rollback/cleanup requirements:** restore order states or cleanup synthetic orders per AP-04.
9. **Evidence needed to pass:** sanitized transition evidence (allowed/invalid), resulting states, and suppression behavior evidence.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-09, AP-10.

##### ADM-09 — Customer management
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09 approved; synthetic customer records available.
2. **Required synthetic data:** synthetic customer records/details.
3. **Required secure access:** authorized admin session.
4. **Test steps:** view/search customer records/details → verify correctness and authorization boundaries.
5. **Expected outcomes:** correct customer data visible to authorized admin; no unauthorized exposure.
6. **Database write/read requirements:** provisioning writes if needed; verification **read-only**.
7. **External provider restrictions:** none.
8. **Rollback/cleanup requirements:** cleanup synthetic customers per AP-04 if provisioned.
9. **Evidence needed to pass:** sanitized evidence of correct authorized visibility and data accuracy.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning), AP-04, AP-09.

##### ADM-10 — Custom cake request management
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-08/AP-09/AP-10 approved as applicable; synthetic requests available.
2. **Required synthetic data:** synthetic custom cake requests in relevant lifecycle states.
3. **Required secure access:** authorized admin session.
4. **Test steps:** view requests → perform approved lifecycle updates/responses/management actions → verify resulting states/details.
5. **Expected outcomes:** request states/details update correctly per workflow with no external side effects claimed.
6. **Database write/read requirements:** provisioning writes if needed; lifecycle actions **write** if in scope; verification **reads**.
7. **External provider restrictions:** notifications/uploads subject to safe-mode suppression/blocks; no external side effects.
8. **Rollback/cleanup requirements:** restore/cleanup synthetic requests per AP-04.
9. **Evidence needed to pass:** sanitized before/after lifecycle/state evidence.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-08 (if media/notifications relevant), AP-09, AP-10.

##### ADM-11 — WhatsApp Centre
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09/AP-10 approved; safe-mode behavior understood.
2. **Required synthetic data:** synthetic WhatsApp conversations/messages/templates/status records as applicable (or accepted empty/suppressed scope).
3. **Required secure access:** authorized admin session.
4. **Test steps:** open WhatsApp Centre → review conversations/templates/status/outbound views → verify suppression/state rendering and absence of real send/webhook side effects.
5. **Expected outcomes:** UI/data renders safely; no real sends/webhook side effects; suppressed/blocked actions not reported as delivered.
6. **Database write/read requirements:** provisioning writes if needed; verification **read-only**.
7. **External provider restrictions:** no Meta WhatsApp outbound sends; no live WhatsApp webhooks.
8. **Rollback/cleanup requirements:** cleanup synthetic WhatsApp-related records per AP-04 if provisioned.
9. **Evidence needed to pass:** sanitized UI/state evidence showing safe, accurate suppression behavior.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning), AP-04, AP-09, AP-10.

##### ADM-12 — Notification and outbox monitoring
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09/AP-10 approved; records/events available or approved safe generation path.
2. **Required synthetic data:** synthetic outbox/notification records or approved safely generated events.
3. **Required secure access:** authorized admin session.
4. **Test steps:** open monitoring views → inspect statuses/retries/errors/idempotency indicators (as available) → compare to stored/suppressed state.
5. **Expected outcomes:** monitoring reflects actual stored state; suppressed deliveries not shown as sent/delivered.
6. **Database write/read requirements:** provisioning/event generation may require **writes** (approved); monitoring verification **read-only**.
7. **External provider restrictions:** no real email/WhatsApp delivery; no live webhooks.
8. **Rollback/cleanup requirements:** cleanup synthetic outbox/notification records per AP-04.
9. **Evidence needed to pass:** sanitized monitoring evidence aligned with stored/suppressed states.
10. **Explicit approval required before execution:** AP-02, AP-03 (if provisioning/generation), AP-04, AP-09, AP-10.

##### ADM-13 — Settings management
1. **Prerequisites:** ADM-01/AP-03/AP-04/AP-09 approved; baseline settings snapshot and rollback plan prepared.
2. **Required synthetic data:** approved test-safe settings values/change set.
3. **Required secure access:** authorized admin session.
4. **Test steps:** capture baseline → apply approved settings changes → verify persistence/effects/validation/authorization → restore or document final approved state.
5. **Expected outcomes:** settings persist and apply correctly; validation/authorization enforced; controlled effects observed.
6. **Database write/read requirements:** **Writes** for settings changes (and restore if performed); **reads** for verification.
7. **External provider restrictions:** indirect only; no external provider calls by action alone.
8. **Rollback/cleanup requirements:** mandatory restore-to-baseline or explicitly approved final state documented per AP-04.
9. **Evidence needed to pass:** sanitized baseline/change/verification (and restore/final-state) evidence.
10. **Explicit approval required before execution:** AP-02, AP-03, AP-04, AP-09.

### Phase 5 — Non-negotiable UAT safeguards and cleanup policy

- **Environment/isolation:** UAT database only `127.0.0.1:27018/bluebell_whatsapp_uat`; `UAT_SAFE_MODE=true`; **never** use production MongoDB, Atlas, or temporary restore instance (`27019`) for app UAT; **never** `27017`.
- **Data/privacy:** no real customer information; synthetic/non-real identities and contacts only.
- **Communications:** no real OTP, email, or WhatsApp delivery; no contact with real recipients.
- **Payments:** no real payment transactions; no live Razorpay operations/webhooks/captures; do not claim suppressed/simulated behavior as real verified payment.
- **Media:** no unintended Cloudinary uploads/deletes; no false-success reporting for blocked external operations.
- **Security:** no authentication, authorization, or OTP bypasses; no weakening of security controls.
- **Secrets/evidence hygiene:** no credentials/tokens/secrets/credential-bearing URIs/PII in source files, repository, screenshots, or chat; sanitize all evidence.
- **Notifications integrity:** never claim a suppressed notification was delivered/sent.
- **DB write control:** every approved database write must have documented scope, owner, purpose, before/after state capture (as applicable), and an approved cleanup/rollback/retention plan. No ad-hoc writes.

### Phase 6 — Approval-gated execution policy

**Until approvals are received (current state):**
- Continue only safe **read-only and pre-submission** testing already permitted by constraints.
- Do **not** create synthetic accounts or test records.
- Do **not** submit orders or custom cake requests.
- Do **not** perform admin mutations.
- Do **not** disable Safe Mode.
- Do **not** trigger external services.

**After approvals are received (future, only when explicitly authorized):**
- Review each approval against the **exact permitted scope** (workflow, data, writes, environment, timeframe).
- Execute only **explicitly authorized** operations per applicable runbook(s); keep unrelated workflows and production services untouched.
- Capture sanitized evidence for each executed step/outcome.
- **Stop immediately** if an operation would exceed approved scope, affect unintended data/systems, or risk prohibited side effects.

> **Approval of one workflow does not authorize all other workflows. Missing approval is not approval. BLB-03P does not grant approvals or authorize execution.**

### Documentation / safety (BLB-03P)

- **Updated:** appended **BLB-03P** to `docs/uat/BLB-03-UAT-RESULTS.md` (prior results preserved). Updated `docs/CLIENT_HANDOVER_STATUS.md` with factual approval-readiness status (BLB-03 milestone/blocker notes reflect BLB-03P artifacts prepared; approvals pending; no execution authorized; no completion claim).
- **Not updated:** `docs/uat/BLB-03-DEFECT-REGISTER.md` (no genuine confirmed defect established).
- **No prohibited operations performed:** no source-code changes; no account/credential creation; no database writes or synthetic data provisioning; no checkout/order/custom cake submissions; no credential inspection/reset/modification; no OTP/email/WhatsApp/provider requests; no payment operations; no Safe Mode disabling; no service restarts or environment changes; no production deployment; no Git stage/commit/push/merge/reset/clean/stash/branch switch. Existing dirty and untracked workspace preserved.

### Updated Stage 3 completion assessment (BLB-03P)

- **Customer UAT and Admin UAT remain INCOMPLETE.** BLB-03P establishes approval-readiness artifacts (pending BLB-03M decision, AP-01–AP-10 register all **PENDING**, workflow runbooks, safeguards/cleanup, and approval-gated policy) but **does not grant approvals or authorize execution**. Genuine business workflow testing for CUST-10–14 and ADM-01–13 remains blocked until required decisions/approvals, secure synthetic access/data, and controlled permissions are obtained and executed with evidence under `UAT_SAFE_MODE`. Safe-executable pre-submission/read-only coverage from prior runs remains evidenced and distinct from blocked workflows; **no 100% completion claimed**.

## BLB-03Q Business approval capture & UAT authorization register (2026-11-19)

- **Objective:** prepare the formal approval capture process for BLB-03M and AP-01–AP-10, making BLB-03P approval register/runbooks practical for client/owner review and response. **Documentation/readiness only.** No approvals invented, assumed, simulated, or granted. Actual approval evidence must come from authorized client/owner/technical/security decision-maker(s).
- **Phase 1 — Existing records verified (read-only):**
  - **Docs reviewed:** `docs/uat/BLB-03-UAT-TEST-PLAN.md`, `docs/uat/BLB-03-UAT-RESULTS.md` (through BLB-03P), `docs/uat/BLB-03-DEFECT-REGISTER.md`, `docs/CLIENT_HANDOVER_STATUS.md`, `docs/UAT_SAFE_MODE.md`.
  - **BLB-03P artifacts confirmed present:** BLB-03M pending decision record, AP-01–AP-10 approval register (all pending), CUST-10–14 and ADM-01–ADM-13 execution runbooks, safeguards/cleanup and approval-gated execution policy preserved in `docs/uat/BLB-03-UAT-RESULTS.md`.
  - **Branch/HEAD (verified, no Git operations performed):** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`.
  - **Actual approval evidence found in reviewed records/user-supplied materials:** **None.** All unconfirmed approvals remain **PENDING**.

### Phase 2 — Client/owner approval request (prepared)

> **Instructions to approver:** please review and respond per approval item using the BLB-03Q response template below. Provide written approval evidence from an authorized decision-maker. You may **approve**, **approve with restrictions**, **reject**, or **defer** each item. Missing evidence means the item remains **PENDING**. Do **not** include credentials, secrets, tokens, OTPs, or sensitive personal information in responses.

#### AP-01 — Guest checkout UX decision (BLB-03M) — **PENDING until written confirmation supplied**

| Field | Details |
|---|---|
| **Decision required** | Select **exactly one** option for guest checkout **Customer details → Continue** behavior: **Option A** — require guest **name, valid email, and phone** before progression to fulfilment, with **field-specific validation errors** at step 1 (Continue). **Option B** — allow progression after **phone validation** (current step-1 behavior), with guest **name/email enforced during final order placement** (client-side final validation) and **backend validation** (authoritative). |
| **Why required** | Current implementation behavior and protections are documented, but repository evidence does not establish intended step-1 UX; BLB-03M is **UNCONFIRMED**. The decision affects expected UX, acceptance criteria, and regression scope for CUST-10/guest checkout validation. |
| **Exact permitted scope requested** | A recorded business/product decision (A or B) applicable to guest checkout Customer details Continue behavior only. No weakening of final/frontend or backend validation/security controls. |
| **Security and operational restrictions** | No bypass of authentication/authorization/validation/security controls. Any implementation change (if A) requires separate controlled implementation/regression task and must not be assumed approved by this decision alone beyond scope stated. |
| **Required approver role** | Client/Owner (product/business decision-maker); technical owner acknowledgment recommended. |
| **Evidence needed to record approval** | Written response stating selected option (A or B), approver name/role, date/time, scope/conditions (if any), and approval reference/channel. |

#### AP-02 — Synthetic customer and admin access

| Field | Details |
|---|---|
| **Decision required** | Permission to provision/use designated **UAT-only synthetic customer and admin identities** and to receive/use credentials **securely out-of-band** for authorized testing. |
| **Why required** | CUST-12/13 and ADM-* authenticated workflows require controlled test identities/credentials; no approved credentials currently available. |
| **Exact permitted scope requested** | Specific synthetic identities/roles, authorized testers, and approved secure out-of-band credential delivery/handling method for isolated UAT only. |
| **Security and operational restrictions** | Synthetic/non-real identities only; least privilege; credentials never in chat/repo/screenshots/logs/evidence; no credential reset/change/inspection beyond approved scope; no production access. |
| **Required approver role** | Client/Owner + Security/Technical owner. |
| **Evidence needed to record approval** | Written approval of identities/roles/access scope, tester list/roles, secure delivery method (without exposing secrets), and any conditions/expiry. |

#### AP-03 — Isolated UAT database write permissions

| Field | Details |
|---|---|
| **Decision required** | Permission for specific, controlled **database writes** on `127.0.0.1:27018/bluebell_whatsapp_uat` only for approved UAT activities. |
| **Why required** | Blocked workflows (order creation/submission, provisioning, status/inventory/settings/product/request changes, cleanup) require DB writes; current policy prohibits writes without explicit approval. |
| **Exact permitted scope requested** | Explicit collections/records/actions, purpose, owner, and time window for each approved write activity. |
| **Security and operational restrictions** | Isolated UAT DB only; no `27017`, no `27019` app use, no Atlas/production; no ad-hoc writes; `UAT_SAFE_MODE=true`; rollback/cleanup required per AP-04; documented before/after state as applicable. |
| **Required approver role** | Client/Owner + Technical/DB owner. |
| **Evidence needed to record approval** | Written approval specifying allowed operations/scope/window/owner and rollback/cleanup plan reference. |

#### AP-04 — Synthetic data provisioning and cleanup

| Field | Details |
|---|---|
| **Decision required** | Permission to **provision** required synthetic data/accounts/orders/requests and perform approved **cleanup/restore** actions. |
| **Why required** | CUST-10–14/ADM-* require minimum synthetic datasets/records and controlled post-test cleanup/retention. |
| **Exact permitted scope requested** | Provisioning manifest (what records, for which workflows) and cleanup/rollback/retention plan. |
| **Security and operational restrictions** | Minimum necessary synthetic/non-real data only; no real customer/production data; documented before/after state; cleanup/restore only as approved. |
| **Required approver role** | Client/Owner + Technical/DB owner. |
| **Evidence needed to record approval** | Written manifest + cleanup/rollback/retention plan, approver/date, and acceptance of post-execution cleanup evidence. |

#### AP-05 — Registration and OTP testing policy

| Field | Details |
|---|---|
| **Decision required** | Approved policy for **CUST-11 registration/OTP** (and any OTP-dependent guest verification if in scope): an approved secure **non-bypass** UAT-safe mechanism, or formal deferral/out-of-scope. |
| **Why required** | UAT Safe Mode suppresses external Brevo/OTP delivery and OTP plaintext is non-recoverable; registration/OTP cannot be validated via real delivery and must not bypass security. |
| **Exact permitted scope requested** | Specific in-scope flows, permitted verification mechanism (if any), and accepted limitations/deferral boundaries. |
| **Security and operational restrictions** | No real OTP/email/WhatsApp to real recipients; no auth/OTP bypass or hardcoded OTP; no secret/token exposure; compliant with `UAT_SAFE_MODE`. |
| **Required approver role** | Client/Owner + Security/Technical owner. |
| **Evidence needed to record approval** | Written policy/decision, mechanism details (if approved), scope/limitations, evidence criteria, or explicit deferral approval. |

#### AP-06 — Guest checkout order submission

| Field | Details |
|---|---|
| **Decision required** | Permission to execute **CUST-10** guest checkout **order submission/order-creation** steps in isolated UAT under approved safe conditions. |
| **Why required** | End-to-end guest checkout completion requires submission/DB writes and safe handling of verification/payment/notification constraints. |
| **Exact permitted scope requested** | Specific submission scenarios, synthetic inputs/data, permitted payment-safe path, and verification/notification handling expectations. |
| **Security and operational restrictions** | No real customer details; no real payment transactions/provider side effects; controlled DB writes/cleanup per AP-03/AP-04; `UAT_SAFE_MODE=true`; suppressed notifications not claimed delivered. |
| **Required approver role** | Client/Owner + Technical owner. |
| **Evidence needed to record approval** | Written approval of scenarios, data, payment-safe handling, verification path, and evidence requirements. |

#### AP-07 — Payment testing restrictions

| Field | Details |
|---|---|
| **Decision required** | Confirm permitted **payment-safe** verification scope (no live Razorpay ops/webhooks/captures, no real transactions, no claims of real verified payment). |
| **Why required** | Payment-related UAT must remain safe/non-transactional under UAT Safe Mode and avoid false payment/delivery claims. |
| **Exact permitted scope requested** | Allowed payment-step observations/UI/state checks and explicitly excluded live operations. |
| **Security and operational restrictions** | `UAT_SAFE_MODE=true` enforced; no external payment provider contact; no real captures/transactions; evidence must state non-live/suppressed context where applicable. |
| **Required approver role** | Client/Owner + Technical/Security owner. |
| **Evidence needed to record approval** | Written restriction/permission statement and accepted evidence boundaries. |

#### AP-08 — Custom cake submission and media policy

| Field | Details |
|---|---|
| **Decision required** | Permission/scope for **CUST-14** custom cake submission and **media/upload handling** under Safe Mode. |
| **Why required** | Submission implies DB writes and potential media handling; Cloudinary external ops are blocked in Safe Mode and must not produce false success. |
| **Exact permitted scope requested** | Submission scenarios and media-field policy (none, or separately supported/approved safe local/fixture approach, or explicit limitation). |
| **Security and operational restrictions** | No unintended external Cloudinary uploads/deletes; no false-success reporting; synthetic inputs only; controlled writes/cleanup per AP-03/AP-04. |
| **Required approver role** | Client/Owner + Technical owner. |
| **Evidence needed to record approval** | Written submission/media policy, scope, limitations, and evidence/cleanup criteria. |

#### AP-09 — Admin workflow testing scope

| Field | Details |
|---|---|
| **Decision required** | Approve which **ADM-01–ADM-13** workflows/actions are in scope and permitted mutation level. |
| **Why required** | Admin UAT requires secure access and may involve sensitive mutations (products/inventory/orders/settings/requests); scope must be explicitly authorized per workflow. |
| **Exact permitted scope requested** | Workflow-by-workflow included actions, excluded actions, and mutation/read-only boundaries. |
| **Security and operational restrictions** | Least privilege; authorized admin access only; settings/inventory/order-status/product/request changes require explicit scope and rollback; no unauthorized data exposure. |
| **Required approver role** | Client/Owner + Technical owner. |
| **Evidence needed to record approval** | Written scope matrix (workflows/actions/exclusions), approver/date, and evidence requirements. |

#### AP-10 — Notification and WhatsApp suppression expectations

| Field | Details |
|---|---|
| **Decision required** | Confirm expected handling/evidence for **suppressed** email/OTP/WhatsApp/outbox behavior in UAT Safe Mode. |
| **Why required** | Safe Mode suppresses external deliveries; UAT evidence must not claim suppressed notifications as sent/delivered and must align on acceptable monitoring/state assertions. |
| **Exact permitted scope requested** | Accepted suppression behaviors, monitoring/outbox evidence expectations, and non-delivery assertions for relevant workflows. |
| **Security and operational restrictions** | No real recipients contacted; no live webhooks; suppressed deliveries not marked/claimed delivered; monitoring reflects stored/suppressed state only. |
| **Required approver role** | Client/Owner + Technical owner. |
| **Evidence needed to record approval** | Written acceptance of suppression behavior, monitoring evidence criteria, and non-delivery assertions. |

### Phase 3 — Reusable client/owner approval response template

Copy and complete one block per approval item (AP-01–AP-10). You may respond **APPROVED**, **APPROVED WITH RESTRICTIONS**, **REJECTED**, or **DEFERRED**. Do not include credentials, secrets, tokens, OTPs, or sensitive personal information.

```text
Approval ID: [AP-01 .. AP-10]
Approver name or authorized role: [ ]
Decision: [PENDING / APPROVED / APPROVED WITH RESTRICTIONS / REJECTED / DEFERRED]
Approved scope (specific actions/workflows/data/environments permitted): [ ]
Exclusions and restrictions (what is NOT permitted): [ ]
Conditions or limitations (safeguards, cleanup, time window, evidence requirements): [ ]
Date and time: [YYYY-MM-DD HH:MM TZ]
Written approval reference (email/ticket/document/message ID/location): [ ]
Notes: [ ]
```

**BLB-03M (AP-01) addendum (if responding to AP-01):**
```text
Selected option: [A / B / NOT SELECTED]
Rationale/conditions (optional): [ ]
```

### Phase 4 — Evidence-backed approval register (BLB-03M and AP-01–AP-10)

> **Status rules:** only `PENDING`, `APPROVED`, `APPROVED WITH RESTRICTIONS`, `REJECTED`, `DEFERRED`. Status may change **only** when actual written approval evidence is supplied by the user or present in an authorized project record. Missing evidence = **PENDING**. OpenCode recommendations, technical assumptions, existing implementation, or prior assistant messages are **not** approval.

#### BLB-03M decision status

| Item | Status | Selected option | Written evidence/reference | Notes |
|---|---|---|---|---|
| BLB-03M Guest checkout Customer details Continue (AP-01) | **PENDING CLIENT/OWNER DECISION** | _(none)_ | **None found** | Options A/B prepared; no selection recorded without written confirmation. |

#### AP-01–AP-10 register

| Approval ID | Approval required | Status | Approved scope / restrictions / conditions | Written evidence/reference | Blockers if not approved |
|---|---|---|---|---|---|
| AP-01 | Guest checkout UX decision (BLB-03M) | **PENDING** | — | **None found** | CUST-10 expected UX/regression criteria unconfirmed; step-1 name/email requirement unresolved. |
| AP-02 | Synthetic customer and admin access | **PENDING** | — | **None found** | Authenticated customer/admin workflows cannot proceed without approved identities/secure credentials. |
| AP-03 | Isolated UAT database write permissions | **PENDING** | — | **None found** | No provisioning/submission/mutation/cleanup writes authorized. |
| AP-04 | Synthetic data provisioning and cleanup | **PENDING** | — | **None found** | Required synthetic datasets/cleanup cannot be created/executed. |
| AP-05 | Registration and OTP testing policy | **PENDING** | — | **None found** | CUST-11 (and OTP-dependent paths) blocked without approved non-bypass UAT-safe policy or deferral. |
| AP-06 | Guest checkout order submission | **PENDING** | — | **None found** | CUST-10 end-to-end submission/order creation not authorized. |
| AP-07 | Payment testing restrictions | **PENDING** | — | **None found** | Payment-related scope/evidence boundaries for CUST-10 not authorized/confirmed. |
| AP-08 | Custom cake submission and media policy | **PENDING** | — | **None found** | CUST-14 submission/media handling not authorized. |
| AP-09 | Admin workflow testing scope | **PENDING** | — | **None found** | ADM-01–ADM-13 scope/mutations not authorized. |
| AP-10 | Notification and WhatsApp suppression expectations | **PENDING** | — | **None found** | Suppression/monitoring evidence expectations not formally accepted for notification-related workflows. |

### Phase 5 — Workflow authorization mapping (scope-specific)

> An approval authorizes **only** its specified actions/scope. If a workflow requires multiple approvals, it remains **BLOCKED** until **all applicable approvals** are confirmed by evidence. **No workflow is authorized by this document.**

| Workflow | Required approvals (all applicable must be confirmed) | Authorization status | Notes |
|---|---|---|---|
| **CUST-10** Guest checkout and order creation | AP-01, AP-03, AP-04, AP-06, AP-07, AP-10 (+ AP-02/AP-05 if verification/account elements apply per approved scope) | **BLOCKED** (all required approvals pending) | Pre-submission navigation/validation evidenced previously; submission/order creation not authorized. |
| **CUST-11** Registration and OTP | AP-02, AP-03, AP-04, AP-05, AP-10 | **BLOCKED** (all pending) | UAT-safe non-bypass policy/mechanism or formal deferral required. |
| **CUST-12** Customer login | AP-02, AP-04, AP-03 (if provisioning writes in scope) | **BLOCKED** (all pending) | Secure out-of-band synthetic credentials and provisioning approval required. |
| **CUST-13** Customer account and order history | AP-02, AP-03, AP-04 | **BLOCKED** (all pending) | Requires authenticated synthetic customer + associated synthetic orders. |
| **CUST-14** Custom cake request submission | AP-03, AP-04, AP-08, AP-10 | **BLOCKED** (all pending) | Submission/writes and media policy required; UI reachability previously observed only. |
| **ADM-01** Admin authentication | AP-02, AP-09 | **BLOCKED** (all pending) | Secure authorized admin credentials/access required. |
| **ADM-02** Authorization and protected routes | AP-02, AP-03 (if provisioning), AP-04, AP-09 | **BLOCKED** (all pending) | Requires admin + customer sessions/accounts. |
| **ADM-03** Dashboard data and metrics | AP-02, AP-03 (if provisioning), AP-04, AP-09 | **BLOCKED** (all pending) | Dataset/empty-state verification scope required. |
| **ADM-04** Product creation and editing | AP-02, AP-03, AP-04, AP-08 (if media), AP-09 | **BLOCKED** (all pending) | DB writes and safe-mode media handling required. |
| **ADM-05** Product availability | AP-02, AP-03, AP-04, AP-09 | **BLOCKED** (all pending) | State-change writes and rollback required. |
| **ADM-06** Inventory adjustments | AP-02, AP-03, AP-04, AP-09 | **BLOCKED** (all pending) | Inventory-affecting writes and rollback required. |
| **ADM-07** Order listing and filtering | AP-02, AP-03 (if provisioning), AP-04, AP-09 | **BLOCKED** (all pending) | Synthetic orders/read verification scope required. |
| **ADM-08** Order status changes | AP-02, AP-03, AP-04, AP-09, AP-10 | **BLOCKED** (all pending) | State transitions + suppression expectations required. |
| **ADM-09** Customer management | AP-02, AP-03 (if provisioning), AP-04, AP-09 | **BLOCKED** (all pending) | Authorized visibility and synthetic records required. |
| **ADM-10** Custom cake request management | AP-02, AP-03, AP-04, AP-08 (if relevant), AP-09, AP-10 | **BLOCKED** (all pending) | Lifecycle updates/writes and safe handling required. |
| **ADM-11** WhatsApp Centre | AP-02, AP-03 (if provisioning), AP-04, AP-09, AP-10 | **BLOCKED** (all pending) | Safe-mode suppression/data scope required. |
| **ADM-12** Notification and outbox monitoring | AP-02, AP-03 (if provisioning/generation), AP-04, AP-09, AP-10 | **BLOCKED** (all pending) | Suppression/state evidence expectations required. |
| **ADM-13** Settings management | AP-02, AP-03, AP-04, AP-09 | **BLOCKED** (all pending) | Controlled settings writes with rollback/restore required. |

### Phase 6 — Actual approval evidence found, missing approvals, and blockers

- **Actual approval evidence found:** **None** (no user-supplied written approvals and no authorized approval records identified in reviewed project docs at this time).
- **Missing approvals (all PENDING):** BLB-03M/AP-01 decision, AP-02, AP-03, AP-04, AP-05, AP-06, AP-07, AP-08, AP-09, AP-10.
- **Resulting blockers:** all CUST-10–14 and ADM-01–ADM-13 workflows remain **BLOCKED** (multi-approval dependencies unresolved). Existing BLB-03P runbooks/safeguards remain the governing execution plan **only after** specific, evidence-backed approvals are recorded.

### Documentation / safety (BLB-03Q)

- **Updated:** appended **BLB-03Q** to `docs/uat/BLB-03-UAT-RESULTS.md` (client/owner approval request, response template, evidence-backed BLB-03M/AP-01–AP-10 register, workflow authorization mapping; prior results and BLB-03P runbooks preserved).
- **`docs/CLIENT_HANDOVER_STATUS.md`:** **not updated** (no actual approval evidence supplied; no factual status change supported by evidence beyond existing BLB-03P readiness notes).
- **`docs/uat/BLB-03-DEFECT-REGISTER.md`:** **not modified** (no genuine defect established).
- **No prohibited operations performed:** no source-code changes; no account/credential creation; no database writes or synthetic data provisioning; no checkout/order/custom cake submissions; no credential inspection/reset/modification; no OTP/email/WhatsApp/provider requests; no Razorpay/payment operations; no Safe Mode disabling; no service restarts or environment changes; no production deployment; no Git stage/commit/push/merge/reset/clean/stash/branch switch. Existing dirty and untracked workspace preserved.
