import { Router } from "express";

const router: Router = Router();

/**
 * F2 privacy remediation:
 * Public, unauthenticated, phone-number-based WhatsApp consent HTTP endpoints are
 * disabled. They previously allowed disclosure/mutation of consent state for
 * arbitrary phone numbers without ownership verification.
 *
 * Internal consent workflows remain intact:
 * - Checkout/custom-cake flows use internal whatsappConsentService.grantConsent(...)
 * - Inbound Meta STOP handling uses withdrawAllConsent(...) via webhook processing
 * - Admin consent visibility remains available via authenticated /api/admin/whatsapp/consents
 *
 * A verified, ownership-bound customer flow is required before reintroducing any
 * public self-service consent read/write endpoint.
 */

const PUBLIC_CONSENT_ENDPOINT_DISABLED = {
  error: "This consent endpoint is unavailable.",
  code: "CONSENT_ENDPOINT_DISABLED",
} as const;

function disabledPublicConsentEndpoint(
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): void {
  // 410 Gone: intentionally disabled to prevent unauthenticated phone-based consent disclosure/mutation.
  // Response is generic and does not reveal whether a phone/consent record exists.
  res.status(410).json(PUBLIC_CONSENT_ENDPOINT_DISABLED);
}

// Explicitly disable known public consent routes (no alternate unauthenticated paths provided here).
router.get("/consent/status", disabledPublicConsentEndpoint);
router.post("/consent/grant", disabledPublicConsentEndpoint);
router.post("/consent/withdraw", disabledPublicConsentEndpoint);

export default router;
