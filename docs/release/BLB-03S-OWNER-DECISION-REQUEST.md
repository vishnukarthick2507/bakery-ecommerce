# BLB-03S — Owner Decision Request Package

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Document date:** 2026-11-21  
**Prepared by:** Codex/OpenCode documentation pass (read-only evidence collection; no approvals assumed)

## 1. Purpose and current release status

This document packages the outstanding release-gate decisions for review by the **authorized project owner/client** (or explicitly delegated approver). BLB-03R inspected repository documentation and located **no formal approval evidence** for the required release gates in the inspected project documentation. This does **not** assert approvals do not exist outside the repository; it means they are not evidenced in-repo.

**CURRENT RELEASE STATUS: NOT READY**

Security remediation S01–S07 has been locally verified (Step 7A: 45 backend test files / 639 tests passed / 0 failures; backend and frontend TypeScript checks passed). This local verification **does not** clear outstanding approvals, UAT execution/evidence, operational verification, index rollout authorization/verification, or production deployment requirements.

## 2. How to use this document

- For each decision, record **Approve / Reject / Defer** (or the decision-specific option where noted).
- Provide **approver name/role**, **date**, **scope/conditions**, and **evidence/reference** (email, signed document, ticket, meeting minutes, etc.).
- If a verbal decision is given, document it and obtain written confirmation.
- Missing responses remain **PENDING**.
- **Approval of a plan does not authorize execution unless execution is separately approved.**

## 3. Approval rules (mandatory)

1. Only an authorized project owner/client or explicitly delegated approver may approve.
2. Every approval must record **person/role, date, scope, and evidence reference**.
3. Verbal decisions must be documented and confirmed in writing.
4. Approval of one item **does not** automatically approve related items.
5. **UAT approval does not imply production approval.**
6. **Approval to prepare a plan does not authorize execution.**
7. Missing responses remain **PENDING**.
8. Rejected or deferred decisions remain open release gates until resolved.

## 4. Decision register

### Decision 1 — BLB-03M / AP-01: Guest checkout (Customer details step “Continue” behavior)

**Source:** `docs/uat/BLB-03-UAT-RESULTS.md`, BLB-03M decision record (Phase 2) and AP-01 register; `docs/release/BLB-03U-STEP7B-RELEASE-GATE-TRACKER.md`.

**Current documented behavior (source-supported):** Step-1 Continue validates phone only; missing/malformed guest name/email can progress to fulfilment (BLB-03K/L observations). `handlePlaceOrder()` and backend enforce guest name/email/phone before order creation (final/client + authoritative backend validation). No checkout code modified in BLB-03P.

| Option | Existing documented description (source) | Scope/implications (source-supported) | Dependencies | Evidence needed after decision |
|---|---|---|---|---|
| **A** | Require guest **name, valid email, and phone** before progression from Customer details to fulfilment, with **field-specific validation errors** at step 1 (Continue). | Minimal change in `app/checkout/page.tsx` (Customer details Continue) to validate guest name/email aligned with existing `handlePlaceOrder`/backend rules/messages, preserve values, block progression on invalid fields, retain final/backend enforcement; requires focused frontend/e2e regression tests and browser verification (no submit). | Approved UX decision; implementation/test/regression work only if separately authorized; no weakening of final/backend validation. | Written decision record (approver/date/option/scope), implementation PR/change record if executed, regression/browser evidence, updated UAT results. |
| **B** | Allow progression after **phone validation** (current step-1 behavior), with guest **name/email enforced during final order placement** (client-side final validation) and **backend validation** (authoritative). | Retain current step-1 behavior (phone-only) with final/backend enforcement; document as intended and ensure no requirement-violation defect logged. | Written decision record; no code change required by this option. | Written decision record; updated UAT/release docs stating intended behavior; no false defect classification. |

**Owner response (complete all fields):**
- Selected option: `A / B / Defer`
- Owner decision:
- Approver (name/role):
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 2 — AP-02: Synthetic customer and admin access

**Requirement (source):** Permission to provision/use designated **UAT-only synthetic customer and admin identities** and to receive/use credentials **securely out-of-band** for authorized testing. *(Source: `docs/uat/BLB-03-UAT-RESULTS.md` AP-02)*

