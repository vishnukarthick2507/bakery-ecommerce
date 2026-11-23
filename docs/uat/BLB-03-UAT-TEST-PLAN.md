# BLB-03 — UAT Test Plan (Preparation)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Phase:** A–F preparation complete (read-only preflight + planning/docs). **No runtime UAT executed.**

> **Safety:** Local isolated UAT only after explicit approval. Use dedicated MongoDB `127.0.0.1:27018` / `bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true`. **Never** use port 27017/service/data, temp restore port 27019 for app UAT, Atlas/production DBs, real payments, real emails/OTPs/WhatsApp, external uploads, or production webhooks. No credentials/secrets exposed.

## 1. Test classification legend
- **READY:** Preconditions and safe execution path are expected to be satisfiable after approved startup/data prep (subject to runtime confirmation).
- **BLOCKED:** Cannot execute until specific dependency/approval/data fix is resolved.
- **NOT TESTED:** No execution evidence yet (default for all cases in this preparation phase).
- **REQUIRES SYNTHETIC DATA:** Approved synthetic dataset/accounts/records required before meaningful execution.

*Execution rule:* A case may be marked **PASS** only with runtime evidence (steps, expected/actual, sanitized artifacts). Static inspection alone is insufficient.

## 2. Phase C — Customer journey test cases

| Test ID | Business workflow | Classification | Preconditions | Steps (high level) | Expected result | Actual result | PASS/FAIL/BLOCKED/NOT TESTED | Evidence | Defect ref | Retest |
|---|---|---|---|---|---|---|---|---|---|---|
| CUST-01 | Storefront homepage | REQUIRES SYNTHETIC DATA | Approved UAT stack running; frontend routed to local backend; safe dataset/settings allow browsing | Open homepage; verify layout/navigation/hero/CTAs/content render without errors | Homepage loads correctly; no server/client errors; links work | — | NOT TESTED | — | — | — |
| CUST-02 | Product catalogue | REQUIRES SYNTHETIC DATA | Products inspected/available (5 reported; suitability unverified) | Open catalogue; browse categories/listing; verify product cards/pricing/images/placeholders | Catalogue displays available products accurately; empty/error states handled | — | NOT TESTED | — | — | — |
| CUST-03 | Product detail pages | REQUIRES SYNTHETIC DATA | At least one active/available product | Open product details; verify name/description/price/media/options/availability | Detail page shows correct data and actions for availability state | — | NOT TESTED | — | — | — |
| CUST-04 | Product availability | REQUIRES SYNTHETIC DATA | Products with available/unavailable/out-of-stock states prepared as needed | View catalogue/detail for in-stock and unavailable items; attempt add/purchase where disallowed | Availability reflected correctly; disallowed actions prevented with clear feedback | — | NOT TESTED | — | — | — |
| CUST-05 | Cart add/update/remove | REQUIRES SYNTHETIC DATA | Purchasable product(s) | Add items; change quantities; remove items | Cart updates correctly; line items/totals consistent; no duplicate/corrupt state | — | NOT TESTED | — | — | — |
| CUST-06 | Cart persistence after refresh | REQUIRES SYNTHETIC DATA | Items in cart; persistence mechanism active | Refresh/navigate away and back; reopen browser tab/session as applicable | Cart state persists according to design; no unintended loss/corruption | — | NOT TESTED | — | — | — |
| CUST-07 | Price, quantity and total calculations | REQUIRES SYNTHETIC DATA | Known product prices/fees/settings | Add/update quantities; review subtotal/delivery/discounts/total (as applicable) | Calculations accurate and consistent across cart/checkout/order summary | — | NOT TESTED | — | — | — |
| CUST-08 | Delivery address validation | REQUIRES SYNTHETIC DATA | Delivery flow enabled in settings; synthetic address inputs | Enter valid/invalid/incomplete addresses | Valid addresses accepted; invalid inputs rejected with clear validation | — | NOT TESTED | — | — | — |
| CUST-09 | Delivery date and time-slot validation | REQUIRES SYNTHETIC DATA | Scheduling rules/slots configured | Select valid/invalid/past/unavailable slots | Allowed slots accepted; invalid/unavailable selections blocked correctly | — | NOT TESTED | — | — | — |
| CUST-10 | Guest checkout | BLOCKED | Guest checkout supported; OTP/contact verification path; safe payment/order flow; synthetic data | Complete guest checkout flow including required verification | Order can be placed/recorded per supported safe path without real provider side effects | — | NOT TESTED | — | — | — |
| CUST-11 | Customer registration and OTP | BLOCKED | UAT-safe OTP strategy/support; email provider suppressed in safe mode | Attempt registration and OTP verification | Supported UAT-safe behavior verified; no real OTP/email sent; no auth bypass/hardcoded OTP | — | NOT TESTED | — | — | — |
| CUST-12 | Customer login | REQUIRES SYNTHETIC DATA | Pre-provisioned synthetic customer with known password (secure out-of-band) | Login with valid/invalid credentials; verify session/logout behavior | Valid password login succeeds; invalid rejected; session/cookies handled correctly | — | NOT TESTED | — | — | — |
| CUST-13 | Customer account and order history | REQUIRES SYNTHETIC DATA | Authenticated synthetic customer with associated synthetic orders | Open account/profile and order history/details | Profile and order history display correct authorized data only | — | NOT TESTED | — | — | — |
| CUST-14 | Custom cake request submission | BLOCKED | Submission flow available; upload handling in UAT safe mode understood; synthetic inputs | Submit custom cake request (with/without optional fields/media as supported safely) | Request persisted/acknowledged appropriately; external uploads blocked/suppressed safely (no false success) | — | NOT TESTED | — | — | — |

