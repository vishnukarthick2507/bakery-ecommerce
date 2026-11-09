import { Router } from "express";

import {
  getInventoryMovements,
} from "../controllers/inventoryMovementController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router: Router = Router();

// Get inventory movement history (admin only, paginated)
router.get("/movements", authenticateAdmin, getInventoryMovements);

export default router;
