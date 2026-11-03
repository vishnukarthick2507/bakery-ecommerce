
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

/*
|--------------------------------------------------------------------------
| PHONE NORMALIZATION FOR RATE-LIMIT KEYS
|--------------------------------------------------------------------------
| Mirrors the normalization used by customerAuthController so the same mobile
| number (with or without spaces, dashes, or a leading +91/91 country code)
| always maps to the same rate-limit bucket. Values that are missing, empty,
| or not a valid 10-digit Indian mobile number collapse to a single shared
| "unknown" bucket, so a client cannot bypass rate limiting by repeatedly
| changing the request body.
*/
function normalizePhone(phone: unknown): string {
  if (typeof phone !== "string" || phone.length === 0) {
    return "unknown";
  }
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  const normalized = cleaned.replace(/^(\+91|91)/, "");
  return /^[6-9]\d{9}$/.test(normalized) ? normalized : "unknown";
}

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 OTP sends per phone/IP per hour
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again after 1 hour.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const phone = normalizePhone(req.body?.phone);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${phone}:${ipKey}`;
  },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 OTP verification attempts per phone/IP per 15 minutes
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
    const phone = normalizePhone(req.body?.phone);
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${phone}:${ipKey}`;
  },
});
