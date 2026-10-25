import { Router } from "express";

import { adminLogin, verifyToken } from "../controllers/authController.js";
import {
	getCurrentCustomer,
	loginCustomer,
	logoutCustomer,
	registerCustomer,
} from "../controllers/customerAuthController.js";
import { authenticateCustomer } from "../middleware/auth.js";

const router = Router();

/*
||--------------------------------------------------------------------------
|| AUTH ROUTES
||--------------------------------------------------------------------------
*/

// Admin login
router.post("/login", adminLogin);

// Verify token
router.get("/verify", verifyToken);

router.post("/register", registerCustomer);
router.post("/customer/login", loginCustomer);
router.get("/me", authenticateCustomer, getCurrentCustomer);
router.post("/logout", authenticateCustomer, logoutCustomer);



export default router;
