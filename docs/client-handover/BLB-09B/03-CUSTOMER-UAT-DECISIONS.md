# 03 — Customer UAT Decisions

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-09B — Group 2  
**Status:** COMPLETE (AP-01–AP-08 recorded)

## AP-01 (BLB-03M) — Guest Checkout “Continue” behavior

| Field | Value |
|---|---|
| Decision | **APPROVE OPTION A — Allow guest checkout to continue without forcing account registration.** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Existing checkout validation and security controls must remain in place. Guest checkout must not bypass payment or order validation. This decision does not authorize source-code changes, test execution or UAT. |
| Classification | PROJECT_OWNER_DECISION (not execution authorization) |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-02 — Synthetic customer/admin access policy for UAT

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Use synthetic customer and admin accounts exclusively for UAT. Never use real customer personal data. Store test credentials securely, restrict access to authorized testers, revoke or rotate credentials after UAT, and clean up test accounts and data afterward. This is a UAT access-policy decision only. It does not authorize account creation, credential provisioning or UAT execution. |
| Classification | PROJECT_OWNER_DECISION (UAT access-policy only; not execution authorization) |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-03 — Isolated UAT database write policy

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Any future UAT database operation must target exactly `127.0.0.1:27018/bluebell_whatsapp_uat`. `UAT_SAFE_MODE=true` must be verified. No access to ports 27017 or 27019, MongoDB Atlas or production databases. Require a verified backup, named operator, approved operation scope and audit evidence before any database write. Separate explicit authorization is required before every database operation. |
| Classification | PROJECT_OWNER_DECISION — database safety policy only. This does not authorize database access, prechecks, index creation, rollout or UAT. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-04 — Synthetic test data provisioning and cleanup

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Only synthetic test customers, orders, products and custom-cake requests may be created. Provisioning is permitted only in the separately approved isolated UAT environment. Test records must be clearly identifiable and traceable. Maintain an audit record of created test data. A verified backup is required before cleanup. Cleanup or archival must follow a separately approved plan. Never modify or delete real customer data. Separate execution authorization is required before provisioning or cleanup. |
| Classification | PROJECT_OWNER_DECISION — test data policy only. This does not authorize database writes, data provisioning, cleanup or UAT execution. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-05 / CUST-11 — Registration & OTP safe testing

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | CUST-11 testing must use synthetic accounts in an isolated, separately authorized UAT environment. All existing OTP security controls (S02) must remain fully intact. No OTP bypass, weakening or disabling of security controls. OTP values must never appear in logs, screenshots, reports or shared evidence. No real customer OTP delivery. Email/OTP provider testing requires separate explicit authorization. Rate limits, expiry and failed-attempt protections must remain enforced. |
| Classification | PROJECT_OWNER_DECISION — OTP testing policy only. This does not authorize OTP delivery, provider calls, account creation or UAT execution. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-06 / CUST-10 — Guest checkout order submission UAT scope

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Include the end-to-end guest checkout order submission journey in future customer UAT. Use synthetic customer, delivery and order data only. Use only the separately approved isolated UAT environment. Payment testing must comply with AP-07 restrictions. Notification testing must comply with AP-10 restrictions. Verify checkout validation, order creation and order status without creating real transactions or contacting real customers. Separate explicit UAT execution authorization is mandatory. |
| Classification | PROJECT_OWNER_DECISION — UAT scope only. This does not authorize test execution, database writes, payment-provider calls or notifications. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-07 — Payment testing restrictions

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Payment testing must use Razorpay sandbox/test mode only. No live transactions, real charges, captures, refunds or production webhooks. Use synthetic customer and payment data only. Sandbox payment creation, verification, webhook-signature validation and idempotency testing may be included in future UAT. Never use real customer payment credentials or financial data. Provider testing requires separate explicit authorization, a named operator and documented test scope. Preserve all existing payment-signature verification and security controls. Test evidence must not expose secrets or sensitive payment data. |
| Classification | PROJECT_OWNER_DECISION — payment testing policy only. This does not authorize provider calls, sandbox testing, live payment operations or UAT execution. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-08 / CUST-14 — Custom cake and media UAT scope

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Include custom-cake form submission, input validation and request-status handling in future UAT. Use synthetic customer and custom-cake data only. Use only the separately approved isolated UAT environment. Exclude Cloudinary uploads and all real external media-provider operations from this approval. Any future media testing requires verified isolation evidence and separate explicit Cloudinary/media-provider authorization. Do not upload real customer images or personal media. Separate explicit UAT execution authorization remains mandatory. |
| Classification | PROJECT_OWNER_DECISION — custom-cake UAT scope only. This does not authorize test execution, database writes, Cloudinary uploads, external media-provider calls or deployment. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |