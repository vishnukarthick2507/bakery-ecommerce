# Operations, Deployment, Backup and Recovery Runbook

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Handover runbook template; production-specific values and execution evidence remain to be supplied  
**Prepared:** 2026-11-26

## 1. Scope and safety

This runbook describes a controlled release and recovery process for the Next.js frontend, Express backend, MongoDB database, and external integrations. It is not evidence that production is configured, backed up, monitored, or recoverable.

**Do not perform production deployment, database restore, index migration, payment, email, WhatsApp, or Cloudinary operations from this document without explicit owner approval and an approved change window.** Use staging and provider sandbox credentials for rehearsal.

## 2. System components

| Component | Current source-level design | Operational proof still required |
|---|---|---|
| Frontend | Next.js 16 / React 19; Vercel deployment integration | Production project, domain, environment values, deployment protection and rollback owner. |
| Backend | Express 5 + TypeScript | Hosting target, runtime version, start command, health URL, scaling and log retention. |
| Database | MongoDB / Mongoose | Production cluster, least-privilege DB user, network allowlist, backups, PITR/retention and restore test. |
| Payments | Razorpay | Live account ownership, webhook URL/secret, key rotation and sandbox-to-live approval. |
| Email | Brevo SMTP/API integration | Verified sender/domain, credentials, deliverability and failure alerting. |
| WhatsApp | Meta webhook / message integration | Business account/template approval, approved consent language, opt-out process and send authorization. |
| Media | Cloudinary | Production cloud/account, upload presets/signing, access policy and retention. |
| Identity | Customer/admin sessions and Google OAuth | OAuth origins/redirects, cookie domains/security, secret management and admin recovery procedure. |

## 3. Release readiness checklist

### Before staging release

- [ ] Confirm target branch, commit SHA, reviewer approval and PR merge authorization.
- [ ] Confirm CI passes for the exact candidate SHA; record workflow URL and job results.
- [ ] Run frontend and backend typechecks.
- [ ] Run backend unit/integration tests using isolated test databases.
- [ ] Run the full intended Playwright desktop/mobile suite, not only the narrow CI smoke spec.
- [ ] Build the frontend in production mode with non-production placeholder values where appropriate.
- [ ] Run dependency and secret scanning; triage findings.
- [ ] Verify staging environment variables are present without printing secret values.
- [ ] Verify staging database connectivity and required indexes using a read-only preflight.
- [ ] Verify payment provider sandbox, email test recipient, WhatsApp test number/template and Cloudinary test account only after approval.
- [ ] Run staging smoke tests for catalogue, registration/login, custom cake, checkout, payment sandbox, order tracking, admin operations and uploads.
- [ ] Record evidence, defects, owners and go/no-go decision.

### Before production release

- [ ] Named business owner approves release and change window.
- [ ] Named technical owner approves exact commit and rollback point.
- [ ] Production environment values have been reviewed and stored in the hosting secret manager; no secrets in Git.
- [ ] Domain, TLS, CORS, CSRF, cookie flags, trusted proxy and rate-limit topology are verified.
- [ ] Production database backup completed and restore point identified.
- [ ] Index/migration plan reviewed against actual production data; no automatic schema sync without approval.
- [ ] Payment/webhook/email/WhatsApp/OAuth provider settings and callbacks verified by authorized owners.
- [ ] WhatsApp consent wording, evidence, opt-out and template purpose are approved before automated customer sends.
- [ ] Monitoring, alerts, log access, incident contact and rollback operator are assigned.
- [ ] Client UAT completed, defects accepted/resolved, and written client sign-off received.

## 4. Deployment procedure (staging first)

1. Freeze the candidate commit SHA and PR.
2. Review the complete diff, dependency changes, environment-variable changes and migration/index implications.
3. Confirm CI checks correspond to that exact SHA.
4. Merge only after the authorized reviewer/owner approves; merging is not covered by this runbook's current authorization.
5. Deploy to staging using the hosting platform's approved workflow.
6. Confirm frontend and backend health endpoints and database connectivity.
7. Execute staging smoke tests and provider sandbox checks.
8. Record deployment URL, commit SHA, test evidence, timestamps and any known limitations.
9. Obtain release go/no-go from the named owner before any production deployment.

## 5. Health checks and monitoring

The source includes a backend root response and `/health` endpoint; the health response reports service and database connectivity. The repository health-check script is a limited smoke check of frontend homepage, backend root, backend health and DB connectivity. It does not prove checkout, payment, upload, notification or full customer journey health.

Production monitoring must additionally cover:

