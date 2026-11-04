import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { csrfProtection } from "../src/middleware/csrf.js";
import authRoutes from "../src/routes/authRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import paymentRoutes from "../src/routes/paymentRoutes.js";
import settingsRoutes from "../src/routes/settingsRoutes.js";
import customCakeRoutes from "../src/routes/customCakeRoutes.js";
import adminOrderRoutes from "../src/routes/adminOrderRoutes.js";
import uploadRoutes from "../src/routes/uploadRoutes.js";

let mongoServer: MongoMemoryServer;

function createCsrfTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/auth", authRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/custom-cake-requests", customCakeRoutes);
  app.use("/api/admin/orders", adminOrderRoutes);
  app.use("/api/admin/uploads", uploadRoutes);
  return app;
}

const app = createCsrfTestApp();

const TRUSTED_ORIGIN = "https://bakery-ecommerce-topaz.vercel.app";
const UNTRUSTED_ORIGIN = "https://evil.com";

function setCookie(name: string, value: string): string {
  return `${name}=${value}`;
}

describe("CSRF Protection Middleware", () => {
  const customerCookie = setCookie("customer-token", "fake-token");
  const adminCookie = setCookie("admin-token", "fake-token");

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
    process.env.CORS_ORIGIN = TRUSTED_ORIGIN;
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(() => {
    process.env.CORS_ORIGIN = TRUSTED_ORIGIN;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    delete process.env.CORS_ORIGIN;
  });

  describe("Safe methods (GET, HEAD, OPTIONS)", () => {
    it("allows GET requests without Origin header", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).not.toBe(403);
    });

    it("allows OPTIONS requests without Origin header", async () => {
      const res = await request(app).options("/api/orders");
      expect(res.status).not.toBe(403);
    });
  });

  describe("State-changing requests without auth cookies", () => {
    it("allows POST /api/auth/register without cookies", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Origin", TRUSTED_ORIGIN)
        .send({
          name: "Test User",
          email: "test@example.com",
          phone: "9840916058",
          password: "Secure1password",
        });
      // May fail validation or succeed, but should not be 403 CSRF
      expect(res.status).not.toBe(403);
    });

    it("allows POST /api/auth/customer/login without cookies", async () => {
      const res = await request(app)
        .post("/api/auth/customer/login")
        .set("Origin", TRUSTED_ORIGIN)
        .send({ email: "test@example.com", password: "password123" });
      expect(res.status).not.toBe(403);
    });

    it("allows POST /api/auth/otp/send without cookies", async () => {
      const res = await request(app)
        .post("/api/auth/otp/send")
        .set("Origin", TRUSTED_ORIGIN)
        .send({ email: "test@example.com" });
      expect(res.status).not.toBe(403);
    });
  });

  describe("Cookie-authenticated state-changing requests", () => {

    it("rejects POST /api/orders with untrusted origin", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", customerCookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it("rejects POST /api/orders without Origin header", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Cookie", customerCookie)
        .send({});
      expect(res.status).toBe(403);
    });

    it("allows POST /api/orders with trusted origin", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", customerCookie)
        .send({});
      // Should not be 403 CSRF; may fail validation or auth, but not CSRF
      expect(res.status).not.toBe(403);
    });

    it("rejects POST /api/payments/create-order with untrusted origin", async () => {
      const res = await request(app)
        .post("/api/payments/create-order")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", customerCookie)
        .send({ orderNumber: "SV-TEST" });
      expect(res.status).toBe(403);
    });

    it("allows POST /api/payments/create-order with trusted origin", async () => {
      const res = await request(app)
        .post("/api/payments/create-order")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", customerCookie)
        .send({ orderNumber: "SV-TEST" });
      expect(res.status).not.toBe(403);
    });

    it("rejects PATCH /api/orders/:id/status with untrusted origin", async () => {
      const res = await request(app)
        .patch("/api/orders/SV-TEST/status")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", adminCookie)
        .send({ status: "CONFIRMED" });
      expect(res.status).toBe(403);
    });

    it("allows PATCH /api/orders/:id/status with trusted origin", async () => {
      const res = await request(app)
        .patch("/api/orders/SV-TEST/status")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", adminCookie)
        .send({ status: "CONFIRMED" });
      expect(res.status).not.toBe(403);
    });

    it("rejects POST /api/admin/logout with untrusted origin", async () => {
      const res = await request(app)
        .post("/api/admin/logout")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", adminCookie);
      expect(res.status).toBe(403);
    });

    it("allows POST /api/admin/logout with trusted origin", async () => {
      const res = await request(app)
        .post("/api/admin/logout")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", adminCookie);
      expect(res.status).not.toBe(403);
    });

    it("rejects PATCH /api/settings with untrusted origin", async () => {
      const res = await request(app)
        .patch("/api/settings")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", adminCookie)
        .send({ onlineOrdersEnabled: false });
      expect(res.status).toBe(403);
    });

    it("allows PATCH /api/settings with trusted origin", async () => {
      const res = await request(app)
        .patch("/api/settings")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", adminCookie)
        .send({ onlineOrdersEnabled: false });
      expect(res.status).not.toBe(403);
    });

    it("rejects POST /api/admin/uploads/signature with untrusted origin", async () => {
      const res = await request(app)
        .post("/api/admin/uploads/signature")
        .set("Origin", UNTRUSTED_ORIGIN)
        .set("Cookie", adminCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("Razorpay webhook exemption", () => {
    it("allows webhook requests without Origin header", async () => {
      const res = await request(app)
        .post("/api/payments/webhook")
        .send({});
      // Webhook signature verification will fail, but CSRF should not block it
      expect(res.status).not.toBe(403);
    });

    it("allows webhook requests with any origin", async () => {
      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Origin", UNTRUSTED_ORIGIN)
        .send({});
      expect(res.status).not.toBe(403);
    });
  });

  describe("Multiple trusted origins", () => {
    it("allows multiple configured origins", async () => {
      process.env.CORS_ORIGIN = `${TRUSTED_ORIGIN},https://admin.example.com`;

      const res = await request(app)
        .post("/api/orders")
        .set("Origin", "https://admin.example.com")
        .set("Cookie", customerCookie)
        .send({});
      expect(res.status).not.toBe(403);

      delete process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = TRUSTED_ORIGIN;
    });
  });
});
