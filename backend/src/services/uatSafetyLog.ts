import { isUatSafeModeEnabled } from "../config/uatSafeMode.js";

export function logUatSuppressed(action: string, context: Record<string, unknown> = {}): void {
  if (!isUatSafeModeEnabled()) return;
  const safeContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    const lower = key.toLowerCase();
    if (lower.includes("secret") || lower.includes("token") || lower.includes("password") || lower.includes("uri") || lower.includes("authorization")) {
      safeContext[key] = "[REDACTED]";
    } else {
      safeContext[key] = value;
    }
  }
  console.info(`[UAT_SAFE_MODE] Suppressed external side effect: ${action}`, safeContext);
}
