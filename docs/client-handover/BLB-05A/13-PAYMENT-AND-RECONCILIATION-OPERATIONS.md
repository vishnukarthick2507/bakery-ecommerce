# Payment Operations and Reconciliation Guide

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Source-informed operational draft; provider configuration and business policies require owner verification  
**Prepared:** 2026-11-26

## 1. Purpose and boundaries

This guide describes the payment lifecycle controls that the owner and authorized operators should verify before accepting real customer payments. It is not evidence of a configured or approved production payment system.

**No live payment, refund, webhook replay, key rotation, provider dashboard change, or production database operation is authorized by this document.** Use an authorized Razorpay sandbox account and synthetic test orders for rehearsal.

## 2. Source-level integration overview

The application has a Razorpay integration. The exact deployed account, keys, webhook configuration, settlement account, enabled payment methods, and production behavior have not been independently verified in this handover activity.

The implementation and deployed configuration must be reviewed together. Do not infer that a payment is captured or settled merely because a browser reports success or an order record exists.

## 3. Roles and ownership to confirm

| Responsibility | Named owner | Status |
|---|---|---|
| Razorpay account and legal entity owner | Not supplied | Required |
| Payment operations/reconciliation operator | Not supplied | Required |
| Refund approver | Not supplied | Required |
| Technical webhook maintainer | Not confirmed | Required |
| Finance/bookkeeping reviewer | Not supplied | Required |
| Customer escalation contact | Not supplied | Required |

Only authorized account owners should access provider dashboards or change credentials and webhook settings.

## 4. Payment state evidence

For every test or real transaction, retain a controlled evidence record containing:

- Internal order number and internal payment/order reference.
- Provider payment/order identifiers, where available.
- Amount and currency as recorded by the application and provider.
- Provider-side status and timestamp.
- Webhook event identifier and processing result, where applicable.
- Refund identifier, amount, status and timestamp, if applicable.
- Operator, reviewer and evidence location.

Do not store card numbers, CVV, UPI PINs, passwords, API secrets, access tokens or unnecessary customer personal data in this record.

## 5. Sandbox verification checklist

Run only after the owner supplies sandbox access and explicitly authorizes the test window.

- [ ] Confirm the account is a sandbox/test account, not live.
- [ ] Verify the configured public key and secret are sandbox credentials without exposing values in logs or chat.
- [ ] Confirm webhook endpoint, signing-secret custody and event subscriptions with the authorized technical owner.
- [ ] Create a synthetic order with a known amount and currency.
- [ ] Complete a provider-documented successful test payment.
- [ ] Verify server-side signature/payment verification and the resulting internal order state.
- [ ] Test a failed/cancelled payment path.
- [ ] Test duplicate webhook delivery and confirm idempotent handling.
- [ ] Test delayed/out-of-order event handling where the provider sandbox supports it.
- [ ] Test refund flow only with explicit refund-test authorization.
- [ ] Confirm the customer-facing status does not claim settlement unless settlement evidence exists.
- [ ] Record exact commit, environment, test identifiers, timestamps, expected/actual results and defects.

## 6. Daily reconciliation procedure (proposed; owner approval required)

1. Export the provider transaction report through an authorized account.
2. Obtain the corresponding application order/payment report from an authorized operator.
3. Match using provider identifiers and internal order references; do not match solely on customer name.
4. Compare amount, currency, status, timestamps, refunds and fees.
5. Classify unmatched or inconsistent entries: pending, failed, duplicate, amount mismatch, missing webhook, refund mismatch or unknown.
6. Assign each exception to a named owner and record the next action.
7. Have a separate reviewer approve adjustments and close the reconciliation period.
8. Preserve reports under the business-approved retention/access policy.

This is a proposed control procedure, not a statement that daily reconciliation currently occurs.

## 7. Exception handling

| Exception | Safe response |
|---|---|
| Customer says paid; application says pending | Check provider-side transaction and webhook evidence; do not manually mark paid without authorized verification. |
| Duplicate payment | Preserve both provider references; escalate to finance/owner for approved refund or adjustment. |
| Webhook signature failure | Reject/hold event according to implementation; investigate configuration and logs without exposing secrets. |
| Payment amount mismatch | Stop fulfillment decision and escalate to finance/owner. |
| Refund pending/failed | Check provider status and assigned refund approver; do not promise completion before provider confirmation. |
| Provider unavailable | Keep state pending/unknown; communicate only verified status and follow approved retry/reconciliation procedure. |

## 8. Refund and customer communication policy

The business must supply and approve refund eligibility, timelines, cancellation rules, partial-refund authority, delivery/production cut-off rules and customer communication wording. No refund policy or SLA is invented in this document.

## 9. Security and access controls

- Store credentials only in approved secret management.
- Restrict dashboard and webhook-secret access to named operators.
- Rotate credentials only through an approved change process.
- Redact secrets and personal data from application/provider logs.
- Review webhook authentication, replay/idempotency handling and alerting.
- Revoke access promptly when an operator leaves the role.

## 10. Approval and evidence register

| Item | Status |
|---|---|
| Sandbox account and test authorization | Not supplied / not verified |
| Live account ownership and production configuration | Not verified |
| Webhook endpoint/signature verification | Not verified in this handover |
| Successful/failed/duplicate payment sandbox evidence | Not executed |
| Refund sandbox evidence | Not executed |
| Settlement and reconciliation procedure approval | Owner/finance input required |
| Refund policy and customer wording | Owner/client input required |
| Production payment release authorization | Not granted |

**Conclusion:** The payment integration is documented as an application capability, not as an operationally verified production service. Production payment readiness remains unproven until the authorized evidence above is recorded.
