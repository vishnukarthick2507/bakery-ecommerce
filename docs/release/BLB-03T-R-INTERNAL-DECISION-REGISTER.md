# BLB-03T-R — Internal Project Decision Register

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-21  
**Prepared by:** Internal project documentation pass (documentation-only; no code/operational changes)  
**Authority context:** The project is being managed internally as the project owner/development team. This register records internal recommendations/assessments only. It does **not** record external client sign-off, does **not** authorize operational execution, and does **not** change release status.

## 1. Purpose

BLB-03R found no formal approval evidence in inspected repository documentation. BLB-03S packaged 19 owner decision requests. BLB-03T confirmed no completed owner responses were available. This BLB-03T-R register re-evaluates those decisions as internal project-team decisions/planning assessments, based on existing requirements, implementation, security remediation, and UAT evidence.

## 2. Decision principles and classification rules

| Classification | Meaning |
|---|---|
| **INTERNAL DECISION** | Project team can decide based on existing requirements/evidence; still requires documented confirmation and does not authorize execution by itself. |
| **TECHNICAL REVIEW REQUIRED** | More investigation/evidence needed before a safe decision. |
| **OPERATIONAL AUTHORIZATION REQUIRED** | A separately controlled operation needs explicit authorization, window, operator, rollback, and evidence capture. |
| **EXTERNAL ACCESS/PERMISSION REQUIRED** | Requires access/permission from external account/infrastructure owner (DNS/WAF/CDN/cloud/provider/account owner). |
| **DEFERRED** | Insufficient evidence or unresolved risk; keep gate open. |

**Mandatory rules:**
- Internal decision ≠ execution authorization.
- Plan approval ≠ execution authorization.
- UAT approval ≠ production approval.
- No operational work is authorized by this document.
- **CURRENT RELEASE STATUS: NOT READY**.

## 3. Evidence base inspected

- `docs/release/BLB-03S-OWNER-DECISION-REQUEST.md`
- `docs/release/BLB-03U-STEP7B-RELEASE-GATE-TRACKER.md`
- `docs/uat/BLB-03-UAT-RESULTS.md`
- `docs/uat/BLB-03-UAT-TEST-PLAN.md`
- `docs/uat/BLB-03-TEST-DATA-PLAN.md`
- `docs/UAT_SAFE_MODE.md`
- `docs/security/BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md`
- `docs/release/BLB-03S-RELEASE-READINESS.md`
- `docs/CLIENT_HANDOVER_STATUS.md`
- Targeted code/model inspection: `backend/src/models/CustomCakeSubmissionIdempotency.ts` (idempotencyKey unique, expiresAt TTL index), existing S07/S04/S05/S06 reports and controller evidence previously inspected in Step 7A.

## 4. Decision-by-decision register

| Field | Description |
|---|---|
| Decision ID | Original identifier |
| Requirement | Exact/faithful documented requirement |
| Evidence | Source docs/implementation evidence |
| Internal recommendation | Recommended decision (not approval) |
| Rationale | Why appropriate |
| Risk | Remaining risk/limitation |
| Classification | Internal / Technical / Operational / External / Deferred |
| Execution authorization | Not authorized unless separately approved |
| Next action | Concrete next step |
| Status | Pending review / Recommended / Deferred |

### Decision 1 — BLB-03M / AP-01: Guest checkout Customer details Continue

| Field | Assessment |
|---|---|
| Decision ID | BLB-03M / AP-01 |
| Requirement | Exact Option A/B from `docs/uat/BLB-03-UAT-RESULTS.md`: **A** = Require guest name, valid email, and phone before progression from Customer details to fulfilment, with field-specific validation errors at step 1 (Continue). **B** = Allow progression after phone validation (current step-1 behavior), with guest name/email enforced during final order placement (client-side final validation) and backend validation (authoritative). |
| Evidence | `BLB-03-UAT-RESULTS.md` BLB-03M record (L570-585); observed behavior: step-1 Continue validates phone only; `handlePlaceOrder()` and backend enforce guest name/email/phone before order creation. Final/backend protections exist; step-1 UX feedback for guest name/email incomplete. No checkout behavior modified in prior milestones. |
| Internal recommendation | **Recommend Option A** (internal product-quality recommendation), subject to internal confirmation before any code change. |
| Rationale | Option A aligns step-1 UX with existing final/backend rules, gives earlier field-specific feedback, reduces avoidable late-step failure, and preserves existing authoritative backend validation. Option B is functionally safe but leaves known UX inconsistency documented in UAT. |
| Risk | Any checkout change can regress guest flow; requires focused frontend/e2e regression and browser verification. Must not weaken backend/final validation. Current release has no approved implementation window. |
| Classification | **INTERNAL DECISION** (product/UX) + **OPERATIONAL AUTHORIZATION REQUIRED** before implementation/testing/deploy. |
| Execution authorization | **Not authorized.** No code change, test-change deployment, or UAT execution authorized by this recommendation. |
| Next action | Internally confirm Option A/B; if A selected, create separate approved implementation+regression task; update decision record with explicit internal approver/date/evidence. |
| Status | **Recommended (Option A) — pending internal confirmation** |

