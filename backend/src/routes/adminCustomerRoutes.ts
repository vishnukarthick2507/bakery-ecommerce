import { Router } from "express";

import {
  getAllCustomers,
  toggleCustomerActive,
} from "../controllers/adminCustomerController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router: Router = Router();

// Get all customers (admin only, paginated, searchable)
router.get("/", authenticateAdmin, getAllCustomers);

// Toggle customer active status (admin only)
router.patch("/:id/active", authenticateAdmin, toggleCustomerActive);

export default router;
