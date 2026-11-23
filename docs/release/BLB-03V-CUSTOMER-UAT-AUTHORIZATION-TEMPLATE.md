# BLB-03V — Customer UAT Execution Authorization Template (CUST-01–CUST-14)

**Project:** Bluebell Bakehouse  
**Status:** **DRAFT TEMPLATE — NOT AUTHORIZED**  
**Date:** 2026-11-21

> **WARNING:** Template only. Blank/incomplete = **NOT AUTHORIZED**. UAT authorization does **not** authorize production, DB index execution, or provider operations.

## 1. Authorization record

| Field | Value |
|---|---|
| Record ID |  |
| Scope | Customer UAT CUST-01–CUST-14 (select exact subset below) |
| Plan review status | PLAN REVIEWED / PLAN APPROVED / NOT REVIEWED |
| Execution status | **NOT AUTHORIZED** / EXECUTION AUTHORIZED |
| Internal approver (name/role) |  |
| QA lead (name/role) |  |
| Operator/tester (name/role) |  |
| Execution window |  |
| Environment target | `127.0.0.1:27018/bluebell_whatsapp_uat` only |
| `UAT_SAFE_MODE` confirmed |  |
| Evidence location |  |

## 2. Exact case scope

| Case | Include? (Y/N) | Preconditions met? | Notes |
|---|---|---|---|
| CUST-01 Storefront homepage |  |  |  |
| CUST-02 Product catalogue |  |  |  |
| CUST-03 Product detail pages |  |  |  |
| CUST-04 Product availability |  |  |  |
| CUST-05 Cart add/update/remove |  |  |  |
| CUST-06 Cart persistence after refresh |  |  |  |
| CUST-07 Price/quantity/total calculations |  |  |  |
| CUST-08 Delivery address validation |  |  |  |
| CUST-09 Delivery date/time-slot validation |  |  |  |
| CUST-10 Guest checkout end-to-end |  |  | **Dependency-heavy** |
| CUST-11 Customer registration and OTP |  |  | **BLOCKED/DEFERRED risk** |
| CUST-12 Customer login |  |  |  |
| CUST-13 Customer account/order history |  |  |  |
| CUST-14 Custom cake request submission |  |  | **Media external path BLOCKED** |

## 3. Dependencies and restrictions

| Area | Required control | Status |
|---|---|---|
| BLB-03M | Confirmed Option A/B and regression impact |  |
| AP-02/16 | Synthetic customer identity/credentials, secure out-of-band, no real creds |  |
| AP-03/04 | Isolated UAT DB writes/cleanup only on 127.0.0.1:27018/bluebell_whatsapp_uat |  |
| AP-05 | No OTP disclosure/bypass/external delivery; CUST-11 safe evidence path confirmed or deferred |  |
| AP-06/07 | No live Razorpay/real txns/webhooks/provider ops |  |
| AP-08 | No external Cloudinary uploads/deletes; media path only if safe isolation confirmed |  |
| AP-10 | Email/OTP/WhatsApp/admin/customer notifications suppressed; never report as sent/delivered |  |

## 4. Stop conditions

- Wrong DB target / Atlas / 27017 / 27019.
- `UAT_SAFE_MODE` not true.
- Real customer data/credentials used.
- Real provider side effect observed.
- Scope ambiguity or missing authorization field.
- CUST-11 requires unsafe OTP handling.
- CUST-14 requires external media upload.

## 5. Cleanup/rollback/evidence

| Item | Detail |
|---|---|
| Synthetic data manifest |  |
| Cleanup owner |  |
| Rollback trigger/procedure |  |
| Evidence location |  |
| Defect log location |  |

## 6. Explicit authorization statement

> **EXECUTION AUTHORIZED:** [ ] No (default)  [ ] Yes — only when fully completed and signed.

| Signature/confirmation | Name/role | Date |
|---|---|---|
| Internal approver |  |  |
| QA lead |  |  |
| Operator/tester |  |  |

**Current state: NOT AUTHORIZED.**