# BLB-03U-R — Synthetic Data and Credentials Plan

**Project:** Bluebell Bakehouse  
**Date:** 2026-11-21  
**Status:** **READY FOR INTERNAL REVIEW**  
**Execution status:** **NOT AUTHORIZED**

## 1. Purpose

Define the controlled policy for synthetic UAT identities, credentials, data provisioning, isolation, cleanup, and evidence handling. This document authorizes **no** provisioning or DB writes.

## 2. Strict environment boundary

- **Allowed UAT DB target only:** `127.0.0.1:27018`, database `bluebell_whatsapp_uat`.
- **Prohibited:** MongoDB Atlas, production port `27017`, temporary restore port `27019`.
- **UAT mode required:** `UAT_SAFE_MODE=true`.
- **Prohibited data:** real customer data, real customer credentials, real admin credentials, real payment details, real provider tokens/secrets in evidence.

## 3. Synthetic identity requirements

| Identity type | Purpose | Requirements | Status |
|---|---|---|---|
| Synthetic customer (guest inputs) | CUST-10/14 form flows | Non-real name/email/phone/address; clearly labeled test data; no real person data | **NOT AUTHORIZED** to create |
| Synthetic registered customer | CUST-12/13 | Pre-provisioned UAT-only account; secure out-of-band password delivery; least privilege | **NOT AUTHORIZED** to create |
| Synthetic admin | ADM-01–13 | UAT-only admin; least privilege; secure out-of-band delivery; no shared uncontrolled credentials | **NOT AUTHORIZED** to create |
| Synthetic orders/requests | CUST-13, ADM-07/08/10, S07 checks | Traceable test IDs/tags in notes/manifest; cleanup plan; no real customer linkage | **NOT AUTHORIZED** to create |

## 4. Secure credential handling

- Generate credentials only in an approved secure environment.
- Deliver out-of-band through approved secure channel (not repo, chat transcript, screenshots, logs, or issue bodies).
- Use unique credentials per role/tester where possible.
- No credential reuse from production.
- Rotate/revoke after UAT window.
- Record evidence of delivery as metadata only (who/when/method), never the secret value.

## 5. Data provisioning plan (future authorized execution only)

1. **Manifest:** define scenario, data type, owner, count, identifier pattern, DB collections affected, creation window.
2. **Precheck:** confirm 127.0.0.1:27018/bluebell_whatsapp_uat; confirm `UAT_SAFE_MODE=true`; confirm backup/restore point as required.
3. **Provision:** minimum necessary synthetic records only; tag records with internal test manifest ID in evidence log.
4. **Verify:** read-only confirmation of created records and isolation.
5. **Cleanup:** remove/restore synthetic records per approved cleanup plan; verify removal.
6. **Closeout:** revoke credentials/access; archive sanitized evidence.

## 6. Isolation and traceability

- Use a unique UAT run ID (e.g., `BLB03UR-RUN-YYYYMMDD-XX`) in manifests/evidence.
- Keep synthetic emails/phones obviously non-real and UAT-only.
- Never mix UAT data with production/Atlas/restore instances.
- Capture before/after counts or record identifiers in sanitized evidence.

## 7. Cleanup and rollback

- **Cleanup required** after every authorized UAT run involving writes.
- **Rollback triggers:** wrong target, unexpected data mutation, failed cleanup verification, external side effect observed, authorization ambiguity.
- **Rollback actions:** stop execution, preserve evidence, restore from approved backup/snapshot per separately authorized procedure. **No ad-hoc destructive cleanup.**
- **Failure handling:** mark case BLOCKED/NOT TESTED; log incident in evidence register.

## 8. Access revocation

- Disable/remove UAT-only accounts or rotate credentials at end of window.
- Revoke temporary access to UAT environment/DB/tools.
- Confirm revocation in closeout evidence.

## 9. Prohibited actions

- No real customer/admin credentials.
- No real customer/production data.
- No Atlas/27017/27019 targets.
- No secret sharing in repo/chat/screenshots.
- No provisioning/cleanup execution without separate authorization.