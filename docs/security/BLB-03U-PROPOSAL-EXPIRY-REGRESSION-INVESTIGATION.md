# BLB-03U Step 4C Review — Proposal Expiry Regression Investigation (Read-Only)

**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD (before/after, unchanged):** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Investigation date:** 2026-11-21  
**Mode:** **Strictly read-only investigation. No source/tests/docs/config/env modified, no fixes implemented, no Git mutations, no services started/stopped/restarted, no production/UAT DB access, no external provider contact, no secrets/customer data exposed.**

> **Safety/compliance:** Repository root/branch/HEAD and `git status --short` confirmed before and after investigation. All pre-existing modified and untracked work preserved. Only this report was created: `docs/security/BLB-03U-PROPOSAL-EXPIRY-REGRESSION-INVESTIGATION.md` (no other documents updated).

## 1. Scope and reported failures

Reported from BLB-03U Step 4C full backend suite (`cd backend; npx vitest run`, exit 1, output captured to `%LOCALAPPDATA%\Temp\opencode\blb03u-s05-backend-vitest.txt`):
- **File:** `backend/tests/proposalExpiry.test.ts`
- **Suite:** `Order reschedule expiry > Response window (admin-selectable)`
- **Failures (3):**
  1. `defaults to 3 hours when responseWindowHours is omitted` — expected `200`, received `400` (`tests/proposalExpiry.test.ts:290`)
  2. `uses 1 hour when responseWindowHours is 1` — expected `200`, received `400` (`tests/proposalExpiry.test.ts:311`)
  3. `uses 72 hours when responseWindowHours is 72` — expected `200`, received `400` (`tests/proposalExpiry.test.ts:332`)
- **Full-suite totals:** 44 files (43 passed, 1 failed), 624 tests (621 passed, 3 failed), duration 294.04s.

## 2. Failing test cases, setup, fixtures, payloads, and assertions

**Location:** `backend/tests/proposalExpiry.test.ts`
- **Suite/describe:** `Order reschedule expiry` (line ~238) → `Response window (admin-selectable)` (line ~277).
- **Setup:** in-memory MongoDB replica set via `mongodb-memory-server` (`connectTestDB`, lines ~30-60), minimal Express app posting `/propose/:id` directly to `proposeSlot` with injected admin (`req.admin`) (lines ~62-76), test data helpers create Settings/Admin/User/Product/order records (lines ~78-236+). `beforeEach` clears collections, recreates test data, and sets `process.env.ADMIN_NOTIFICATION_EMAIL = "admin@example.com"` (restored in `afterEach`). `emailService` is mocked (`sendRescheduleExpiryAlert`, `isBrevoConfigured`, `sendAdminLoginAlertOnce`, `getBrevoPresenceChecks`) (lines ~21-26).
- **Failing cases (exact payloads/assertions):**
  1. **Line 278–296:** creates confirmed order; `futureTime = new Date(Date.UTC(2026, 10, 20, 12, 0, 0))` (2026-11-20T12:00:00.000Z). POST `/propose/${order._id}` with `{ time: futureTime.toISOString(), note: "Test proposal" }` (no `responseWindowHours`). Expects `200`, then `proposedSlot.expiresAt` ~3h from `now`.
  2. **Line 298–317:** same fixed `futureTime`; payload adds `responseWindowHours: 1`. Expects `200`, expiry ~1h.
  3. **Line 319–338:** same fixed `futureTime`; payload adds `responseWindowHours: 72`. Expects `200`, expiry ~72h.
- **Sibling passing cases in same describe (relevant):** `rejects responseWindowHours below 1` (350: `responseWindowHours: 0`, expects 400) and `rejects responseWindowHours above 72` (366: `responseWindowHours: 73`, expects 400) use `futureTime = addHours(new Date(), 5)` (dynamic future) and passed in the full suite (25 of 28 tests in file passed overall).

## 3. Relevant route/controller/validation/service trace

- **Test execution path:** direct controller invocation via test app `POST /propose/:id` → `proposeSlot` (`backend/tests/proposalExpiry.test.ts:66-73`, `14`; controller from `backend/src/controllers/orderController.ts:1280+`). Route-level middleware/rate limiting not involved in this test harness.
- **Validation/schema:** `proposeSlotSchema` (`backend/src/controllers/orderController.ts:1243-1255`) requires `time` as ISO datetime, `note` trimmed min 1/max 500, `responseWindowHours` optional int min 1 max 72 default 3. Parsed at `1298-1308`; invalid schema returns `400 { message: "Invalid proposal data", errors }`.
- **Slot validation:** `proposedTime = new Date(proposedTimeStr)` (1309), `validateSlot(proposedTime, order.fulfillmentType)` (1322-1331). On invalid slot: throws/returns `400` with `message: slotValidation.error ?? "Invalid slot time."`.
  - `backend/src/services/slotValidation.ts:51-62`: rejects if `slotTime.getTime() <= now.getTime()` with `valid:false, error:"Slot must be in the future."`; then enforces Asia/Kolkata business hours/day windows.
