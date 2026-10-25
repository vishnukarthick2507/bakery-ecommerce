import { Router } from "express";

import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
} from "../controllers/paymentController.js";
import { optionalCustomerAuth } from "../middleware/auth.js";

const router = Router();

router.post("/create-order", optionalCustomerAuth, createPaymentOrder);
router.post("/verify", optionalCustomerAuth, verifyPayment);
router.post("/webhook", handleWebhook);

export default router;
