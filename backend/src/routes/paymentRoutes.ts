import { Router } from "express";

import {
  createPaymentOrder,
  retryPayment,
  verifyPayment,
  handleWebhook,
} from "../controllers/paymentController.js";
import { optionalCustomerAuth } from "../middleware/auth.js";
import {
  createPaymentOrderLimiter,
  retryPaymentLimiter,
  verifyPaymentLimiter,
} from "../middleware/rateLimit.js";

const router: Router = Router();

router.post(
  "/create-order",
  createPaymentOrderLimiter,
  optionalCustomerAuth,
  createPaymentOrder,
);
router.post("/retry", retryPaymentLimiter, optionalCustomerAuth, retryPayment);
router.post("/verify", verifyPaymentLimiter, optionalCustomerAuth, verifyPayment);
router.post("/webhook", handleWebhook);

export default router;
