import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { ipKeyGenerator } from "express-rate-limit";

import paymentRoutes from "../src/routes/paymentRoutes.js";
import {
  createPaymentOrderLimiter,
  retryPaymentLimiter,
  verifyPaymentLimiter,
} from "../src/middleware/rateLimit.js";
import { csrfProtection } from "../src/middleware/csrf.js";

process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

function createTestApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/payments", paymentRoutes);
  return app;
}

const app = createTestApp();

async function resetLimiter(limiter: { resetKey: (key: string) => unknown }) {
  const keys = ["127.0.0.1", "::ffff:127.0.0.1", "::1", "unknown"];
  for (const key of keys) {
    await limiter.resetKey(ipKeyGenerator(key) ?? key);
    await limiter.resetKey(key);
  }
}

async function resetAllPaymentLimiters() {
  await resetLimiter(createPaymentOrderLimiter);
  await resetLimiter(retryPaymentLimiter);
  await resetLimiter(verifyPaymentLimiter);
}

const endpoints = [
  {
    path: "/api/payments/create-order",
    limit: 30,
    limiter: createPaymentOrderLimiter,
    message: "Too many payment initiation requests from this IP. Please try again later.",
  },
  {
    path: "/api/payments/retry",
    limit: 20,
    limiter: retryPaymentLimiter,
    message: "Too many payment retry requests from this IP. Please try again later.",
  },
  {
    path: "/api/payments/verify",
    limit: 30,
    limiter: verifyPaymentLimiter,
    message: "Too many payment verification requests from this IP. Please try again later.",
  },
] as const;

describe("S03 payment endpoint rate limiting", () => {
  beforeEach(async () => {
    await resetAllPaymentLimiters();
  });

  for (const endpoint of endpoints) {
    it(`${endpoint.path} keeps existing behavior below threshold and returns 429 after ${endpoint.limit} requests`, async () => {
      const agent = request(app);

      for (let i = 0; i < endpoint.limit; i++) {
        const res = await agent
          .post(endpoint.path)
          .set("Origin", "http://localhost:3000")
          .send({});
        expect(res.status).not.toBe(429);
        expect([400, 401, 403, 404, 409, 422, 500, 502, 503]).toContain(res.status);
      }

      const limited = await agent
        .post(endpoint.path)
        .set("Origin", "http://localhost:3000")
        .send({});
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ message: endpoint.message });
      expect(limited.headers["ratelimit-limit"]).toBeDefined();
      expect(limited.headers["ratelimit-remaining"]).toBeDefined();
      expect(limited.headers["ratelimit-reset"]).toBeDefined();
    });
  }

  it("uses independent limiters for payment create/retry/verify", async () => {
    const agent = request(app);

    for (let i = 0; i < 20; i++) {
      const res = await agent
        .post("/api/payments/retry")
        .set("Origin", "http://localhost:3000")
        .send({});
      expect(res.status).not.toBe(429);
    }
    const retryLimited = await agent
      .post("/api/payments/retry")
      .set("Origin", "http://localhost:3000")
      .send({});
    expect(retryLimited.status).toBe(429);

    const createRes = await agent
      .post("/api/payments/create-order")
      .set("Origin", "http://localhost:3000")
      .send({});
    const verifyRes = await agent
      .post("/api/payments/verify")
      .set("Origin", "http://localhost:3000")
      .send({});
    expect(createRes.status).not.toBe(429);
    expect(verifyRes.status).not.toBe(429);
  });
});