- **Business-hours context for fixed timestamp:** `2026-11-20T12:00:00.000Z` = 17:30 IST on Friday (2026-11-20), within Friday hours 07:00–21:00 (`slotValidation.ts:17-25`, `28-44`) — time-of-day/day would be acceptable if not in the past.
- **Other 400/409 paths in `proposeSlot`:** invalid order ID (1293-1295, 400), invalid proposal data (1300-1305, 400), pending proposal exists (1334-1343, 409), ineligible order status (1346-1354, 400), proposed time equals confirmed slot (1357-1364, 400). None match the fixed-time/future-window cases given the test setup (confirmed order, no pending proposal, valid schema/payloads).
- **Response window usage:** `responseWindowMs = (responseWindowHours ?? 3) * 60 * 60 * 1000` and expiry computed/stored (1368-1396); not reached if slot validation fails.

## 4. Relevant pre-existing diffs vs S05 changes

**S05 (Step 4C) changes (confirmed):** `backend/src/services/emailService.ts` (admin login alert privacy/dedupe/diagnostics refactor; other email functions preserved), `backend/tests/emailService.test.ts` (admin login alert cases only), `backend/.env.example` (config docs), plus new S05 tests/docs under untracked paths. **No overlap** with `proposeSlot`, proposal-expiry scheduling logic, slot validation, order routes/middleware, or `backend/tests/proposalExpiry.test.ts` behavior except mocked `emailService` APIs used by proposalExpiry tests remain available/mocked.

**Pre-existing working-tree diffs (relevant files, inspected):**
- `backend/tests/proposalExpiry.test.ts`: only `+      launchTimeout: 60000,` in `MongoMemoryServer.create` instance options (`connectTestDB`) — unrelated to proposal payloads/validation/assertions.
- `backend/src/controllers/orderController.ts`: pre-existing modifications in unrelated areas (e.g. added `grantConsent` import/checkout WhatsApp consent handling, create-order schema changes incl. pincode, and other hunks outside `proposeSlot`); `proposeSlot`/`responseWindowHours`/slot-validation logic not shown as modified in diff inspection and current working-tree implementation at 1243–1420 matches expected response-window and validation behavior.
- `backend/src/services/proposalExpiry.ts`: pre-existing diff adds UAT-safe-mode external-side-effect blocking/logging for expiry notifications (unrelated to admin proposal submission path/slot validation in these tests).
- `backend/src/routes/orderRoutes.ts`: pre-existing diff adds `createOrderLimiter` on order creation route (unrelated; tests call controller directly).
- `backend/src/services/slotValidation.ts`: no working-tree diff.

**Conclusion:** no evidence that S05 changes or relevant proposal/proposeSlot implementation diffs introduced the observed 400s.

## 5. Actual reason for HTTP 400 (per failure)

**Established proximate cause (all three failures):** the proposed slot timestamp is rejected by `validateSlot` as not in the future.

- **Evidence:**
  - Current system date at investigation: **Sat Nov 21 2026** (system update/context); test fixed slot: `2026-11-20T12:00:00.000Z` (2026-11-20 17:30 IST), which is **in the past** relative to current time.
  - `backend/src/services/slotValidation.ts:59-62`: `if (slotTime.getTime() <= now.getTime()) return { valid:false, error:"Slot must be in the future." };`
  - `backend/src/controllers/orderController.ts:1322-1331`: slot validation failure returns HTTP `400` with `message` set to `slotValidation.error` (i.e. `"Slot must be in the future."` in this condition).
  - The same describe block's dynamically-futured boundary tests (`addHours(new Date(), 5)`) behaved as expected in the full suite (schema-invalid `0`/`73` rejected with 400; valid cases for 1h/72h/default-3h would reach slot validation and pass it when future), while the 3 fixed-date cases failed with 400.
  - Individual rerun reproduced failure 1 with 400 (see Section 6).

**Why this yields the reported assertion:** tests expect `res.status` 200 and read `res.body.order.proposedSlot.expiresAt`, but controller returns 400 due to past-slot validation before proposal creation/expiry computation.

## 6. Individual test results (safely run, read-only)

Executed from `backend/` (isolated test environment, no repo file changes, no external/prod/UAT DB/services/providers):
- **Command:** `npx vitest run tests/proposalExpiry.test.ts -t "defaults to 3 hours when responseWindowHours is omitted"`
- **Result:** **FAIL** — `Test Files 1 failed (1), Tests 1 failed | 27 skipped (28), Duration 13.34s`
  - `defaults to 3 hours when responseWindowHours is omitted` (290:26): `AssertionError: expected 400 to be 200 // Object.is equality`

