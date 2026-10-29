import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

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
  });
});