**OTP limitation notes (CUST):** `UAT_SAFE_MODE` blocks external email delivery; OTP plaintext is not exposed/recoverable. Password login for pre-provisioned accounts is the primary supported customer auth path for UAT. Registration, forgot/reset password, OTP login, and guest-checkout OTP verification are **blocked/limited** unless a separately approved, non-bypass UAT mechanism is established.

## 3. Phase D — Admin journey test cases

| Test ID | Business workflow | Classification | Preconditions | Steps (high level) | Expected result | Actual result | PASS/FAIL/BLOCKED/NOT TESTED | Evidence | Defect ref | Retest |
|---|---|---|---|---|---|---|---|---|---|---|
| ADM-01 | Admin authentication | BLOCKED | Admin account present and securely accessible; admin login flow available | Login with valid/invalid admin credentials | Authorized admin session established for valid creds; invalid rejected; no secrets exposed | — | NOT TESTED | — | — | — |
| ADM-02 | Admin authorization and protected routes | REQUIRES SYNTHETIC DATA | Admin and ordinary customer sessions/accounts | Access admin routes/APIs as admin, customer, and unauthenticated user | Admin-only functions inaccessible to customers/unauthenticated users (UI and API enforced) | — | NOT TESTED | — | — | — |
| ADM-03 | Dashboard data and metrics | REQUIRES SYNTHETIC DATA | Dataset/orders/metrics sufficient for display (may require synthetic data) | Open dashboard; verify widgets/counts/charts/summaries | Dashboard renders and reflects underlying data correctly or shows valid empty states | — | NOT TESTED | — | — | — |
| ADM-04 | Product creation and editing | REQUIRES SYNTHETIC DATA | Admin session; product management UI/API; image upload constraints known | Create/edit product fields; save; verify persistence/list/detail | Valid changes persisted and reflected; validation/errors handled; external image ops safely suppressed in UAT | — | NOT TESTED | — | — | — |
| ADM-05 | Product availability | REQUIRES SYNTHETIC DATA | Existing/new products | Toggle/set availability/active states; verify storefront/admin effects | Availability changes behave correctly and consistently | — | NOT TESTED | — | — | — |
| ADM-06 | Inventory adjustments | REQUIRES SYNTHETIC DATA | Inventory-managed products and permissions | Adjust stock/inventory; verify movements/levels | Inventory updates persisted correctly with audit/movement behavior as designed | — | NOT TESTED | — | — | — |
| ADM-07 | Order listing and filtering | REQUIRES SYNTHETIC DATA | Synthetic orders across statuses/types/dates | View orders list; apply filters/search/sort/pagination | Correct orders returned/displayed; filters accurate | — | NOT TESTED | — | — | — |
| ADM-08 | Order status changes | REQUIRES SYNTHETIC DATA | Orders in valid transitional states | Perform allowed status transitions; attempt invalid transitions | Allowed transitions succeed with correct side effects/state; invalid blocked; notifications suppressed safely in UAT | — | NOT TESTED | — | — | — |
| ADM-09 | Customer management | REQUIRES SYNTHETIC DATA | Synthetic customer records | View/search customer records/details | Correct customer data visible to authorized admin; no unauthorized exposure | — | NOT TESTED | — | — | — |
| ADM-10 | Custom cake request management | REQUIRES SYNTHETIC DATA | Synthetic custom cake requests | View/update/respond/manage request lifecycle | Request states/details update correctly per workflow | — | NOT TESTED | — | — | — |
| ADM-11 | WhatsApp Centre | BLOCKED | WhatsApp-related data/UI; safe-mode behavior understood | Open WhatsApp Centre; review conversations/templates/status views as available | UI/data renders safely; no real sends/webhook side effects; suppressed/blocked actions not reported as delivered | — | NOT TESTED | — | — | — |
| ADM-12 | Notification and outbox monitoring | REQUIRES SYNTHETIC DATA | Notification/outbox records or generated safe events | View outbox/notification statuses, retries/errors (sanitized) | Monitoring reflects actual stored state; UAT-suppressed deliveries not shown as sent | — | NOT TESTED | — | — | — |
| ADM-13 | Settings management | REQUIRES SYNTHETIC DATA | Admin access; settings singleton | View/update operational settings; verify effects | Settings persist and apply correctly; validation/authorization enforced | — | NOT TESTED | — | — | — |

