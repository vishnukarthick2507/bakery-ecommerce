import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import {
  adminLogin,
  verifyToken,
  adminMe,
  adminLogout,
} from "../controllers/authController.js";
import {
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  sendOtp,
  verifyOtp,
  completeRegistration,
} from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middleware/auth.js";
import {
  adminLoginLimiter,
  customerLoginLimiter,
  customerRegisterLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from "../middleware/rateLimit.js";
import { getJwtSecret } from "../config/jwt.js";

const router: Router = Router();

function setVerifiedEmailForRegistrationLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  let verifiedEmail: string | undefined;
  const token = req.cookies?.["otp-registration-token"];

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as {
        email?: unknown;
        purpose?: string;
        accountType?: string;
      };
      if (
        decoded.accountType === "REGISTRATION" &&
        decoded.purpose === "REGISTRATION" &&
        typeof decoded.email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded.email)
      ) {
        verifiedEmail = decoded.email.toLowerCase();
      }
    } catch {
      // Invalid proof tokens share the IP-only rate-limit bucket.
    }
  }

  req.body = {
    ...(req.body && typeof req.body === "object" ? req.body : {}),
    email: verifiedEmail,
  };
  next();
}

/*
||--------------------------------------------------------------------------
|| AUTH ROUTES
||--------------------------------------------------------------------------
*/

// Admin login
router.post("/login", adminLoginLimiter, adminLogin);

// Verify token
router.get("/verify", verifyToken);

// Admin session status (reads httpOnly admin-token cookie)
router.get("/me", adminMe);

router.post(
  "/logout",
  (req, res, next) => {
    if (req.baseUrl === "/api/admin") {
      void adminLogout(req, res);
      return;
    }
    next();
  },
  authenticateCustomer,
  logoutCustomer,
);

router.post("/register", customerRegisterLimiter, registerCustomer);
router.post("/customer/login", customerLoginLimiter, loginCustomer);
router.post("/otp/send", otpSendLimiter, sendOtp);
router.post("/otp/verify", otpVerifyLimiter, verifyOtp);
router.post(
  "/otp/register-complete",
  setVerifiedEmailForRegistrationLimit,
  otpVerifyLimiter,
  completeRegistration,
);
router.get("/me", authenticateCustomer, getCurrentCustomer);

export default router;