(Full-suite run had already reproduced all three failures with identical 400-vs-200 symptoms at lines 290/311/332; given the same fixed timestamp and validation path, the proximate cause applies uniformly.)

## 7. Cause determination and attribution

| Failure | Precise proximate cause (established) | Determination | Attributable to S05 (Step 4C)? | Evidence / notes |
|---|---|---|---|---|
| 1. Defaults to 3h when omitted | `validateSlot` rejects fixed proposed time `2026-11-20T12:00:00.000Z` as past (`slotValidation.ts:59-62`) → `proposeSlot` returns 400 with past-slot error (`orderController.ts:1322-1331`) | **Test setup/data sensitivity (hardcoded timestamp now past) interacting with pre-existing validation behavior**; not a logic regression in proposal/response-window handling | **No** | Fixed date is before current date (2026-11-21); dynamic-future sibling cases passed; S05 touched only admin login alert/email service paths, unrelated tests/docs/env example; no relevant proposeSlot/slotValidation diffs |
| 2. Uses 1h when `responseWindowHours` is 1 | Same as (1) | Same | **No** | Same fixed timestamp/payload path except valid `responseWindowHours: 1` (schema-valid) |
| 3. Uses 72h when `responseWindowHours` is 72 | Same as (1) | Same | **No** | Same fixed timestamp/payload path except valid `responseWindowHours: 72` (schema-valid) |

**Not supported by evidence:** regression introduced by Step 4C; failure caused by S05-modified files; failure caused by relevant pre-existing working-tree changes to propose/slot validation logic. **Inconclusive/not directly proven:** exact historical pass state in a clean environment at HEAD on the original run date (unchanged HEAD alone is not proof of unchanged working-tree/runtime behavior), but current concrete evidence sufficiently explains the failures without implicating S05.

## 8. Relevant source/test files and line references

- `backend/tests/proposalExpiry.test.ts:21-26` (emailService mocks), `30-37` (launchTimeout diff), `62-76` (test app/propose endpoint), `238-276` (setup/teardown), `277-338` (failing cases), `340-368` (passing boundary cases using dynamic future times)
- `backend/src/controllers/orderController.ts:1243-1255` (schema incl. `responseWindowHours`), `1280-1331` (proposeSlot auth/parse/slot validation/400 responses), `1368-1396` (response window expiry application)
- `backend/src/services/slotValidation.ts:17-25` (business hours), `51-77` (future-time and business-hours validation)
- `backend/src/services/proposalExpiry.ts` (pre-existing UAT-related diff; not on failing request path)
- `backend/src/routes/orderRoutes.ts` (pre-existing `createOrderLimiter` diff; not used by test harness)

## 9. Remaining uncertainty

- The controller returns `400` with a message body (`slotValidation.error`) not asserted/captured by these tests; the investigation infers the specific message from source-path evidence and timestamp conditions rather than observing it in the captured failure output. Behavior is nonetheless consistent and specific.
- Whether the fixed date `2026-11-20T12:00:00.000Z` was intended to remain valid long-term or should be relative/future-generated is a test-design question outside this read-only investigation.

## 10. Recommended next action (no implementation performed)

- **Do not attribute to S05 or revert S05 changes.** Treat as a separate, non-S05 test reliability/date-sensitivity issue in `backend/tests/proposalExpiry.test.ts` (Response window cases using hardcoded past timestamp).
- In a future, explicitly authorized change, update those three test cases to use a deterministic future slot time (e.g. dynamically computed future time within valid business hours, or a fixed far-future time aligned with slot rules) while preserving intent/assertions; re-run `tests/proposalExpiry.test.ts` and relevant regression scope to confirm.
- Keep BLB-03U Step 4C S05 status/evidence as reported, with this investigation recorded as the explanation for the unrelated full-suite failures.

## 11. Final confirmation

