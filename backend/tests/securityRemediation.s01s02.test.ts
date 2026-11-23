import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import authRoutes from "../src/routes/authRoutes.js";
import { Admin } from "../src/models/Admin.js";
import { User } from "../src/models/User.js";
import { OtpSession } from "../src/models/OtpSession.js";
import { isBrevoConfigured, sendOtpEmail } from "../src/services/emailService.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

vi.mock("../src/services/emailService.js", () => ({
  sendOtpEmail: vi.fn(),
  isBrevoConfigured: vi.fn(() => true),
  getBrevoPresenceChecks: vi.fn(),
  sendAdminLoginAlertOnce: vi.fn().mockResolvedValue(true),
}));

const app = createAuthTestApp();

function setCookieValues(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function customerCookie(value: string | string[] | undefined): string | undefined {
  return setCookieValues(value)
    .find((cookie) => cookie.startsWith("customer-token="))
    ?.split(";")[0];
}

function countGetMeRouteRegistrations(): number {
  const stack = (authRoutes as any).stack as any[];
  return stack.filter(
    (layer) =>
      layer?.route?.path === "/me" &&
      layer.route.methods &&
      layer.route.methods.get === true,
  ).length;
}

describe("BLB-03U S01/S02 security remediation regressions", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
    process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-16-chars";
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    (sendOtpEmail as ReturnType<typeof vi.fn>).mockReset();
    (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReset();
    (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    delete process.env.UAT_SAFE_MODE;
    // Default to explicit test environment for convenience unless a case overrides it.
    process.env.NODE_ENV = "test";
  });

  afterAll(async () => {
    delete process.env.UAT_SAFE_MODE;
    await disconnectTestDB();
  });

  describe("S01 - session introspection route and context separation", () => {
    it("has only one GET /me route registration", () => {
      expect(countGetMeRouteRegistrations()).toBe(1);
    });

    it("returns customer session introspection for a valid customer token on /api/auth/me", async () => {
      const user = await User.create({
        name: "Customer One",
        email: "customer-one@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "customer-one@example.com", password: "Secure1password" });
      const sessionCookie = customerCookie(login.headers["set-cookie"]);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: user._id.toString(),
        name: "Customer One",
        email: "customer-one@example.com",
        phone: "9840916058",
      });
      expect(res.body.isAdmin).toBeUndefined();
    });

    it("returns admin session introspection for a valid admin session on /api/admin/me and /api/auth/me", async () => {
      const admin = await Admin.create({
        username: "admin-s01",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
        tokenVersion: 0,
      });
      const adminToken = jwt.sign(
        { adminId: admin._id.toString(), username: "admin-s01", role: "ADMIN", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const adminMe = await request(app)
        .get("/api/admin/me")
        .set("Cookie", `admin-token=${adminToken}`);
      expect(adminMe.status).toBe(200);
      expect(adminMe.body).toEqual({ isAdmin: true });
      expect(adminMe.body.user).toBeUndefined();

      const authMe = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `admin-token=${adminToken}`);
      expect(authMe.status).toBe(200);
      expect(authMe.body).toEqual({ isAdmin: true });
      expect(authMe.body.user).toBeUndefined();
    });

    it("does not disclose admin identity for a customer token and does not disclose customer identity for an admin token", async () => {
      const customer = await User.create({
        name: "Customer Two",
        email: "customer-two@example.com",
        phone: "9840916059",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });
      const customerToken = jwt.sign(
        { customerId: customer._id.toString(), accountType: "CUSTOMER", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const customerOnAdminMe = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(customerOnAdminMe.status).toBe(200);
      expect(customerOnAdminMe.body).toEqual({ isAdmin: false });
      expect(customerOnAdminMe.body.user).toBeUndefined();

      const admin = await Admin.create({
        username: "admin-cross",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
        tokenVersion: 0,
      });
      const adminToken = jwt.sign(
        { adminId: admin._id.toString(), username: "admin-cross", role: "ADMIN", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const adminOnAuthMe = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminOnAuthMe.status).toBe(200);
      expect(adminOnAuthMe.body).toEqual({ isAdmin: true });
      expect(adminOnAuthMe.body.user).toBeUndefined();
    });

    it("does not treat invalid or expired JWTs as authenticated admin/customer sessions on introspection endpoints", async () => {
      const invalidAuth = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");
      expect(invalidAuth.status).toBe(200);
      expect(invalidAuth.body).toEqual({ isAdmin: false });
      expect(invalidAuth.body.user).toBeUndefined();

      const expiredCustomerToken = jwt.sign(
        { customerId: "000000000000000000000000", accountType: "CUSTOMER", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "-10s" },
      );
      const expiredCustomer = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredCustomerToken}`);
      expect(expiredCustomer.status).toBe(200);
      expect(expiredCustomer.body).toEqual({ isAdmin: false });
      expect(expiredCustomer.body.user).toBeUndefined();

      // Invalid/expired customer cookie-only session must be handled by the
      // customer auth chain (no admin-status fallback, no identity disclosure).
      const invalidCustomerCookie = await request(app)
        .get("/api/auth/me")
        .set("Cookie", "customer-token=invalid-token");
      expect(invalidCustomerCookie.status).toBe(401);
      expect(invalidCustomerCookie.body.user).toBeUndefined();

      const expiredAdminToken = jwt.sign(
        { adminId: "000000000000000000000000", username: "ghost", role: "ADMIN", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "-10s" },
      );
      const expiredAdmin = await request(app)
        .get("/api/admin/me")
        .set("Cookie", `admin-token=${expiredAdminToken}`);
      expect(expiredAdmin.status).toBe(200);
      expect(expiredAdmin.body).toEqual({ isAdmin: false });
    });
  });

  describe("S02 - OTP response disclosure hardening", () => {
    async function sendOtp(email: string, purpose = "AUTH") {
      return request(app).post("/api/auth/otp/send").send({ email, purpose });
    }

    it("never exposes OTP in production responses and uses the approved email delivery path", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const res = await sendOtp("prod-s02@example.com", "LOGIN");
        expect(res.status).toBe(200);
        expect(res.body.message).toContain("OTP sent successfully");
        expect(res.body.otp).toBeUndefined();
        expect(sendOtpEmail).toHaveBeenCalledTimes(1);
        expect((sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
          "prod-s02@example.com",
        );
        const session = await OtpSession.findOne({ identifier: "prod-s02@example.com" });
        expect(session).not.toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("never exposes OTP in UAT Safe Mode and suppresses external delivery", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalUat = process.env.UAT_SAFE_MODE;
      process.env.NODE_ENV = "production";
      process.env.UAT_SAFE_MODE = "true";
      try {
        const res = await sendOtp("uat-s02@example.com", "LOGIN");
        expect(res.status).toBe(200);
        expect(res.body.otp).toBeUndefined();
        expect(res.body.uatSuppressed).toBe(true);
        expect(sendOtpEmail).not.toHaveBeenCalled();
        const session = await OtpSession.findOne({ identifier: "uat-s02@example.com" });
        expect(session).not.toBeNull();
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalUat === undefined) delete process.env.UAT_SAFE_MODE;
        else process.env.UAT_SAFE_MODE = originalUat;
      }
    });

    it("does not disclose OTP through an unsafe non-explicit environment configuration", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "staging";
      (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
      try {
        const res = await sendOtp("unsafe-s02@example.com", "LOGIN");
        expect(res.status).toBe(503);
        expect(res.body.code).toBe("EMAIL_CONFIG_MISSING");
        expect(res.body.otp).toBeUndefined();
        expect(sendOtpEmail).not.toHaveBeenCalled();
        const session = await OtpSession.findOne({ identifier: "unsafe-s02@example.com" });
        expect(session).toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      }
    });
  });
});
