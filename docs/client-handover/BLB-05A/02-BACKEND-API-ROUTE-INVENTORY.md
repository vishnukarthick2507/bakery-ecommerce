# Backend API Route Inventory

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Source-derived route inventory — not a live API contract  
**Branch:** `fix/api-product-data-access`  
**Prepared:** 2026-11-26

## Purpose and evidence boundary

This document records the Express route mounts and route handlers found in `backend/src/server.ts` and the route modules listed below. It is intended as a handover starting point for developers and operators.

- This is a static source inspection, not a live endpoint test.
- Request schemas, response examples, status-code catalogues, pagination contracts, and error payloads are not exhaustively specified here.
- Authentication labels describe middleware visible on the route. Controller-level ownership checks and provider verification may add further requirements.
- Do not use this document as authorization to call live payment, messaging, upload, or production endpoints.

## Service entry points

| Method | Path | Purpose / notes |
|---|---|---|
| GET | `/` | Backend service identification response. |
| GET | `/health` | Health response includes service status and database connected/disconnected state. |

The server applies Helmet, cookie parsing, request IDs, CSRF protection, CORS allowlisting with credentials, JSON parsing, and raw-body parsing for Razorpay and WhatsApp webhooks. The webhook raw parsers are mounted before `express.json()` so signature verification can use the original request bytes. The app sets Express `trust proxy` to 1; deployment proxy topology must be checked before relying on IP-based controls.

## Mounted API groups

| Mount path | Route module | Scope |
|---|---|---|
| `/api/products` | `productRoutes.ts` | Public catalogue reads; admin product management. |
| `/api/orders` | `orderRoutes.ts` | Order creation, customer order history, guest tracking, admin order operations. |
| `/api/custom-cake-requests` | `customCakeRoutes.ts` | Public custom-cake submission; customer and admin request workflows. |
| `/api/payments` | `paymentRoutes.ts` | Razorpay order creation, retry, verification, webhook. |
| `/api/auth` and `/api/admin` | `authRoutes.ts` | Customer and admin authentication/session routes, mounted under both prefixes. |
| `/api/admin` | `analyticsRoutes.ts` | Admin analytics. |
| `/api/admin/orders` | `adminOrderRoutes.ts` | Admin order operations. |
| `/api/admin/customers` | `adminCustomerRoutes.ts` | Admin customer operations. |
| `/api/admin/inventory` | `adminInventoryRoutes.ts` | Admin inventory operations. |
| `/api/admin/uploads` | `uploadRoutes.ts` | Admin upload-signature operations. |
| `/api/customer/uploads` | `customerUploadRoutes.ts` | Customer upload-signature operations. |
| `/api/settings` | `settingsRoutes.ts` | Store settings. |
| `/api/admin/whatsapp` | `adminWhatsAppRoutes.ts` | Admin WhatsApp operations. |
| `/api/whatsapp` | `whatsappRoutes.ts`, `whatsappWebhookRoutes.ts` | WhatsApp integration and inbound webhook. |

## Route-level inventory

### Products — `backend/src/routes/productRoutes.ts`

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| GET | `/api/products` | Public unless `includeInactive=true`; that query requires admin authentication | Public response is restricted to customer-facing product fields by the current controller. |
| GET | `/api/products/slug/:slug` | Public | Product detail by slug; public-field projection is applied in controller. |
| GET | `/api/products/:id` | Public | Product detail by ID; public-field projection is applied in controller. |
| POST | `/api/products` | Admin | Create product. |
| PATCH | `/api/products/:id` | Admin | Update product. |
| DELETE | `/api/products/:id` | Admin | Disable product (route comment; verify controller semantics before operational use). |

### Orders — `backend/src/routes/orderRoutes.ts`

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| POST | `/api/orders` | Public; optional customer authentication | Rate-limited before optional authentication and creation. |
| GET | `/api/orders/me` | Customer | Current customer's order list. |
| GET | `/api/orders/me/:orderNumber` | Customer | Current customer's order detail. |
| POST | `/api/orders/track` | Public | Guest tracking; rate-limited. Treat returned order/contact details as sensitive. |
| GET | `/api/orders` | Admin | Admin order list. |
| PATCH | `/api/orders/:orderNumber/status` | Admin | Update order status. |
| POST | `/api/orders/:orderNumber/mark-paid` | Admin | Mark eligible PAY_AT_STORE order paid. |
| PATCH | `/api/orders/:orderNumber/archive` | Admin | Archive order. |
| PATCH | `/api/orders/:orderNumber/restore` | Admin | Restore order. |
| POST | `/api/orders/:id/proposal/accept` | Customer | Accept proposal; controller must enforce ownership/state. |
| POST | `/api/orders/:id/proposal/decline` | Customer | Decline proposal; controller must enforce ownership/state. |
| POST | `/api/orders/:id/proposal/request-alternative` | Customer | Request alternative slot; controller must enforce ownership/state. |
| GET | `/api/orders/:orderNumber` | Public with optional customer authentication | Controller applies order lookup/access rules; verify exact disclosure requirements before sharing tracking details. |