- **Branch/HEAD before:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`
- **Branch/HEAD after:** `feature/whatsapp-business-automation` @ `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` (**unchanged**)
- **Git mutations:** **none** (no stage/commit/stash/reset/clean/checkout/switch/pull/push or other state changes).
- **Documents updated:** **only** `docs/security/BLB-03U-PROPOSAL-EXPIRY-REGRESSION-INVESTIGATION.md` (created).

### Preserved modified/untracked files (`git status --short`, unchanged set)
- **Modified:** `app/cart/page.tsx`, `app/checkout/page.tsx`, `backend/.env.example`, `backend/src/config/db.ts`, `backend/src/controllers/authController.ts`, `backend/src/controllers/customCakeController.ts`, `backend/src/controllers/customerAuthController.ts`, `backend/src/controllers/orderController.ts`, `backend/src/controllers/paymentController.ts`, `backend/src/controllers/uploadController.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/routes/authRoutes.ts`, `backend/src/routes/customCakeRoutes.ts`, `backend/src/routes/orderRoutes.ts`, `backend/src/routes/paymentRoutes.ts`, `backend/src/seedAdmin.ts`, `backend/src/server.ts`, `backend/src/services/cloudinary.ts`, `backend/src/services/customerOrderNotifications.ts`, `backend/src/services/emailService.ts`, `backend/src/services/googleAuth.ts`, `backend/src/services/proposalExpiry.ts`, `backend/src/services/razorpay.ts`, `backend/tests/adminAuth.test.ts`, `backend/tests/analyticsBusinessLogic.test.ts`, `backend/tests/costSnapshot.test.ts`, `backend/tests/csrf.test.ts`, `backend/tests/customCake.test.ts`, `backend/tests/customerAuth.test.ts`, `backend/tests/customerMetrics.test.ts`, `backend/tests/customerUpload.test.ts`, `backend/tests/emailService.test.ts`, `backend/tests/fulfillment.test.ts`, `backend/tests/inventoryLedger.test.ts`, `backend/tests/inventoryMovement.test.ts`, `backend/tests/orderArchive.test.ts`, `backend/tests/orderValidation.test.ts`, `backend/tests/otp.test.ts`, `backend/tests/pagination.test.ts`, `backend/tests/payment.test.ts`, `backend/tests/productController.test.ts`, `backend/tests/proposalExpiry.test.ts`, `backend/tests/reschedule.test.ts`, `backend/tests/settings.test.ts`, `backend/tests/testDatabase.ts`, `backend/tests/upload.test.ts`, `backend/vitest.config.ts`, `components/admin/admin-layout.tsx`, `components/admin/admin-nav.tsx`, `components/cart/cart-provider.tsx`, `components/customer/auth-form.tsx`, `components/home/custom-cake-section.tsx`, `middleware.ts`, `next-env.d.ts`, `pnpm-lock.yaml`, `tests/e2e/checkout-delivery-address-validation.spec.ts`.
- **Untracked:** `app/admin/whatsapp/`, `backend/src/config/uatSafeMode.ts`, `backend/src/controllers/adminWhatsAppController.ts`, `backend/src/controllers/whatsappWebhookController.ts`, `backend/src/models/NotificationOutbox.ts`, `backend/src/models/WhatsAppConsent.ts`, `backend/src/models/WhatsAppMessage.ts`, `backend/src/models/WhatsAppNotificationPreference.ts`, `backend/src/models/WhatsAppWebhookEvent.ts`, `backend/src/routes/adminWhatsAppRoutes.ts`, `backend/src/routes/whatsappRoutes.ts`, `backend/src/routes/whatsappWebhookRoutes.ts`, `backend/src/services/notificationOutboxService.ts`, `backend/src/services/uatSafetyLog.ts`, `backend/src/services/whatsappAdminRecipients.ts`, `backend/src/services/whatsappConsentService.ts`, `backend/src/services/whatsappEventTaxonomy.ts`, `backend/src/services/whatsappService.ts`, `backend/src/services/whatsappTemplateRegistry.ts`, `backend/tests/adminWhatsApp.test.ts`, `backend/tests/customCakeRateLimit.s03.test.ts`, `backend/tests/emailService.adminLoginAlert.test.ts`, `backend/tests/notificationOutbox.test.ts`, `backend/tests/orderCheckoutWhatsappConsent.test.ts`, `backend/tests/orderRateLimit.s03.test.ts`, `backend/tests/paymentRateLimit.s03.test.ts`, `backend/tests/securityRemediation.s01s02.test.ts`, `backend/tests/uatSafeMode.test.ts`, `backend/tests/whatsappAdminRecipients.test.ts`, `backend/tests/whatsappConsent.test.ts`, `backend/tests/whatsappConsentRoutes.test.ts`, `backend/tests/whatsappTemplateRegistry.test.ts`, `backend/tests/whatsappWebhook.test.ts`, `backend/tests/whatsappWebhookHttpIntegration.test.ts`, `backend/tests/whatsappWebhookOutboxCorrelation.test.ts`, `docs/CLIENT_HANDOVER_STATUS.md`, `docs/UAT_SAFE_MODE.md`, `docs/WHATSAPP_STAGE5_PHASE_A.md`, `docs/release/`, `docs/security/`, `docs/uat/`, `playwright-report/`, `test-results/`, `tests/e2e/cart-consistency.spec.ts`, `tests/e2e/customer-admin-isolation.spec.ts`.

**Investigation complete. Stopped (no S06/S07, no fixes).**
