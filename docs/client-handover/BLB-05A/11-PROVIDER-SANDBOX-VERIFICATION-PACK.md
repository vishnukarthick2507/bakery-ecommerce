# Provider Sandbox Verification Pack

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Prepared:** 2026-11-26  
**Status:** TEST PLAN ONLY — NO PROVIDER TESTS EXECUTED  
**Release posture:** NO-GO until applicable provider, legal, operational and UAT gates are evidenced

## 1. Purpose and safety

This pack defines evidence required to verify external integrations without using production credentials or contacting real customers. It does not grant permission to create provider accounts, change provider settings, send messages, charge/refund money, upload production media, or deploy.

Use provider-owned sandbox/test environments and synthetic data only. Never place credentials, tokens, webhook secrets, OTPs, cookies, customer information or full connection strings in GitHub issues, commits, screenshots or this document. Record evidence references and redacted outcomes only.

**Global stop conditions:** stop if a provider dashboard is not clearly identified as test/sandbox; if a real payment, email, WhatsApp message or public asset could be created; if production credentials/configuration are encountered; if ownership or authorization is unclear; or if any secret/PII is exposed.

## 2. Entry checklist

| Requirement | Required evidence | Current status |
|---|---|---|
| Exact release candidate | Commit SHA and environment URL | NOT PROVIDED |
| Isolated UAT environment | Written environment owner confirmation | NOT PROVIDED |
| Provider test account | Account owner confirms test/sandbox mode | NOT PROVIDED |
| Synthetic test data | Synthetic identities, products, orders and test addresses | NOT PROVIDED |
| Credential custody | Credentials stored in provider/hosting secret manager; no values in repo/chat | NOT PROVIDED |
| Callback isolation | Test webhook URLs and test signing secrets verified | NOT PROVIDED |
| Test authorization | Written scope, permitted actions, date window and operator | NOT PROVIDED |
| Evidence retention | Restricted evidence location and retention approved | NOT PROVIDED |

## 3. Razorpay sandbox verification

**Current project status:** NOT VERIFIED. No payment or refund test is claimed.

Prerequisites:
- Authorized Razorpay test account and test-mode keys.
- Isolated UAT backend and test database.
- Test webhook endpoint and test webhook secret configured only in the approved environment.
- Approved synthetic order and test payment method.
- Named operator and explicit permission for payment/refund test operations.

Test cases:
1. Confirm dashboard is in test mode before using any key.
2. Confirm the test key identifier belongs to the authorized test account; never display key secrets.
3. Create one synthetic order and record its internal order ID and expected amount.
4. Complete a successful sandbox payment and verify server-side signature/payment verification.
5. Test failed and cancelled payment paths; confirm no false paid state.
6. Deliver a valid test webhook and verify signature handling, idempotency and order-state transition.
7. Replay the same webhook event; verify duplicate delivery does not duplicate side effects.
8. Send an invalid-signature webhook; verify it is rejected and logged safely.
9. Test refund only if separately authorized; verify refund status and reconciliation behavior.
10. Confirm test records are clearly identifiable and cleanup is performed only under the approved test-data plan.

Evidence to retain: test-mode confirmation, redacted request/event IDs, synthetic order ID, expected/observed state, webhook replay result, sanitized logs, test report and cleanup record.

Do not infer actual bank settlement or production refund behavior from sandbox results.

## 4. Brevo email and OTP verification

**Current project status:** NOT VERIFIED. No real email delivery is claimed.

Prerequisites:
- Authorized Brevo test/sandbox account or approved test project.
- Verified test sender/domain and sink/test recipient controlled by the project owner.
- OTP test policy, expiry and attempt-limit expectations confirmed.
- External delivery blocked in all non-test environments unless expressly approved.

Test cases:
1. Verify the sender identity and test recipient are authorized.
2. Trigger an OTP request for a synthetic account and confirm delivery only to the test mailbox.
3. Confirm OTP expiry, failed-attempt limit and resend behavior against the approved requirements.
4. Confirm OTP storage/logging does not expose plaintext OTPs or secrets.
5. Test provider rejection, timeout and rate-limit responses.
6. Confirm retry behavior does not create uncontrolled duplicate messages.
7. Confirm the application does not report successful delivery when provider delivery fails.
8. Confirm external email delivery remains blocked in environments where it is not approved.

Evidence: redacted message/event IDs, test mailbox receipt, timestamps, sanitized application logs and pass/fail results. Never record OTP values.