### Decision 2 — AP-02: Synthetic customer and admin access

| Field | Assessment |
|---|---|
| Decision ID | AP-02 |
| Requirement | Permission to provision/use designated UAT-only synthetic customer and admin identities and to receive/use credentials securely out-of-band for authorized testing. Synthetic/non-real identities only; least privilege; no credential exposure in chat/repo/screenshots/logs; no credential reset/change/inspection beyond approved scope. |
| Evidence | `BLB-03-UAT-RESULTS.md` AP-02; UAT plan/results show blocked CUST/ADM flows needing synthetic credentials; `docs/UAT_SAFE_MODE.md` and security controls require no secret exposure. |
| Internal recommendation | **Recommend approving a controlled synthetic-access policy** (UAT-only, least privilege, out-of-band credentials, named testers, no real customer data), with separate execution authorization for actual provisioning. |
| Rationale | Required for CUST/ADM UAT coverage; safe if isolated to UAT, synthetic identities, secure delivery, and cleanup. |
| Risk | Credential leakage, over-privileged admin access, accidental use in wrong environment. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED** for provisioning/use. |
| Execution authorization | **Not authorized.** No account/credential creation or use authorized. |
| Next action | Draft synthetic identity/access matrix and secure out-of-band delivery procedure; obtain separate execution authorization before provisioning. |
| Status | **Recommended** |

### Decision 3 — AP-03: Isolated UAT database write permissions

| Field | Assessment |
|---|---|
| Decision ID | AP-03 |
| Requirement | Permission for specific, controlled DB writes on `127.0.0.1:27018/bluebell_whatsapp_uat` only for approved UAT activities. Explicit collections/records/actions/time window; no 27017, no 27019 app use, no Atlas/prod; no ad-hoc writes; rollback/cleanup required per AP-04. |
| Evidence | AP-03 register; `docs/UAT_SAFE_MODE.md`; BLB-03R/7B tracker constraints. |
| Internal recommendation | **Recommend approving a narrowly scoped UAT-only DB write policy** for explicitly listed collections/actions/windows, with pre/post evidence and cleanup. Separate execution authorization required per run. |
| Rationale | Controlled UAT writes are necessary for blocked workflows; strict target/isolation limits blast radius. |
| Risk | Wrong DB target, data contamination, incomplete cleanup, accidental prod/restore-target use. Any deviation from 127.0.0.1:27018/bluebell_whatsapp_uat is unacceptable. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No DB connection/write/migration/index op authorized. |
| Next action | Prepare per-scenario write manifest (collections/actions/window/rollback owner) for future authorized UAT runs. |
| Status | **Recommended** |

### Decision 4 — AP-04: Synthetic data provisioning and cleanup

| Field | Assessment |
|---|---|
| Decision ID | AP-04 |
| Requirement | Permission to provision required synthetic data/accounts/orders/requests and to perform approved cleanup/restore actions. Minimum necessary synthetic data only; documented before/after state; approved cleanup/retention; no real customer/production data. |
| Evidence | AP-04; `docs/uat/BLB-03-TEST-DATA-PLAN.md`; UAT results blocked workflows. |
| Internal recommendation | **Recommend adopting a synthetic-data lifecycle policy**: manifest before run, synthetic-only data, before/after snapshots/evidence, cleanup/rollback after run, retention limit, no real PII. |
| Rationale | Enables repeatable UAT and prevents test-data contamination. |
| Risk | Residual test data, incomplete cleanup, accidental real data use. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No provisioning/cleanup execution authorized. |
| Next action | Create execution-ready provisioning/cleanup checklist tied to AP-03 scope and approved UAT scenarios. |
| Status | **Recommended** |

