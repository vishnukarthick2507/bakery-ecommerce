# BLB-03 — Test Data Plan (Preparation)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Status:** PREPARATION ONLY — **no seeds/imports/database writes executed**

## 1. Evidence basis (read-only)
- **Dedicated UAT DB config:** `C:\MongoDB\BluebellWhatsAppUAT\mongod-uat.cfg` → `127.0.0.1:27018`, dbPath `C:\MongoDB\BluebellWhatsAppUAT\data`, auth enabled (local-only). Original/temporary restore on 27019 must not be used for application UAT.
- **Restored dataset (BLB-02G reported):** DB `bluebell_whatsapp_uat`, 17 visible collections: `admins`, `customcakerequests`, `customermetrics`, `customerotpproofs`, `inventorymovements`, `notificationoutboxes`, `orders`, `otpsendcooldowns`, `otpsessions`, `pendingregistrations`, `products`, `settings`, `users`, `whatsappconsents`, `whatsappmessages`, `whatsappnotificationpreferences`, `whatsappwebhookevents`.
- **Observed counts (prior, unverified in this phase):** `products=5`, `settings=1`, `orders=0`, `users=0`, several others `0`; `admins` and `customcakerequests` counts **unverified**.
- **Model/seed inspection (static):** `backend/src/models/*` (Product/Order/User/Admin/Settings/CustomCakeRequest and related), `backend/src/seedProducts.ts` (5 products; destructive replace-by-slug behavior for matching slugs), `backend/src/seedAdmin.ts` (strict local-UAT target + explicit confirmation + strong password policy; aborts if admins exist). **No seed/admin scripts executed.**

## 2. Dataset suitability assessment (current)
| Area | Assessment | Notes |
|---|---|---|
| Products | **Possibly usable, requires inspection** | 5 docs reported; inspect active/availability/stock/price/images/category/slug against UI and checkout logic before UAT. |
| Settings | **Likely present, requires inspection** | 1 doc reported; verify online/delivery/pickup flags, closed message, reopen/cod limits for intended scenarios. |
| Admins | **Unknown (unverified)** | Admin count not verified; UAT requires at least one known synthetic admin credential path (password auth). Admin seed is guarded and aborts if admins exist. |
| Users/customers | **Insufficient** | 0 users reported; UAT needs pre-provisioned synthetic customer accounts for password-login flows due to OTP delivery suppression in UAT safe mode. |
| Orders | **Insufficient for history/status scenarios** | 0 reported; create synthetic orders in approved states only if needed for admin/customer journey coverage. |
| Custom cake requests | **Unknown/likely insufficient** | Count unverified; admin/customer custom-cake workflows may require synthetic records. |
| Inventory movements / metrics / WhatsApp/notification records | **Unverified/likely sparse** | Inspect only; create minimal records only if required and approved. |

**Conclusion:** Dataset is **not assumed sufficient for UAT**. Approved read-only inspection and approved synthetic data preparation are required.

## 3. Synthetic data principles (mandatory)
- **No real customer data.** Use clearly synthetic names/emails/phones/addresses (e.g. `uat.customer.*@example.test`, reserved/test phone patterns as permitted by validation).
- **No secrets in docs/reports.** Do not generate or record plaintext passwords, OTPs, tokens, API keys, or credential-bearing URIs. Credential provisioning must be handled via approved secure operator process.
- **No DB writes in this phase.** All items below are proposals pending explicit approval.
- **UAT-safe only:** no real provider calls, payments, emails, WhatsApp sends, external uploads, or production webhooks.
- **Minimal necessary data:** create only records needed to execute approved READY test cases.

## 4. Proposed synthetic dataset (pending approval)

### 4.1 Administrator (required)
- **Quantity:** 1 synthetic administrator (or use existing verified synthetic admin if already present and securely accessible).
- **Auth path:** username/password admin login (supported). 
- **Requirements:** active admin record, known credentials supplied securely out-of-band (not in repo/docs), role/permissions sufficient for dashboard/orders/products/inventory/customers/custom-cake/WhatsApp/notifications/settings views.
- **Notes:** `backend/src/seedAdmin.ts` enforces local UAT target, explicit confirmation, and strong password; aborts if any admin exists. If admin exists, do **not** reseed; verify access through approved secure means.

