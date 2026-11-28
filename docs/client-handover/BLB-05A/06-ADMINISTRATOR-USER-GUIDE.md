# Administrator User Guide

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Version:** Draft — source-derived, pending admin training and UAT  
**Date:** 26 November 2026

## Important access and safety notice

This guide describes admin navigation and visible functions in the current frontend source. It does not grant admin access or authorize production changes. Only named, approved administrators should use the admin area. Do not share admin credentials, session cookies, OTPs, API keys or customer exports.

Before using production, the business must assign administrator roles, approve operating procedures, configure recovery contacts and complete admin UAT.

## 1. Sign in and navigate

1. Open the business-approved production URL (canonical domain still requires owner confirmation).
2. Navigate to the admin login page.
3. Sign in using the administrator credentials provisioned by the authorized system owner.
4. The admin area provides a dashboard and navigation links for:
   - Dashboard
   - Analytics
   - Products
   - Orders
   - Customers
   - Custom Cakes
   - WhatsApp Centre
   - Inventory
   - Payments
   - Reports
   - Settings
5. On smaller screens, open the navigation drawer using the menu button.
6. Use **Logout** when finished, especially on shared devices.

The admin frontend wraps protected pages with an admin-auth component and the backend applies admin authentication to protected APIs. A page loading is not proof that all API actions are authorized; do not bypass access controls.

## 2. Dashboard

The dashboard presents operational indicators including total/pending/completed/cancelled orders, gross sales, received revenue, customers, products, low-stock products, pending custom-cake requests, recent orders and a revenue trend.

Use the dashboard as an overview, then open the relevant module for detailed work. Metrics depend on the backend analytics response and current data; reconcile financial figures with the approved accounting/payment records before making financial decisions.

## 3. Products

Use **Products** to manage the catalogue. The public catalogue displays customer-facing product details; internal cost and inventory information should remain restricted to authorized admin users.

Before changing a product, verify its name, description, category, price, images, preparation time, active state and availability. Confirm pricing and product copy with the business owner. Do not expose internal cost, stock thresholds or supplier lead times in public content.

A product marked inactive or unavailable may no longer appear in normal customer browsing. Confirm the intended storefront result after any authorized change.

## 4. Orders

Use **Orders** to review customer orders and their fulfilment/payment status. The application has order lifecycle states including placed, payment confirmed, confirmed, preparing, ready, ready for pickup, out for delivery, delivered, collected, cancelled and reschedule proposed.

Before changing an order:
- Verify the order number and customer details.
- Check the payment status separately from fulfilment status.
- Confirm stock/availability and the requested fulfilment slot.
- Follow the business-approved cancellation, refund and rescheduling policy.
- Add only factual internal notes where the UI supports them.

Do not mark an order paid based only on a customer screenshot or verbal claim. Verify the payment through the approved Razorpay/admin reconciliation process. Do not issue refunds or change payment records without the authorized finance procedure.

### Reschedule proposals

An admin may propose a new fulfilment slot through the order workflow. Confirm the proposed date/time with the customer and follow the approved business process. The customer response controls are in the authenticated customer order detail page. The public tracking page does not currently provide proposal acceptance/decline controls.

## 5. Customers

The Customers page derives customer summaries from existing orders and includes name, phone, order count, paid total, latest order and available address details. Search is available by name or phone.

Treat this information as confidential personal data. Use it only for legitimate order operations. Do not export, copy, message, or share customer details outside approved business processes.

## 6. Custom Cakes

Use **Custom Cakes** to review custom cake requests. The workflow includes pending, contacted, confirmed and closed statuses, quote information and proposed fulfilment details. Confirm flavour, weight, theme, reference image, cake message and customer instructions before preparing a quote.

A request should not be treated as a confirmed paid order merely because it has been received or contacted. Follow the business-approved quote acceptance, payment and conversion process. Do not promise availability until the bakery confirms it.

## 7. Inventory

Use **Inventory** to review stock and movement history. Movement reasons in the backend include order reservation, order restore, order commit, manual adjustment, restock and expiry release.

Before a manual stock adjustment, count the physical stock and record the approved reason. Never alter inventory to hide a discrepancy. Escalate unexpected negative stock, repeated reservation failures or unexplained movement history to the technical/operations owner.

## 8. Analytics and reports

Analytics navigation includes overview, sales, products, customers, financial and inventory views, with report routes for sales, products, customers and financial information. Use the date range and filters offered by the page.

Reports are operational summaries, not automatically audited accounts. Confirm calculations and payment reconciliation with the finance owner before sharing externally.

## 9. WhatsApp Centre

The admin navigation includes a WhatsApp Centre for message statistics, message history, message detail, retry, consent records and notification preferences.

**Current compliance restriction:** project records state that the WhatsApp templates are not submitted/approved/enabled and the legal/compliance consent evidence remains incomplete. Do not retry or initiate customer messages in production until the business/legal owner has supplied written approval, the templates and provider setup are approved, and a separately authorized test/release process is completed. A phone number is not proof of consent.

## 10. Payments

Use the Payments area to review payment-related records only according to the finance team's approved procedure. Verify online payments against Razorpay's authorized dashboard/webhook evidence. Do not manually mark a payment as paid, alter identifiers or initiate refunds without documented authorization.

## 11. Settings

The Settings page exposes controls for:
- Online ordering on/off.
- Delivery on/off.
- Pickup on/off.
- Customer-facing closed message.
- Optional reopen date/time.
- Maximum Cash on Delivery amount.

The page states that disabling online orders prevents new orders but does not affect existing orders. The backend enforces the store settings when an order is created. These settings directly affect customer checkout; obtain business approval before changing them and verify the storefront afterwards.

## 12. Reports and logout

Generate or view reports only for approved business purposes and share them through authorized channels. Avoid downloading or distributing unnecessary personal data. Log out at the end of each session and do not leave shared workstations unattended.

## 13. Troubleshooting and escalation

| Issue | Action |
|---|---|
| Admin login rejected | Confirm account provisioning with the named admin owner; do not share credentials. |
| Dashboard metrics unavailable | Check service status and report the timestamp/error to the technical owner. |
| Product/order save fails | Do not repeatedly submit uncertain changes; capture the error and verify whether the change persisted. |
| Payment discrepancy | Escalate to finance and technical owners; reconcile with provider records. |
| Inventory mismatch | Recount stock and escalate before adjustment. |
| WhatsApp message failure | Do not repeatedly retry; check consent/template/provider authorization first. |
| Settings change affects checkout | Restore only with owner approval and verify current backend settings. |
| Suspected account compromise | Notify the security/technical owner and follow the credential/session revocation procedure. |

## 14. Required business inputs before publication

- Named admin roles, access provisioning and account recovery contacts.
- Order handling, cancellation, refund, delivery, pickup and reschedule SOPs.
- Product pricing, discount and inventory adjustment approval limits.
- Finance reconciliation and refund authorization procedure.
- Customer privacy, retention and data export rules.
- Approved WhatsApp consent, templates, suppression and escalation policy.
- Support hours, SLAs and incident escalation contacts.
- Current screenshots and admin training/UAT evidence.

## Approval record

| Review | Status |
|---|---|
| Source-derived technical draft | Prepared |
| Business process review | Pending |
| Security/admin role review | Pending |
| Screenshot capture and training | Pending |
| Admin UAT | Not evidenced |
| Client approval for publication | Pending |
