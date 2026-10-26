import { Router } from "express";

import {
  getAnalytics,
  exportAnalytics,
} from "../controllers/analyticsController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Get analytics data (admin only)
router.get("/analytics", authenticateAdmin, getAnalytics);

// Export analytics to Excel (admin only)
router.get("/analytics/export", authenticateAdmin, exportAnalytics);

export default router;
