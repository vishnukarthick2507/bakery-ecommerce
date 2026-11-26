# Customer and Administrator UAT Execution Pack

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Branch:** `fix/api-product-data-access`  
**Prepared:** 2026-11-26  
**Status:** PROPOSED TEST PLAN — NOT EXECUTED — NOT ACCEPTED  
**Release posture:** NO-GO until the applicable release gates are evidenced and approved

## 1. Purpose and limits

This pack gives the project owner, business testers and QA a controlled way to plan and record customer and administrator user-acceptance testing (UAT). It is a test script and evidence register only. Creating this document does not authorize access to a client environment, production data, external providers, payment processing, message delivery, deployment or release.

The scenarios below are proposed from the documented application workflows. Before execution, the product owner and QA lead must confirm that each scenario matches the agreed scope and the exact release candidate. A test marked PASS requires recorded evidence; an unexecuted test must remain NOT RUN.

## 2. Mandatory entry criteria

Do not start execution until every applicable item is confirmed.

| Entry criterion | Required evidence | Status |
|---|---|---|
| Release candidate identified | Commit SHA, build/version and environment URL recorded | NOT PROVIDED |
| Environment approved | Written confirmation this is a dedicated UAT/staging environment | NOT PROVIDED |
| Data isolation verified | Database identity checked without exposing connection strings; confirmed not production/shared client data | NOT PROVIDED |
| Test identities ready | Synthetic customer and administrator accounts; access approved | NOT PROVIDED |
| Provider isolation verified | Razorpay test mode; email sink/test recipient; WhatsApp disabled or approved test destination; Cloudinary test account; OAuth test client | NOT PROVIDED |
| Test data prepared | Synthetic products, addresses, orders and custom-cake requests; reset/cleanup plan | NOT PROVIDED |
| Business rules approved | Product availability, delivery, cancellation/refund, custom-cake and consent wording confirmed by owner | NOT PROVIDED |
| Testers assigned | Named customer tester, admin tester, QA recorder and decision owner | NOT PROVIDED |
| Evidence storage approved | Restricted location and retention period agreed; no secrets or personal customer data in screenshots/logs | NOT PROVIDED |
| Stop/escalation process agreed | Named contact and defect severity/triage process | NOT PROVIDED |

**Stop immediately** if the environment or database cannot be positively identified, real customer data appears unexpectedly, a real payment/message is about to be sent, credentials are exposed, or a test causes an unplanned state change.

## 3. Execution rules

1. Use only synthetic accounts and synthetic data approved for this test.
2. Never paste passwords, OTPs, API keys, cookies, payment credentials, full database URIs or personal customer information into this register.
3. Use provider sandboxes/test modes only. Keep WhatsApp sends disabled unless separate legal/compliance and send authorization has been documented.
4. Do not use production for UAT, browser testing, data cleanup or workflow rehearsal.
5. Record the exact build/commit, environment, tester, date/time, result and evidence reference for every executed case.
6. Record defects with severity, reproduction steps and a sanitized evidence reference. Do not silently waive failed tests.
7. Re-test fixes against the same release candidate or record the new candidate SHA and repeat affected regression cases.
8. A passing UAT run is not, by itself, production deployment authorization or client acceptance.

## 4. Result definitions

- **PASS** — expected result observed and sanitized evidence recorded.
- **FAIL** — actual result differs from expected result; create a defect.
- **BLOCKED** — prerequisite or external decision prevents execution; state the blocker.
- **NOT RUN** — not attempted.
- **NOT APPLICABLE** — owner/QA records why the case is outside agreed scope.

## 5. Customer UAT scenarios

All cases start as NOT RUN. Confirm actual UI labels and business rules against the approved release candidate before execution.

| ID | Scenario | Steps / checks | Expected result | Result / evidence |
|---|---|---|---|---|
| C-01 | Storefront loads | Open the approved UAT storefront on desktop and mobile; inspect navigation and page errors | Storefront loads without blocking errors; layout is usable at both viewports | NOT RUN |
| C-02 | Product catalogue | Open catalogue; inspect active products, images, names, descriptions and displayed prices | Only customer-facing product information is shown; no internal cost, stock-control or reorder fields are exposed | NOT RUN |
| C-03 | Product detail | Open an active product by its detail link/slug | Correct product details render; unavailable/unknown product is handled safely | NOT RUN |
| C-04 | Cart consistency | Add products, change quantities, remove an item and revisit cart | Cart reflects the selected items and quantities consistently; invalid quantities are rejected or normalized per approved rules | NOT RUN |
| C-05 | Customer account access | Sign in with synthetic customer; open account-protected pages; sign out | Customer can access own account; protected pages require authentication; sign-out removes access | NOT RUN |
| C-06 | Cross-customer isolation | Sign in as customer A; attempt to access customer B's synthetic order/request identifier using an approved test method | Customer A cannot view or modify customer B's private records | NOT RUN |
| C-07 | Checkout address validation | Proceed to checkout with missing and then valid synthetic delivery details | Required fields are clearly validated; valid details proceed according to approved checkout rules | NOT RUN |
| C-08 | Order creation — sandbox only | Complete checkout using an approved sandbox/test payment path or approved non-payment test path | One correctly associated test order is created; no live charge occurs; order state is consistent | NOT RUN |
| C-09 | Payment result handling | In provider sandbox, test success, failure and cancellation paths where supported | UI and order state reflect the actual sandbox result; no false success is shown | NOT RUN |
| C-10 | Order tracking | Open tracking for the synthetic order using the intended customer workflow | Only appropriate order/tracking information is shown; unknown identifiers fail safely | NOT RUN |
| C-11 | Custom-cake request form | Complete form navigation and validation using synthetic content | Required inputs are validated and the customer can review the request before submission | NOT RUN |
| C-12 | Custom-cake request privacy | Submit only if separately authorized in isolated UAT; attempt cross-customer detail access | Request is associated with the submitting customer; another customer cannot view it | NOT RUN |
| C-13 | Email/OTP | Execute only with approved test sender and sink/test mailbox | OTP lifecycle and email delivery behave as specified; no real customer is contacted | NOT RUN |
| C-14 | Consent and communication preferences | Review every checkout/custom-cake consent control against owner/legal-approved wording | No preselected or misleading consent; recorded choice matches approved policy and is auditable | BLOCKED — approved wording/policy required |
| C-15 | Mobile usability | Repeat agreed critical customer flows on supported mobile viewport/device | Controls, forms, cart and checkout are usable without clipping or blocked actions | NOT RUN |

