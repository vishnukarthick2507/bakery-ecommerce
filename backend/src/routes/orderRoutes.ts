import { Router } from "express";

import {
  createOrder,
  getOrderByNumber,
  getAllOrders,
  updateOrderStatus,
  getMyOrders,
  getMyOrderByNumber,
  trackGuestOrder,
} from "../controllers/orderController.js";
import {
  authenticateAdmin,
  authenticateCustomer,
  optionalCustomerAuth,
} from "../middleware/auth.js";
import { guestTrackingLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Create a new order (public)
router.post("/", optionalCustomerAuth, createOrder);

router.get("/me", authenticateCustomer, getMyOrders);
router.get("/me/:orderNumber", authenticateCustomer, getMyOrderByNumber);
router.post("/track", guestTrackingLimiter, trackGuestOrder);

// Get all orders (admin only)
router.get("/", authenticateAdmin, getAllOrders);

// Update order status (admin only)
router.patch(
  "/:orderNumber/status",
  authenticateAdmin,
  updateOrderStatus,
);

// Get one order by order number (public)
router.get(
  "/:orderNumber",
  optionalCustomerAuth,
  getOrderByNumber,
);

export default router;
