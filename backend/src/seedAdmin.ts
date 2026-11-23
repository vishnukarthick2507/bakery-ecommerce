import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { Admin } from "./models/Admin.js";

dotenv.config();

export const REQUIRED_SEED_CONFIRMATION = "I_UNDERSTAND_CREATE_LOCAL_UAT_ADMIN";
export const REQUIRED_HOST = "127.0.0.1";
export const REQUIRED_PORT = "27018";
export const REQUIRED_DB_NAME = "bluebell_whatsapp_uat";
export const BCRYPT_COST_FACTOR = 10;
export const MIN_PASSWORD_LENGTH = 12;

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function fail(message: string): ValidationResult {
  return { ok: false, message };
}

export function validateMongoTarget(uri: string | undefined): ValidationResult {
  if (!uri || typeof uri !== "string" || uri.trim().length === 0) {
    return fail("MONGODB_URI is required.");
  }

  const raw = uri.trim();

  if (raw.toLowerCase().startsWith("mongodb+srv://")) {
    return fail("Atlas/SRV MongoDB URIs are not allowed.");
  }

  if (!raw.startsWith("mongodb://")) {
    return fail("Only the mongodb:// scheme is allowed for this script.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail("MONGODB_URI is malformed or not parseable.");
  }

  if (parsed.protocol !== "mongodb:") {
    return fail("Only the mongodb:// scheme is allowed for this script.");
  }

  if (parsed.username || parsed.password) {
    // Credentials may be present in local env URIs; never print them.
    // Validation continues against host/port/database only.
  }

  if (parsed.hostname !== REQUIRED_HOST) {
    return fail("MongoDB host must be exactly 127.0.0.1.");
  }

  // Reject unexpected host lists/remote targets encoded in authority.
  // new URL() normalizes hostname, but a comma in the authority indicates multiple hosts.
  const schemeSeparator = raw.indexOf("://");
  const authorityStart = schemeSeparator >= 0 ? schemeSeparator + 3 : 0;
  const authorityEndCandidates = [raw.indexOf("/", authorityStart), raw.indexOf("?", authorityStart), raw.indexOf("#", authorityStart)].filter((i) => i >= 0);
  const authorityEnd = authorityEndCandidates.length > 0 ? Math.min(...authorityEndCandidates) : raw.length;
  const authority = raw.slice(authorityStart, authorityEnd);
  const hostPortAuthority = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  if (hostPortAuthority.includes(",")) {
    return fail("Multiple MongoDB hosts are not allowed.");
  }

  if (parsed.port !== REQUIRED_PORT) {
    return fail("MongoDB port must be exactly 27018.");
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!dbName || dbName.includes("/")) {
    return fail("MongoDB database name must be exactly bluebell_whatsapp_uat.");
  }

  if (dbName !== REQUIRED_DB_NAME) {
    return fail("MongoDB database name must be exactly bluebell_whatsapp_uat.");
  }

  return { ok: true };
}

export function hasExplicitExecutionConfirmation(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): boolean {
  const envConfirmed = env.SEED_ADMIN_CONFIRM === REQUIRED_SEED_CONFIRMATION;
  const argConfirmed = argv.includes(`--confirm=${REQUIRED_SEED_CONFIRMATION}`) || argv.includes("--confirm-seed-admin-local-uat");
  return envConfirmed || argConfirmed;
}

export function validateAdminUsername(username: string | undefined): ValidationResult {
  if (typeof username !== "string" || username.trim().length === 0) {
    return fail("ADMIN_SEED_USERNAME is required and must be non-empty.");
  }
  return { ok: true };
}

export function validateAdminPassword(password: string | undefined): ValidationResult {
  if (typeof password !== "string" || password.trim().length === 0) {
    return fail("ADMIN_SEED_PASSWORD is required and must be non-empty.");
  }

  const value = password;
  if (value.length < MIN_PASSWORD_LENGTH) {
    return fail("ADMIN_SEED_PASSWORD must be at least 12 characters long.");
  }

  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    return fail("ADMIN_SEED_PASSWORD must include uppercase, lowercase, digit, and symbol characters.");
  }

  return { ok: true };
}

async function closeConnectionIfOpen(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch {
    // Intentionally suppressed to avoid leaking sensitive connection details.
  }
}

export async function seedAdmin(): Promise<void> {
  const targetValidation = validateMongoTarget(process.env.MONGODB_URI);
  if (!targetValidation.ok) {
    console.error(`Seed aborted: ${targetValidation.message}`);
    process.exitCode = 1;
    return;
  }

  if (!hasExplicitExecutionConfirmation()) {
    console.error("Seed aborted: explicit execution confirmation is required.");
    process.exitCode = 1;
    return;
  }

  const username = process.env.ADMIN_SEED_USERNAME;
  const password = process.env.ADMIN_SEED_PASSWORD;

  const usernameValidation = validateAdminUsername(username);
  if (!usernameValidation.ok) {
    console.error(`Seed aborted: ${usernameValidation.message}`);
    process.exitCode = 1;
    return;
  }

  const passwordValidation = validateAdminPassword(password);
  if (!passwordValidation.ok) {
    console.error(`Seed aborted: ${passwordValidation.message}`);
    process.exitCode = 1;
    return;
  }

  const safeUsername = username!.trim();

  try {
    await mongoose.connect(process.env.MONGODB_URI!.trim(), {
      serverSelectionTimeoutMS: 10000,
    });

    const existingAdminCount = await Admin.countDocuments({});
    if (existingAdminCount > 0) {
      console.error("Seed aborted: one or more admin accounts already exist.");
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password!, BCRYPT_COST_FACTOR);
    await Admin.create({
      username: safeUsername,
      password: passwordHash,
      role: "ADMIN",
    });

    console.log("Admin account created successfully in local UAT database.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = /MONGODB_URI|mongodb:\/\/|mongodb\+srv:\/\//i.test(message)
      ? "A database operation failed."
      : "Admin seed failed.";
    console.error(`Seed aborted: ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    await closeConnectionIfOpen();
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  void seedAdmin().then(() => {
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  });
}
