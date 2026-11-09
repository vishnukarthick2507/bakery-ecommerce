import { Router } from "express";

import { getCustomerUploadSignatureController } from "../controllers/uploadController.js";
import { authenticateCustomer } from "../middleware/auth.js";

const router: Router = Router();

// Generate Cloudinary upload signature (authenticated customers only)
router.post(
  "/signature",
  authenticateCustomer,
  getCustomerUploadSignatureController,
);

export default router;
