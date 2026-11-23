# 07 — Response Intake Procedure

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Milestone:** BLB-08A — DRAFT — PREPARATION ONLY  
**Date:** 2026-11-21

## 1. Intake workflow

| Step | Action | Owner | Output |
|---:|---|---|---|
| 1 | Receive written response through approved channel | `[Project coordinator]` | Raw evidence preserved |
| 2 | Preserve original evidence (no edits to original) | `[Project coordinator]` | Evidence file/ref recorded |
| 3 | Record source, date/time, sender, channel | `[Project coordinator]` | Intake log entry |
| 4 | Verify sender identity and authority | `[Delivery/Security lead]` | Identity/authority check |
| 5 | Map to decision ID / operation / W01 / D-14 | `[Delivery manager]` | Mapped register row |
| 6 | Extract selected option, conditions, scope, validity | `[Delivery manager]` | Structured record |
| 7 | Identify ambiguity/conflict | `[Delivery/Tech lead]` | Clarification request if needed |
| 8 | Classify response | `[Delivery manager]` | RECEIVED — NOT VERIFIED / VERIFIED — DECISION CONFIRMED / VERIFIED — CONDITIONAL DECISION / VERIFIED — REJECTED / VERIFIED — DEFERRED / AMBIGUOUS — CLARIFICATION REQUIRED / CONFLICTING EVIDENCE |
| 9 | Update only directly supported gate | `[Delivery manager]` | Gate reassessment entry |
| 10 | Preserve request/evidence trail | `[Project coordinator]` | Audit trail |

## 2. Classification rules

- Missing required info != consent/approval.
- Decision confirmation != execution authorization.
- UAT approval != production release authorization.
- One operation authorization != another operation authorization.
- Conflicting evidence requires resolution before gate update.

## 3. Escalation on intake issues

| Issue | Action |
|---|---|
| Ambiguous response | Send clarification request template (BLB-07A/05-E) |
| Unknown authority | Request authority confirmation; keep as NOT VERIFIED |
| Conflicting evidence | Escalate to decision owner; mark CONFLICTING EVIDENCE |
| Missing scope/environment/validity for auth | Mark NOT VERIFIED; request completion |