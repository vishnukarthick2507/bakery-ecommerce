import { Router } from "express";

import { authenticateAdmin } from "../middleware/auth.js";
import {
  getWhatsAppStats,
  listWhatsAppMessages,
  getWhatsAppMessageDetail,
  retryWhatsAppMessage,
  listWhatsAppConsents,
  listNotificationPreferences,
  updateNotificationPreference,
} from "../controllers/adminWhatsAppController.js";

const router: Router = Router();

router.use(authenticateAdmin);

router.get("/stats", getWhatsAppStats);
router.get("/messages", listWhatsAppMessages);
router.get("/messages/:id", getWhatsAppMessageDetail);
router.post("/messages/:id/retry", retryWhatsAppMessage);
router.get("/consents", listWhatsAppConsents);
router.get("/preferences", listNotificationPreferences);
router.patch("/preferences", updateNotificationPreference);

export default router;
