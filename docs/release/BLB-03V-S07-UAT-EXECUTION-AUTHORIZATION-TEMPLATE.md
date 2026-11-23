# BLB-03V — S07 UAT Index Precheck & Rollout Execution Authorization Template

**Project:** Bluebell Bakehouse  
**Status:** **DRAFT TEMPLATE — NOT AUTHORIZED**  
**Date:** 2026-11-21

> **WARNING:** This is a template only. A blank or incomplete field means **NOT AUTHORIZED**. `PLAN REVIEWED`/`PLAN APPROVED` do **not** mean execution authorized. UAT authorization does **not** authorize production.

## 1. Authorization record

| Field | Value (complete explicitly or leave blank = NOT AUTHORIZED) |
|---|---|
| Record ID |  |
| Decision ID | Decision 11 — S07 UAT idempotency index rollout |
| Plan review status | PLAN REVIEWED / PLAN APPROVED / NOT REVIEWED |
| Execution status | **NOT AUTHORIZED** / EXECUTION AUTHORIZED (only when fully completed) |
| Internal approver (name/role) |  |
| Approver date |  |
| Operator (name/role) |  |
| Execution window (start/end timezone) |  |
| Evidence location |  |

## 2. Explicit scope

**Permitted target only:** `127.0.0.1:27018` / database `bluebell_whatsapp_uat`.

**In scope (only after execution authorization):**
- [ ] Read-only precheck: existing indexes on `CustomCakeSubmissionIdempotencies`.
- [ ] Read-only precheck: duplicate `idempotencyKey` values.
- [ ] Read-only precheck: missing/invalid `expiresAt` values.
- [ ] Backup/restore point confirmation.
- [ ] Create unique index `{ idempotencyKey: 1 }` with `unique: true`.
- [ ] Create TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.
- [ ] Post-create verification (`getIndexes`, behavior checks as authorized).

## 3. Explicit exclusions

- No MongoDB Atlas.
- No production port `27017`.
- No temporary restore port `27019`.
- No production database/cluster.
- No ad-hoc data deletion/modification.
- No index drop unless separately authorized by its own record.
- No application code/config/service/deployment changes.
- No UAT business-flow execution under this record.

## 4. Preconditions

| Precondition | Evidence/initials | Pass/Fail |
|---|---|---|
| `UAT_SAFE_MODE=true` confirmed |  |  |
| Target confirmed as `127.0.0.1:27018/bluebell_whatsapp_uat` |  |  |
| No Atlas/27017/27019 connection possible in procedure |  |  |
| Backup/restore point available |  |  |
| Rollback owner identified |  |  |
| Operator has approved access |  |  |
| Stop conditions reviewed |  |  |

## 5. Stop conditions (mandatory STOP)

- Target differs from `127.0.0.1:27018/bluebell_whatsapp_uat`.
- `UAT_SAFE_MODE` not confirmed true.
- Backup/restore point unavailable.
- Duplicate `idempotencyKey` found.
- Missing/invalid `expiresAt` found.
- Unexpected/conflicting existing index found.
- Authorization record incomplete/ambiguous.
- Any unexpected error/output.

## 6. Verification criteria

| Check | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Unique index exists | `idempotencyKey` unique index present |  |  |
| TTL index exists | `expiresAt` index with `expireAfterSeconds:0` |  |  |
| Duplicate precheck | No duplicates |  |  |
| Replay/conflict behavior (if separately authorized test) | S07 behavior preserved |  |  |

## 7. Rollback/recovery

| Item | Detail |
|---|---|
| Rollback trigger |  |
| Rollback owner |  |
| Rollback procedure |  |
| Data deletion allowed? | **No ad-hoc deletion.** Separate approved remediation only. |
| Backup reference |  |

## 8. Explicit authorization statement

> **EXECUTION AUTHORIZED:** [ ] No (default)  [ ] Yes — only when all fields complete, preconditions pass, and approver signs below.

| Signature/confirmation | Name/role | Date | Notes |
|---|---|---|---|
| Internal approver |  |  |  |
| Operator |  |  |  |
| QA/reviewer (optional) |  |  |  |

**Current state: NOT AUTHORIZED.**