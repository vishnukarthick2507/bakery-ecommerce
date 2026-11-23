# BLB-03U-R — Admin UAT Runbook

**Project:** Bluebell Bakehouse  
**Date:** 2026-11-21  
**Status:** **READY FOR INTERNAL REVIEW**  
**Execution status:** **NOT AUTHORIZED / NOT TESTED**

## 1. Global prerequisites

- [ ] Separate operational execution authorization recorded.
- [ ] AP-02/03/04/09/10 approvals/authorizations as applicable.
- [ ] Secure synthetic admin credentials delivered out-of-band (no secrets in repo/chat/logs).
- [ ] `UAT_SAFE_MODE=true`; DB target `127.0.0.1:27018/bluebell_whatsapp_uat`.
- [ ] Prohibited: Atlas, `27017`, `27019`, real customer data, real admin/customer credentials, real provider operations.
- [ ] Mutation rollback plan prepared for any state-changing case.
- [ ] Evidence capture is sanitized.

## 2. Execution order

1. **Read-only checks first:** ADM-01, ADM-02, ADM-03, ADM-07, ADM-09, ADM-11, ADM-12.
2. **Controlled state-changing checks:** ADM-04, ADM-05, ADM-06, ADM-08, ADM-10, ADM-13 (only with per-case mutation authorization and rollback).
3. **Excluded unless separately authorized:** destructive/irreversible data deletion, production-like bulk operations, live provider/webhook operations, credential resets/changes outside approved scope.

## 3. Admin case matrix

| Test ID | Objective | Readiness | Type | Prereqs | Expected result | Evidence | Cleanup/rollback | Gate |
|---|---|---|---|---|---|---|---|---|
| ADM-01 | Admin authentication | **BLOCKED** | Read-only/auth | Secure admin creds (AP-02) | Valid login succeeds; invalid rejected; no secret exposure | Sanitized screenshots | Logout | Admin UAT auth gate |
| ADM-02 | Authorization/protected routes | **BLOCKED** | Read-only/authz | Admin + synthetic customer sessions | Admin-only routes/APIs inaccessible to customer/unauth; accessible to admin | UI+API evidence | Logout sessions | AP-02/09 |
| ADM-03 | Dashboard data/metrics | **BLOCKED** | Read-only | Admin session; sufficient dataset | Renders correctly or valid empty states | Screenshots | None | AP-09 |
| ADM-04 | Product creation/editing | **BLOCKED** | Controlled mutation | Admin session; AP-03/04/09; media policy | Valid create/edit persisted; validation handled; no external image side effects in UAT Safe Mode | Before/after screenshots, record IDs | Rollback created/edited test product per AP-04 | Mutation gate |
| ADM-05 | Product availability | **BLOCKED** | Controlled mutation | Existing/synthetic product | Availability toggles persist and reflect consistently | Before/after screenshots | Restore original state | Mutation gate |
| ADM-06 | Inventory adjustments | **BLOCKED** | Controlled mutation | Inventory-managed product; baseline | Adjustments persisted with consistent counts/movements | Before/after counts/movement evidence | Reverse adjustment/restore baseline | Mutation gate + rollback |
| ADM-07 | Order listing/filtering | **BLOCKED** | Read-only | Synthetic orders across states | Correct orders returned; filters accurate | Screenshots | None | AP-09 |
| ADM-08 | Order status changes | **BLOCKED** | Controlled mutation | Transitional synthetic orders; AP-10 | Allowed transitions succeed; invalid blocked; notifications suppressed/not claimed delivered | Before/after status, logs/monitoring evidence | Restore prior status if approved; record side effects | Mutation gate + AP-10 |
| ADM-09 | Customer management | **BLOCKED** | Read-only | Synthetic customer records | Authorized admin sees correct data; no unauthorized exposure | Sanitized screenshots | None | AP-09 |
| ADM-10 | Custom cake request management | **BLOCKED** | Controlled mutation | Synthetic custom cake requests | Request lifecycle updates correctly per workflow | Before/after evidence | Restore prior state | Mutation gate |
| ADM-11 | WhatsApp Centre | **BLOCKED** | Read-only | Safe synthetic WhatsApp/outbox data; AP-10 | UI renders safely; no real sends/webhook side effects; suppressed not reported delivered | Screenshots | None | AP-09/10 |
| ADM-12 | Notification/outbox monitoring | **BLOCKED** | Read-only | Notification/outbox records or safe events | Monitoring reflects stored/suppressed state; no false sent/delivered claims | Screenshots/log evidence | None | AP-09/10 |
| ADM-13 | Settings management | **BLOCKED** | Controlled mutation | Admin access; settings singleton; rollback | Settings persist/apply correctly; validation/authorization enforced | Before/after settings evidence | Restore previous settings immediately | Mutation gate + explicit rollback |

## 4. Admin UAT safety rules

- No live provider/webhook operations.
- No destructive deletes unless separately authorized with rollback/backup.
- No credential reset/change/inspection outside approved scope.
- Do not report UAT-suppressed notifications as sent/delivered.
- Any mutation requires before/after evidence and rollback record.

## 5. Readiness statement

- **Documentation readiness:** **READY FOR INTERNAL REVIEW**.
- **Execution readiness:** **NOT AUTHORIZED / NOT TESTED**.
- **Release status:** **NOT READY**.