### Decision 5 — AP-05: Registration and OTP testing policy

| Field | Assessment |
|---|---|
| Decision ID | AP-05 |
| Requirement | Define approved policy for CUST-11 registration/OTP (and any OTP-dependent guest verification if in scope): approved secure non-bypass UAT-safe mechanism or formal deferral/out-of-scope. No real OTP/email/WhatsApp to real recipients; no auth bypass/hardcoded OTP; no secret/token exposure; compliant with UAT_SAFE_MODE. |
| Evidence | AP-05; `docs/UAT_SAFE_MODE.md`; S02 remediation (no OTP disclosure, UAT suppression/fail-closed behavior); UAT results CUST-11 blocked. |
| Internal recommendation | **Recommend a non-bypass, UAT-safe OTP test policy**: isolated UAT only, `UAT_SAFE_MODE=true`, no real external email/OTP delivery, no OTP plaintext exposure, no hardcoded/bypass OTP. Acceptable evidence limited to safe-mode observable behavior/logs/state permitted by existing implementation; if implementation cannot provide sufficient safe evidence, formally defer CUST-11 scope rather than weakening safeguards. |
| Rationale | Preserves S02/UAT Safe Mode security properties while allowing controlled assessment where possible. |
| Risk | CUST-11 may remain partially non-executable without a safe verification mechanism; any bypass would create security regression. |
| Classification | **INTERNAL DECISION** + **TECHNICAL REVIEW REQUIRED** (confirm exact safe evidence path supported by current implementation) + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No OTP testing, account creation, or provider operations authorized. |
| Next action | Technical review of current CUST-11 safe-mode observability; document permissible evidence or formal deferral scope before UAT. |
| Status | **Recommended with technical review** |

### Decision 6 — AP-06: Guest checkout order submission

| Field | Assessment |
|---|---|
| Decision ID | AP-06 |
| Requirement | Permission to execute CUST-10 order submission/order-creation steps in isolated UAT under approved safe conditions. Authorized scenarios/data only; no real customer details; no real payment transactions/provider side effects; controlled DB writes and cleanup per AP-03/AP-04. |
| Evidence | AP-06; CUST-10 runbook in UAT results; UAT Safe Mode; BLB-03M pending decision impact. |
| Internal recommendation | **Recommend a limited internal UAT plan** for CUST-10 after BLB-03M decision, AP-02/03/04/05/07/10 dependencies, and safe payment/verification path are resolved. Permitted scenario: synthetic cart/guest data, isolated UAT DB, no real payment/provider contact, no real customer details, controlled write+cleanup. |
| Rationale | Needed for end-to-end checkout confidence; can be bounded by existing safe-mode constraints. |
| Risk | Unintended writes/provider side effects if run outside controls; BLB-03M UX affects expected behavior. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No order submission/UAT execution authorized. |
| Next action | Finalize CUST-10 scenario sheet with BLB-03M outcome, dependency checklist, and rollback/cleanup evidence template. |
| Status | **Recommended (blocked by dependencies)** |

### Decision 7 — AP-07: Payment testing restrictions

| Field | Assessment |
|---|---|
| Decision ID | AP-07 |
| Requirement | Confirm permitted payment-safe verification scope (no live Razorpay ops/webhooks/captures, no real transactions, no claims of real verified payment). UAT_SAFE_MODE constraints enforced; UI/state inspection and approved safe behavior only; no external payment provider contact. |
| Evidence | AP-07; `docs/UAT_SAFE_MODE.md`; UAT test plan SAFE cases; payment controllers/routes exist but live verification is out of scope. |
| Internal recommendation | **Recommend approving strict payment-safe scope only**: UI/state/config inspection and safe-mode behavior verification; no live Razorpay order creation/capture/webhook/settlement; no real transactions; no "real payment verified" claims. |
| Rationale | Preserves financial/provider safety while allowing limited UAT confidence. |
| Risk | Limited payment confidence until separately authorized controlled integration testing; false confidence if evidence wording is sloppy. |
| Classification | **INTERNAL DECISION**. |
| Execution authorization | **Not authorized.** No payment operations authorized. |
| Next action | Add payment-safe evidence wording checklist to UAT runbooks; confirm any allowed non-live scenarios with technical review. |
| Status | **Recommended** |

### Decision 8 — AP-08: Custom cake submission and media policy

