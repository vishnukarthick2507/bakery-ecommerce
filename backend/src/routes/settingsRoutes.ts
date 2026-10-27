import { Router } from "express";

import {
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Public read: used by the customer checkout UI to gate fulfilment options.
// No secrets are exposed (only toggle states, a message, and a date).
router.get("/", getSettings);

// Admin write: create/update the single settings document.
router.patch("/", authenticateAdmin, updateSettings);

export default router;
