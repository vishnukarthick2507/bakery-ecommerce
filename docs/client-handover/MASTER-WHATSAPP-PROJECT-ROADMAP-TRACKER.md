# MASTER WHATSAPP PROJECT ROADMAP & TRACKER

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**Baseline HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Status:** Documentation/control artifact — **NOT READY / NO-GO**  
**Rule:** This tracker records evidence and authorization state. It does **not** grant implementation, testing, UAT, Meta, deployment, or production authorization.

---

## 1. Master Progress Tracker

| Workstream | Status | Evidence | Blocker | Next action |
|---|---|---|---|---|
| Baseline audit | **COMPLETE** | `docs/client-handover/MASTER-WHATSAPP-PROJECT-BASELINE.md`; read-only code/docs inspection; git baseline confirmed | None for audit | Keep baseline updated only with authorized evidence |
| Owner decisions | **WAITING FOR OWNER** | BLB-20 register: 5 fully approved / 2 partially approved / 2 not decided. D20-08-C approved Option B (2026-11-22) | D20-08-D/E/F, D20-05-B/E/F, D20-01, D20-09 NOT DECIDED | Prepare/present D20-08-D (priority 1) for explicit owner selection |
| Technical design | **NOT STARTED** | Prior docs: BLB-18/19/20 series; master baseline identifies gaps | Owner decisions incomplete; BLB-21 NOT AUTHORIZED for implementation scope | Prepare decision-complete design after required approvals; mark implementation-dependent sections as pending authorization |
| Backend implementation | **BLOCKED** | Existing code has WhatsApp/outbox/consent/webhook foundations; critical gaps: no outbox worker, RESCHEDULE_PROPOSED unmapped, D20-06-F UTC issue, registry/doc drift | BLB-21 NOT AUTHORIZED; D20-08 unresolved; external/legal gates | No code changes until explicit BLB-21 authorization and scoped plan |
| Frontend integration | **BLOCKED** | Checkout consent checkbox exists; account order detail has proposal response UI; public track lacks proposal response UI | BLB-21 NOT AUTHORIZED; D20-08-D/E/F/D20-09 decisions; UX/auth constraints | No code changes until authorized |
| Notification templates | **BLOCKED** | 18 registry entries exist; 8 code-approved/enabled, 10 not submitted/disabled; all Meta NOT_SUBMITTED/NOT APPROVED externally | Registry reconciliation needed; owner decisions; legal/compliance; Meta submission/approval; BLB-21 | Do not enable/submit/send; reconcile registry only under authorized implementation |
| Meta setup | **WAITING FOR EXTERNAL APPROVAL** | Master prompt: developer onboarding started; business portfolio blocked earlier; app incomplete; no verified credentials; no live delivery verified | Meta account/business/app/credentials/phone verification | Document required env/setup steps; no account creation bypass or credential handling in chat |
| Webhooks | **IN PROGRESS (code present, not production-verified)** | `whatsappWebhookController.ts`, raw-body mount, signature verification, idempotency, status correlation; UAT-safe blocking | No verified Meta app/credentials/webhook subscription; no live webhook verification evidence | Keep blocked for production; include in authorized UAT/sandbox plan later |
| Compliance | **WAITING FOR EXTERNAL APPROVAL** | W01 NOT RECEIVED; D-14 NOT RECEIVED; D-16-D-18 UNRESOLVED; Group 5 0/13 DEFER; D-19 NO-GO | Legal/compliance written validation/evidence | Prepare checklist; do not claim clearance |
| Automated testing | **BLOCKED** | Historical baseline: backend 45 files/639 tests PASS, frontend typecheck/build PASS (prior). No new runs in this audit | New runs require explicit test authorization; code changes require BLB-21 | Run only after explicit authorization and scoped change set |
| UAT | **BLOCKED** | UAT-safe mode exists in code; no authorized UAT execution | BLB-21, owner decisions, legal/compliance, isolated UAT authorization, no real customer/provider data | Plan only; execute only with separate UAT authorization |
| Security review | **NOT STARTED** | Baseline identified initial risks (G-01..G-10) | Requires scoped review cycle; some fixes need BLB-21 | Perform read-only security audit next authorized phase; document findings |
| Deployment | **BLOCKED** | No deployment authorization; dirty worktree; unresolved gates | Owner decisions, BLB-21, tests/UAT/security/legal/Meta approvals | Do not deploy |
| Production validation | **BLOCKED** | No production WhatsApp delivery verified | All prior gates + explicit production authorization | Do not perform production actions |
| Final handover | **NOT STARTED** | Baseline/roadmap created | All prior workstreams | Create after authorized completion/evidence |