### 4.2 Customer accounts (required)
- **Quantity:** at least 2 synthetic customers.
- **Auth paths (supported in UAT-safe context):** password login for pre-provisioned accounts (`POST /api/auth/login` path) and authenticated session/profile/account flows. 
- **OTP-dependent paths (registration/forgot-password/reset/OTP-login/guest checkout OTP):** **constrained** in UAT safe mode (external email delivery suppressed; OTP plaintext not exposed/recoverable by design). Pre-provision customers with known passwords via approved secure data-prep method; validate non-delivery/blocked behavior separately.
- **Profile data (synthetic):** name, email, valid-format phone, address details as needed for delivery scenarios; no real PII.
- **State coverage idea:** one standard active customer with order history (after approved order creation), one customer for clean checkout/profile scenarios.

### 4.3 Products and inventory (inspect first, augment only if needed)
- **Existing:** inspect 5 reported products for correctness (name/slug/price/category/images/stock/availability/active flags, preparation details as applicable).
- **Adjustments (if approved):** set synthetic inventory/stock/availability to enable in-stock, low-stock, and out-of-stock/disallowed purchase cases without affecting external systems.
- **Additional products:** create only if required to cover catalog/variant/pricing/availability gaps; keep minimal and synthetic.

### 4.4 Orders (approved synthetic states)
Create only as needed for UAT coverage; ensure totals/status/payment/inventory timestamps/fulfillment data are consistent with models and business rules.
- **Coverage targets:** PLACED/PENDING payment (as applicable), CONFIRMED/PAID-equivalent local state where representable without real provider capture, PREPARING/READY/OUT_FOR_DELIVERY/DELIVERED/COLLECTED/CANCELLED and reschedule-related states as supported.
- **Fulfillment:** at least one DELIVERY and one PICKUP scenario (if supported).
- **Payment safety:** represent local payment states for workflow testing only; **no live Razorpay orders/captures/webhooks**. Any "paid" simulation must be clearly synthetic and consistent with UAT-safe constraints.
- **Linkage:** associate selected orders to synthetic customers for account/order-history tests.

### 4.5 Custom cake requests
- **Quantity:** minimal set (e.g. 1 pending/new, 1 in-progress/contacted/quoted as supported, 1 completed/closed) to validate admin/customer views and transitions.
- **Data:** synthetic contact/details only; no real uploads to external providers in UAT safe mode (upload suppression must be respected).

### 4.6 Notification/outbox and WhatsApp-related records (only if required)
- Inspect existing `notificationoutboxes`, `whatsappmessages`, `whatsappconsents`, `whatsappnotificationpreferences`, `whatsappwebhookevents` for safe monitoring UI/workflow checks.
- If approved, seed minimal synthetic records only to validate admin visibility/status rendering and UAT-safe suppression/retry/idempotency behavior **without any external delivery**.

### 4.7 Settings
- Inspect and, if approved, adjust singleton settings for controlled scenarios (online ordering enabled/disabled, delivery/pickup toggles, COD limits/messages, reopen timing) with rollback awareness.

## 5. Data preparation execution prerequisites (approval-gated)
- BLB-02G read verification outcome accepted (expected collections/content suitability known).
- Explicit approval for: starting dedicated UAT MongoDB on `127.0.0.1:27018` (if needed for data prep), connection/auth method, exact write/seed/import commands or scripts, target DB `bluebell_whatsapp_uat`, and rollback/cleanup approach.
- `UAT_SAFE_MODE=true` and verified UAT DB target for any application-assisted prep; no external providers contacted.
- Synthetic credentials handled securely out-of-band.
- Evidence captured for every write action (what/when/target/result) if approved.

