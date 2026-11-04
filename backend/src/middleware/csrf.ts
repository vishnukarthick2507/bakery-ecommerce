import type { Request, Response, NextFunction } from "express";

/*
|--------------------------------------------------------------------------
| CSRF PROTECTION MIDDLEWARE
|--------------------------------------------------------------------------
| Protects cookie-authenticated state-changing requests from Cross-Site
| Request Forgery (CSRF) attacks.
|
| Cookies are set with SameSite=None; Secure in production, which means
* they are sent on cross-origin requests. Without Origin validation, a
* malicious site could make cross-origin state-changing requests that
* include the victim's authentication cookies.
|
| Protection logic:
| - Safe methods (GET, HEAD, OPTIONS) are exempt (no state change).
| - Requests without authentication cookies are exempt (no session to
|   hijack; public endpoints like registration/login don't use cookies).
| - For cookie-authenticated state-changing requests, the Origin header
|   must match a trusted origin. Missing or unexpected origins are
|   rejected with 403.
| - The Razorpay webhook is exempt because it authenticates via its own
|   signature verification and does not use session cookies.
|--------------------------------------------------------------------------
*/

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Authentication cookies that indicate a session is being used.
// If any of these are present, the request is cookie-authenticated and
// requires Origin validation for state-changing methods.
const AUTH_COOKIES = [
  "customer-token",
  "admin-token",
  "otp-registration-token",
  "otp-reset-token",
];

function getTrustedOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    return ["http://localhost:3000"];
  }
  return corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
}

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Safe methods do not change state; no CSRF protection needed.
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Razorpay webhook authenticates via signature verification and does not
  // use session cookies. Exempt from CSRF protection.
  if (req.path === "/api/payments/webhook") {
    return next();
  }

  // Determine whether this request carries authentication cookies. Only
  // cookie-authenticated requests need CSRF protection.
  const cookies = req.cookies || {};
  const hasAuthCookie = AUTH_COOKIES.some((name) => Boolean(cookies[name]));

  if (!hasAuthCookie) {
    return next();
  }

  // Validate the Origin header. Same-origin requests from the browser do
  // not include an Origin header, but those would not carry backend
  // domain cookies either (different domain). A cookie-authenticated
  // cross-origin request must include Origin.
  const origin = req.headers.origin;
  if (!origin) {
    res.status(403).json({
      message: "CSRF protection: Origin header required for authenticated requests",
    });
    return;
  }

  const trustedOrigins = getTrustedOrigins();
  if (!trustedOrigins.includes(origin)) {
    res.status(403).json({
      message: "CSRF protection: untrusted origin",
    });
    return;
  }

  next();
}
