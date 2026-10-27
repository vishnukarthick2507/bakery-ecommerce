import { Router } from "express";

import { proposeSlot } from "../controllers/orderController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Propose a new slot for an order (admin only)
router.post(
  "/:id/propose-slot",
  authenticateAdmin,
  proposeSlot,
);

export default router;