| Field | Assessment |
|---|---|
| Decision ID | AP-08 |
| Requirement | Permission/scope for CUST-14 submission and media/upload handling under Safe Mode. No unintended external Cloudinary uploads/deletes; no false-success reporting; DB writes/cleanup controlled; synthetic inputs only. |
| Evidence | AP-08; S07 remediation/design/report; custom-cake honeypot/idempotency tests; UAT safe mode. |
| Internal recommendation | **Recommend a limited CUST-14 UAT policy**: isolated UAT DB only, synthetic inputs, no real customer PII, no external Cloudinary side effects, no false-success reporting, controlled cleanup. Media tests only if a safe non-external path is confirmed; otherwise defer media upload portion. |
| Rationale | S07 hardened submission path, but media/provider and DB-write safety still need controlled scope. |
| Risk | Unintended external upload/delete, data residue, or over-claiming coverage if media path not safely isolated. |
| Classification | **INTERNAL DECISION** + **TECHNICAL REVIEW REQUIRED** (media-safe path) + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No submission/upload/UAT execution authorized. |
| Next action | Technical review of custom-cake media/upload behavior under UAT Safe Mode; define allowed/deferred media cases. |
| Status | **Recommended with technical review** |

### Decision 9 — AP-09: Admin workflow testing scope

| Field | Assessment |
|---|---|
| Decision ID | AP-09 |
| Requirement | Approve which ADM-01–ADM-13 workflows/actions are in scope and permitted mutation level. Least privilege; per-workflow authorization; settings/inventory/order-status/product changes require explicit scope and rollback; no unauthorized exposure. |
| Evidence | AP-09; UAT test plan ADM-01–13; UAT results blocked; admin auth/S05 controls. |
| Internal recommendation | **Recommend phased ADM scope**: Phase A read-only/admin-auth/authorization checks (ADM-01,02,03,07,09,11,12 as safe/readable); Phase B controlled mutations (ADM-04,05,06,08,10,13) only with explicit per-workflow mutation approval, rollback, and evidence. |
| Rationale | Reduces risk by separating read-only verification from mutating admin actions. |
| Risk | Mutating admin tests can alter settings/inventory/order state; WhatsApp Centre/outbox views may be misinterpreted without AP-10 boundaries. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No admin account creation/workflow execution authorized. |
| Next action | Produce ADM scenario matrix with mutation level, rollback, and evidence per case. |
| Status | **Recommended** |

### Decision 10 — AP-10: Notification and WhatsApp suppression expectations

| Field | Assessment |
|---|---|
| Decision ID | AP-10 |
| Requirement | Confirm expected handling/evidence for suppressed email/OTP/WhatsApp/outbox behavior in UAT Safe Mode. Suppressed deliveries must not be claimed sent/delivered; no real recipients contacted; live webhooks blocked; monitoring reflects stored/suppressed state. |
| Evidence | AP-10; `docs/UAT_SAFE_MODE.md`; S02/S05/S06/S07 remediations and reports. |
| Internal recommendation | **Recommend adopting strict suppression interpretation policy**: all UAT evidence must label suppressed/blocked/not-sent states explicitly; no real email/OTP/WhatsApp/provider contact; no "delivered/sent externally" claim unless separately authorized live environment evidence exists. |
| Rationale | Prevents false pass results and protects against accidental external communications. |
| Risk | Testers may misread stored/suppressed records as sent without clear evidence rules. |
| Classification | **INTERNAL DECISION**. |
| Execution authorization | **Not authorized.** No provider calls/webhook operations authorized. |
| Next action | Include suppression-evidence checklist in CUST/ADM runbooks and defect triage template. |
| Status | **Recommended** |

### Decision 11 — S07 UAT idempotency index rollout

