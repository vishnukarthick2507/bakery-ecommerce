# BLB-04B — Client Response Instructions

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Repository:** `C:\Users\Admin\Documents\bakery-ecommerce-whatsapp`  
**Branch:** `feature/whatsapp-business-automation`  
**HEAD:** `60d24dc0cd649d815214ddb23b0b44cf6dc26f1f`  
**Date:** 2026-11-21  
**Status:** **DRAFT — DOCUMENTATION ONLY / NOT AUTHORIZED**

## 1. Purpose

Explain how the authorized project owner/client should complete `docs/release/BLB-04A-DECISION-RESPONSE-TEMPLATE.md` and supply genuine evidence for decision capture.

## 2. Who may respond

- Only the authorized project owner/client, or an explicitly delegated approver with written delegation evidence.
- The responder must provide name, role, and confirmation date for any non-blank decision response.

## 3. Accepted response values

Use only these values:

| Response | When to use | Required fields |
|---|---|---|
| **Approve** | You approve the selected option/scope as written | Selected option, approver name, approver role, confirmation date, conditions/limitations (if any), supporting evidence ref |
| **Reject** | You reject the option/scope | Selected option/decision rejected, approver name, approver role, confirmation date, rationale in conditions/limitations, supporting evidence ref |
| **Defer** | You postpone the decision | Approver name, approver role, confirmation date, deferral reason, re-evaluation trigger/date if known, supporting evidence ref |
| **Request clarification** | You need more information before deciding | Requester name, requester role, date, clarification questions in conditions/limitations, supporting evidence ref |
| **Conditional approval** | You approve only if specific conditions are met | Selected option, approver name, approver role, confirmation date, explicit conditions, condition verification owner, evidence required to satisfy conditions, supporting evidence ref |

## 4. Mandatory fields for any actual response

- Decision ID
- Selected option/response
- Approver name
- Approver role
- Confirmation date
- Conditions/limitations (or "None")
- Supporting evidence reference
- Dependencies acknowledged (if applicable)

**Blank fields = NOT RECEIVED / NOT CONFIRMED.**

## 5. Evidence requirements

Evidence must be genuine, reviewable, and attributable. Acceptable examples include signed approval record, email approval with headers preserved in an evidence file, ticket/workflow approval, or meeting decision record with approver/date/scope. 

Evidence must include:
- Who decided
- What was decided (exact option/scope)
- When it was decided
- Any conditions/limitations
- Where the evidence is stored/referenced

## 6. Conditional approval rules

A conditional approval is **not fully confirmed for execution** until conditions are satisfied and evidenced.

Record:
- Condition text
- Verification owner
- Evidence required
- Verification date/status
- Whether condition is satisfied

Execution authorization remains **NOT AUTHORIZED** until a separate execution authorization record is issued.

## 7. What will not be accepted as confirmation

- Silence or no response
- Verbal assumption without written evidence
- Agent/technical recommendation alone
- Incomplete template rows (missing approver/date/scope/evidence)
- Ambiguous response (e.g., "looks good" without selected option/scope)
- Implied approval from UAT, deployment, or prior discussion

## 8. Critical boundaries

- Decision confirmation does **not** authorize implementation, UAT, DB writes/index operations, provider calls, deployment, or production release.
- D-11 S07 UAT index precheck/rollout requires separate explicit execution authorization and UAT-only `127.0.0.1:27018/bluebell_whatsapp_uat`, `UAT_SAFE_MODE=true`.
- No S02 weakening, OTP disclosure/bypass, or real OTP delivery.
- No live Razorpay/real payment transactions/webhooks/captures.
- No Cloudinary/external media side effects without separate runtime isolation evidence and authorization.
- D-12 and D-19 remain deferred/NO-GO unless separately authorized with evidence-complete gates.

## 9. Submission

Return the completed template and evidence references through the agreed controlled project channel. Do not include secrets, real credentials, PII, or production data in the response.