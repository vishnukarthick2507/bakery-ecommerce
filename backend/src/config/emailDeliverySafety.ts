export function parseEmailExternalDeliveryBlockedEnv(
  raw: string | undefined = process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED,
): boolean {
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("Invalid EMAIL_EXTERNAL_DELIVERY_BLOCKED value. Use true or false.");
}

export function isExternalEmailDeliveryBlocked(): boolean {
  return parseEmailExternalDeliveryBlockedEnv(process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED);
}

export function assertEmailDeliverySafetyConfig(): void {
  // Throws on invalid value. Missing value defaults to false (production-compatible).
  parseEmailExternalDeliveryBlockedEnv(process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED);
}
