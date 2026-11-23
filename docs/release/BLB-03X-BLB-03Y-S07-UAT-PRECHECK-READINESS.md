# BLB-03X — BLB-03Y S07 UAT Precheck & Rollout Readiness Checklist

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Milestone:** BLB-03X (preparation only)  
**Date:** 2026-11-21  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Status:** **READY FOR INTERNAL REVIEW — PREPARATION ONLY / NOT AUTHORIZED**

## 1. Purpose

Prepare a future, separately authorized BLB-03Y S07 UAT index precheck/rollout readiness checklist. This document is **not** authorization and **not** execution. BLB-03X performed no MongoDB connection, no live record inspection, no index creation, no migration, and no UAT.

## 2. Hard boundaries

### Only permissible future UAT target (if separately authorized)
- **Host:** `127.0.0.1`
- **Port:** `27018`
- **Database:** `bluebell_whatsapp_uat`
- **`UAT_SAFE_MODE=true`** required

### Explicitly prohibited
- MongoDB `27017`
- Temporary restore MongoDB `27019`
- MongoDB Atlas
- Production databases/clusters
- External providers (email/OTP/WhatsApp/Razorpay/Cloudinary/Google/etc.)
- Ad-hoc data deletion/modification
- Index creation/drop outside separately authorized scope
- Any execution without explicit written execution authorization

## 3. Required preconditions

| # | Precondition | Required evidence | Status |
|---|---|---|---|
| 1 | Separate explicit written execution authorization for BLB-03Y | Completed authorization record with approver, operator, scope, window, rollback, evidence location, stop conditions | **NOT AUTHORIZED** |
| 2 | Exact database target verification | Evidence shows `127.0.0.1:27018/bluebell_whatsapp_uat` only; no 27017/27019/Atlas/prod | **PENDING** |
| 3 | Safe Mode verification | Evidence shows `UAT_SAFE_MODE=true` before any DB action | **PENDING** |
| 4 | Existing index inspection | Read-only precheck output for `CustomCakeSubmissionIdempotencies.getIndexes()` captured | **PENDING** |
| 5 | Duplicate/conflicting record assessment before unique-index creation | Aggregate precheck for duplicate `idempotencyKey`; no unresolved duplicates/conflicts | **PENDING** |
| 6 | Backup and restore/rollback procedure | Backup/snapshot/restore point ID, owner, restore procedure, rollback trigger | **PENDING** |
| 7 | Exact index names, key definitions and options | Unique: `{ idempotencyKey: 1 }`, `unique: true`, name agreed; TTL: `{ expiresAt: 1 }`, `expireAfterSeconds: 0`, name agreed | **PENDING** |
| 8 | Pre-execution stop conditions | Operator/approver acknowledge all stop conditions | **PENDING** |
| 9 | Sanitized before/after evidence | Evidence location prepared; sanitized capture plan | **PENDING** |
| 10 | Post-operation verification and rollback criteria | Verification checks and rollback criteria documented/approved | **PENDING** |

## 4. Read-only precheck checklist (future authorized execution only)

> **NOT AUTHORIZED IN BLB-03X.** Commands below are planning references only.

| Check | Purpose | Pass criteria | Stop condition |
|---|---|---|---|
| Target confirmation | Prevent wrong DB target | Exactly `127.0.0.1:27018/bluebell_whatsapp_uat` | Any other target |
| Safe Mode confirmation | Prevent unsafe external side effects | `UAT_SAFE_MODE=true` | Missing/false/unknown |
| Backup/restore point | Enable recovery | Backup ID/time/restore procedure recorded | No backup/rollback |
| Existing indexes | Detect conflicts/drift | Index state captured and reviewed | Unexpected/conflicting index |
| Duplicate `idempotencyKey` | Prevent unique-index failure/data conflict | No duplicates | Any duplicate found; **no auto-delete** |
| Missing/invalid `expiresAt` | Prevent TTL/index/data issues | All `expiresAt` valid dates or separately approved remediation plan | Missing/invalid `expiresAt` |
| Conflicting records/app assumptions | Avoid unsafe rollout | Conflicts reviewed and resolved by separate approved plan | Unresolved conflict |

## 5. Planned index definitions (code-level evidence)

Source: `backend/src/models/CustomCakeSubmissionIdempotency.ts`, S07 design/report.

| Index | Key | Options | Purpose |
|---|---|---|---|
| Unique idempotency key | `{ idempotencyKey: 1 }` | `unique: true` (name to be confirmed in execution record) | Atomic dedupe/replay/conflict protection |
| TTL expiry | `{ expiresAt: 1 }` | `expireAfterSeconds: 0` (name to be confirmed) | Expire dedupe records at `expiresAt` |

## 6. Stop conditions (mandatory STOP)

- Target differs from `127.0.0.1:27018/bluebell_whatsapp_uat`.
- `UAT_SAFE_MODE` not confirmed true.
- No separate explicit written execution authorization.
- Backup/restore point unavailable or unverified.
- Duplicate `idempotencyKey` found.
- Missing/invalid `expiresAt` found.
- Unexpected/conflicting existing index found.
- Any unresolved data conflict.
- Authorization record incomplete/ambiguous.
- Any unexpected error/output/side effect.
- Any request touching 27017, 27019, Atlas, prod, or external providers.

## 7. Post-operation verification criteria (future authorized execution only)

| Check | Expected evidence | Pass criteria |
|---|---|---|
| Index list | `getIndexes()` output captured before/after | Unique `idempotencyKey` and TTL `expiresAt` (`expireAfterSeconds:0`) present |
| Duplicate precheck | Precheck output captured | No duplicates |
| Invalid `expiresAt` precheck | Precheck output captured | No missing/invalid `expiresAt`, or separately approved remediation completed |
| Application behavior (if separately authorized) | S07 replay/conflict/in-progress evidence in isolated UAT | Matches S07 expected behavior |
| TTL observation | Observation window recorded | TTL monitor behavior observed/recorded; no claim of instant deletion |

## 8. Rollback criteria

- **Rollback trigger:** wrong target risk, failed precheck, index creation error, unexpected index state, data conflict, missing backup, or ambiguous authorization.
- **Rollback actions (future, separately authorized as needed):** stop execution; preserve evidence; do not ad-hoc delete data; use approved restore procedure only if authorized; dropping index is a separate authorized action because it re-opens S07 duplicate risk.
- **No auto-remediation:** duplicates/conflicts require separate approved remediation plan.

## 9. Authorization separation

- This checklist does **not** authorize BLB-03Y execution.
- `PLAN REVIEWED`/`PLAN APPROVED` != execution authorized.
- A completed BLB-03Y execution authorization authorizes only the explicitly scoped BLB-03Y action.
- S07 UAT authorization != S07 production authorization != UAT execution != production release.

## 10. Readiness statement

- **Preparation status:** **READY FOR INTERNAL REVIEW**.
- **Execution status:** **NOT AUTHORIZED**.
- **Live DB activity performed in BLB-03X:** **None**.
- **Final release status:** **RELEASE NOT READY / NO-GO**.