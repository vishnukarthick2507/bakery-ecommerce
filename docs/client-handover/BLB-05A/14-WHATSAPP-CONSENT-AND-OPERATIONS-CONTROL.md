# WhatsApp Consent and Operations Control

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Control and evidence draft; legal, Meta and owner approvals remain separate gates  
**Prepared:** 2026-11-26

## 1. Purpose and strict boundary

This document records the operational controls required before any WhatsApp customer messaging is enabled. It does not grant legal approval, Meta approval, template submission, template activation, implementation, or message-send authorization.

**Current fail-closed rule:** keep WhatsApp automated sending disabled unless the relevant legal/business decisions, Meta template approval, provider configuration, consent evidence and separate execution authorization are all recorded.

## 2. Current known posture

- The project decision register records several owner-approved wording/format decisions, but explicitly distinguishes those decisions from implementation authorization.
- Some decisions remain partial or undecided; consult `docs/client-handover/BLB-20-PROJECT-OWNER-DECISION-REGISTER.md` for the authoritative item-by-item status.
- The owner decision register states W01 written legal/compliance validation has not been received/verified.
- Meta template submission/approval evidence is not recorded there; templates are described as not submitted and disabled.
- Group 5 execution authorization is recorded as 0/13 granted and 13/13 deferred.
- BLB-21 implementation remains not authorized.
- No live message sending is authorized by this document.

These statuses must be rechecked against the current owner decision register before any future change.

## 3. Preconditions before enabling any message

- [ ] Written legal/compliance review of the exact consent language and intended processing purpose.
- [ ] Business owner approval of customer-facing consent and opt-out wording.
- [ ] Documented consent capture point, timestamp, source, purpose, policy version and withdrawal status.
- [ ] Defined suppression/opt-out handling and a process to prevent future sends after withdrawal.
- [ ] Named Meta Business/account owner and authorized technical operator.
- [ ] Approved WhatsApp Business Platform configuration and verified sender ownership.
- [ ] Exact templates submitted through the approved process and provider/Meta approval evidence retained.
- [ ] Approved mapping from event to template, payload variables and customer context.
- [ ] Separate authorization for implementation, sandbox tests and any actual message sending.
- [ ] Monitoring, retries, rate limits, incident stop procedure and audit evidence defined.

A template being approved by Meta does not itself establish that a particular recipient has consented. Consent and template approval are separate controls.

## 4. Consent evidence requirements

For each consent record, the business/legal owner should define the minimum necessary evidence:

| Field | Requirement |
|---|---|
| Customer reference | Use an internal identifier; restrict access |
| Consent status | Explicit yes/no/withdrawn state |
| Purpose/channel | State WhatsApp and the specific purpose |
| Notice version | Identify the exact approved notice text/version |
| Capture source | Page/form/workflow where the choice was recorded |
| Timestamp | Reliable timestamp and timezone |
| Withdrawal | Timestamp/source and suppression propagation |
| Evidence access | Named role and retention period approved by policy |

Do not treat an account phone number, order placement, general terms acceptance, or a previously sent message as proof of WhatsApp consent unless the approved legal/business policy explicitly supports that conclusion.

## 5. Fail-closed operational rules

- If consent is absent, unknown, stale or withdrawn, do not send.
- If template status is unknown, rejected, disabled or unapproved, do not send.
- If required payload values are missing or inconsistent, do not send.
- If recipient identity or destination is ambiguous, do not send.
- If provider credentials/configuration cannot be verified, do not send.
- If an opt-out/suppression lookup fails, do not send.
- Stop automated sends and escalate on unexpected volume, duplicate sends, consent mismatch or suspected data exposure.

## 6. Change and test controls

All future changes must identify the approved decision, implementation scope, exact templates and variables, code commit, test environment, synthetic recipient, operator and approver.

Sandbox tests must use an explicitly authorized test account and test recipient. Real customer sends, Meta submission, template enablement, provider changes and production deployment each require separate scope-specific authorization.

## 7. Incident response

1. Disable/stop the affected automated send path using the approved operator procedure.
2. Preserve event IDs, timestamps, template identifier, redacted payload metadata and relevant logs.
3. Identify affected recipients and consent state using restricted access.
4. Notify the business/legal owner and technical owner through the approved escalation route.
5. Do not resend, delete evidence or make customer promises until the incident owner approves the response.
6. Record cause, containment, affected scope, corrective action and re-enable approval.

## 8. Ownership to complete

| Role | Named owner/contact |
|---|---|
| Business policy approver | Not supplied |
| Legal/compliance reviewer | Not supplied |
| Meta Business/account owner | Not supplied |
| WhatsApp technical operator | Not confirmed |
| Consent/opt-out support owner | Not supplied |
| Incident escalation contact | Not supplied |

## 9. Evidence and approval register

| Gate | Current status |
|---|---|
| W01 legal/compliance approval | Not received/verified in owner decision register |
| Exact consent wording approval | Requires owner/legal confirmation |
| Meta Business ownership/configuration | Not verified |
| Template submission/approval | Not evidenced; templates recorded as not submitted/disabled |
| Consent capture and withdrawal end-to-end | Not verified |
| Automated send implementation authorization | Not granted (BLB-21 not authorized) |
| Live send authorization | Not granted |
| UAT evidence | Not completed |

**Conclusion:** WhatsApp remains a blocked, fail-closed integration. This document is a control checklist only and must not be interpreted as permission to implement, enable, submit or send.