## 5. Cloudinary media verification

**Current project status:** NOT VERIFIED.

Prerequisites:
- Authorized non-production Cloudinary account/cloud.
- Test upload preset and restricted test folder.
- Synthetic, non-copyright-sensitive test image.
- Agreed cleanup and retention procedure.

Test cases:
1. Verify account/cloud identity is the approved test account.
2. Upload a synthetic test image using the application's intended upload flow.
3. Confirm returned asset metadata and URL are handled correctly.
4. Test invalid file type, oversize file and rejected upload.
5. Confirm unsigned/signed upload policy matches the intended security model.
6. Delete the test asset only if the test account owner authorizes deletion.
7. Verify no production asset or customer upload was altered.

Evidence: redacted asset/public ID, upload result, validation result, deletion result and sanitized logs. Do not store API secrets.

## 6. Google OAuth verification

**Current project status:** NOT VERIFIED.

Prerequisites:
- Authorized test OAuth client and test project.
- Approved test origins and callback URLs.
- Synthetic test account.
- Consent screen and data-access scope reviewed by the owner.

Test cases:
1. Confirm client ID belongs to the approved test project.
2. Confirm exact allowed JavaScript origins and redirect/callback URLs.
3. Complete successful sign-in with synthetic test identity.
4. Test user cancellation and provider error response.
5. Test invalid/mismatched redirect URI and origin rejection.
6. Verify account linking/session creation follows the approved application policy.
7. Verify logout and protected-route behavior.
8. Confirm no client secret is exposed to browser code or committed to the repository.

Evidence: redacted OAuth project/client reference, callback configuration review, sanitized test outcome and logs. Never record access tokens, ID tokens, refresh tokens or secrets.

## 7. Meta WhatsApp — blocked pending separate approval

**Current project status:** BLOCKED / NOT AUTHORIZED for live sends. Templates are documented as not submitted/disabled; legal/compliance evidence is outstanding.

No test message may be sent until all of the following are separately evidenced:
- Legal/compliance-approved consent wording and lawful basis for the intended message category.
- Project-owner approval of customer journey, template content, opt-in capture, opt-out and suppression rules.
- Verified Meta Business ownership, WhatsApp Business Account and sender number.
- Approved templates and provider status.
- Approved test recipient/number and test scope.
- Explicit send authorization naming operator, recipient scope, template IDs and test window.

Pre-approval checks may be documentation-only: verify code remains fail-closed, templates remain disabled/not submitted, and no production token is configured or used. Do not call send endpoints, submit templates or alter Meta settings as part of this pack.

Required evidence after authorized test: approved policy reference, template IDs/status, synthetic test consent record, redacted message ID, delivery result, opt-out/suppression verification and audit record.

## 8. Consolidated evidence register

| Provider | Test environment/account | Test date/operator | Scenarios run | Result | Evidence reference | Defects | Approval |
|---|---|---|---|---|---|---|---|
| Razorpay | NOT PROVIDED | NOT SCHEDULED | NOT RUN | NOT VERIFIED | — | — | NOT AUTHORIZED |
| Brevo / OTP | NOT PROVIDED | NOT SCHEDULED | NOT RUN | NOT VERIFIED | — | — | NOT AUTHORIZED |
| Cloudinary | NOT PROVIDED | NOT SCHEDULED | NOT RUN | NOT VERIFIED | — | — | NOT AUTHORIZED |
| Google OAuth | NOT PROVIDED | NOT SCHEDULED | NOT RUN | NOT VERIFIED | — | — | NOT AUTHORIZED |
| Meta WhatsApp | BLOCKED | NOT SCHEDULED | PRE-APPROVAL REVIEW ONLY | BLOCKED | — | — | NOT AUTHORIZED |

## 9. Completion criteria

A provider is VERIFIED for the agreed scope only when:
- the correct sandbox/test account and isolated environment are evidenced;
- all in-scope positive, negative and failure-path tests have recorded results;
- no real customer, live charge, real message or production asset was affected;
- secrets and personal data are absent from evidence artifacts;
- defects are fixed or explicitly dispositioned by the authorized owner;
- provider-specific approval and evidence references are recorded.

**Conclusion:** This is a controlled verification plan, not evidence of successful provider integration. Razorpay, Brevo/OTP, Cloudinary and Google OAuth remain NOT VERIFIED. Meta WhatsApp remains BLOCKED pending legal/compliance and separate send authorization. Production release remains NO-GO.
