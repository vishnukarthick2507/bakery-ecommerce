# 04 — Admin UAT Decisions

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-09B — Group 3  
**Status:** COMPLETE (AP-09, AP-10, AP-16 recorded)

## AP-09 — Admin workflow testing scope (ADM-01–ADM-13)

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Include ADM-01–ADM-13 admin workflows in future UAT. Use only the separately approved isolated UAT environment. Use synthetic admin accounts and synthetic customer, product, order and custom-cake data only. Follow AP-02 synthetic-account access controls, AP-03 database safety restrictions and AP-04 test-data provisioning and cleanup policy. Apply AP-10 notification restrictions before testing any action that could trigger customer communications. Verify role-based access control and admin authorization boundaries. Do not access or modify real customer data or production records. Separate explicit UAT execution authorization is mandatory. |
| Classification | PROJECT_OWNER_DECISION — admin UAT scope only. This does not authorize test execution, database writes, provider calls, deployment or production operations. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-10 — Notification/WhatsApp suppression expectations during UAT

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | All real customer notifications must be suppressed or blocked during UAT, including WhatsApp, email and SMS. UAT must never contact real customers or use real customer contact details. Only synthetic/test recipients may be used, and only within the separately approved isolated UAT environment. Default notification behavior during UAT must be suppression. Notifications must not be sent externally unless a separate provider-testing authorization explicitly permits the specific operation. Any future WhatsApp, email or SMS provider sandbox testing requires separate explicit authorization, a named operator, documented scope and verified sandbox configuration. Preserve all existing consent, opt-in, opt-out, withdrawal, OTP and notification security controls. Do not bypass or weaken them to facilitate testing. UAT evidence must clearly distinguish between notification suppressed, queued, attempted, accepted by provider and delivered. Never report a suppressed or queued notification as sent or delivered. Logs and screenshots must not expose OTPs, secrets, access tokens or real customer personal information. Separate explicit UAT execution authorization remains mandatory. |
| Classification | PROJECT_OWNER_DECISION — UAT notification-policy decision only. This does not authorize source-code changes, test execution, database writes, provider calls, actual notification delivery, deployment or production operations. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## AP-16 — Synthetic data/credentials operational handling

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Synthetic UAT credentials and data must be accessible only to named, authorized testers and operators, following least-privilege access. Credentials must be stored in an approved secure secrets manager or equivalent access-restricted storage. Never store credentials in source code, public repositories, screenshots, reports or unsecured documents. Credentials, OTPs, access tokens and sensitive information must never be shared through unsecured channels, including ordinary WhatsApp or email messages. Use synthetic test data exclusively. All test records must be clearly identifiable and traceable to the UAT activity. Maintain an audit trail of credential access, provisioning, changes, rotation, revocation and synthetic-data operations. Audit records must not contain passwords, OTPs, tokens or other secrets. Test credentials must be rotated or revoked after UAT or when access is no longer required. Synthetic-data cleanup or archival must follow a separately approved plan and require a verified backup before cleanup. Never expose, access, modify or delete real customer credentials or personal data as part of UAT. Any credential provisioning, synthetic-data provisioning, cleanup, database operation or UAT execution requires its own separate explicit execution authorization. |
| Classification | PROJECT_OWNER_DECISION — operational-handling policy decision only. This does not authorize credential creation, data provisioning, database writes, cleanup, source-code changes, testing, UAT execution, provider calls, deployment or production operations. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |