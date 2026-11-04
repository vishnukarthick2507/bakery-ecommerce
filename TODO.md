# Brevo Email OTP Diagnostic — Complete

## Changes Made

### Backend
- `backend/src/controllers/authController.ts` — Added `brevoSmtpDiagnostic` controller method. Calls `verifyBrevoSmtpConnection()` and returns `{ smtpConfigured, smtpConnectionOk, error? }`. No credentials/OTP/customer data exposed.
- `backend/src/routes/authRoutes.ts` — Added `GET /api/admin/diagnostics/brevo-smtp` route protected by `authenticateAdmin` middleware. Imports `brevoSmtpDiagnostic` and `authenticateAdmin`.

### Frontend
- No changes (diagnostic is backend-only; tested via authenticated admin session).

### Tests (`backend/tests/adminAuth.test.ts`)
- Added `verifyBrevoSmtpConnection` mock.
- `rejects unauthorized access without admin token` → expects 401 without cookie.
- `returns diagnostic result for authenticated admin` → logs in as admin, hits endpoint with cookie, expects 200 with `smtpConfigured: true`, `smtpConnectionOk: true`, no `error`, no credentials.
- `returns failure detail when SMTP verification fails` → mocks verify failure, expects `smtpConnectionOk: false`, `error: "Invalid login"`.

## Security
- Endpoint protected by existing `authenticateAdmin` middleware (httpOnly admin-token cookie or Bearer header).
- Returns only `{ smtpConfigured, smtpConnectionOk, error? }` — no SMTP credentials, no OTPs, no customer data, no env values.
- Does not send email (uses `transporter.verify()` only).

## Test Results
- `adminAuth.test.ts` + `emailService.test.ts`: **24/24 passed**
- Frontend TypeScript `tsc --noEmit`: clean
- Previous full backend suite: **211/211 passed** (before diagnostic addition)

## How to Test Through an Authenticated Admin Session

### Step 1: Log in as admin
```
POST https://bakery-ecommerce-staging.onrender.com/api/auth/login
Content-Type: application/json
{ "username": "<admin>", "password": "<password>" }
```
Capture the `admin-token` httpOnly cookie from `Set-Cookie`.

### Step 2: Call the diagnostic endpoint
```
GET https://bakery-ecommerce-staging.onrender.com/api/admin/diagnostics/brevo-smtp
Cookie: admin-token=<captured-token>
```

### Expected responses
| Scenario | Response |
|----------|----------|
| Not authenticated | `401 { "message": "Authentication required" }` |
| SMTP configured + connection OK | `200 { "smtpConfigured": true, "smtpConnectionOk": true }` |
| SMTP configured + auth/connection failure | `200 { "smtpConfigured": true, "smtpConnectionOk": false, "error": "<safe code>" }` |
| SMTP not configured (missing env vars) | `200 { "smtpConfigured": false, "smtpConnectionOk": false, "error": "Brevo SMTP is not configured" }` |

### Interpretation
- `smtpConfigured: false` → Missing `BREVO_SMTP_HOST`/`BREVO_SMTP_USER`/`BREVO_SMTP_KEY`/`BREVO_FROM_EMAIL` in Render backend env vars.
- `smtpConfigured: true, smtpConnectionOk: false` → Brevo credentials invalid or sender not verified in Brevo dashboard.
- Both `true` → SMTP is working; the OTP delivery issue is elsewhere.

## Manual Cleanup
Remove the temporary diagnostic endpoint after troubleshooting:
- Delete `brevoSmtpDiagnostic` from `authController.ts`
- Remove the route from `authRoutes.ts`
- Remove diagnostic tests from `adminAuth.test.ts`

## Constraints Honored
- ✅ No SMTP credentials exposed
- ✅ No OTP/email sent
- ✅ No files modified beyond adding the diagnostic endpoint
- ✅ No environment variables modified
- ✅ No commit, push, or deploy
- ✅ OTP security untouched
