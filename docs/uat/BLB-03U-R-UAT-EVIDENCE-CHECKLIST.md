# BLB-03U-R — UAT Evidence Checklist

**Project:** Bluebell Bakehouse  
**Date:** 2026-11-21  
**Status:** **READY FOR INTERNAL REVIEW**  
**Execution status:** **NOT AUTHORIZED / NOT TESTED**

## 1. Evidence capture rules

- Capture only sanitized evidence: no secrets, no OTPs, no credentials, no real customer PII, no provider tokens.
- Record timestamp, tester, environment, run ID, case ID, build/HEAD if applicable.
- Distinguish **observed** vs **expected** vs **not tested**.
- Never label suppressed notifications as sent/delivered.
- Never claim live payment verified in UAT Safe Mode.
- Store evidence location/reference in the run log (path/ticket/doc reference).

## 2. Pre-run evidence

| Item | Required evidence | Status |
|---|---|---|
| Execution authorization | Approved record with scope, approver, date, window | NOT TESTED |
| UAT target confirmation | `UAT_SAFE_MODE=true`; `127.0.0.1:27018`; `bluebell_whatsapp_uat` | NOT TESTED |
| Prohibited target check | Confirmation no Atlas/27017/27019 used | NOT TESTED |
| Synthetic data manifest | IDs/types/counts/owner; no real data | NOT TESTED |
| Credential handling | Out-of-band delivery metadata only; no secret values | NOT TESTED |
| Backup/restore point (if writes/index ops) | Backup ID/time/operator | NOT TESTED |
| Rollback plan | Scenario-specific rollback owner/procedure | NOT TESTED |

## 3. Per-case evidence matrix

| Case | Minimum evidence | Pass criteria | Cleanup evidence | Status |
|---|---|---|---|---|
| CUST-01 | Homepage screenshot, console/network note | Loads, no errors, links work | N/A | NOT TESTED |
| CUST-02 | Catalogue screenshots/counts | Products/cards/pricing render correctly | N/A | NOT TESTED |
| CUST-03 | Product detail screenshot | Correct data/actions by availability | N/A | NOT TESTED |
| CUST-04 | In-stock/unavailable screenshots | Availability/disallowed actions correct | N/A | NOT TESTED |
| CUST-05 | Before/after cart screenshots | Add/update/remove/totals correct | Reset cart | NOT TESTED |
| CUST-06 | Before/after refresh screenshots | Persistence as designed | Reset cart | NOT TESTED |
| CUST-07 | Calculation table/screenshots | Totals accurate/consistent | Reset cart | NOT TESTED |
| CUST-08 | Valid/invalid address screenshots | Validation messages correct | N/A | NOT TESTED |
| CUST-09 | Slot validation screenshots | Valid accepted; invalid blocked | N/A | NOT TESTED |
| CUST-10 | Checkout flow screenshots, synthetic order ref, suppression note | Safe end-to-end order recorded as authorized; no real provider side effects | AP-04 cleanup record | NOT TESTED |
| CUST-11 | Registration/OTP-safe response screenshots/log notes | No OTP disclosure; no real delivery; no bypass; safe-mode behavior as approved | Account cleanup if created | NOT TESTED |
| CUST-12 | Login success/failure screenshots (sanitized) | Valid succeeds; invalid rejected; session/logout correct | Logout/revoke | NOT TESTED |
| CUST-13 | Account/order history screenshots | Authorized data only | N/A | NOT TESTED |
| CUST-14 | Submission/validation/idempotency evidence | Safe persistence/ack or approved safe behavior; no external media side effects | Request cleanup | NOT TESTED |
| ADM-01 | Login success/failure screenshots | Auth works; no secret exposure | Logout | NOT TESTED |
| ADM-02 | Admin/customer/unauth access evidence | Route/API authz enforced | Logout | NOT TESTED |
| ADM-03 | Dashboard screenshots | Correct render/data or valid empty state | N/A | NOT TESTED |
| ADM-04 | Before/after product records | Persisted; no external image side effects | Rollback product changes | NOT TESTED |
| ADM-05 | Before/after availability | Consistent toggle behavior | Restore state | NOT TESTED |
| ADM-06 | Before/after inventory/movement | Counts/movements correct | Reverse adjustment | NOT TESTED |
| ADM-07 | Filter/list screenshots | Correct results | N/A | NOT TESTED |
| ADM-08 | Before/after status + suppression evidence | Allowed/blocked transitions correct; no false sent | Restore status | NOT TESTED |
| ADM-09 | Customer management screenshots | Authorized data only | N/A | NOT TESTED |
| ADM-10 | Before/after custom cake management | Lifecycle updates correct | Restore state | NOT TESTED |
| ADM-11 | WhatsApp Centre screenshots | Safe render; no real send/webhook side effects | N/A | NOT TESTED |
| ADM-12 | Outbox/notification screenshots | Stored/suppressed state only | N/A | NOT TESTED |
| ADM-13 | Before/after settings evidence | Persist/apply/validate correctly | Restore settings | NOT TESTED |

## 4. S07 index rollout evidence (if separately authorized)

| Item | Evidence | Status |
|---|---|---|
| Prechecks | Target/safe-mode/backup/duplicate/expiresAt checks output | NOT TESTED |
| Index before/after | `getIndexes()` output sanitized | NOT TESTED |
| Duplicate precheck | Aggregate output showing no conflicts | NOT TESTED |
| Unique/TTL verification | Index definitions and controlled behavior checks | NOT TESTED |
| Rollback readiness | Documented rollback trigger/owner | NOT TESTED |

## 5. Defect/incident evidence

- Record case ID, severity, repro steps, expected/actual, environment, evidence refs.
- Mark external side effects/security concerns as immediate stop conditions.
- Do not include secrets/PII in defect artifacts.