import { Router } from "express";

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
} from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middleware/auth.js";
import {
  adminLoginLimiter,
  customerLoginLimiter,
  customerRegisterLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from "../middleware/rateLimit.js";

const router = Router();

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
router.post("/logout", adminLogout);

// OTP send and verify (customer authentication)
router.post("/otp/send", otpSendLimiter, sendOtp);
router.post("/otp/verify", otpVerifyLimiter, verifyOtp);

router.post("/register", customerRegisterLimiter, registerCustomer);
router.post("/customer/login", customerLoginLimiter, loginCustomer);
router.get("/me", authenticateCustomer, getCurrentCustomer);
router.post("/logout", authenticateCustomer, logoutCustomer);

export default router;
