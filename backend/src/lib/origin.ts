/*
|--------------------------------------------------------------------------
| Shared origin utilities for CORS and CSRF protection
|--------------------------------------------------------------------------
| Both CORS and CSRF middleware validate the Origin header against the same
| set of trusted origins. This module centralizes the normalization and
| lookup logic so the two middlewares can never diverge.
|
| Normalization rules:
| - Trim whitespace
| - Remove trailing slashes so "https://example.com/" matches "https://example.com"
| - Strip pathname (only scheme + host are compared)
| - Validate the string is a parseable URL
| Returns null for invalid origins.
*/

/**
 * Normalizes an origin string for consistent comparison.
 * Returns null for invalid origins.
 */
export function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin.trim());
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Builds the list of trusted origins from the CORS_ORIGIN environment variable.
 * Falls back to localhost:3000 when the variable is unset or empty.
 */
export function getTrustedOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin || !corsOrigin.trim()) {
    return ["http://localhost:3000"];
  }
  return corsOrigin
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter((o): o is string => Boolean(o));
}
