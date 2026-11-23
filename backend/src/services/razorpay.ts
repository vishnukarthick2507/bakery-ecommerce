import Razorpay from "razorpay";
import { isUatExternalSideEffectsBlocked } from "../config/uatSafeMode.js";
import { logUatSuppressed } from "./uatSafetyLog.js";

let client: Razorpay | null = null;

export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}

export function getRazorpayKeySecret(): string | null {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || null;
}

export function getRazorpayClient(): Razorpay {
  if (isUatExternalSideEffectsBlocked()) {
    logUatSuppressed("razorpay.client_access");
    throw new Error("Razorpay live API access is blocked in UAT_SAFE_MODE.");
  }

  if (client) return client;

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return client;
}
