import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import {
  adminLogin,
  verifyToken,
  adminMe,
  adminLogout,
  brevoSmtpDiagnostic,
} from "../controllers/authController.js";
import {
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  sendOtp,
  verifyOtp,
  completeRegistration,
  googleAuth,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  updateProfile,
  changePassword,
} from "../controllers/customerAuthController.js";
import { authenticateCustomer, authenticateAdmin } from "../middleware/auth.js";
import {
  adminLoginLimiter,
  customerLoginLimiter,
  customerRegisterLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
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

router.get(
  "/diagnostics/brevo-smtp",
  authenticateAdmin,
  brevoSmtpDiagnostic,
);

// Customer registration (password-based with email OTP verification)
router.post("/register", customerRegisterLimiter, registerCustomer);

// Customer login (email/password)
router.post("/customer/login", customerLoginLimiter, loginCustomer);

// Google OAuth sign-in (ID token verification)
router.post("/google", customerLoginLimiter, googleAuth);

// OTP send
router.post("/otp/send", otpSendLimiter, sendOtp);

// OTP verify
router.post("/otp/verify", otpVerifyLimiter, verifyOtp);

// Registration complete
router.post(
  "/otp/register-complete",
  setVerifiedEmailForRegistrationLimit,
  otpVerifyLimiter,
  completeRegistration,
);

// Forgot password
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);

// Verify reset OTP
router.post("/verify-reset-otp", otpVerifyLimiter, verifyResetOtp);

// Reset password
router.post("/reset-password", resetPasswordLimiter, resetPassword);

// Customer session
router.get("/me", authenticateCustomer, getCurrentCustomer);

// Customer profile update
router.patch("/profile", authenticateCustomer, updateProfile);

// Customer password change
router.post(
  "/change-password",
  authenticateCustomer,
  changePasswordLimiter,
  changePassword,
);

export default router;