**Why approval is needed:** CUST/ADM UAT workflows require controlled test identities; credentials must not be exposed in repo/chat/logs/screenshots.

**Proposed scope (source-supported):** Synthetic/non-real identities only; least privilege; no credential exposure in chat/repo/screenshots/logs; no credential reset/change/inspection beyond approved scope.

**Restrictions:** UAT-only; secure out-of-band delivery; approved tester/role list; no production/real customer data.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 3 — AP-03: Isolated UAT database write permissions

**Requirement (source):** Permission for specific, controlled **DB writes** on `127.0.0.1:27018/bluebell_whatsapp_uat` only for approved UAT activities. *(Source: AP-03)*

**Why approval is needed:** Several CUST/ADM scenarios require controlled writes in isolated UAT; writes are otherwise prohibited.

**Proposed scope (source-supported):** Explicit collections/records/actions/time window; no `27017`, no `27019` app use, no Atlas/prod; no ad-hoc writes; rollback/cleanup required per AP-04.

**Restrictions:** Isolated UAT DB only; minimum necessary writes; documented before/after state; no production/real customer data.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 4 — AP-04: Synthetic data provisioning and cleanup

**Requirement (source):** Permission to **provision** required synthetic data/accounts/orders/requests and to perform approved **cleanup/restore** actions. *(Source: AP-04)*

**Why approval is needed:** UAT execution requires controlled synthetic data and a cleanup/rollback path.

**Proposed scope (source-supported):** Minimum necessary synthetic data only; documented before/after state; approved cleanup/retention; no real customer/production data.

**Restrictions:** Isolated UAT only; approved manifest; cleanup evidence required after execution.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 5 — AP-05: Registration and OTP testing policy

**Requirement (source):** Define approved policy for **CUST-11 registration/OTP** (and any OTP-dependent guest verification if in scope): approved secure **non-bypass** UAT-safe mechanism or formal deferral/out-of-scope. *(Source: AP-05)*

**Why approval is needed:** UAT Safe Mode suppresses external OTP delivery and OTP plaintext is not exposed/recoverable by design.

**Proposed scope (source-supported):** No real OTP/email/WhatsApp to real recipients; no auth bypass/hardcoded OTP; no secret/token exposure; compliant with `UAT_SAFE_MODE`.

**Restrictions:** No real customer/provider contact; no bypass/hardcoded OTP; secure, non-bypass only if approved.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 6 — AP-06: Guest checkout order submission

**Requirement (source):** Permission to execute **CUST-10** order submission/order-creation steps in isolated UAT under approved safe conditions. *(Source: AP-06)*

**Why approval is needed:** End-to-end guest checkout requires order submission/persistence and may touch verification/payment-safe paths.

**Proposed scope (source-supported):** Authorized scenarios/data only; no real customer details; no real payment transactions/provider side effects; controlled DB writes and cleanup per AP-03/AP-04.

**Restrictions:** Isolated UAT; `UAT_SAFE_MODE=true`; no real payments/provider side effects; depends on applicable AP dependencies.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 7 — AP-07: Payment testing restrictions

**Requirement (source):** Confirm permitted **payment-safe** verification scope (no live Razorpay ops/webhooks/captures, no real transactions, no claims of real verified payment). *(Source: AP-07)*

**Why approval is needed:** Payment-related UAT must have explicit safety boundaries.

**Proposed scope (source-supported):** `UAT_SAFE_MODE=true` constraints enforced; UI/state inspection and approved safe behavior only; no external payment provider contact.

**Restrictions:** No live Razorpay ops/webhooks/captures; no real transactions; no claims of real verified payment.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 8 — AP-08: Custom cake submission and media policy

**Requirement (source):** Permission/scope for **CUST-14** submission and **media/upload handling** under Safe Mode. *(Source: AP-08)*

**Why approval is needed:** Submission may involve DB writes and media handling; Cloudinary external ops are blocked in safe mode.

**Proposed scope (source-supported):** No unintended external Cloudinary uploads/deletes; no false-success reporting; DB writes/cleanup controlled; synthetic inputs only.

