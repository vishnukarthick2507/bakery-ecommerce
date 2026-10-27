import { Router } from "express";

import { getUploadSignatureController } from "../controllers/uploadController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// Generate Cloudinary upload signature (admin only)
router.post(
  "/signature",
  authenticateAdmin,
  getUploadSignatureController,
);

export default router;