| Field | Assessment |
|---|---|
| Decision ID | Decision 11 (S07 UAT index rollout) |
| Requirement | UAT-only index rollout proposal covering unique `idempotencyKey` index; TTL `expiresAt` index with `expireAfterSeconds: 0`; duplicate/conflicting record prechecks; backup and rollback; verification evidence. Plan approval separate from execution authorization. |
| Evidence | `backend/src/models/CustomCakeSubmissionIdempotency.ts` (idempotencyKey unique/indexed; expiresAt required with `index: { expires: 0 }`); S07 design/report; Step 7A/7B tracker; target constraints 127.0.0.1:27018 / bluebell_whatsapp_uat. |
| Internal recommendation | **Recommend approving the UAT rollout plan only**, not execution. Plan: precheck indexes/duplicates/invalid expiresAt; backup/restore point; create/verify unique `idempotencyKey` and TTL `expiresAt` (`expireAfterSeconds:0`); capture before/after evidence; rollback plan documented. |
| Rationale | S07 correctness depends on DB-enforced uniqueness/TTL in real environments; UAT-first reduces risk. |
| Risk | Duplicate existing keys block unique index; wrong target/environment; rollback complexity; execution without approval. |
| Classification | **INTERNAL DECISION** (plan) + **OPERATIONAL AUTHORIZATION REQUIRED** (execution). |
| Execution authorization | **Not authorized.** No MongoDB connection/index creation/modification/verification on any DB authorized. |
| Next action | Prepare a separate UAT execution authorization record (operator, window, backup, prechecks, commands, rollback, evidence). |
| Status | **Recommended for plan only** |

### Decision 12 — S07 production idempotency index rollout

| Field | Assessment |
|---|---|
| Decision ID | Decision 12 (S07 production index rollout) |
| Requirement | Separate production readiness assessment. Do not reuse UAT authorization. Keep production index operations deferred until a separate production authorization and controlled change plan exist. |
| Evidence | S07 report/design/Step 7A state code-level only; BLB-03R/7B separate UAT/prod requirement. |
| Internal recommendation | **Defer production execution**. Recommend preparing a production-specific plan only after UAT index rollout evidence, compatibility checks, and release readiness review. |
| Rationale | Production change requires separate risk window, backup/rollback, and deployment/change control. |
| Risk | Premature prod change, insufficient rollback, unverified data conflicts. |
| Classification | **OPERATIONAL AUTHORIZATION REQUIRED** + **DEFERRED** for execution. |
| Execution authorization | **Not authorized.** No production DB/index operation authorized. |
| Next action | After any separately authorized UAT rollout and evidence review, draft prod-specific change plan for separate approval. |
| Status | **Deferred** |

### Decision 13 — Origin/Referer compatibility

| Field | Assessment |
|---|---|
| Decision ID | Decision 13 |
| Requirement | Review S07 design/reports. Recommend enforce, defer or investigate further, with compatibility and risk rationale. Do not change enforcement. |
| Evidence | S07 design/report: Origin/Referer enforcement deferred; S07/P5 controls active; Step 7A residual risk notes browser/client compatibility concern. |
| Internal recommendation | **Investigate further, then enforce after compatibility testing**. Default until evidence: defer enforcement with documented risk acceptance, not silent omission. |
| Rationale | Enforcement can reduce CSRF-like cross-origin abuse but may break legitimate clients/proxies if not compatibility-tested. |
| Risk | If deferred: residual abuse surface remains. If enforced without testing: false rejects for legitimate traffic. |
| Classification | **TECHNICAL REVIEW REQUIRED** + **INTERNAL DECISION** pending evidence. |
| Execution authorization | **Not authorized.** No enforcement/config/code change authorized. |
| Next action | Inventory legitimate origins/clients/proxy behaviors for custom-cake/public endpoints; run compatibility test plan in approved environment before any enforcement decision. |
| Status | **Pending review** |

### Decision 14 — WAF/CDN/trusted-proxy verification

| Field | Assessment |
|---|---|
| Decision ID | Decision 14 |
| Requirement | Identify deployment topology evidence required. Classify which checks can be done through repository inspection and which require infrastructure access. Do not change infrastructure. |
| Evidence | Step 7A/7B residuals: process-local rate limits, `trust proxy` dependency; no deployed topology verification. |
| Internal recommendation | **Recommend an operational topology review only** (no infra changes). Repo-inspectable: app trust proxy setting, rate-limit key logic, route exposure assumptions. Infra-required: CDN/WAF rules, real client IP propagation, TLS/edge config, rate limiting/bot controls, logging/retention. |
| Rationale | S03/S05/S07 controls depend partly on deployment topology; local code pass is insufficient. |
| Risk | Incorrect client IP attribution or missing edge protections in production. |
| Classification | **EXTERNAL ACCESS/PERMISSION REQUIRED** (infra) + **OPERATIONAL AUTHORIZATION REQUIRED** (review execution). |
| Execution authorization | **Not authorized.** No infrastructure change or live production modification authorized. |
| Next action | Request/prepare topology evidence checklist for infra owner; schedule read-only review after access/approval. |
| Status | **Pending review** |

