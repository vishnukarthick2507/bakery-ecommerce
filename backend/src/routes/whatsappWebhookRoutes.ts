import { Router } from "express";
import express from "express";

import {
  verifyWebhook,
  receiveWebhook,
} from "../controllers/whatsappWebhookController.js";

const router: Router = Router();

/*
|--------------------------------------------------------------------------
| WHATSAPP WEBHOOK ROUTES
|--------------------------------------------------------------------------
| Meta WhatsApp Business Platform Cloud API webhook.
|
| GET  /api/whatsapp/webhook/verify   — Meta subscription verification
| POST /api/whatsapp/webhook          — Inbound messages & status callbacks
|
| The POST route must be parsed as raw (express.raw) so the signature can be
| verified against the exact bytes Meta sent. This is mounted in server.ts
| before express.json().
*/

// Meta subscription verification (GET)
router.get("/webhook/verify", verifyWebhook);
router.get("/webhook", verifyWebhook);

// Inbound messages & status callbacks (POST)
// Raw body parsing is applied in server.ts for this exact path.
router.post("/webhook", receiveWebhook);

export default router;
