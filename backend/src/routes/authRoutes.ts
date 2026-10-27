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
} from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middleware/auth.js";
import {
  adminLoginLimiter,
  customerLoginLimiter,
  customerRegisterLimiter,
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

router.post("/register", customerRegisterLimiter, registerCustomer);
router.post("/customer/login", customerLoginLimiter, loginCustomer);
router.get("/me", authenticateCustomer, getCurrentCustomer);
router.post("/logout", authenticateCustomer, logoutCustomer);

export default router;
