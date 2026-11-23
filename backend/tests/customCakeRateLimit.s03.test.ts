import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { ipKeyGenerator } from "express-rate-limit";

import customCakeRoutes from "../src/routes/customCakeRoutes.js";
import { createCustomCakeRequestLimiter } from "../src/middleware/rateLimit.js";
import { csrfProtection } from "../src/middleware/csrf.js";

process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function createTestApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/custom-cake-requests", customCakeRoutes);
  return app;
}

const app = createTestApp();

async function resetLimiterKeys() {
  const keys = ["127.0.0.1", "::ffff:127.0.0.1", "::1", "unknown"];
  for (const key of keys) {
    await createCustomCakeRequestLimiter.resetKey(ipKeyGenerator(key) ?? key);
    await createCustomCakeRequestLimiter.resetKey(key);
  }
}

function postCustomCake(agent: ReturnType<typeof request>) {
  return agent
    .post("/api/custom-cake-requests")
    .set("Origin", "http://localhost:3000")
    .send({});
}

describe("S03 custom cake request rate limiting", () => {
  beforeEach(async () => {
    await resetLimiterKeys();
  });

  it("keeps public custom cake submission behavior below threshold and returns 429 after 10 requests", async () => {
    const agent = request(app);

    for (let i = 0; i < 10; i++) {
      const res = await postCustomCake(agent);
      expect(res.status).not.toBe(429);
      // Invalid payload should be rejected by validation/controller, not by rate limiting.
      expect([400, 422, 500, 503]).toContain(res.status);
    }

    const limited = await postCustomCake(agent);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      message: "Too many custom cake requests from this IP. Please try again later.",
    });
    expect(limited.headers["ratelimit-limit"]).toBeDefined();
    expect(limited.headers["ratelimit-remaining"]).toBeDefined();
    expect(limited.headers["ratelimit-reset"]).toBeDefined();
  });

  it("resets counters between tests (isolation)", async () => {
    const res = await postCustomCake(request(app));
    expect(res.status).not.toBe(429);
  });
});
