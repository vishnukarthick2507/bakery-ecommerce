# 05 — Technical Decisions

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-09B — Group 4  
**Status:** COMPLETE (D-11, D-12, D-13, D-S05, D-15 recorded)

## D-11 — UAT database index precheck/rollout authorization (S07 idempotency indexes)

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Any future D-11 operation must target exactly `127.0.0.1:27018/bluebell_whatsapp_uat`. `UAT_SAFE_MODE=true` must be independently verified before any operation. Access to MongoDB ports 27017 and 27019, MongoDB Atlas and all production databases is strictly prohibited. A verified backup must exist before any database write or index creation. A named operator, documented operation scope, precheck results, rollback plan, stop conditions and audit evidence are mandatory. Only synthetic/non-production UAT data may be involved. No real customer data or external provider operations are permitted. Every database operation requires separate, explicit operation-specific execution authorization under Group 5. Any environment mismatch, failed safety check, missing backup or unexpected database state must stop the operation immediately. |
| Classification | PROJECT_OWNER_DECISION — technical/governance decision only. This does not authorize database access, prechecks, index creation, rollout, testing, UAT execution, production database operations or production release. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## D-12 — Production database index rollout authorization (S07 idempotency indexes)

| Field | Value |
|---|---|
| Decision | **DEFER** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions / Rationale | Defer production index rollout until D-11 UAT precheck and rollout have been separately authorized, executed and supported by acceptable evidence. D-14 infrastructure and operational ownership evidence must be resolved. Verified production backup, rollback plan, monitoring arrangements and approved maintenance window are mandatory prerequisites. A named operator and documented production operation scope must be established. Separate, explicit production database execution authorization is mandatory before any production database operation. No production database access, index creation, rollout or verification is authorized by this decision. Any future production operation must undergo a fresh readiness assessment and operation-specific authorization. |
| Classification | PROJECT_OWNER_DECISION — production database governance decision only; NOT production DB execution authorization, deployment authorization or production release authorization. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## D-13 — Rollback / stop conditions / go-no-go criteria for future UAT or release operations

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | Every future operation must have a documented and approved scope, named operator, precheck checklist, applicable verified backup, rollback plan, stop conditions and explicit go/no-go criteria. Immediate STOP is mandatory if: environment, database target or operation scope does not match the authorization; required safety settings, including UAT_SAFE_MODE=true for applicable UAT DB operations, cannot be independently verified; a required backup is missing, invalid or cannot be verified; unexpected database state, data-integrity concern or unauthorized write is detected; secrets, OTPs, access tokens or real customer personal information are exposed; there is any risk of contacting real customers or triggering unauthorized external notifications; provider sandbox configuration cannot be verified; a critical security, validation or authorization control fails; or the named operator, approved scope or required authorization is absent. Rollback or an approved recovery procedure is mandatory when an operation produces an unauthorized change, failed verification, data-integrity concern or result outside its approved scope. Preserve evidence and do not attempt unapproved recovery actions. NO-GO applies whenever a required approval, execution authorization, safety check, backup, rollback plan, evidence item or acceptance criterion is missing or failed. Any scope change, environment change or deviation requires a fresh assessment and separate explicit authorization before proceeding. Record operation results, stop events, rollback/recovery actions and evidence in an auditable record. No operation may continue merely because a previous decision or conditional approval exists. Operation-specific execution authorization remains mandatory. |
| Classification | PROJECT_OWNER_DECISION — operational safety and governance policy only. This does NOT authorize source-code changes, tests, database access or writes, provider calls, UAT execution, deployment, production operations or production release. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## D-S05 — S05 WhatsApp consent/compliance implementation sequencing

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | W01 business-policy conditions must be preserved: Transactional WhatsApp order updates only; Explicit customer opt-in is mandatory; Marketing remains disabled by default and requires separate consent; Unknown or historical consent must be treated as no consent unless auditable evidence proves otherwise; STOP and support-channel withdrawal requests must be honoured; Auditable consent history must be maintained. Formal legal/compliance validation and approval of the consent wording, capture process, purpose, retention, withdrawal handling and applicable regulatory requirements are mandatory before implementation. Consent-state handling, opt-in/opt-out behaviour, suppression rules, audit history and notification boundaries must be documented and approved before implementation. D-14 infrastructure, provider ownership and operational evidence must be resolved wherever applicable to the proposed implementation. A documented implementation scope, acceptance criteria, security review and testing plan must be prepared and reviewed. S05 implementation must remain BLOCKED until all mandatory prerequisites are evidenced and independently verified. Separate, explicit Group 5 source-code implementation and any other relevant operation-specific execution authorization must be obtained before work begins. This decision does not constitute legal/compliance approval, provider authorization, UAT authorization, deployment authorization or production release authorization. |
| Classification | PROJECT_OWNER_DECISION — implementation sequencing and governance policy only; NOT legal approval or execution authorization. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |

## D-15 — Release readiness / go-live criteria and final approval boundary

| Field | Value |
|---|---|
| Decision | **APPROVE WITH CONDITIONS** |
| Approver | Project Owner |
| Date | 21 November 2026 |
| Conditions | All critical and high-priority release blockers must be closed or formally dispositioned, with objective evidence and independent verification. W01 legal/compliance validation and consent implementation requirements must be completed and approved by the appropriate legal/compliance authority. D-14 infrastructure, provider ownership, operational responsibility, security configuration, backup and recovery evidence must be verified. Required customer and admin UAT must be separately authorized, executed in the approved isolated environment, and supported by documented results and acceptance evidence. S07 UAT database index verification and any required rollout must be separately authorized and completed with acceptable evidence. Production database rollout remains subject to D-12 prerequisites and separate production DB authorization. Payment, OTP, WhatsApp, email, notification suppression, consent, security and access-control requirements must pass their applicable verification criteria. Deployment and operational readiness must include named owners, monitoring, incident response, approved runbooks, verified backups, rollback procedures and an approved go-live window. All acceptance criteria, unresolved risks, deviations and stakeholder decisions must be documented and reviewed. Any failed mandatory criterion, missing evidence, unresolved critical blocker or safety-control failure results in NO-GO. Final production release requires a separate, explicit D-19 production release decision and operation-specific authorization. This D-15 decision must never be interpreted as release approval. |
| Classification | PROJECT_OWNER_DECISION — release-readiness governance and go-live criteria only. It does NOT authorize source-code changes, testing, UAT, database operations, provider calls, deployment, production operations or production release. |
| Evidence | BLB-09B chat decision capture (2026-11-21) |