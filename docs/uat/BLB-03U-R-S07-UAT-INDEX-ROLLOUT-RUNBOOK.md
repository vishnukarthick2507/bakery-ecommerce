# BLB-03U-R — S07 UAT Index Rollout Runbook

**Project:** Bluebell Bakehouse  
**Date:** 2026-11-21  
**Status:** **READY FOR INTERNAL REVIEW**  
**Execution status:** **NOT AUTHORIZED** (documentation-only; no DB commands executed)

## 1. Purpose

Prepare a UAT-only, evidence-based runbook for `CustomCakeSubmissionIdempotency` index rollout. This runbook is for planning and controlled authorization only.

## 2. Evidence inspected

- `backend/src/models/CustomCakeSubmissionIdempotency.ts`: `idempotencyKey` is required, trimmed, unique, indexed; `expiresAt` is required Date with `index: { expires: 0 }`.
- `backend/src/controllers/customCakeController.ts`: S07 idempotency key validation, HMAC-SHA256 fingerprint, 24h TTL, replay/conflict/in-progress/503 recovery behavior.
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md` and `BLB-03U-S07-REMEDIATION-REPORT.md`: code-level indexes only; no prod/UAT index creation/verification.
- Step 7A/7B: index rollout remains blocked pending separate authorization.

## 3. Strict target and safety boundary

- **Only allowed target:** `127.0.0.1:27018`, database `bluebell_whatsapp_uat`.
- **Required:** `UAT_SAFE_MODE=true`.
- **Prohibited:** MongoDB Atlas, production port `27017`, temporary restore port `27019`, any production DB, any ad-hoc writes, any unapproved index commands.
- **Planning != execution.** Every command below is **NOT AUTHORIZED** in this milestone.

## 4. Required index definitions

| Index | Definition | Purpose |
|---|---|---|
| Unique idempotency key | `{ idempotencyKey: 1 }`, `unique: true` | Atomic dedupe claim/replay/conflict; prevents duplicate submission creation for same key. |
| TTL expiry | `{ expiresAt: 1 }`, `expireAfterSeconds: 0` | Expire dedupe records at `expiresAt` (24h lifecycle in app logic). |

## 5. Prechecks (read-only, future authorized execution only)

| Precheck | Method | Pass criteria | Stop condition |
|---|---|---|---|
| Target confirmation | Operator confirms host/port/db from approved env; verify connection string target before any command | Exactly `127.0.0.1:27018/bluebell_whatsapp_uat` | Any other target → **STOP** |
| Safe mode confirmation | Verify app/env config for UAT run | `UAT_SAFE_MODE=true` | Missing/false/unknown → **STOP** |
| Backup/restore point | Confirm approved backup/snapshot/restore point exists | Backup ID/time recorded | No backup/rollback path → **STOP** |
| Existing indexes | `db.CustomCakeSubmissionIdempotencies.getIndexes()` (**NOT AUTHORIZED**) | Index state captured | Unexpected conflicting index requires review → **STOP** |
| Duplicate idempotencyKey | Aggregate group by `idempotencyKey` having count>1 (**NOT AUTHORIZED**) | No duplicates | Duplicates found → **STOP**, no auto-delete |
| Missing/invalid expiresAt | Find docs where `expiresAt` missing/not date (**NOT AUTHORIZED**) | None or reviewed exception | Invalid data → **STOP** for remediation plan |
| Conflicting records | Inspect duplicates/conflicts and app assumptions | Remediation plan approved separately | Any unresolved conflict → **STOP** |

## 6. Execution procedure (NOT AUTHORIZED)

> **NOT AUTHORIZED IN BLB-03U-R.** Do not run. Commands shown only for controlled future authorization.

```javascript
// NOT AUTHORIZED - UAT only, after all prechecks and explicit execution authorization
// db = connect to approved 127.0.0.1:27018/bluebell_whatsapp_uat only

db.CustomCakeSubmissionIdempotencies.getIndexes();

db.CustomCakeSubmissionIdempotencies.aggregate([
  { $group: { _id: "$idempotencyKey", count: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
]);

db.CustomCakeSubmissionIdempotencies.find(
  { $or: [ { expiresAt: { $exists: false } }, { expiresAt: { $not: { $type: "date" } } } ] }
).limit(20);

// Create indexes only if prechecks pass and execution is separately authorized
db.CustomCakeSubmissionIdempotencies.createIndex(
  { idempotencyKey: 1 },
  { unique: true, name: "idempotencyKey_1_unique" }
);

db.CustomCakeSubmissionIdempotencies.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "expiresAt_ttl" }
);

db.CustomCakeSubmissionIdempotencies.getIndexes();
```

## 7. Verification (future authorized execution only)

- **Unique constraint:** index list shows unique `idempotencyKey`; duplicate-key insert attempt in controlled test fails with duplicate-key error; app replay/conflict behavior matches S07.
- **TTL definition:** index list shows `expiresAt` with `expireAfterSeconds: 0`.
- **Expiry behavior:** TTL monitor runs periodically (MongoDB background behavior; not immediate). Verification must allow delay and record observation window; do not claim instant expiry.
- **Idempotent replay:** same key+same payload returns original 201 response; no duplicate record.
- **Conflict:** same key+different payload returns 409.

## 8. Rollback and recovery

- **Do not auto-delete conflicting data.** Escalate with sanitized evidence.
- If index creation fails, record exact error/output; do not retry blindly.
- Dropping an index is a separate authorized action; dropping unique index re-opens S07 duplicate risk and must be risk-accepted explicitly.
- Restore/rollback to approved backup only under separate authorization.

## 9. Production separation

- **Production rollout is DEFERRED / NOT AUTHORIZED.**
- UAT approval/evidence does **not** authorize production.
- Separate production runbook/authorization required: target confirmation, backup, window, operator, prechecks, verification, rollback, post-change smoke.

## 10. Readiness statement

- **Runbook readiness:** **READY FOR INTERNAL REVIEW**.
- **Execution readiness:** **NOT AUTHORIZED**. No DB connections/inspections/index ops performed.