#!/usr/bin/env node
/**
 * Pre-deployment validation script for S.V. Sweets & Bakers.
 *
 * Runs before any deployment to verify the codebase is in a deployable state.
 *
 * Usage:
 *   node scripts/prep-deploy.mjs
 *
 * Exits with code 0 if all checks pass, code 1 if any check fails.
 * No secrets are used or logged.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const RESULTS = [];

function check(name, condition, detail = "") {
  RESULTS.push({ name, pass: Boolean(condition), detail });
  console.log(
    `${condition ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`
  );
}

// 1. Git status — working tree should be clean (or only intended changes)
try {
  const status = execSync("git status --porcelain", {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  const untrackedOrModified = status
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const allowedUntracked = [
    ".github/workflows/ci.yml",
    "render.yaml",
    "vercel.json",
    "DEPLOYMENT_WORKFLOW.md",
    "scripts/health-check.mjs",
    "scripts/prep-deploy.mjs",
  ];
  const unexpected = untrackedOrModified.filter(
    (line) => !allowedUntracked.some((a) => line.includes(a))
  );
  check(
    "Git working tree clean (no unexpected changes)",
    unexpected.length === 0,
    unexpected.length > 0 ? `Unexpected: ${unexpected.join(", ")}` : "clean"
  );
} catch (error) {
  check("Git status check", false, error.message);
}

// 2. Frontend typecheck
try {
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
  check("Frontend TypeScript typecheck", true, "clean");
} catch (error) {
  check("Frontend TypeScript typecheck", false, "see tsc output");
}

// 3. Backend typecheck
try {
  execSync("npx tsc --noEmit", { cwd: path.join(ROOT, "backend"), stdio: "pipe" });
  check("Backend TypeScript typecheck", true, "clean");
} catch (error) {
  check("Backend TypeScript typecheck", false, "see tsc output");
}

// 4. Required config files exist
const requiredFiles = [
  "backend/.env.example",
  ".env.example",
  "backend/src/server.ts",
  "playwright.config.ts",
  "backend/vitest.config.ts",
];
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(ROOT, file));
  check(`Required file exists: ${file}`, exists);
}

// 5. Backend health endpoint implemented
const serverTsPath = path.join(ROOT, "backend/src/server.ts");
if (fs.existsSync(serverTsPath)) {
  const serverTs = fs.readFileSync(serverTsPath, "utf8");
  check(
    "Backend /health endpoint implemented",
    serverTs.includes("/health") && serverTs.includes("dbReady")
  );
} else {
  check("Backend /health endpoint implemented", false, "server.ts not found");
}

// 6. .env files are gitignored
const gitignorePath = path.join(ROOT, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  check(".env is gitignored", gitignore.includes(".env"));
  check(".env.local is gitignored", gitignore.includes(".env.local"));
} else {
  check(".env is gitignored", false, ".gitignore not found");
  check(".env.local is gitignored", false, ".gitignore not found");
}

// Summary
const failed = RESULTS.filter((r) => !r.pass);
console.log("\n=== Pre-Deployment Validation Summary ===");
console.log(`Total checks: ${RESULTS.length}`);
console.log(`Passed:       ${RESULTS.length - failed.length}`);
console.log(`Failed:       ${failed.length}`);

if (failed.length > 0) {
  console.log("\nFailed checks — do not deploy until resolved:");
  for (const f of failed) {
    console.log(`  - ${f.name}: ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log("\nAll pre-deployment checks passed. Ready for deployment (pending user approval).");
  process.exit(0);
}
