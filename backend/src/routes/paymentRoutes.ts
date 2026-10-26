import { Router } from "express";

import {
  createPaymentOrder,
  retryPayment,
  verifyPayment,
  handleWebhook,
} from "../controllers/paymentController.js";
import { optionalCustomerAuth } from "../middleware/auth.js";

const router = Router();

router.post("/create-order", optionalCustomerAuth, createPaymentOrder);
router.post("/retry", optionalCustomerAuth, retryPayment);
router.post("/verify", optionalCustomerAuth, verifyPayment);
router.post("/webhook", handleWebhook);

export default router;
