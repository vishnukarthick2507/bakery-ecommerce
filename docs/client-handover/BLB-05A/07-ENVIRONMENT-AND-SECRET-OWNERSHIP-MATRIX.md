# Environment Variable and Secret Ownership Matrix

**Project:** Bluebell Bakehouse / S.V. Sweets & Bakers  
**Status:** Names-only source inventory; values, production configuration and secret ownership are not verified  
**Date:** 26 November 2026

## Handling rules

- This document intentionally contains variable names only. Never place secret values, access tokens, passwords, OTP secrets, connection strings or private keys in Git.
- Store secrets in the relevant hosting/provider secret manager and restrict access to named operators.
- Frontend variables prefixed with `NEXT_PUBLIC_` are exposed to browser bundles and must contain only values safe for public exposure (for example public API origin and OAuth client ID). Never put secrets in these variables.
- Values in `.env.example` are development placeholders, not evidence of production values.
- Confirm each variable's environment, owner, rotation procedure and deployment target before release.

## Frontend / Next.js

Source: root `.env.example`, `next.config.mjs`, root package/build configuration.

| Variable | Purpose | Secret? | Production value/status |
|---|---|---:|---|
| `NEXT_PUBLIC_API_URL` | Browser-facing API origin used by frontend API calls. | No, public | Must point to approved backend URL; not verified. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public site URL used for links/notifications. | No, public | Canonical domain not owner-confirmed; D20-01 unresolved. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Identity Services web client ID. | No, public identifier | OAuth client/origins not verified. |
| `BACKEND_INTERNAL_URL` | Server-side Next.js proxy destination for Express backend. | No, URL | Hosting network route not verified. |
| `JWT_SECRET` | Shared secret used for edge/session token verification. | **Yes** | Must be strong, consistent with backend where required, stored only in secret manager; not verified. |

## Backend / Express

Source: `backend/.env.example` and source-level integration configuration.

| Variable | Purpose | Secret? | Production value/status |
|---|---|---:|---|
| `MONGODB_URI` | MongoDB connection string. | **Yes** | Production cluster/user/network access not verified. |
| `PORT` | Express listener port. | No | Hosting-specific value not verified. |
| `CORS_ORIGIN` | Allowed frontend origin(s). | No | Must match approved production origin; not verified. |
| `JWT_SECRET` | Customer/admin JWT signing and verification secret. | **Yes** | Strong secret and rotation owner required; not verified. |
| `OTP_SECRET` | HMAC secret for OTP handling. | **Yes** | Separate strong secret and rotation owner required; not verified. |
| `RAZORPAY_KEY_ID` | Razorpay API key identifier. | Sensitive configuration | Live/sandbox account and environment not verified. |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret. | **Yes** | Must remain server-side; not verified. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret. | **Yes** | Must match configured webhook endpoint; not verified. |
| `ADMIN_NOTIFICATION_EMAIL` | Recipient for admin security/operational email alerts. | Personal/business contact | Owner and mailbox access not supplied. |
| `BREVO_API_KEY` | Brevo email API credential. | **Yes** | Sender/domain and provider access not verified. |
| `BREVO_FROM_EMAIL` | Transactional sender address. | No, but controlled identity | Sender verification not verified. |
| `BREVO_FROM_NAME` | Transactional sender display name. | No | Current example is S.V. Sweets & Bakers; owner approval required. |
| `EMAIL_EXTERNAL_DELIVERY_BLOCKED` | Blocks all external email delivery when true; missing defaults false, invalid values fail startup. | No | Must be explicitly reviewed per environment; not verified. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account/cloud identifier. | No | Production cloud not verified. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. | Sensitive configuration | Production account not verified. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. | **Yes** | Must remain server-side; not verified. |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API access token. | **Yes** | No live-send authorization; do not enable messaging. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp sender number ID. | No, identifier | Business account ownership/configuration not verified. |
| `WHATSAPP_API_VERSION` | Meta Graph API version. | No | Example defaults to v18.0; owner/technical review required. |
| `WHATSAPP_APP_SECRET` | Meta app secret for webhook verification. | **Yes** | Provider setup not verified. |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token. | **Yes** | Must be configured consistently with Meta webhook; not verified. |

## CI-only values

GitHub Actions defines non-production placeholder values for the Next.js build and tests, including `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `BACKEND_INTERNAL_URL`, and `JWT_SECRET`. These are CI-only placeholders and must never be copied into production.

## Required owner/operations completion

| Control | Required evidence | Status |
|---|---|---|
| Environment-by-environment variable inventory | Dev, CI, staging and production mapping | Partial; names inventoried |
| Secret owner and access list | Named custodian and least-privilege roles | Not supplied |
| Secret rotation | Rotation cadence, emergency revocation and owner | Not supplied |
| Production value verification | Redacted configuration review by authorized operator | Not performed |
| Public variable review | Confirm no secrets in `NEXT_PUBLIC_*` | Required before release |
| Domain/CORS/OAuth alignment | Approved domains, origins and callback URLs | Not verified |
| Provider sandbox/live separation | Distinct keys and endpoints; no live values in staging | Not verified |
| Backup/recovery credentials | Access path and recovery owner | Not supplied |
| WhatsApp legal/Meta gate | W01 legal evidence, Meta business/template approval and separate execution authorization | Blocked |

## Sign-off

This matrix is a source-derived inventory only. It does not prove that any production environment variable is configured correctly or that the connected hosting accounts have been inspected. Production configuration verification must be performed by an authorized owner without exposing secret values.