- HTTP error rate, latency, process restarts and resource saturation.
- MongoDB connectivity, connection pool saturation, slow queries and storage.
- Payment creation/verification/webhook failures and reconciliation backlog.
- Email and WhatsApp delivery/retry/failure rates (without exposing message content or PII in logs).
- Upload failures and provider quota/errors.
- Authentication failures, suspicious guest-order tracking attempts and rate-limit activity.
- Backup job success, backup age, restore-point availability and alert delivery.

Monitoring provider, thresholds, retention, escalation and owner are currently **not verified**.

## 6. Backup and restore procedure

### Backup policy fields requiring owner completion

| Control | Required value | Current evidence |
|---|---|---|
| Backup method | Atlas backup / snapshot / PITR selection | Not verified. |
| Frequency | Owner-approved schedule | Not supplied. |
| Retention | Daily/weekly/monthly retention | Not supplied. |
| Encryption and access | Encryption, key custody, least-privilege roles | Not verified. |
| Backup alerting | Failure notification destination/owner | Not supplied. |
| Recovery point objective (RPO) | Business-approved maximum data loss | Not supplied. |
| Recovery time objective (RTO) | Business-approved maximum outage | Not supplied. |
| Restore owner | Named technical owner | Not supplied. |
| Last successful restore test | Date, target, evidence and result | Not verified in this runbook. |

### Controlled restore rehearsal

1. Obtain written approval and choose an isolated restore target; never overwrite production for a rehearsal.
2. Identify the backup snapshot/point-in-time and record its timestamp and source cluster.
3. Restore into a separate, access-restricted environment using the provider's documented procedure.
4. Confirm database/collection availability and compare collection counts and representative records against approved expected values.
5. Verify indexes and schema compatibility; pay special attention to the Order model's unique+sparse `customCakeRequestId` index preflight note.
6. Run read-only application connectivity checks and approved staging smoke tests.
7. Record data-loss window, restore duration, discrepancies, evidence, operator and approver.
8. Destroy or retain the isolated restore environment according to the approved data-handling policy.

**A backup job reporting success is not proof of recoverability.** A successful restore test requires verified data and application-level read checks.

## 7. Rollback

- Identify the last known-good frontend and backend commit/deployment before release.
- Record database migration/index changes separately; application rollback does not automatically reverse data changes.
- If no database changes were made, redeploy the approved previous application release through the hosting platform.
- If data/schema changes were made, stop and follow the owner-approved forward-fix or restore decision. Do not improvise destructive rollback scripts.
- Verify health, login, catalogue, order read paths and provider webhook processing after rollback.
- Preserve logs and incident evidence; communicate status to the client and owner.

Rollback operator, decision authority and target commit are **not yet assigned in this document**.

## 8. Incident response

1. Triage severity and customer impact; preserve relevant logs and timestamps.
2. Contain compromised credentials or exposed endpoints through approved secret rotation/access controls.
3. For payment discrepancies, pause manual reconciliation changes and use provider dashboard/webhook evidence.
4. For messaging incidents, stop automated sends until consent/template/provider status is reviewed.
5. For data incidents, preserve database state and involve the authorized database owner before any repair.
6. Record timeline, scope, root cause, corrective action, customer communication and prevention work.

Do not put passwords, API keys, access tokens, OTPs, full payment data, or unnecessary customer PII in incident tickets.

## 9. Contacts and ownership — completion required

| Responsibility | Named owner / contact |
|---|---|
| Business owner / release approver | **Not supplied** |
| Technical owner / maintainer | **Not confirmed** |
| Hosting / Vercel administrator | **Not supplied** |
| MongoDB administrator / recovery owner | **Not supplied** |
| Razorpay account owner | **Not supplied** |
| Brevo email owner | **Not supplied** |
| Meta WhatsApp owner / consent approver | **Not supplied** |
| Cloudinary owner | **Not supplied** |
| Client UAT approver | **Not supplied** |
| Incident escalation contact | **Not supplied** |

## 10. Current known release gates

- The API security/documentation work is in draft PR #4 and is not merged.
- The configured Playwright CI job is narrower than a full desktop/mobile acceptance suite.
- External provider sandbox checks and production configuration are not verified by this runbook.
- WhatsApp legal consent wording and owner authorization remain outstanding; automated sends must remain fail-closed.
- Client UAT and written acceptance are not evidenced.
- Production deployment, live payments, real email/WhatsApp sends and production database operations have not been performed as part of this work.

## 11. Sign-off record

| Gate | Name | Date | Evidence / decision |
|---|---|---|---|
| Technical review | Pending | — | — |
| Security review | Pending | — | — |
| Staging acceptance | Pending | — | — |
| Backup restore rehearsal | Pending | — | — |
| Business release approval | Pending | — | — |
| Client UAT acceptance | Pending | — | — |
