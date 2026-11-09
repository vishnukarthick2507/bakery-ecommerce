
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/*
|--------------------------------------------------------------------------
| RATE LIMITING CONFIGURATION
|--------------------------------------------------------------------------
| Production-safe limits tailored for a small bakery e-commerce store.
| Protects authentication and tracking endpoints from brute-force/credential
| stuffing without blocking legitimate customers with typos or NAT/shared IPs.
|--------------------------------------------------------------------------
*/

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

export const customerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

export const customerRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 registrations per IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many accounts created from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

export const guestTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 tracking requests per IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many tracking requests from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 forgot-password requests per email/IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many password reset requests from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${email}:${ipKey}`;
  },
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 reset password attempts per email/IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many password reset attempts from this IP, please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${email}:${ipKey}`;
  },
});

/*
|--------------------------------------------------------------------------
| EMAIL NORMALIZATION FOR RATE-LIMIT KEYS
|--------------------------------------------------------------------------
| Mirrors the email handling used by customerAuthController so the same
| email address (with different casing or surrounding whitespace) always maps
| to the same rate-limit bucket. Values that are missing, empty, or not a
| valid email collapse to a single shared "unknown" bucket, so a client cannot
| bypass rate limiting by repeatedly changing the request body.
*/
function normalizeEmail(email: unknown): string {
  if (typeof email !== "string" || email.length === 0) {
    return "unknown";
  }
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "unknown";
}

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 OTP sends per email/IP per hour
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again after 1 hour.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${email}:${ipKey}`;
  },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 OTP verification attempts per email/IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many OTP verification attempts. Please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${email}:${ipKey}`;
  },
});

export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 password change attempts per IP per 15 minutes
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message:
      "Too many password change attempts. Please try again after 15 minutes.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});