### Decision 15 — Accessibility/browser smoke testing

| Field | Assessment |
|---|---|
| Decision ID | Decision 15 |
| Requirement | Define browser/accessibility test scope based on existing frontend and UAT requirements. Identify required evidence. Do not claim manual testing completed. |
| Evidence | Step 7A/7B note no manual a11y/browser smoke; S07 added honeypot a11y attrs; UAT flows include checkout/custom-cake/admin. |
| Internal recommendation | **Recommend scoped smoke test plan**: keyboard navigation, focus order, labels/errors, screen-reader spot checks, autofill behavior on custom-cake honeypot, responsive checks on checkout/custom-cake/admin login/key flows. Browsers: latest Chrome/Edge + one Firefox/Safari where available (exact matrix to confirm by team capability). |
| Rationale | S07 and checkout/admin changes carry UX/a11y regression risk not covered by local unit tests. |
| Risk | Untested a11y regressions, especially hidden honeypot interactions and form error handling. |
| Classification | **INTERNAL DECISION** (scope) + **OPERATIONAL AUTHORIZATION REQUIRED** (execution). |
| Execution authorization | **Not authorized.** No manual testing claimed or authorized as completed. |
| Next action | Confirm supported browser/device matrix and execute approved smoke pass with evidence capture. |
| Status | **Recommended** |

### Decision 16 — Synthetic UAT data and credentials

| Field | Assessment |
|---|---|
| Decision ID | Decision 16 |
| Requirement | Prepare proposed provisioning, secure delivery, access and cleanup policy. Keep real customer data and credentials out of UAT process. Do not create accounts or credentials. |
| Evidence | AP-02/03/04; `docs/uat/BLB-03-TEST-DATA-PLAN.md`; `docs/UAT_SAFE_MODE.md`. |
| Internal recommendation | **Recommend internal policy**: synthetic-only dataset; named-role accounts; credentials generated and delivered out-of-band via approved secure channel; no secrets in repo/chat/tickets/screenshots; least privilege; cleanup/retention log; immediate revocation/rotation after UAT window. |
| Rationale | Required for UAT while minimizing security/privacy exposure. |
| Risk | Credential mishandling or residual test data if policy not followed. |
| Classification | **INTERNAL DECISION** + **OPERATIONAL AUTHORIZATION REQUIRED**. |
| Execution authorization | **Not authorized.** No account/credential/data creation authorized. |
| Next action | Approve policy and create controlled provisioning/cleanup runbook before any UAT. |
| Status | **Recommended** |

### Decision 17 — Customer UAT (CUST-10–CUST-14)

| Field | Assessment |
|---|---|
| Decision ID | Decision 17 |
| Requirement | Review CUST-10–14. Define prerequisites, test boundaries, expected results and evidence. Keep execution pending until isolated UAT prerequisites are satisfied. |
| Evidence | `BLB-03-UAT-TEST-PLAN.md`, `BLB-03-UAT-RESULTS.md` (CUST-10-14 blocked), AP dependencies, UAT Safe Mode. |
| Internal recommendation | **Recommend conditional internal approval for scoped CUST-10–14 execution only after prerequisites**: BLB-03M decision, AP-02–08/10 as applicable, isolated UAT 127.0.0.1:27018/bluebell_whatsapp_uat, `UAT_SAFE_MODE=true`, synthetic data/creds, no real provider/customer operations, evidence+cleanup. |
| Rationale | Required for release confidence; currently blocked by prerequisites, not by lack of test cases. |
| Risk | Executing before prerequisites can create invalid evidence or safety incidents. |
| Classification | **INTERNAL DECISION** (scope/readiness) + **OPERATIONAL AUTHORIZATION REQUIRED** (execution). |
| Execution authorization | **Not authorized.** No UAT execution authorized. |
| Next action | Build CUST execution gate checklist; obtain separate execution authorization when all prerequisites satisfied. |
| Status | **Recommended (execution blocked)** |

### Decision 18 — Admin UAT (ADM-01–ADM-13)

