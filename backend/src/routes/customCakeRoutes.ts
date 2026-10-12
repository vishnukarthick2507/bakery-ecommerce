import { Router } from "express";

import {
  createCustomCakeRequest,
  getAllCustomCakeRequests,
  updateCustomCakeRequestStatus,
} from "../controllers/customCakeController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Create custom cake request (public)
router.post("/", createCustomCakeRequest);

// Get all custom cake requests (admin only)
router.get("/", authenticateAdmin, getAllCustomCakeRequests);

// Update custom cake request status (admin only)
router.patch("/:id/status", authenticateAdmin, updateCustomCakeRequestStatus);

export default router;
