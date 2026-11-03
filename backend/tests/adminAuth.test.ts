import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { Admin } from "../src/models/Admin.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

vi.mock("../src/services/emailService.js", () => ({
  verifyBrevoSmtpConnection: vi.fn(),
}));

function setCookieValues(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

import { verifyBrevoSmtpConnection } from "../src/services/emailService.js";

const app = createAuthTestApp();

describe("Admin authentication API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    vi.mocked(verifyBrevoSmtpConnection).mockReset();

    await Admin.create({
      username: "testadmin",
      password: await bcrypt.hash("CorrectPassword123", 10),
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("rejects invalid login input", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("rejects an unknown admin", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        username: "unknown",
        password: "CorrectPassword123",
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("rejects an incorrect password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        username: "testadmin",
        password: "WrongPassword123",
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        username: "testadmin",
        password: "CorrectPassword123",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(setCookieValues(response.headers["set-cookie"]).some((cookie) => cookie.startsWith("admin-token="))).toBe(true);
    expect(response.body.admin).toMatchObject({
      username: "testadmin",
      role: "ADMIN",
    });
    expect(response.body.admin).not.toHaveProperty("password");
  });

  it("clears the admin cookie through the admin logout route", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "testadmin", password: "CorrectPassword123" });
    const adminCookie = login.headers["set-cookie"]?.[0]?.split(";")[0];

    const response = await request(app)
      .post("/api/admin/logout")
      .set("Cookie", adminCookie!);

    expect(response.status).toBe(200);
    expect(setCookieValues(response.headers["set-cookie"]).some((cookie) =>
      cookie.startsWith("admin-token=") && /Expires=/i.test(cookie),
    )).toBe(true);
  });

  describe("GET /api/admin/diagnostics/brevo-smtp", () => {
    it("rejects unauthorized access without admin token", async () => {
      const response = await request(app).get("/api/admin/diagnostics/brevo-smtp");
      expect(response.status).toBe(401);
    });

    it("returns diagnostic result for authenticated admin", async () => {
      vi.mocked(verifyBrevoSmtpConnection).mockResolvedValue({
        ok: true,
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ username: "testadmin", password: "CorrectPassword123" });
      const adminCookie = login.headers["set-cookie"]?.[0]?.split(";")[0];

      const response = await request(app)
        .get("/api/admin/diagnostics/brevo-smtp")
        .set("Cookie", adminCookie!);

      expect(response.status).toBe(200);
      expect(response.body.smtpConfigured).toBe(true);
      expect(response.body.smtpConnectionOk).toBe(true);
      expect(response.body.error).toBeUndefined();
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("BREVO_SMTP");
    });

    it("returns failure detail when SMTP verification fails", async () => {
      vi.mocked(verifyBrevoSmtpConnection).mockResolvedValue({
        ok: false,
        detail: "Invalid login",
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ username: "testadmin", password: "CorrectPassword123" });
      const adminCookie = login.headers["set-cookie"]?.[0]?.split(";")[0];

      const response = await request(app)
        .get("/api/admin/diagnostics/brevo-smtp")
        .set("Cookie", adminCookie!);

      expect(response.status).toBe(200);
      expect(response.body.smtpConfigured).toBe(true);
      expect(response.body.smtpConnectionOk).toBe(false);
      expect(response.body.error).toBe("Invalid login");
    });
  });
});