## 4. Phase E — Commerce and integration safety cases

| Test ID | Area | Classification | Preconditions | Verification focus | Expected safe outcome | Actual result | PASS/FAIL/BLOCKED/NOT TESTED | Evidence | Defect ref | Retest |
|---|---|---|---|---|---|---|---|---|---|---|
| SAFE-01 | Order creation and persistence | REQUIRES SYNTHETIC DATA | Approved runtime; valid cart/customer/scheduling inputs | Create orders via supported safe paths | Orders persisted with correct items/totals/status/customer/fulfillment/schedule | — | NOT TESTED | — | — | — |
| SAFE-02 | Inventory reservation and release | REQUIRES SYNTHETIC DATA | Inventory-enabled products; order create/cancel/expiry scenarios | Observe reservation/commit/release behavior | Inventory counts/movements remain consistent; no leakage/double-release | — | NOT TESTED | — | — | — |
| SAFE-03 | Duplicate order prevention | REQUIRES SYNTHETIC DATA | Repeat submit/idempotency scenarios | Retry submission, refresh/resubmit, double-click protection | No unintended duplicate orders/charges/side effects | — | NOT TESTED | — | — | — |
| SAFE-04 | Payment state transitions | BLOCKED | Local payment workflow representable in UAT safe mode; no live provider | Exercise allowed transitions (pending/failed/paid-equivalent as safely supported) | State transitions consistent and auditable; no real provider dependency implied | — | NOT TESTED | — | — | — |
| SAFE-05 | Razorpay request and webhook suppression (UAT) | READY | `UAT_SAFE_MODE=true`, verified UAT target, backend running after approval | Attempt/create paths that would call Razorpay; inspect webhook handling controls | Razorpay external requests/webhook side effects blocked/suppressed; no live order/payment created | — | NOT TESTED | — | — | — |
| SAFE-06 | Email and OTP suppression | READY | `UAT_SAFE_MODE=true`, backend running | Trigger OTP/order/admin email paths | No real email/OTP sent; suppression logged/handled safely; caller behavior does not claim delivery | — | NOT TESTED | — | — | — |
| SAFE-07 | WhatsApp outbound suppression | READY | `UAT_SAFE_MODE=true`, outbox/WhatsApp paths exercised safely | Trigger WhatsApp-eligible events/outbox processing | No real WhatsApp message sent; jobs not falsely marked delivered/sent by suppression | — | NOT TESTED | — | — | — |
| SAFE-08 | Cloudinary upload/delete suppression | READY | `UAT_SAFE_MODE=true`, upload-capable flows | Attempt media upload/delete where applicable | External Cloudinary operations blocked/suppressed; no false success reported to user | — | NOT TESTED | — | — | — |
| SAFE-09 | Google OAuth rejection | READY | `UAT_SAFE_MODE=true`, backend/frontend running | Attempt Google sign-in flow | OAuth blocked/rejected safely as designed; no external auth side effect | — | NOT TESTED | — | — | — |
| SAFE-10 | Notification outbox retry and idempotency behavior | REQUIRES SYNTHETIC DATA | Outbox records/events and worker/runtime observation in approved UAT | Observe enqueue/claim/retry/idempotency/suppression behavior | No duplicate unsafe sends; retries/idempotency consistent; suppressed jobs handled per UAT-safe design | — | NOT TESTED | — | — | — |

## 5. Phase F — Evidence and traceability requirements
- All execution evidence to be stored/referenced under `docs/uat/` (sanitized). 
- Required artifacts: `BLB-03-UAT-TEST-PLAN.md` (this file), `BLB-03-TEST-DATA-PLAN.md`, `BLB-03-DEFECT-REGISTER.md`, `BLB-03-UAT-RESULTS.md`.
- Each executed test must record: Test ID, business workflow, preconditions, steps, expected result, actual result, PASS/FAIL/BLOCKED/NOT TESTED, evidence, defect reference (if any), retest status.
- **No PASS claims from static inspection.** Blocked provider operations must never be reported as successful customer payment or notification.

## 6. Overall readiness summary (preparation)
- **READY (after approved safe startup, subject to runtime verification):** SAFE-05, SAFE-06, SAFE-07, SAFE-08, SAFE-09.
- **REQUIRES SYNTHETIC DATA:** most customer/admin workflow and commerce persistence cases (CUST-01–09,12,13; ADM-02–10,12,13; SAFE-01–03,10).
- **BLOCKED:** OTP/auth flows dependent on real delivery or unsupported UAT auth paths (CUST-10,11,14 partial), admin access verification pending secure credentials (ADM-01), WhatsApp Centre runtime validation pending safe data/access (ADM-11), live/payment-provider-equivalent transitions (SAFE-04).
- **NOT TESTED:** all cases (no runtime UAT executed).