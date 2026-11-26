import { Router } from "express";
import jwt from "jsonwebtoken";

import {
  createCustomCakeRequest,
  getAllCustomCakeRequests,
  getMyCustomCakeRequests,
  getCustomCakeRequestById,
  updateCustomCakeRequestStatus,
  proposeProposal,
  respondProposal,
  convertCustomCakeRequestToOrder,
} from "../controllers/customCakeController.js";
import { authenticateAdmin, authenticateCustomer, optionalCustomerAuth, type AuthRequest } from "../middleware/auth.js";
import { createCustomCakeRequestLimiter } from "../middleware/rateLimit.js";

const router: Router = Router();

// Create custom cake request (public)
router.post("/", createCustomCakeRequestLimiter, createCustomCakeRequest);

// Get all custom cake requests (admin only)
router.get("/", authenticateAdmin, getAllCustomCakeRequests);

// Get authenticated customer's own requests
router.get("/my", authenticateCustomer, getMyCustomCakeRequests);

// Get single custom cake request (admin or owning customer). Admin browser
// sessions use admin-token; customer sessions use customer-token.
router.get(
  "/:id",
  (req, res, next) => {
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = req.cookies?.["admin-token"] ?? bearerToken;
    const decoded = token ? jwt.decode(token) : null;
    if (req.cookies?.["admin-token"] || (decoded && typeof decoded === "object" && "adminId" in decoded)) {
      return authenticateAdmin(req as AuthRequest, res, next);
    }
    return optionalCustomerAuth(req as AuthRequest, res, next);
  },
  getCustomCakeRequestById,
);

// Update custom cake request status (admin only)
router.patch("/:id/status", authenticateAdmin, updateCustomCakeRequestStatus);

// Propose price and delivery (admin only)
router.patch(
  "/:id/propose",
  authenticateAdmin,
  proposeProposal,
);

// Respond to proposal (customer only)
router.patch(
  "/:id/respond",
  authenticateCustomer,
  respondProposal,
);

// Convert accepted custom cake request to order (admin only)
router.patch(
  "/:id/convert",
  authenticateAdmin,
  convertCustomCakeRequestToOrder,
);

export default router;
