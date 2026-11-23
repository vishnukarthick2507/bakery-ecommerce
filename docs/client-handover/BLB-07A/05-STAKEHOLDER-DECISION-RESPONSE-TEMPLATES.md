# 05 — Stakeholder Decision & Authorization Response Templates

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Milestone:** BLB-07A — DRAFT — NOT SENT — NO APPROVALS RECEIVED  
**Date:** 2026-11-21

## Instructions

Complete only applicable fields. Missing required approval information is **not** consent. A decision confirmation is not execution authorization. A technical authorization is not production release authorization.

## A. Single-decision response template

| Field | Response |
|---|---|
| Decision ID |  |
| Decision title |  |
| Selected option |  |
| Decision status (Approved / Rejected / Deferred) |  |
| Conditions / limitations |  |
| Reason / business justification |  |
| Approver name |  |
| Approver role / authority |  |
| Date |  |
| Evidence/reference |  |
| Execution authorization granted? (separate) | No / Yes (specify operation) |

## B. Multiple-decision response register

| Decision ID | Selected option | Approved / Rejected / Deferred | Conditions | Reason | Approver name/role | Date | Evidence ref | Execution auth granted? |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |

## C. Conditional approval template

| Field | Response |
|---|---|
| Decision ID |  |
| Approved with conditions | Yes |
| Conditions required before effective |  |
| Conditions required before execution |  |
| Approver name / role |  |
| Date |  |
| Evidence ref |  |
| Condition verification owner |  |
| Condition due date | `[PLACEHOLDER]` |

## D. Rejection / deferment template

| Field | Response |
|---|---|
| Decision ID |  |
| Status (Rejected / Deferred) |  |
| Reason |  |
| Alternative requested |  |
| Revisit date / trigger | `[PLACEHOLDER]` |
| Approver name / role |  |
| Date |  |
| Evidence ref |  |

## E. Clarification request template

| Field | Response |
|---|---|
| Decision ID |  |
| Clarification needed |  |
| What information is missing |  |
| Requested from |  |
| Requested by / date |  |
| Response due date | `[PLACEHOLDER]` |

## F. Operation-specific execution authorization template

| Field | Response |
|---|---|
| Operation # / name |  |
| Exact scope |  |
| Environment |  |
| Preconditions |  |
| Expected outcome |  |
| Responsible operator |  |
| Approver name / role / authority |  |
| Decision (Approve / Reject / Defer) |  |
| Conditions / limitations |  |
| Valid from / until |  |
| Evidence ref |  |

**DB restriction reminder:** Any separately authorized future UAT DB operation must target exactly `127.0.0.1:27018/bluebell_whatsapp_uat` with `UAT_SAFE_MODE=true`. No 27017/27019/Atlas/production DB access.

## G. Verification classification (for project team use after receipt)

| Status | Meaning |
|---|---|
| RECEIVED — NOT VERIFIED | Response received but identity/authority/scope/date/evidence not yet verified |
| VERIFIED — DECISION CONFIRMED | Verified decision with required evidence |
| VERIFIED — CONDITIONAL DECISION | Verified, but conditions must be met before dependent action |
| VERIFIED — REJECTED | Verified rejection |
| VERIFIED — DEFERRED | Verified deferral |
| AMBIGUOUS — CLARIFICATION REQUIRED | Unclear/incomplete response |
| CONFLICTING EVIDENCE | Conflicts with other evidence; requires resolution |