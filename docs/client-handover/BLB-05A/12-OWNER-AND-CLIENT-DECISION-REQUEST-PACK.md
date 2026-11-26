# Owner and Client Decision Request Pack

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Prepared:** 2026-11-26  
**Status:** REQUEST TEMPLATE — NO NEW APPROVALS RECORDED  
**Purpose:** Consolidate decisions and evidence that repository work cannot supply.

## 1. How to use this pack

The project owner/client should complete only the decisions relevant to the agreed release scope. Attach written approval or a link to the authoritative decision record. A blank field is not approval. A verbal discussion, draft wording or technical recommendation must not be represented as legal approval, provider approval, implementation authorization or client acceptance.

Do not enter passwords, API keys, OTPs, access tokens, payment credentials, database URIs or other secrets in this document or GitHub.

## 2. Business and legal decisions

| ID | Decision requested | Why required | Current status | Owner response / evidence reference |
|---|---|---|---|---|
| O-01 | Confirm canonical customer-facing production domain and approved custom-cake destination | D20-01 remains unresolved; provider templates must not use an unconfirmed domain | NOT DECIDED | NOT PROVIDED |
| O-02 | Approve checkout and custom-cake consent wording, purpose, optional/required status, retention and proof of consent | Consent capture implementation and customer communication are blocked without approved policy | NOT PROVIDED | NOT PROVIDED |
| O-03 | Confirm customer opt-out and suppression policy for all communication channels | Prevents unwanted messages and defines operational handling | NOT PROVIDED | NOT PROVIDED |
| O-04 | Confirm refund, cancellation, order modification and payment dispute policies | Needed for accurate checkout, customer guide, admin guide and support | NOT PROVIDED | NOT PROVIDED |
| O-05 | Confirm delivery areas, fees, lead times, cut-off times and unavailable-date rules | Needed to validate checkout and customer-facing promises | NOT PROVIDED | NOT PROVIDED |
| O-06 | Confirm custom-cake pricing, deposit/payment, proposal expiry and acceptance rules | Needed for accurate workflow, templates and UAT | PARTIAL / OWNER DECISIONS EXIST IN PRIOR REGISTER | NOT PROVIDED HERE |
| O-07 | Confirm support contact, operating hours, escalation owner and expected response times | Needed for support guide and incident handling | NOT PROVIDED | NOT PROVIDED |
| O-08 | Approve warranty/maintenance scope, duration, exclusions and commercial terms | Cannot be inferred by engineering | NOT PROVIDED | NOT PROVIDED |
| O-09 | Confirm data retention, deletion and customer privacy request handling | Needed for operational and legal documentation | NOT PROVIDED | NOT PROVIDED |
| O-10 | Confirm accessibility, supported browsers/devices and release acceptance criteria | Needed to scope final UAT and support | NOT PROVIDED | NOT PROVIDED |

## 3. Technical and operational ownership decisions

| ID | Decision requested | Why required | Current status | Owner response / evidence reference |
|---|---|---|---|---|
| T-01 | Name frontend, backend, database, hosting and security owners | Assigns accountability for operation and incidents | NOT PROVIDED | NOT PROVIDED |
| T-02 | Name custodians for production secrets and define access/rotation/revocation | Environment matrix has names only; no verified owner/access list | NOT PROVIDED | NOT PROVIDED |
| T-03 | Confirm production hosting projects, backend host, database cluster and canonical domains | Source configuration does not prove deployed topology | NOT VERIFIED | NOT PROVIDED |
| T-04 | Approve backup frequency, retention, RPO/RTO and restore test window | Runbook exists but no authorized restore evidence | NOT PROVIDED | NOT PROVIDED |
| T-05 | Name monitoring/alert recipients and incident escalation contacts | No named operations ownership evidenced | NOT PROVIDED | NOT PROVIDED |
| T-06 | Approve staging/UAT environment, test data policy and cleanup owner | Required before credentialed or state-mutating tests | NOT PROVIDED | NOT PROVIDED |
| T-07 | Approve rollback authority, rollback trigger and change window | Production deployment remains unauthorized | NOT PROVIDED | NOT PROVIDED |
| T-08 | Confirm provider account owners and sandbox access coordinators | Needed for provider verification without secrets in repo/chat | NOT PROVIDED | NOT PROVIDED |

## 4. Provider approval checklist

| Provider | Owner action required | Current posture |
|---|---|---|
| Razorpay | Provide authorized test-mode account access through approved secret manager; approve sandbox payment/webhook/refund test scope | NOT VERIFIED |
| Brevo / email OTP | Confirm test sender/domain and sink mailbox; authorize test delivery | NOT VERIFIED |
| Cloudinary | Confirm test cloud/account and restricted test folder; authorize upload/delete test | NOT VERIFIED |
| Google OAuth | Confirm test client, origins, callbacks and test identity | NOT VERIFIED |
| Meta WhatsApp | Complete legal/compliance approval, Meta business ownership, template approval, consent/opt-out policy and separate send authorization | BLOCKED / NOT AUTHORIZED |

No credentials should be pasted into GitHub, chat, issue comments or this document. Use provider/hosting secret managers and grant least-privilege access directly to named operators.

## 5. UAT and client acceptance decisions

| ID | Decision requested | Current status | Owner response / evidence reference |
|---|---|---|---|
| U-01 | Name customer UAT tester(s) and approve synthetic test accounts | NOT PROVIDED | NOT PROVIDED |
| U-02 | Name administrator UAT tester(s) and approve least-privilege test access | NOT PROVIDED | NOT PROVIDED |
| U-03 | Approve exact UAT environment and test window | NOT PROVIDED | NOT PROVIDED |
| U-04 | Approve UAT cases, expected business outcomes and severity definitions | PROPOSED TEST PACK CREATED | NOT PROVIDED |
| U-05 | Confirm defect triage owner and disposition authority | NOT PROVIDED | NOT PROVIDED |
| U-06 | Confirm training/manual review participants | NOT PROVIDED | NOT PROVIDED |
| U-07 | Identify authorized client signatory for acceptance | NOT PROVIDED | NOT PROVIDED |
| U-08 | Define written acceptance format and any accepted limitations | NOT PROVIDED | NOT PROVIDED |

## 6. Explicit authorization record

For any restricted activity, record a separate authorization with exact scope. A general “go ahead” must not be interpreted as permission for every environment or provider.

| Field | Required entry |
|---|---|
| Activity | Exact action (e.g., Razorpay sandbox webhook test) |
| Environment | Exact named sandbox/staging environment |
| Permitted data | Synthetic data only, described |
| Operator | Named person |
| Allowed actions | Exact operations, including any create/update/delete/send/payment action |
| Prohibited actions | Production, real customers, live payments/messages, unrelated configuration |
| Start/end window | Date and time with timezone |
| Evidence location | Approved restricted location |
| Approval | Named authorized owner and dated written approval |

## 7. Decision response register

| Decision ID | Decision | Approver role/name | Date | Evidence link/reference | Implementation authorized? |
|---|---|---|---|---|---|
| — | — | — | — | — | NO |

## 8. Release decision

Select one only after reviewing the evidence package:

- [ ] **NO-GO** — one or more critical release gates remain open.
- [ ] **CONDITIONAL GO** — only explicitly listed conditions are accepted by the authorized release owner; no legal/provider requirement may be waived without its proper authority.
- [ ] **GO** — all agreed technical, operational, security, provider, UAT and client-acceptance criteria are evidenced and approved.

**Current repository-evidenced recommendation: NO-GO.** This pack records requests, not approvals. It does not change any prior decision register status, authorize implementation or provider operations, approve deployment, or grant client acceptance.