### Custom cake requests — `backend/src/routes/customCakeRoutes.ts`

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| POST | `/api/custom-cake-requests` | Public | Rate-limited; controller performs request validation and abuse/idempotency controls. |
| GET | `/api/custom-cake-requests` | Admin | Admin request list. |
| GET | `/api/custom-cake-requests/my` | Customer | Current customer's requests. |
| GET | `/api/custom-cake-requests/:id` | Admin or owning customer | Route selects admin or optional customer authentication; controller enforces ownership. |
| PATCH | `/api/custom-cake-requests/:id/status` | Admin | Update request status. |
| PATCH | `/api/custom-cake-requests/:id/propose` | Admin | Propose price/delivery. |
| PATCH | `/api/custom-cake-requests/:id/respond` | Customer | Customer proposal response. |
| PATCH | `/api/custom-cake-requests/:id/convert` | Admin | Convert accepted request to order. |

### Payments — `backend/src/routes/paymentRoutes.ts`

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| POST | `/api/payments/create-order` | Public with optional customer authentication | Rate-limited; creates payment order. |
| POST | `/api/payments/retry` | Public with optional customer authentication | Rate-limited; controller validates order/customer context. |
| POST | `/api/payments/verify` | Public with optional customer authentication | Rate-limited; controller verifies payment signature/state. |
| POST | `/api/payments/webhook` | Provider webhook | Raw request body is preserved for signature verification; controller verifies provider authenticity. |

### Authentication — `backend/src/routes/authRoutes.ts`

This router is mounted twice: at `/api/auth` and `/api/admin`. Therefore paths below have both prefixes unless the controller/mount-aware logic intentionally distinguishes them.

| Method | Route suffix | Access at route | Notes |
|---|---|---|---|
| POST | `/login` | Public, rate-limited | Admin login. |
| GET | `/verify` | Token verification handler | Verify session/token. |
| GET | `/me` | Session-introspection chain | Admin/customer session resolution is mount-aware. |
| POST | `/logout` | Mount-aware admin logout or customer auth | Clears relevant session. |
| GET | `/diagnostics/brevo-smtp` | Admin | Email diagnostics; do not expose diagnostic output publicly. |
| POST | `/register` | Public, rate-limited | Customer registration. |
| POST | `/customer/login` | Public, rate-limited | Customer login. |
| POST | `/google` | Public, rate-limited | Google ID-token authentication. |
| POST | `/otp/send` | Public, rate-limited | Send registration/login OTP as implemented. |
| POST | `/otp/verify` | Public, rate-limited | Verify OTP. |
| POST | `/otp/register-complete` | Public, rate-limited | Complete registration after verified-email token. |
| POST | `/forgot-password` | Public, rate-limited | Start password recovery. |
| POST | `/verify-reset-otp` | Public, rate-limited | Verify password-reset OTP. |
| POST | `/reset-password` | Public, rate-limited | Complete password reset. |
| PATCH | `/profile` | Customer | Update customer profile. |
| POST | `/change-password` | Customer, rate-limited | Change password. |

### Uploads

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| POST | `/api/admin/uploads/signature` | Admin | Upload signature route; verify exact upload controller contract. |
| POST | `/api/customer/uploads/signature` | Customer | Cloudinary upload signature. |

### WhatsApp webhook

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| GET | `/api/whatsapp/webhook/verify` | Provider verification callback | Meta subscription verification. |
| GET | `/api/whatsapp/webhook` | Provider verification callback | Same verification handler is also registered here. |
| POST | `/api/whatsapp/webhook` | Provider webhook | Raw-body signature verification; inbound messages/status callbacks. |

### Admin operations and settings

| Method | Full path | Access at route | Notes |
|---|---|---|---|
| POST | `/api/admin/orders/:id/propose-slot` | Admin | Propose a new fulfilment slot for an order. |
| GET | `/api/admin/customers` | Admin | Paginated/searchable customer listing (controller contract not exhaustively documented here). |
| PATCH | `/api/admin/customers/:id/active` | Admin | Toggle customer active status. |
| GET | `/api/admin/inventory/movements` | Admin | Paginated inventory movement history. |
| GET | `/api/settings` | Public | Returns storefront fulfilment/order toggle settings and customer-facing closure details; confirm response projection before exposing changes. |
| PATCH | `/api/settings` | Admin | Update singleton store settings. |

### Analytics — `backend/src/routes/analyticsRoutes.ts`

All routes below require admin authentication:

| Method | Full path | Purpose |
|---|---|---|
| GET | `/api/admin/analytics` | Analytics overview. |
| GET | `/api/admin/analytics/export` | Export analytics to Excel. |
| GET | `/api/admin/analytics/sales` | Sales analytics. |
| GET | `/api/admin/analytics/products` | Product performance analytics. |
| GET | `/api/admin/analytics/customers` | Customer intelligence analytics. |
| GET | `/api/admin/analytics/financial` | Financial analytics. |
| GET | `/api/admin/analytics/inventory` | Inventory analytics. |
| GET | `/api/admin/analytics/reports/sales` | Sales PDF report. |
| GET | `/api/admin/analytics/reports/products` | Product PDF report. |
| GET | `/api/admin/analytics/reports/customers` | Customer PDF report. |
| GET | `/api/admin/analytics/reports/financial` | Financial PDF report. |

### WhatsApp admin — `backend/src/routes/adminWhatsAppRoutes.ts`

All routes in this module require admin authentication via router-level middleware:

| Method | Full path | Purpose |
|---|---|---|
| GET | `/api/admin/whatsapp/stats` | WhatsApp statistics. |
| GET | `/api/admin/whatsapp/messages` | Message list. |
| GET | `/api/admin/whatsapp/messages/:id` | Message detail. |
| POST | `/api/admin/whatsapp/messages/:id/retry` | Retry a message; may cause an external send and must not be used casually in production. |
| GET | `/api/admin/whatsapp/consents` | Consent records. |
| GET | `/api/admin/whatsapp/preferences` | Notification preferences. |
| PATCH | `/api/admin/whatsapp/preferences` | Update notification preferences. |

### Public WhatsApp consent endpoints — `backend/src/routes/whatsappRoutes.ts`

| Method | Full path | Access | Current behavior |
|---|---|---|---|
| GET | `/api/whatsapp/consent/status` | Public | Explicitly disabled; returns HTTP 410 with `CONSENT_ENDPOINT_DISABLED`. |
| POST | `/api/whatsapp/consent/grant` | Public | Explicitly disabled; returns HTTP 410 with `CONSENT_ENDPOINT_DISABLED`. |
| POST | `/api/whatsapp/consent/withdraw` | Public | Explicitly disabled; returns HTTP 410 with `CONSENT_ENDPOINT_DISABLED`. |

The route module comments state that public phone-number-only consent endpoints were disabled because they did not verify phone ownership. Internal consent workflows and the inbound Meta STOP handling remain separate. A verified, ownership-bound customer flow is required before reintroducing public self-service consent operations.

## Source files inspected

The source list below is expanded to include the remaining admin and settings route modules:

- `backend/src/routes/adminOrderRoutes.ts`
- `backend/src/routes/adminCustomerRoutes.ts`
- `backend/src/routes/adminInventoryRoutes.ts`
- `backend/src/routes/analyticsRoutes.ts`
- `backend/src/routes/settingsRoutes.ts`
- `backend/src/routes/adminWhatsAppRoutes.ts`
- `backend/src/routes/whatsappRoutes.ts`
- `backend/src/routes/uploadRoutes.ts`

## Security and operational notes

1. Do not expose internal product fields (for example cost, stock/reorder controls) through public catalogue responses. The current PR branch includes public-field projections and admin authentication for inactive-product listing; that change is not yet merged.
2. Guest order tracking and public custom-cake submission are public entry points. Keep rate limiting, input validation, anti-enumeration, ownership checks, and privacy-safe responses in place.
3. Razorpay and WhatsApp webhook handlers require the original raw request bytes for signature verification. Do not move JSON parsing ahead of the raw-body mounts.
4. Route-level access is not a substitute for controller-level authorization and ownership checks.
5. Do not send real customer messages or initiate live payment actions during documentation or test validation.
6. Rate-limit controls described in source use process-local in-memory stores in the reviewed implementation; multi-instance deployments need an appropriate shared control layer or edge protection.
7. WhatsApp notification consent policy and legal wording are not approved in the project decision record. A phone number alone is not consent; do not enable automated sends until explicit policy approval and auditable consent handling are completed.

## Required completion before this is a client API reference

- Add request and response schemas/examples from the Zod validators/controllers.
- Record all success/error status codes and error envelope conventions.
- Document pagination, sorting, filtering, idempotency, and webhook retry semantics.
- Document cookie names, token lifetimes, CSRF expectations, and role/ownership matrix without exposing secrets.
- Verify deployed base URLs and environment-specific routes with approved staging access.
- Generate or validate an OpenAPI specification and keep it synchronized with route tests.
- Obtain technical owner review and client approval.

## Source files inspected

- `backend/src/server.ts`
- `backend/src/routes/productRoutes.ts`
- `backend/src/routes/orderRoutes.ts`
- `backend/src/routes/paymentRoutes.ts`
- `backend/src/routes/authRoutes.ts`
- `backend/src/routes/customCakeRoutes.ts`
- `backend/src/routes/customerUploadRoutes.ts`
- `backend/src/routes/whatsappWebhookRoutes.ts`