| Field | Assessment |
|---|---|
| Decision ID | Decision 18 |
| Requirement | Review ADM-01–13. Define prerequisites, admin access restrictions, test boundaries and evidence. Keep execution pending until isolated UAT prerequisites are satisfied. |
| Evidence | `BLB-03-UAT-TEST-PLAN.md`, `BLB-03-UAT-RESULTS.md` (ADM-01-13 blocked), AP-02/03/04/09/10, S05 admin alert controls. |
| Internal recommendation | **Recommend conditional internal approval for scoped ADM-01–13 execution only after prerequisites**: secure admin/synthetic credentials, AP-09 scope, AP-03/04 write/cleanup where mutating, AP-10 suppression boundaries, isolated UAT + Safe Mode, rollback for mutating cases. |
| Rationale | Admin flows are release-critical but include mutating/high-impact actions. |
| Risk | Unauthorized mutation/data exposure if scope/rollback is unclear. |
| Classification | **INTERNAL DECISION** (scope/readiness) + **OPERATIONAL AUTHORIZATION REQUIRED** (execution). |
| Execution authorization | **Not authorized.** No UAT execution authorized. |
| Next action | Create ADM case-by-case mutation/rollback matrix; obtain separate execution authorization. |
| Status | **Recommended (execution blocked)** |

### Decision 19 — Production release Go/No-Go

| Field | Assessment |
|---|---|
| Decision ID | Decision 19 |
| Requirement | Define objective release criteria. Include security verification; database/index verification; customer and admin UAT evidence; operational verification; regression results; deployment and rollback readiness; explicit release authorization. Do not approve production release in this milestone. |
| Evidence | BLB-03S release readiness NOT READY; Step 7A NOT READY for release; BLB-03R/7B tracker gates; S07 index code-level only. |
| Internal recommendation | **NO-GO (current state).** Recommend production release only after all required gates are closed with evidence: AP/BLB-03M decisions resolved, S07 UAT+prod index rollout verified, CUST-10-14 and ADM-01-13 completed with evidence, WAF/proxy/origin/a11y/ops verification complete, regression evidence green, deployment/rollback/runbook and explicit release authorization recorded. |
| Rationale | Local security verification is necessary but insufficient for production readiness. |
| Risk | Releasing now would bypass UAT, index rollout verification, operational controls, and approval gates. |
| Classification | **INTERNAL DECISION** (current NO-GO recommendation) + **OPERATIONAL AUTHORIZATION REQUIRED** for any future release. |
| Execution authorization | **Not authorized.** No production release/deployment authorized. |
| Next action | Use tracker as gate checklist; re-evaluate Go/No-Go only after evidence-complete gate closure. |
| Status | **Recommended (NO-GO currently)** |

## 5. S05 documentation discrepancy

**Finding (retained):** `docs/security/BLB-03U-S05-REMEDIATION-DESIGN.md` was not found during Step 7A/7B and remains missing.

**Evidence present:** `BLB-03U-S05-READ-ONLY-ASSESSMENT.md`, `BLB-03U-S05-REMEDIATION-REPORT.md`, BLB-03T S05 section, S05 code/tests (`backend/src/services/emailService.ts`, `backend/tests/emailService.adminLoginAlert.test.ts`, related auth routes/controllers).

**Internal recommendation:** **Accept the gap as a documented provenance issue, but commission a clearly labeled reconstruction** if the team wants a complete audit trail. Do **not** fabricate a historical design doc or backdate it as original. If reconstructed, label as "reconstructed from assessment/report/code/tests on <date>" and include evidence sources and unknowns.

**Status:** Recommended (documentation decision pending internal confirmation).

## 6. Current release status

**CURRENT RELEASE STATUS: NOT READY**

Security remediation S01–S07 is locally verified, but operational UAT, index rollout authorization/verification, infrastructure/compatibility verification, accessibility/browser smoke evidence, and production release criteria remain outstanding. This register provides internal recommendations only; it does not authorize execution.

## 7. Operational actions still prohibited (this milestone)

- No MongoDB connections/reads/writes/index create/drop/modify/migrations.
- No UAT execution; no customer/admin account creation; no synthetic/real order or custom-cake submission.
- No email/OTP/WhatsApp/Razorpay/Cloudinary/external provider calls.
- No service start/stop/restart; no frontend/backend deployment.
- No env/config/dependency/source/test changes.
- No Git mutations.

## 8. Recommended next milestone

**BLB-03U-R / Controlled UAT Readiness Planning** (documentation + approval packaging, still no execution): confirm internal decisions for BLB-03M and AP scope; create execution-ready but unauthorized runbooks/checklists for S07 UAT index plan, CUST-10-14, ADM-01-13, and evidence capture; resolve S05 provenance-doc decision; then seek/record explicit operational execution authorization before any UAT/index work.