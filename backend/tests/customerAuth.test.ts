import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
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

describe("Customer password-based authentication", () => {
  let app: ReturnType<typeof createAuthTestApp>;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "test-jwt-secret-that-is-at-least-32-chars-long";
    await connectTestDB();
    app = createAuthTestApp();
  });

  beforeEach(async () => {
    await clearTestDB();
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
    it("registers a new customer and returns { token, user }", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("rejects duplicate email", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const res = await request(app)
        .post("/api/auth/register")
        .send(registerPayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists");
    });

    it("rejects duplicate phone", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...registerPayload,
          email: "someone-else@example.com",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists");
    });

    it("rejects invalid registration details", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "A",
        email: "not-an-email",
        phone: "123",
        password: "short",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/customer/login", () => {
    it("logs in a registered customer and returns { token, user }", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const res = await request(app)
        .post("/api/auth/customer/login")
        .send({
          email: "priya@example.com",
          password: "Secure1password",
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
    });

    it("rejects a wrong password", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

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
    it("returns the customer profile for a valid customer token", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "priya@example.com", password: "Secure1password" });
      expect(login.status).toBe(200);
      const token = login.body.token;

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: "Priya Customer",
        email: "priya@example.com",
        phone: "9840916058",
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("returns { isAdmin: false } with no token (admin fallback unchanged)", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isAdmin: false });
    });

    it("returns customer profile when Authorization header has customer JWT and admin-token cookie also exists", async () => {
      await request(app).post("/api/auth/register").send(registerPayload);

      const login = await request(app)
        .post("/api/auth/customer/login")
        .send({ email: "priya@example.com", password: "Secure1password" });
      expect(login.status).toBe(200);
      const customerToken = login.body.token;

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
        .set("Authorization", `Bearer ${customerToken}`)
        .set("Cookie", `admin-token=${adminToken}`);

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
  });
});
