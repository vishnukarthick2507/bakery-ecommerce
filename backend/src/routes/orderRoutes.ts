import { Router } from "express";

import {
  createOrder,
  getOrderByNumber,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = Router();

// Create a new order
router.post("/", createOrder);

// Get all orders
router.get("/", getAllOrders);

// Update order status
router.patch(
  "/:orderNumber/status",
  updateOrderStatus,
);

// Get one order by order number
router.get(
  "/:orderNumber",
  getOrderByNumber,
);

export default router;