import { Router } from "express";

import {
  createOrder,
  getOrderByNumber,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Create a new order (public)
router.post("/", createOrder);

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
  getOrderByNumber,
);

export default router;