---

## 2. Prioritized Owner-Decision Queue

| Priority | Decision | Status | Dependency / Evidence | Recommended next step |
|---:|---|---|---|---|
| 1 | **D20-08-D** Response deadline/expiry communication | **NOT DECIDED** | D20-08-C approved Option B (2026-11-22, generic contact S.V. Sweets & Bakers); proposal expiry behavior exists (`proposalExpiry.ts`) but no customer expiry WhatsApp | Prepare evidence/review/capture package for explicit owner selection |
| 2 | **D20-08-E** Exact customer-facing wording | **NOT DECIDED** | Depends on D20-08-D and approved variables/semantics (A/B/C approved) | Draft/review after D |
| 3 | **D20-08-F** Implementation prerequisites acknowledgement | **NOT DECIDED** | Acknowledgement only; not execution authorization | Record after D/E decisions |
| 4 | **D20-05-B** Tax/delivery inclusion wording | NOT DECIDED | No evidence tax/delivery included/excluded | Owner/legal wording decision |
| 5 | **D20-05-E** Tracking URL placement/destination | NOT DECIDED | Depends on D20-01/D20-09 and `{{trackingUrl}}` handling | Resolve after domain/URL decisions |
| 6 | **D20-05-F** Acceptance/proceeding semantics | NOT DECIDED | No new workflow to be invented | Owner wording/semantics decision |
| 7 | **D20-01** Production domain/canonical URL | NOT DECIDED / EXTERNAL CONFIRMATION REQUIRED | Affects tracking URLs, template examples, Meta/domain expectations | Owner confirmation with evidence |
| 8 | **D20-09** Custom-cake tracking destination | NOT DECIDED | Depends on D20-01 and auth/access/route confirmation | Owner decision after domain confirmation |

---

## 3. Implementation Readiness Gates (All Must Be Satisfied Before Production)

| Gate | State | Notes |
|---|---|---|
| Owner decisions complete | **NO** | 5 fully approved / 2 partially approved / 2 not decided |
| BLB-21 implementation authorization | **NO** | Explicit owner authorization required |
| Source changes reviewed/tested | **NO** | No authorized implementation cycle |
| Automated tests passing (current) | **HISTORICAL ONLY** | Prior baseline pass; no fresh run in this audit |
| UAT evidence complete | **NO** | Not authorized/executed |
| Security review complete | **NO** | Not started |
| Legal/compliance (W01) | **NO** | NOT RECEIVED |
| Meta app/business/credentials verified | **NO** | External setup incomplete |
| Templates submitted/approved in Meta | **NO** | All NOT_SUBMITTED/NOT APPROVED |
| Webhooks verified in authorized environment | **NO** | No live verification |
| Monitoring/rollback ready | **NO** | Not production-authorized |
| Production authorization | **NO** | Explicit owner authorization required |

---

## 4. Immediate Authorized Work (No Source-Code Changes)

- Maintain decision register discipline; capture only explicit owner approvals.
- Prepare D20-08-D/E/F/05/01/09 review packages as needed.
- Reconcile documentation drift findings in control docs (authorized documentation only).
- Produce security-audit checklist/report (read-only) if requested.
- Prepare implementation plan draft only after required decisions and explicit planning authorization; do not treat draft as implementation authorization.

---

## 5. D20-08-D Owner Decision (Next Required)

**Decision (recorded):** D20-08-D **APPROVED BY PROJECT OWNER — Option C (2026-11-22, BLB-23D)**. The customer-facing WhatsApp notification must not mention an exact proposal expiry date/time, relative response deadline, response-window duration, or countdown/deadline warning. Instruct customer to contact S.V. Sweets & Bakers to discuss the proposed schedule. No expiry-related template variable required. Existing application proposal expiry behaviour unchanged. Documentation-only decision capture; no implementation authorization.

**Status:** **D20-08-D APPROVED (Option C, 2026-11-22). D20-08 remains PARTIALLY APPROVED (A/B/C/D approved; E/F NOT DECIDED). BLB-21 remains NOT AUTHORIZED.**

*End of MASTER-WHATSAPP-PROJECT-ROADMAP-TRACKER.md.*