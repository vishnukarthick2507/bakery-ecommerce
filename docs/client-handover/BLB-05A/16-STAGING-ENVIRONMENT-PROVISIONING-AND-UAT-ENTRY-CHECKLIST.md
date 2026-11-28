# Staging Environment Provisioning and UAT Entry Checklist

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Prepared:** 2026-11-26  
**Status:** PREPARATION CHECKLIST — STAGING ENVIRONMENT NOT CONFIRMED — UAT NOT STARTED  
**Related:** `10-CUSTOMER-ADMIN-UAT-EXECUTION-PACK.md`, `11-PROVIDER-SANDBOX-VERIFICATION-PACK.md`

## 1. Purpose

Prepare a dedicated, isolated staging environment so authorized customer and administrator UAT can be performed without touching production data, real payments, real customer communications or production provider resources.

This checklist does not provision infrastructure or authorize deployment, provider configuration, data migration, database mutation, payment, email or WhatsApp sends. Those actions require the relevant owner authorization and access.

## 2. Minimum staging architecture

| Component | Required staging arrangement | Evidence before UAT |
|---|---|---|
| Frontend | Dedicated staging/preview deployment with clearly identifiable non-production hostname | URL, deployment ID and commit SHA |
| Backend API | Dedicated staging API deployment, not production API | Base URL and deployment/version record |
| Database | Separate staging database/cluster or isolated database with distinct credentials and network access | Database identity confirmation by authorized operator; do not paste URI or credentials into this document |
| Authentication | Synthetic customer and administrator accounts | Account owner confirms roles and login works |
| Payments | Razorpay test mode and test credentials only | Test-mode dashboard/config confirmation; no live key |
| Email/OTP | Brevo or approved test mail sink with verified test sender and controlled test recipient | Test delivery evidence; no real customer recipients |
| Media | Separate Cloudinary test folder/account or approved isolated test namespace | Test upload and delete evidence |
| Google OAuth | Dedicated test OAuth client with staging-only origins and callbacks | Approved client configuration evidence; no production client secrets |
| WhatsApp | Disabled by default; only a separately approved sandbox/test destination may be used | Legal/compliance, Meta and owner approvals plus explicit send authorization |
| Observability | Staging logs and error reporting with secrets and personal data redacted | Access owner and retention settings |
| Secrets | Staging-only secrets in the approved secret manager/deployment environment | Named custodian and access review; never commit secrets |

## 3. Environment isolation checks

Before any UAT execution, the authorized technical owner must record:

- [ ] Staging frontend hostname and deployment identifier.
- [ ] Staging backend API hostname and deployment identifier.
- [ ] Exact Git commit SHA deployed to both frontend and backend.
- [ ] Database/cluster and database name confirmed as non-production by an authorized operator.
- [ ] Staging credentials are distinct from production credentials.
- [ ] No production database URI, payment secret, OAuth secret, SMTP/Brevo key or Cloudinary secret is present in staging.
- [ ] CORS, cookie domain, SameSite and secure-cookie settings are appropriate for the staging host.
- [ ] Staging robots/no-index behavior is configured as intended and access is appropriately restricted.
- [ ] Synthetic test data only; no unapproved copy of real customer data.
- [ ] Backup/restore or reset procedure exists for staging test data.
- [ ] Outbound email and messaging are sinked/disabled unless specifically approved.
- [ ] Payment provider is in test mode and webhook endpoint points only to staging.
- [ ] Logs, screenshots and evidence storage do not expose credentials, OTPs, cookies, payment data or personal information.
- [ ] A named operator can stop the environment and respond to an incident.

**Fail closed:** If any environment variable, API hostname, database identity or provider mode is ambiguous, do not run UAT.

## 4. Safe provisioning sequence

1. Project owner names the technical staging operator and approves the intended hosting/account.
2. Operator creates or identifies isolated staging resources without changing production.
3. Operator deploys the approved candidate commit to staging using staging-only configuration.
4. Operator verifies frontend-to-backend connectivity and database identity without sharing secrets.
5. Operator configures synthetic customer/admin accounts and synthetic products/orders.
6. Operator confirms payment/email/media/OAuth sandbox separation. WhatsApp remains disabled unless its separate approval gates are complete.
7. QA performs a read-only smoke check first; only then may the owner authorize state-changing UAT cases in this isolated environment.
8. QA records results in the UAT execution pack, logs defects and retains sanitized evidence.
9. At the end, operator preserves required evidence, resets synthetic data if appropriate and disables temporary access/resources according to the approved plan.

## 5. Required owner decisions

| Decision | Required response | Current status |
|---|---|---|
| Staging hosting/account owner | Named owner and approved account | NOT PROVIDED |
| Staging frontend URL | Non-production URL | NOT PROVIDED |
| Staging backend URL | Non-production API URL | NOT PROVIDED |
| Database isolation operator | Named operator and confirmation method | NOT PROVIDED |
| UAT candidate commit | Exact SHA to deploy | NOT SELECTED |
| Customer/admin test identities | Synthetic accounts and responsible custodian | NOT PROVIDED |
| Provider sandbox custodians | Named owners for Razorpay, email, Cloudinary and OAuth | NOT PROVIDED |
| WhatsApp test policy | Legal/compliance and Meta approval plus explicit send authorization, or remain disabled | NOT APPROVED |
| QA/test window | Named testers and scheduled window | NOT SCHEDULED |
| Evidence repository | Approved restricted location and retention | NOT PROVIDED |
| Stop/escalation contact | Named technical owner | NOT PROVIDED |

## 6. UAT authorization record

No UAT execution is authorized by this checklist alone.

| Authorization | Name | Decision | Date/reference |
|---|---|---|---|
| Project/business owner authorizes isolated staging use | NOT PROVIDED | NOT APPROVED |
| Technical owner confirms environment isolation | NOT PROVIDED | NOT CONFIRMED |
| QA lead accepts entry criteria | NOT PROVIDED | NOT APPROVED |
| Business testers assigned | NOT PROVIDED | NOT ASSIGNED |
| Client representative approves UAT scope | NOT PROVIDED | NOT APPROVED |

## 7. Current conclusion

**Staging environment: NOT CONFIRMED. UAT: NOT STARTED.**

The repository contains a UAT execution pack, but no staging URL, isolated database confirmation, synthetic test accounts, provider sandbox evidence, tester assignments or execution authorization have been supplied or verified. The next safe action is for the project owner/technical operator to provide the non-secret staging details and complete the isolation checks. Do not send credentials or secret values through chat or commit them to the repository.

Passing staging UAT will be evidence for review; it will not automatically authorize production deployment, PR merge, live provider use or client acceptance.