**Restrictions:** Safe Mode only; no external media side effects; approved evidence/cleanup criteria required.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 9 — AP-09: Admin workflow testing scope

**Requirement (source):** Approve which **ADM-01–ADM-13** workflows/actions are in scope and permitted mutation level. *(Source: AP-09)*

**Why approval is needed:** Admin workflows include sensitive/mutating actions; scope and mutation level must be explicitly authorized.

**Proposed scope (source-supported):** Least privilege; per-workflow authorization; settings/inventory/order-status/product changes require explicit scope and rollback; no unauthorized exposure.

**Restrictions:** No unapproved mutations; sanitize evidence; separate approval from customer UAT.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 10 — AP-10: Notification and WhatsApp suppression expectations

**Requirement (source):** Confirm expected handling/evidence for **suppressed** email/OTP/WhatsApp/outbox behavior in UAT Safe Mode. *(Source: AP-10)*

**Why approval is needed:** Suppressed behavior must be interpreted correctly during UAT; no false “sent/delivered” claims.

**Proposed scope (source-supported):** Suppressed deliveries must not be claimed sent/delivered; no real recipients contacted; live webhooks blocked; monitoring reflects stored/suppressed state.

**Restrictions:** UAT Safe Mode constraints apply; no real provider contact.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 11 — S07 UAT idempotency index rollout (PLAN APPROVAL ONLY)

**Purpose:** Approve the UAT rollout plan for `CustomCakeSubmissionIdempotency` indexes. **This is not execution authorization.**

**Target (if separately authorized):** `127.0.0.1:27018`, database `bluebell_whatsapp_uat` (isolated UAT only). No 27017, no 27019, no Atlas/prod.

**Required indexes (code-level):**
- Unique index on `idempotencyKey`.
- TTL index on `expiresAt` with `expireAfterSeconds: 0`.

**Required plan elements:** pre-deployment checks; backup/restore point; duplicate/conflicting-data checks; unique/TTL verification queries; rollback considerations; operator; execution window; evidence capture.

**Owner response:** `Approve plan / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

**Execution authorization (separate):** `Not authorized / Separately authorized`  
- Execution approver:
- Execution date/window:
- Execution evidence/reference:

> **Explicit rule:** Approving this plan **does not** authorize database execution. Separate written execution authorization is required.

---

### Decision 12 — S07 production idempotency index rollout (SEPARATE)

**Default status: NOT APPROVED.** Do **not** reuse UAT approval.

**Required separate items:** production target confirmation; backup and rollback plan; operator; maintenance window; prechecks and verification; written production execution authorization; post-change evidence.

**Owner response:** `Approve plan / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

**Production execution authorization (separate):** `Not authorized / Separately authorized`  
- Execution approver:
- Date/window:
- Evidence/reference:

---

### Decision 13 — Origin/Referer compatibility

**Request:** Explicit decision on browser Origin/Referer enforcement for relevant public/custom-cake flows (S07 deferred this; compatibility must be reviewed).

**Options:**
- Enforce after compatibility testing.
- Defer with documented risk acceptance.
- Request further investigation.

**Owner response:** `Enforce / Defer with risk acceptance / Investigate`  
- Approver:
- Date:
- Scope/conditions:
- Rationale/evidence reference:

---

### Decision 14 — WAF/CDN/trusted-proxy verification

**Request:** Approve an **operational topology review only** (WAF/CDN/trusted proxy/client-IP chain). This is **not** permission to change infrastructure.

**Owner response:** `Approve review / Reject / Defer`  
- Approver:
- Date:
- Scope/conditions:
- Evidence/reference:

---

### Decision 15 — Accessibility/browser smoke testing

**Request:** Approve scope, supported browsers/devices, test approach (keyboard/screen reader/autofill/smoke), and evidence requirements. Include S07 honeypot/custom-cake, checkout, and critical admin flows as applicable.

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Scope/browsers/approach:
- Evidence/reference:

---

### Decision 16 — Synthetic UAT data and credentials

**Request:** Approve synthetic data set, secure credential provisioning, access restrictions, cleanup/rollback, data retention, and evidence handling. **Never include actual credentials or secrets in this document.**