## 6. Administrator UAT scenarios

Use a dedicated synthetic administrator account. Do not use a production administrator account unless separately authorized for a read-only access review; state-changing tests must remain in isolated UAT.

| ID | Scenario | Steps / checks | Expected result | Result / evidence |
|---|---|---|---|---|
| A-01 | Admin authentication | Sign in with synthetic admin; sign out; revisit protected admin route | Only authorized admin can access admin functions; sign-out removes access | NOT RUN |
| A-02 | Role separation | Attempt admin route access as unauthenticated user and synthetic customer | Access is denied or redirected; no admin data is disclosed | NOT RUN |
| A-03 | Product listing | Open admin product management/list | Admin sees the fields required for authorized product management | NOT RUN |
| A-04 | Inactive products | Request inactive-product listing as admin, then as customer/unauthenticated user | Admin access follows authorization; non-admin request is denied; inactive products are not exposed publicly | NOT RUN |
| A-05 | Product create/update | Create or update a synthetic UAT product only if authorized | Saved fields persist correctly; validation and customer-facing visibility follow approved rules | NOT RUN |
| A-06 | Order administration | Open a synthetic order and inspect its status/payment details | Admin sees correct order details and permitted actions; no unsupported status is presented as paid | NOT RUN |
| A-07 | Custom-cake request administration | Open synthetic request; review permitted proposal/decision workflow only if authorized | Admin can access authorized request; customer ownership/privacy rules remain enforced | NOT RUN |
| A-08 | Customer data minimization | Inspect admin screens and exports used in agreed scope | Only necessary customer data is displayed/exported; no unintended disclosure | NOT RUN |
| A-09 | Communication controls | Inspect notification settings/templates without enabling or sending | WhatsApp remains disabled/fail-closed unless separately approved; no real send is triggered | NOT RUN |
| A-10 | Operational error handling | Exercise safe validation/error paths without changing production or provider state | Errors are understandable and do not expose secrets, stack traces or sensitive records | NOT RUN |
| A-11 | Admin auditability | Review available history/status information for synthetic test actions | Important actions can be traced to the extent supported by the approved requirements | NOT RUN |
| A-12 | Mobile/admin viewport | Review agreed admin tasks at supported viewport sizes | Critical admin controls remain usable or documented as desktop-only by owner decision | NOT RUN |

## 7. Defect log

Create one row per defect. Do not record credentials or personal data.

| Defect ID | Related case | Severity | Steps to reproduce | Expected vs actual | Sanitized evidence reference | Owner | Status / retest |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

Suggested severity definitions (confirm with project owner): **Critical** — security/privacy breach, data loss, incorrect payment/order integrity; **High** — core customer/admin journey blocked; **Medium** — important workflow degraded with workaround; **Low** — cosmetic or minor usability issue.

## 8. Execution record

| Field | Value |
|---|---|
| Release candidate / commit SHA | NOT PROVIDED |
| Environment name and approved URL | NOT PROVIDED |
| Environment owner | NOT PROVIDED |
| Database isolation confirmation reference | NOT PROVIDED |
| Test window | NOT SCHEDULED |
| Customer tester | NOT ASSIGNED |
| Administrator tester | NOT ASSIGNED |
| QA recorder | NOT ASSIGNED |
| Business decision owner | NOT ASSIGNED |
| Test report location | NOT PROVIDED |
| Execution status | NOT RUN |

## 9. Exit criteria and sign-off

UAT may be recommended as complete only when:
- all in-scope cases have a recorded result;
- all Critical and High defects are fixed and successfully retested, or have explicit documented business disposition accepted by the authorized owner;
- Medium/Low defects have owners, target dates and documented acceptance where deferred;
- customer/admin role separation and data privacy checks pass;
- payment, email, storage and OAuth cases have sandbox evidence where in scope;
- consent wording and communication behavior have approved policy evidence;
- the final tested commit SHA is recorded and matches the release candidate under consideration;
- business testers and the authorized client representative sign the result.

| Sign-off role | Name | Decision | Date | Evidence/reference |
|---|---|---|---|---|
| QA lead | NOT ASSIGNED | NOT SIGNED | — | — |
| Business/product owner | NOT ASSIGNED | NOT SIGNED | — | — |
| Client representative | NOT ASSIGNED | NOT SIGNED | — | — |
| Technical/release owner | NOT ASSIGNED | NOT SIGNED | — | — |

**Current conclusion:** This pack is prepared for future authorized execution. No customer/admin UAT has been performed or passed by creating this document. Client acceptance remains NOT GRANTED. Production release remains NO-GO until all applicable technical, operational, legal, provider, UAT and client-acceptance gates are independently evidenced and approved.
