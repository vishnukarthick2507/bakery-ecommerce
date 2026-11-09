/*
|--------------------------------------------------------------------------
| STRUCTURED LOGGER
|--------------------------------------------------------------------------
| Lightweight structured logging without external dependencies. Emits JSON
| log lines suitable for production log aggregation. Automatically redacts
| sensitive fields (passwords, JWTs, cookies, OTPs, payment secrets, API
| keys, customer PII) from log output.
|
| Usage:
|   import { logger } from "@/lib/logger.js";
|   logger.info("Order created", { orderId, amount });
|   logger.error("Payment failed", { error: err.message, orderId });
|--------------------------------------------------------------------------
*/

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

// Fields that must never appear in logs, even if passed in context.
// Keys are compared case-insensitively, so include common camelCase
// and lowercase variants.
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordhash",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "jwt",
  "authorization",
  "cookie",
  "cookies",
  "otp",
  "otpHash",
  "otpSalt",
  "apikey",
  "asecret",
  "apisecret",
  "api_secret",
  "cloudinaryapisecret",
  "razorpaykeysecret",
  "razorpaywebhooksecret",
  "email",
  "phone",
  "name",
  "customername",
  "address",
  "creditcard",
  "cardnumber",
  "cvv",
]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_FIELDS.has(lower);
}

function redactValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    return "[REDACTED]";
  }
  if (value && typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function buildLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): string {
  const entry: Record<string, unknown> = {
    timestamp: formatTimestamp(),
    level,
    message,
  };

  if (context.requestId) {
    entry.requestId = context.requestId;
  }

  const redactedContext = redactObject(context);
  for (const [key, value] of Object.entries(redactedContext)) {
    if (key !== "requestId") {
      entry[key] = value;
    }
  }

  return JSON.stringify(entry);
}

export function withRequestDuration<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    const durationMs = Date.now() - start;
    logger.info(operation, { durationMs });
  });
}

export function info(message: string, context: LogContext = {}): void {
  console.log(buildLogEntry("info", message, context));
}

export function warn(message: string, context: LogContext = {}): void {
  console.warn(buildLogEntry("warn", message, context));
}

export function error(message: string, context: LogContext = {}): void {
  console.error(buildLogEntry("error", message, context));
}

export const logger = {
  info,
  warn,
  error,
};
