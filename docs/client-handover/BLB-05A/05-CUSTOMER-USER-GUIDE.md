# Customer User Guide

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Version:** Draft — source-derived, pending client review and UAT  
**Date:** 26 November 2026

## About this guide

This guide describes the customer-facing website journeys visible in the current frontend source. It is not a record of successful UAT. Button labels, delivery coverage, business contact details, prices, policies and final production URLs must be confirmed by the business before publication.

## 1. Browse the bakery

1. Open the business-approved website address. The canonical production domain has not yet been confirmed in the project owner decision register; do not distribute a preview URL as the production address.
2. Use the home page to browse featured products, categories, offers and bakery information.
3. Select **Shop** / **All products** to browse the catalogue.
4. Use available category, search, availability and sort controls to narrow the catalogue.
5. Open a product to view its description, price, images and availability.
6. Add the desired item and quantity to the cart. Review the cart before checkout.

Availability labels are driven by catalogue data. Products marked available now are presented as available for immediate pickup or delivery, subject to the checkout settings and final backend validation.

## 2. Place an order

The checkout page uses a five-step flow:

1. **Your details** — enter customer name, email where requested, and a reachable phone number.
2. **Delivery or pickup** — select one of the fulfilment methods currently enabled by the store.
3. **Date & time** — select an available date and time slot.
4. **Payment** — choose from the payment methods enabled and permitted for the order. Source currently supports online payment, cash on delivery and pay at store, subject to store settings and eligibility.
5. **Confirm** — review the order details and total before submitting.

For delivery, provide the requested address and a valid six-digit Indian PIN code. Pickup orders do not require a delivery address. Store settings, delivery/pickup availability and COD limits are enforced by the backend; a choice shown on screen may still be rejected if the store's current rules do not permit it.

### Online payment

When online payment is selected, the site loads the Razorpay checkout flow. Complete payment only in the official payment window and do not share OTPs, card PINs or banking credentials with anyone. Wait for the website's confirmation before retrying or placing another order. If the payment result is unclear, retain the order reference and contact the business through its verified support channel.

### Order confirmation and tracking

After successful order placement, retain the order number. Use the site's order history or public order-tracking page where available. Guest tracking may ask for the phone number used at checkout. Do not share an order number and phone number publicly.

Customer account pages include order history and order detail views. Account-specific functions require signing in.

## 3. Create an account or sign in

Use the account registration/sign-in pages and enter only your own details. Google sign-in is available only if it has been configured and enabled for the deployed environment. If sign-in fails, check the email/phone entered and use the business-approved support contact.

## 4. Request a custom cake

1. Open the **Custom Cake** page.
2. Provide the requested contact details and cake requirements, including flavour, weight and theme.
3. Add the cake message, instructions and reference image if those fields are offered.
4. Submit the request and retain the reference number shown by the site.
5. The bakery team reviews the request and may contact you with a quote and proposed fulfilment details.
6. Sign in to the relevant customer account page to review a request and its current status where supported.

A custom-cake request is not a confirmed order until the bakery has confirmed the terms and the required order/payment process is complete. Do not treat a quote or pending request as a confirmed booking.

## 5. Reschedule proposals

If an authenticated customer account receives a proposed schedule for an order, open the relevant order detail page after signing in. The current account order detail UI supports responding to an eligible proposal, including accepting, declining or requesting an alternative time. The public tracking page does not currently provide these proposal response controls. Follow the instructions shown in the authenticated account.

## 6. Privacy and safe use

- Enter accurate contact and fulfilment details; they are used to process the order.
- Use only the official business website and verified payment window.
- Never send passwords, OTPs, payment credentials or full card details to support staff.
- Keep order references private.
- Review the business's final privacy, cancellation, refund, delivery and contact policies before ordering. These policy details require business confirmation and are not supplied by this source-derived guide.

## 7. Troubleshooting

| Issue | Suggested action |
|---|---|
| Product unavailable | Check availability again or choose another product. |
| Checkout says ordering is closed | Follow the closure message and revisit when ordering resumes. |
| Delivery or pickup option missing | The store may have disabled that fulfilment method. |
| PIN code rejected | Enter a valid six-digit PIN code; check for spaces or letters. |
| Payment window does not open | Check the internet connection and retry once; do not create repeated orders if the result is uncertain. |
| Payment status unclear | Keep the order reference and contact the business using its verified channel. |
| Cannot see an order | Sign in with the account used to place it, or use the supported guest tracking process. |
| Custom-cake request not visible | Sign in with the account used for the request and retain the request reference. |

## 8. Business information to complete before publication

- Confirm canonical production website URL and verified support contact.
- Approve delivery zones, fees, delivery/pickup hours and lead times.
- Publish cancellation, refund, exchange and custom-cake deposit/payment rules.
- Publish privacy notice, data-retention/contact process and notification consent wording.
- Confirm whether Google sign-in and each payment method are enabled in production.
- Add current screenshots from an approved production-like environment and complete customer UAT.

## Approval record

| Review | Status |
|---|---|
| Source-derived technical draft | Prepared |
| Business policy review | Pending |
| Screenshot capture | Pending |
| Customer UAT | Not evidenced |
| Client approval for publication | Pending |
