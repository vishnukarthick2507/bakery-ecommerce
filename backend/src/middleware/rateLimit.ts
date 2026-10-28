
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

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 OTP sends per identifier/IP per hour
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again after 1 hour.",
  },
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    const identifier = req.body?.identifier || "unknown";
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${identifier}:${ipKey}`;
  },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 OTP verification attempts per identifier/IP per 15 minutes
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
    const identifier = req.body?.identifier || "unknown";
    const ipKey = ipKeyGenerator(req.ip ?? "127.0.0.1");
    return `${identifier}:${ipKey}`;
  },
});