## 6. Open items / blockers
- `admins` and `customcakerequests` document counts/content **unverified**. *(Updated by BLB-03B read-only inspection: see addendum below.)*
- Existing 5 products/settings **not yet inspected for workflow suitability**. *(Updated by BLB-03B: counts/aggregate indicators verified; field-level suitability still requires approved workflow inspection.)*
- No approved synthetic credentials/accounts/orders prepared.
- OTP-dependent customer flows cannot be fully exercised with real delivery in UAT safe mode (see test plan limitations).

## 7. BLB-03B Read-only dataset inspection (verified 2026-11-19, no DB writes)
- **Runtime verified (read-only):** UAT MongoDB PID **23580** active with connections on `127.0.0.1:27018`; backend `GET /health` = `200 {"status":"ok","service":"bakery-api","database":"connected"}` (UAT safe mode active per prior Gate 2 evidence); frontend `GET /` = `200`; frontend `GET /api/products` proxy = `200` reaching local UAT backend. Backend connection target verified exclusive to `mongodb://127.0.0.1:27018/bluebell_whatsapp_uat` (sanitized). No services restarted.
- **Method:** Read-only inspection via existing authenticated backend configuration/credentials (in-process, `UAT_SAFE_MODE=true`, no secret exposure), `ping` OK, `connectedDb=bluebell_whatsapp_uat`. Counts obtained via read-only document counts; no WiredTiger/catalog inference. No inserts/updates/deletes/seeds/migrations/imports.
- **Verified collection inventory/counts (sanitized):**
  | Collection | Exists | Count | Verified notes (aggregate, no PII) | Suitability (evidence-based) |
  |---|---|---:|---|---|
  | `admins` | Yes | 1 | active/unspecified indicator count = 1 | **Possibly usable** (record exists); **credential/access not verified** |
  | `users` | Yes | 0 | synthetic-email-pattern count = 0; password-field-present count = 0 | **Insufficient** for password-login customer UAT |
  | `products` | Yes | 5 | active/unspecified = 5; stock>0 indicator = 5; priced>0 indicator = 5 | **Possibly usable** pending workflow inspection (availability/images/category/checkout behavior/settings compatibility) |
  | `orders` | Yes | 0 | linked-to-user indicator = 0 | **Insufficient** for history/status/admin-listing scenarios |
  | `customcakerequests` | Yes | 0 | — | **Insufficient** for custom-cake view/management scenarios |
  | `settings` | Yes | 1 | singleton present | **Possibly usable** pending review of ordering/delivery/pickup/COD flags |
  | `inventorymovements` | Yes | 0 | — | **Empty baseline** (acceptable; records needed only for adjustment/history evidence) |
  | `notificationoutboxes` | Yes | 0 | — | **Empty** (monitoring/idempotency cases may require safe records/events) |
  | `whatsappconsents` | Yes | 0 | — | **Empty** (safe consent testing may require synthetic records) |
  | `whatsappmessages` | Yes | 0 | — | **Empty** (acceptable baseline) |
  | `whatsappnotificationpreferences` | Yes | 0 | — | **Empty** (safe preference testing may require synthetic records) |
  | `whatsappwebhookevents` | Yes | 0 | — | **Empty** (acceptable baseline) |
  | `customerotpproofs` | Yes | 0 | — | **Empty** (expected given OTP constraints) |
  | `otpsessions` | Yes | 0 | — | **Empty** (expected given OTP constraints) |
  | `pendingregistrations` | Yes | 0 | — | **Empty** (expected given OTP constraints) |
  | `otpsendcooldowns` | Yes | 0 | — | **Empty** (expected given OTP constraints) |
  | `customermetrics` | Yes | 0 | — | **Empty** (dashboard may show empty states) |
- **Other collections present:** none observed beyond requested list.
- **Readiness facts (verified):** admin record exists (1) but secure credential access unverified; no customer accounts; 5 products present with positive stock/price indicators (aggregate) but workflow suitability unverified; 1 settings document present but flags unverified; no orders/custom cake requests; WhatsApp consent/preferences/outbox/messages/webhooks all empty. **No PII, hashes, tokens, or secrets inspected/exposed.**