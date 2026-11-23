# BLB Phase 0 — Fresh Reconciliation (Read-Only)

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers — WhatsApp Business Automation  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-22  
**Type:** Read-only reconciliation. No source/test/config/env/dependency/DB/provider/deploy/Git mutation performed.

---

## 1. Git / Worktree Baseline

| Item | Value |
|---|---|
| Branch | `feature/whatsapp-business-automation` |
| HEAD | `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f` |
| Status | `TOTAL=107 / TRACKED=58 / UNTRACKED=49` |
| Pre-existing dirty worktree | Preserved; no cleanup/reset/stash/restore |

---

## 2. Reconciliation Matrix

| Area | Classification | Evidence | Blocker / Gate |
|---|---|---|---|
| Frontend (Next.js 16/React 19/TS/Tailwind 4) | **Verified implemented (foundation)** | Repo structure, app routes, checkout/admin/account pages present | Changes require BLB-21 |
| Backend (Express 5/TS/MongoDB/JWT cookies/Razorpay) | **Verified implemented (foundation)** | `backend/src/server.ts`, routes/controllers/services/models present | Changes require BLB-21 |
| Notification outbox primitives | **Implemented but not operational** | `notificationOutboxService.ts` has enqueue/claim/process/retry/lease/recover; no runtime worker started in `server.ts` (no outbox import/start/stop) | G-01 Critical; BLB-21 |
| Proposal expiry worker | **Implemented and started** | `server.ts` imports/starts/stops `proposalExpiry` worker (L27,249,279); worker scans 30s | Admin email config/UAT affects delivery; no customer WhatsApp expiry |
| WhatsApp template registry | **Implemented with governance drift** | 18 entries: 8 APPROVED/enabled:true, 10 NOT_SUBMITTED/enabled:false; no `metaTemplateId` field; BLB-18/19 reported all 18 NOT_SUBMITTED/enabled:false | G-04 High; Meta approval UNVERIFIED |
| Centralized send eligibility | **Missing / partial** | Outbox validates registry+consent+UAT; `whatsappService.sendWhatsAppTemplate` lacks registry/consent/Meta-evidence defense-in-depth | G-04/BLB-23; BLB-21 |
| RESCHEDULE_PROPOSED WhatsApp path | **Missing** | `proposeSlot` emits STATUS_CHANGED+RESCHEDULE_PROPOSED; `customerOrderNotifications.whatsappTemplateFor` returns null for that case; no registry/outbox mapping; no `{{proposedSchedule}}` implementation | G-02 Critical; D20-08-D/E/F; BLB-21 |
| D20-06-F schedule UTC write | **Implemented but incorrect/risky** | `orderController.acceptProposal` writes UTC `toISOString()` split to `scheduledDate/scheduledTime` (L1556-1561) | G-03 High; BLB-21 scoped auth |
| Consent/opt-out foundations | **Partially implemented** | `WhatsAppConsent` model/service, checkout consent, outbox consent checks, webhook STOP handling present | End-to-end/provider/legal evidence not verified |
| Webhook routes | **Implemented but not production-verified** | Raw-body mount, signature verification, idempotency/status handling present | No verified Meta app/credentials/live webhook evidence |
| Meta/Cloud API integration | **Blocked / external** | No verified credentials, no live delivery, templates not Meta-submitted/approved | Meta owner actions/approvals |
| Legal/compliance | **Blocked** | W01 NOT RECEIVED; D-14 NOT RECEIVED; D-16-D-18 UNRESOLVED; Group 5 0/13 DEFER; D-19 NO-GO | External evidence required |
| Testing | **Historical only** | Prior baseline: backend 45 files/639 tests PASS, frontend typecheck/build PASS (not re-run in this audit) | Fresh authorized runs needed |
| UAT/Production | **Blocked** | No UAT/prod authorization; no verified Meta/templates/legal gates | Separate authorizations |

---

## 3. Owner Decision Reconciliation (Source of Truth: BLB-20 Register)

- **Fully approved:** D20-02, D20-03, D20-04, D20-06, D20-07.
- **Partially approved:** D20-05 (A/C approved; D resolved by D20-06; B/E/F NOT DECIDED); D20-08 (A/B/C approved; D/E/F NOT DECIDED). D20-08-C approved Option B 2026-11-22.
- **Not decided:** D20-01, D20-09.
- **Implementation authorization:** BLB-21 NOT AUTHORIZED.

---

## 4. Authorized Work That Can Proceed Now (Docs-Only / Read-Only)

1. D20-08-D decision capture (review already prepared in BLB-23A; capture only on explicit owner approval).
2. Prepare D20-08-E wording review package (docs-only, NOT DECIDED).
3. Prepare D20-08-F prerequisites/semantics review package (docs-only, NOT DECIDED).
4. Prepare D20-05-B/E/F, D20-01, D20-09 decision packages.
5. Prepare BLB-23 registry governance implementation-authorization request (scope/risk/tests/rollback) — no implementation.
6. Prepare BLB-24 outbox worker design package — no implementation/startup.
7. Prepare Meta setup/template/compliance/UAT checklists (no external actions).

## 5. Gated / Not Authorized

- BLB-21 source implementation, config/env/dependency changes.
- DB writes/migrations/seeds/indexes; UAT/prod DB access.
- Meta/provider credential use, template submission/activation, real message sending.
- Production deployment/restart.

*End of Phase 0 Fresh Reconciliation.*