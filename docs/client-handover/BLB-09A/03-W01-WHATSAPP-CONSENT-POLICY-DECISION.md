# 03 — W01 WhatsApp Consent Policy Decision

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `feature/whatsapp-business-automation` | **HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Milestone:** BLB-09A — DOCUMENTATION / INTAKE ONLY  
**Date:** 2026-11-21

## Status

**No actual project-owner decision or legal/compliance approval supplied in BLB-09A.** No policy marked approved. No implementation performed.

## Decision areas

| # | Area | Recommended policy (PROPOSED — NOT APPROVED) | Alternatives | Project owner response | Legal/compliance review required | Status |
|---:|---|---|---|---|---|---|
| 1 | Consent wording | Explicit, plain-language, versioned transactional notice; no pre-checked consent | Short checkbox text; layered notice+policy link | NOT SUPPLIED | Yes | NOT RECEIVED |
| 2 | Capture timing | At checkout/custom-cake submission before automated WhatsApp notifications enabled | Account preference center; post-order confirmation | NOT SUPPLIED | Yes | NOT RECEIVED |
| 3 | Consent purpose | Transactional order/custom-cake updates only | Include service/support messages; include marketing (not recommended default) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 4 | Transactional vs marketing | Transactional only by default; marketing separate explicit opt-in if ever used | Combined consent (higher risk) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 5 | Withdrawal/revocation | STOP keyword, customer request channel, auditable suppression | Manual admin-only withdrawal | NOT SUPPLIED | Yes | NOT RECEIVED |
| 6 | Unknown consent | Fail closed: no automated send until explicit consent | Assume implied consent (not recommended) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 7 | Historical customer consent | Treat as unknown unless auditable evidence exists; re-consent campaign only if legally approved | Grandfather existing records (risk) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 8 | Opted-in/opted-out states | Explicit GRANTED/DENIED/WITHDRAWN/SUPPRESSED states with audit trail | Boolean only (insufficient) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 9 | Retention/audit trail | Retain consent version, timestamp, source, actor, state transitions per approved policy; define retention period | Minimal logging (insufficient) | NOT SUPPLIED | Yes | NOT RECEIVED |
| 10 | Responsible approving authority | Legal/Compliance owner + Business owner sign-off | Business owner only (insufficient for legal compliance) | NOT SUPPLIED | Yes | NOT RECEIVED |

## Boundaries

- Recommended policy is **not approved**.
- Legal/compliance approval is **not obtained**.
- Backend capability does not establish consent.
- No notification may be sent merely because a phone number exists.
- Implementation/execution remains NOT AUTHORIZED.