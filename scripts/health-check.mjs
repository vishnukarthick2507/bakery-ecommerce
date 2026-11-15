#!/usr/bin/env node
/**
 * Post-deployment health check script for S.V. Sweets & Bakers.
 *
 * Usage:
 *   node scripts/health-check.mjs
 *
 * Environment variables (optional overrides):
 *   FRONTEND_URL   (default: https://bakery-ecommerce-topaz.vercel.app)
 *   BACKEND_URL    (default: https://bakery-ecommerce-txuz.onrender.com)
 *
 * Exits with code 0 if all checks pass, code 1 if any check fails.
 * No secrets are used or logged.
 */

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://bakery-ecommerce-topaz.vercel.app";
const BACKEND_URL = process.env.BACKEND_URL ?? "https://bakery-ecommerce-txuz.onrender.com";

const RESULTS = [];

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } catch (error) {
    return { ok: false, status: null, body: null, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function check(name, condition, detail = "") {
  RESULTS.push({ name, pass: Boolean(condition), detail });
  console.log(
    `${condition ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`
  );
}

async function main() {
  console.log("=== S.V. Sweets & Bakers — Post-Deployment Health Check ===\n");
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend:  ${BACKEND_URL}\n`);

  // 1. Frontend homepage
  const frontendRes = await fetchWithTimeout(FRONTEND_URL);
  check(
    "Frontend homepage reachable",
    frontendRes.ok && frontendRes.status === 200,
    `HTTP ${frontendRes.status ?? "error"}${frontendRes.error ? `: ${frontendRes.error}` : ""}`
  );

  // 2. Backend root
  const backendRootRes = await fetchWithTimeout(`${BACKEND_URL}/`);
  check(
    "Backend root reachable",
    backendRootRes.ok && backendRootRes.status === 200,
    `HTTP ${backendRootRes.status ?? "error"}${backendRootRes.error ? `: ${backendRootRes.error}` : ""}`
  );

  // 3. Backend health
  const healthRes = await fetchWithTimeout(`${BACKEND_URL}/health`);
  let healthJson = null;
  if (healthRes.ok) {
    try {
      healthJson = JSON.parse(healthRes.body);
    } catch {
      healthJson = null;
    }
  }
  check(
    "Backend /health returns ok",
    healthJson?.status === "ok",
    `status=${healthJson?.status ?? "unknown"}, database=${healthJson?.database ?? "unknown"}`
  );

  // 4. Database connectivity (via /health)
  check(
    "Database connected",
    healthJson?.database === "connected",
    healthJson?.database ?? "unknown"
  );

  // Summary
  const failed = RESULTS.filter((r) => !r.pass);
  console.log("\n=== Summary ===");
  console.log(`Total checks: ${RESULTS.length}`);
  console.log(`Passed:       ${RESULTS.length - failed.length}`);
  console.log(`Failed:       ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll health checks passed.");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Health check script failed:", error);
  process.exit(1);
});