**Owner response:** `Approve / Reject / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

---

### Decision 17 — Customer UAT execution (CUST-10–CUST-14)

**Source cases:** `docs/uat/BLB-03-UAT-TEST-PLAN.md` / `docs/uat/BLB-03-UAT-RESULTS.md`.

| Case | Name | Owner response (Approve/Reject/Defer) | Approver | Date | Conditions/evidence |
|---|---|---|---|---|---|
| CUST-10 | Guest checkout |  |  |  |  |
| CUST-11 | Customer registration and OTP |  |  |  |  |
| CUST-12 | Customer login |  |  |  |  |
| CUST-13 | Customer account and order history |  |  |  |  |
| CUST-14 | Custom cake request submission |  |  |  |  |

**Required constraints:** isolated UAT only; `UAT_SAFE_MODE=true`; approved synthetic data/credentials; no real customer/provider operations; evidence capture and cleanup.

---

### Decision 18 — Admin UAT execution (ADM-01–ADM-13)

| Case | Name | Owner response (Approve/Reject/Defer) | Approver | Date | Conditions/evidence |
|---|---|---|---|---|---|
| ADM-01 | Admin authentication |  |  |  |  |
| ADM-02 | Admin authorization and protected routes |  |  |  |  |
| ADM-03 | Dashboard data and metrics |  |  |  |  |
| ADM-04 | Product creation and editing |  |  |  |  |
| ADM-05 | Product availability |  |  |  |  |
| ADM-06 | Inventory adjustments |  |  |  |  |
| ADM-07 | Order listing and filtering |  |  |  |  |
| ADM-08 | Order status changes |  |  |  |  |
| ADM-09 | Customer management |  |  |  |  |
| ADM-10 | Custom cake request management |  |  |  |  |
| ADM-11 | WhatsApp Centre |  |  |  |  |
| ADM-12 | Notification and outbox monitoring |  |  |  |  |
| ADM-13 | Settings management |  |  |  |  |

**Required constraints:** approved admin scope/mutation level; least privilege; no unapproved mutations; sanitized evidence; rollback for mutating actions.

---

### Decision 19 — Production release (Go/No-Go)

**Default status: NOT APPROVED.** Request formal go/no-go only after required gates are satisfied.

**Prerequisites/evidence required:** BLB-03M/AP decisions resolved; S07 UAT+prod index rollout approved/executed/verified as applicable; CUST/ADM UAT completed with evidence; WAF/proxy/origin/a11y/browser smoke reviewed; regression evidence; operational verification; deployment authorization; rollback readiness; release checklist sign-off.

**Owner response:** `GO / NO-GO / Defer`  
- Approver:
- Date:
- Conditions/scope:
- Evidence/reference:

## 5. Additional documented item (non-numbered)

- **S05 design-doc provenance gap:** `docs/security/BLB-03U-S05-REMEDIATION-DESIGN.md` is missing; existing S05 assessment/remediation/code/test evidence exists. Owner decision needed: reconstruct clearly labeled historical design doc, or accept documented provenance gap with rationale. This is a documentation/provenance decision, not proof of remediation failure.

## 6. Source documents used

- `docs/release/BLB-03U-STEP7B-RELEASE-GATE-TRACKER.md`
- `docs/release/BLB-03S-RELEASE-READINESS.md`
- `docs/uat/BLB-03-UAT-RESULTS.md`
- `docs/uat/BLB-03-UAT-TEST-PLAN.md`
- `docs/uat/BLB-03-TEST-DATA-PLAN.md`
- `docs/UAT_SAFE_MODE.md`
- `docs/security/BLB-03U-STEP7A-CONSOLIDATED-VERIFICATION-REPORT.md`
- `docs/security/BLB-03U-S07-REMEDIATION-DESIGN.md`
- `docs/security/BLB-03U-S07-REMEDIATION-REPORT.md`
- `docs/CLIENT_HANDOVER_STATUS.md`

## 7. Document control

- This document records **decision requests only**. No approvals are pre-filled.
- No credentials, secrets, PII, or real customer data are included.
- No operational execution is authorized by this document.