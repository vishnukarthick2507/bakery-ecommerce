import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";
import { Admin } from "../src/models/Admin.js";
import { sendOtpEmail, isBrevoConfigured } from "../src/services/emailService.js";

const googleAuthMocks = vi.hoisted(() => ({
  verifyGoogleIdToken: vi.fn(),
  isGoogleConfigured: vi.fn(() => true),
}));

vi.mock("../src/services/emailService.js", () => ({
  sendOtpEmail: vi.fn(),
  isBrevoConfigured: vi.fn(() => true),
}));

vi.mock("../src/services/googleAuth.js", () => googleAuthMocks);

function setCookieValues(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function customerCookie(value: string | string[] | undefined): string | undefined {
  return setCookieValues(value)
    .find((cookie) => cookie.startsWith("customer-token="))
    ?.split(";")[0];
}

describe("Customer password-based authentication", () => {
  let app: ReturnType<typeof createAuthTestApp>;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "test-jwt-secret-that-is-at-least-32-chars-long";
    process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-16-chars";
    await connectTestDB();
    app = createAuthTestApp();
  });

  beforeEach(async () => {
    await clearTestDB();
    (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    googleAuthMocks.isGoogleConfigured.mockReturnValue(true);
    googleAuthMocks.verifyGoogleIdToken.mockResolvedValue({
      googleId: "google-customer-1",
      email: "google@example.com",
      emailVerified: true,
      name: "Google Customer",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  const registerPayload = {
    name: "Priya Customer",
    email: "priya@example.com",
    phone: "9840916058",
    password: "Secure1password",
  };

  describe("POST /api/auth/register", () => {
    it("registers a new customer with email/password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(registerPayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("verification code");
    });

    it("rejects duplicate email registration via password", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const res = await request(app)
        .post("/api/auth/register")
        .send(registerPayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("does not already exist");
    });

    it("rejects duplicate phone registration via password", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...registerPayload,
          email: "someone-else@example.com",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("does not already exist");
    });

    it("returns indistinguishable responses for duplicate email and phone", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const emailRes = await request(app)
        .post("/api/auth/register")
        .send(registerPayload);

      const phoneRes = await request(app)
        .post("/api/auth/register")
        .send({
          ...registerPayload,
          email: "someone-else@example.com",
        });

      expect(emailRes.status).toBe(200);
      expect(phoneRes.status).toBe(200);
      expect(emailRes.body.message).toBe(phoneRes.body.message);
    });

    it("does not create duplicate accounts for duplicate email or phone", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      await request(app).post("/api/auth/register").send(registerPayload);
      await request(app)
        .post("/api/auth/register")
        .send({ ...registerPayload, email: "someone-else@example.com" });

      const { PendingRegistration } = await import("../src/models/PendingRegistration.js");
      const count = await PendingRegistration.countDocuments({
        email: registerPayload.email,
      });
      expect(count).toBe(1);
    });

    it("rejects invalid registration details via password", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "A",
        email: "not-an-email",
        phone: "123",
        password: "short",
      });

      // Invalid input should be rejected (400) or rate-limited (429)
      expect([400, 429]).toContain(res.status);
    });
  });

  describe("POST /api/auth/google redirect handling", () => {
    it("keeps same-site relative redirect paths", async () => {
      const response = await request(app)
        .post("/api/auth/google")
        .send({ idToken: "mock-google-id-token", redirectTo: "/account/orders" });

      expect(response.status).toBe(200);
      expect(response.body.redirectTo).toBe("/account/orders");
    });

    it.each(["//attacker.example/path", "/\\\\attacker.example", "https://attacker.example"])(
      "falls back for unsafe redirect %s",
      async (redirectTo) => {
        const response = await request(app)
          .post("/api/auth/google")
          .send({ idToken: "mock-google-id-token", redirectTo });

        expect(response.status).toBe(200);
        expect(response.body.redirectTo).toBe("/account");
      },
    );
  });

  describe("POST /api/auth/customer/login", () => {
    it("logs in an existing customer with email/password", async () => {
      // Password registration is disabled; create user directly for login tests
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const res = await request(app)
        .post("/api/auth/customer/login")
        .send({
          email: "priya@example.com",
          password: "Secure1password",
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
      expect(setCookieValues(res.headers["set-cookie"]).some((cookie) => cookie.startsWith("customer-token="))).toBe(true);
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
    });

    it("sets only HTTP-only customer cookies with environment-appropriate flags", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Cookie Flags Customer",
        email: "cookie-flags@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "development";
        const developmentResponse = await request(app)
          .post("/api/auth/customer/login")
          .send({ email: "cookie-flags@example.com", password: "Secure1password" });
        const developmentCookie = setCookieValues(developmentResponse.headers["set-cookie"])
          .find((cookie) => cookie.startsWith("customer-token="));

        expect(developmentResponse.status).toBe(200);
        expect(developmentResponse.body.token).toBeUndefined();
        expect(developmentCookie).toMatch(/HttpOnly/i);
        expect(developmentCookie).toMatch(/SameSite=Lax/i);
        expect(developmentCookie).not.toMatch(/Secure/i);

        process.env.NODE_ENV = "production";
        const productionResponse = await request(app)
          .post("/api/auth/customer/login")
          .send({ email: "cookie-flags@example.com", password: "Secure1password" });
        const productionCookie = setCookieValues(productionResponse.headers["set-cookie"])
          .find((cookie) => cookie.startsWith("customer-token="));

        expect(productionResponse.status).toBe(200);
        expect(productionResponse.body.token).toBeUndefined();
        expect(productionCookie).toMatch(/HttpOnly/i);
        expect(productionCookie).toMatch(/Secure/i);
        expect(productionCookie).toMatch(/SameSite=None/i);
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("rejects a wrong password", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const res = await request(app)
        .post("/api/auth/customer/login")
        .send({
          email: "priya@example.com",
          password: "WrongPassword1",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain("Invalid email or password");
    });

    it("rejects login for an unregistered email", async () => {
      const res = await request(app)
        .post("/api/auth/customer/login")
        .send({
          email: "nobody@example.com",
          password: "Secure1password",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns the customer profile from the httpOnly customer cookie", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Cookie Customer",
        email: "cookie@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "cookie@example.com", password: "Secure1password" });
      const sessionCookie = customerCookie(login.headers["set-cookie"]);

      expect(login.status).toBe(200);
      expect(sessionCookie).toMatch(/^customer-token=/);
      expect(login.body.token).toBeUndefined();

      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        name: "Cookie Customer",
        email: "cookie@example.com",
        phone: "9840916058",
      });

      const ordersResponse = await request(app)
        .get("/api/orders/me")
        .set("Cookie", sessionCookie!);
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.body.orders).toEqual([]);
    });

    it("returns the customer profile for a valid customer token", async () => {
      const { User } = await import("../src/models/User.js");
      const user = await User.create({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "priya@example.com", password: "Secure1password" });
      expect(login.status).toBe(200);
      const sessionCookie = customerCookie(login.headers["set-cookie"]);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(user._id.toString()).toBe(res.body.user.id);
    });

    it("returns { isAdmin: false } with no token (admin fallback unchanged)", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAdmin: false });
    });

    it("returns customer profile from the customer cookie when an admin cookie also exists", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "priya@example.com", password: "Secure1password" });
      expect(login.status).toBe(200);
      const sessionCookie = customerCookie(login.headers["set-cookie"]);

      const admin = await Admin.create({
        username: "testadmin",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
      });
      const adminToken = jwt.sign(
        { adminId: admin._id.toString(), username: "testadmin", role: "ADMIN" },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `${sessionCookie}; admin-token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("returns { isAdmin: true } when Authorization header has admin JWT and customer-token cookie also exists", async () => {
      const admin = await Admin.create({
        username: "testadmin2",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
      });
      const adminToken = jwt.sign(
        { adminId: admin._id.toString(), username: "testadmin2", role: "ADMIN" },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const customerToken = jwt.sign(
        { customerId: "000000000000000000000000", accountType: "CUSTOMER", tokenVersion: 0 },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Cookie", `customer-token=${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAdmin: true });
    });

    it("returns { isAdmin: true } when only admin-token cookie exists (no Authorization header)", async () => {
      const admin = await Admin.create({
        username: "testadmin3",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
      });
      const adminToken = jwt.sign(
        { adminId: admin._id.toString(), username: "testadmin3", role: "ADMIN" },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `admin-token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAdmin: true });
    });

    it("returns { isAdmin: false } with invalid token in Authorization header", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAdmin: false });
    });

    it("logs out a customer using the customer cookie and invalidates the session", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Logout Customer",
        email: "logout@example.com",
        phone: "9840916058",
        passwordHash: await bcrypt.hash("Secure1password", 12),
        active: true,
      });

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "logout@example.com", password: "Secure1password" });
      const sessionCookie = customerCookie(login.headers["set-cookie"]);

      const logout = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", sessionCookie!);

      expect(logout.status).toBe(200);
      expect(setCookieValues(logout.headers["set-cookie"]).some((cookie) =>
        cookie.startsWith("customer-token=") && /Expires=/i.test(cookie),
      )).toBe(true);

      const expiredSession = await request(app)
        .get("/api/orders/me")
        .set("Cookie", sessionCookie!);
      expect(expiredSession.status).toBe(401);
    });
  });
});
