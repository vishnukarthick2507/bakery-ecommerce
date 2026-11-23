import { URL } from "node:url";

export const REQUIRED_UAT_DB_NAME = "bluebell_whatsapp_uat";
export const REQUIRED_UAT_DB_PORT = 27018;
export const REJECTED_DB_PORT = 27017;

export interface UatMongoTargetValidation {
  ok: boolean;
  reason?: string;
  details?: {
    scheme?: "mongodb" | "mongodb+srv" | "unknown";
    host?: string;
    port?: number | null;
    database?: string | null;
    authSource?: string | null;
  };
}

function normalizeBooleanString(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Strictly parses UAT_SAFE_MODE from the environment.
 * - undefined/absent => disabled (normal mode)
 * - "true"/"false" (case-insensitive, surrounding whitespace allowed) => boolean
 * - any other value => throws (invalid)
 */
export function parseUatSafeModeEnv(raw: string | undefined = process.env.UAT_SAFE_MODE): boolean {
  if (raw === undefined) return false;
  const normalized = normalizeBooleanString(raw);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("Invalid UAT_SAFE_MODE value. Use true or false.");
}

export function isUatSafeModeEnabled(): boolean {
  return parseUatSafeModeEnv(process.env.UAT_SAFE_MODE);
}

function isLocalHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function extractDbName(pathname: string): string {
  const raw = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  // Ignore any additional path segments; MongoDB db name is the first segment.
  return raw.split("/")[0] ?? "";
}

/**
 * Validates that a MongoDB URI is an explicitly verified local UAT target.
 * Never returns or throws with credentials/full URI.
 */
export function validateUatMongoTarget(uri: string | undefined): UatMongoTargetValidation {
  if (!uri || !uri.trim()) {
    return { ok: false, reason: "MONGODB_URI is required when UAT_SAFE_MODE is enabled." };
  }

  const trimmed = uri.trim();
  if (trimmed.startsWith("mongodb+srv://")) {
    return {
      ok: false,
      reason: "Atlas/SRV MongoDB connections are not allowed in UAT_SAFE_MODE.",
      details: { scheme: "mongodb+srv" },
    };
  }
  if (!trimmed.startsWith("mongodb://")) {
    return {
      ok: false,
      reason: "Only mongodb:// localhost UAT targets are allowed in UAT_SAFE_MODE.",
      details: { scheme: "unknown" },
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "MONGODB_URI is malformed or not parseable.", details: { scheme: "mongodb" } };
  }

  const hostnames = [parsed.hostname].filter(Boolean);
  if (hostnames.length === 0) {
    return { ok: false, reason: "MongoDB host is missing.", details: { scheme: "mongodb" } };
  }

  // Reject multi-host/replica-set style URIs by conservatively checking the raw host section.
  const authority = trimmed.slice("mongodb://".length).split("/")[0] ?? "";
  const hostPart = authority.includes("@") ? authority.split("@").pop() ?? "" : authority;
  if (hostPart.includes(",")) {
    return {
      ok: false,
      reason: "Multi-host MongoDB URIs are not allowed in UAT_SAFE_MODE.",
      details: { scheme: "mongodb", host: hostPart },
    };
  }

  const hostname = parsed.hostname;
  if (!isLocalHost(hostname)) {
    return {
      ok: false,
      reason: "Remote MongoDB hosts are not allowed in UAT_SAFE_MODE.",
      details: { scheme: "mongodb", host: hostname },
    };
  }

  const port = parsed.port ? Number(parsed.port) : 27017; // mongodb default when omitted
  if (!Number.isInteger(port)) {
    return { ok: false, reason: "MongoDB port is invalid.", details: { scheme: "mongodb", host: hostname, port: null } };
  }
  if (port === REJECTED_DB_PORT) {
    return {
      ok: false,
      reason: "MongoDB port 27017 is not allowed in UAT_SAFE_MODE.",
      details: { scheme: "mongodb", host: hostname, port },
    };
  }
  if (port !== REQUIRED_UAT_DB_PORT) {
    return {
      ok: false,
      reason: `MongoDB port must be exactly ${REQUIRED_UAT_DB_PORT} in UAT_SAFE_MODE.`,
      details: { scheme: "mongodb", host: hostname, port },
    };
  }

  const database = extractDbName(parsed.pathname);
  if (database !== REQUIRED_UAT_DB_NAME) {
    return {
      ok: false,
      reason: `MongoDB database name must be exactly ${REQUIRED_UAT_DB_NAME} in UAT_SAFE_MODE.`,
      details: { scheme: "mongodb", host: hostname, port, database: database || null },
    };
  }

  const authSource = parsed.searchParams.get("authSource");
  return {
    ok: true,
    details: {
      scheme: "mongodb",
      host: hostname,
      port,
      database,
      authSource,
    },
  };
}

export function assertUatSafeModeMongoTarget(uri: string | undefined): void {
  if (!isUatSafeModeEnabled()) return;
  const result = validateUatMongoTarget(uri);
  if (!result.ok) {
    throw new Error(result.reason || "UAT_SAFE_MODE MongoDB target validation failed.");
  }
}

export function getUatSafeModeStartupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Defensive redaction in case callers pass unsafe errors.
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, "[REDACTED_MONGODB_URI]")
    .replace(/(password|pwd|pass)=([^&\s]+)/gi, "$1=[REDACTED]");
}

export function assertUatSafeModeConfig(): void {
  // Throws on invalid boolean env value.
  const enabled = parseUatSafeModeEnv(process.env.UAT_SAFE_MODE);
  if (enabled) {
    assertUatSafeModeMongoTarget(process.env.MONGODB_URI);
  }
}

export function isUatExternalSideEffectsBlocked(): boolean {
  return isUatSafeModeEnabled();
}

export function assertNotUatSafeModeExternalSideEffect(action: string): void {
  if (isUatExternalSideEffectsBlocked()) {
    throw new Error(`External side effect blocked in UAT_SAFE_MODE: ${action}`);
  }
}
