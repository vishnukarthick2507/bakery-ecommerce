import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { ipKeyGenerator } from "express-rate-limit";

import orderRoutes from "../src/routes/orderRoutes.js";
import { createOrderLimiter } from "../src/middleware/rateLimit.js";
import { csrfProtection } from "../src/middleware/csrf.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-that-is-at-least-32-chars-long";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function createTestApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/orders", orderRoutes);
  return app;
}

const app = createTestApp();

async function resetLimiterKeys() {
  const keys = ["127.0.0.1", "::ffff:127.0.0.1", "::1", "unknown"];
  for (const key of keys) {
    await createOrderLimiter.resetKey(ipKeyGenerator(key) ?? key);
    await createOrderLimiter.resetKey(key);
  }
}

async function postOrder(agent: ReturnType<typeof request>, opts?: { auth?: boolean }) {
  const req = agent
    .post("/api/orders")
    .set("Origin", "http://localhost:3000")
    .send({});

  if (opts?.auth) {
    const token = jwt.sign(
      { accountId: "507f1f77bcf86cd799439011", accountType: "CUSTOMER", tokenVersion: 0 },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );
    req.set("Cookie", `customer-token=${token}`);
  }

  return req;
}

describe("S03 order create rate limiting", () => {
  beforeEach(async () => {
    await resetLimiterKeys();
  });

  it("retains existing behavior below threshold and returns 429 with headers/body after 20 requests", async () => {
    const agent = request(app);

    for (let i = 0; i < 20; i++) {
      const res = await postOrder(agent);
      expect(res.status).not.toBe(429);
      expect([400, 401, 403, 404, 422, 500, 503]).toContain(res.status);
    }

    const limited = await postOrder(agent);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      message: "Too many order requests from this IP. Please try again later.",
    });
    expect(limited.headers["ratelimit-limit"]).toBeDefined();
    expect(limited.headers["ratelimit-remaining"]).toBeDefined();
    expect(limited.headers["ratelimit-reset"]).toBeDefined();
  });

  it("counts authenticated and guest order requests against the same endpoint limiter", async () => {
    const agent = request(app);

    for (let i = 0; i < 10; i++) {
      const res = await postOrder(agent);
      expect(res.status).not.toBe(429);
    }

    for (let i = 0; i < 10; i++) {
      const res = await postOrder(agent, { auth: true });
      // Request is counted before auth/controller; below combined threshold it must not be rate-limited.
      expect(res.status).not.toBe(429);
    }

    const limited = await postOrder(agent);
    expect(limited.status).toBe(429);
  });

  it("resets counters between tests (isolation)", async () => {
    const res = await postOrder(request(app));
    expect(res.status).not.toBe(429);
  });
});
