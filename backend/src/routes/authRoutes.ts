import { Router } from "express";

import { adminLogin, verifyToken } from "../controllers/authController.js";

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

export default router;
