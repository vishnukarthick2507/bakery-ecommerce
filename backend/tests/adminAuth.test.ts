import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { Admin } from "../src/models/Admin.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

vi.mock("../src/services/emailService.js", () => ({
  getBrevoPresenceChecks: vi.fn(),
}));

function setCookieValues(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

import { getBrevoPresenceChecks } from "../src/services/emailService.js";

const app = createAuthTestApp();

describe("Admin authentication API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    vi.mocked(getBrevoPresenceChecks).mockReset();

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

  it("includes tokenVersion in JWT on login and accepts current-version token", async () => {
    vi.mocked(getBrevoPresenceChecks).mockReturnValue({ apiKeyPresent: true });
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "testadmin", password: "CorrectPassword123" });

    expect(response.status).toBe(200);
    const cookie = response.headers["set-cookie"]?.[0]?.split(";")[0];
    const token = cookie?.split("=")[1];
    expect(token).toBeDefined();

    const decoded = jwt.decode(token!) as { tokenVersion?: number };
    expect(decoded.tokenVersion).toBe(0);

    const authResponse = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", cookie!);

    expect(authResponse.status).toBe(200);
  });

  it("rejects a token with an outdated version", async () => {
    const admin = await Admin.findOne({ username: "testadmin" });
    const adminId = admin!._id.toString();

    const token = jwt.sign(
      { adminId, username: "testadmin", role: "ADMIN", tokenVersion: 0 },
      "test-secret-that-is-at-least-32-characters-long",
    );

    await Admin.findOneAndUpdate(
      { username: "testadmin" },
      { $inc: { tokenVersion: 1 } },
    );

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(response.status).toBe(401);
  });

  it("accepts a legacy token without tokenVersion when DB version is zero", async () => {
    vi.mocked(getBrevoPresenceChecks).mockReturnValue({ apiKeyPresent: true });
    const admin = await Admin.findOne({ username: "testadmin" });
    const adminId = admin!._id.toString();

    const token = jwt.sign(
      { adminId, username: "testadmin", role: "ADMIN" },
      "test-secret-that-is-at-least-32-characters-long",
    );

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(response.status).toBe(200);
  });

  it("accepts a legacy token and logout when admin document has no tokenVersion field", async () => {
    vi.mocked(getBrevoPresenceChecks).mockReturnValue({ apiKeyPresent: true });

    // Remove the tokenVersion field to simulate a legacy document
    await Admin.findOneAndUpdate(
      { username: "testadmin" },
      { $unset: { tokenVersion: 1 } },
    );

    const admin = await Admin.findOne({ username: "testadmin" }).lean();
    expect(admin!.tokenVersion).toBeUndefined();

    const adminId = admin!._id.toString();

    // Legacy token without tokenVersion
    const token = jwt.sign(
      { adminId, username: "testadmin", role: "ADMIN" },
      "test-secret-that-is-at-least-32-characters-long",
    );

    // Middleware accepts legacy token when stored version is effectively zero
    const authResponse = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(authResponse.status).toBe(200);

    // Logout atomically increments from missing to 1
    const logoutResponse = await request(app)
      .post("/api/admin/logout")
      .set("Cookie", `admin-token=${token}`);

    expect(logoutResponse.status).toBe(200);

    const updatedAdmin = await Admin.findOne({ username: "testadmin" });
    expect(updatedAdmin!.tokenVersion).toBe(1);

    // Stale legacy token is rejected after logout
    const staleResponse = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(staleResponse.status).toBe(401);
  });

  it("rejects a version-one token when admin document has no tokenVersion field", async () => {
    // Remove the tokenVersion field to simulate a legacy document
    await Admin.findOneAndUpdate(
      { username: "testadmin" },
      { $unset: { tokenVersion: 1 } },
    );

    const admin = await Admin.findOne({ username: "testadmin" }).lean();
    expect(admin!.tokenVersion).toBeUndefined();

    const adminId = admin!._id.toString();

    // Token claims version 1, but DB has no tokenVersion field (stored version = 0)
    const token = jwt.sign(
      { adminId, username: "testadmin", role: "ADMIN", tokenVersion: 1 },
      "test-secret-that-is-at-least-32-characters-long",
    );

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects a stale token after logout increments version", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "testadmin", password: "CorrectPassword123" });
    const adminCookie = login.headers["set-cookie"]?.[0]?.split(";")[0]!;

    const logoutResponse = await request(app)
      .post("/api/admin/logout")
      .set("Cookie", adminCookie);

    expect(logoutResponse.status).toBe(200);

    const updatedAdmin = await Admin.findOne({ username: "testadmin" });
    expect(updatedAdmin!.tokenVersion).toBe(1);

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(401);
  });

  it("rejects a token without tokenVersion when DB version is greater than zero", async () => {
    await Admin.findOneAndUpdate(
      { username: "testadmin" },
      { $inc: { tokenVersion: 1 } },
    );

    const admin = await Admin.findOne({ username: "testadmin" });
    const adminId = admin!._id.toString();

    const token = jwt.sign(
      { adminId, username: "testadmin", role: "ADMIN" },
      "test-secret-that-is-at-least-32-characters-long",
    );

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(response.status).toBe(401);
  });

  it("increments tokenVersion on admin logout and rejects stale token", async () => {
    const admin = await Admin.findOne({ username: "testadmin" });
    expect(admin!.tokenVersion).toBe(0);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "testadmin", password: "CorrectPassword123" });
    const adminCookie = login.headers["set-cookie"]?.[0]?.split(";")[0]!;

    const logoutResponse = await request(app)
      .post("/api/admin/logout")
      .set("Cookie", adminCookie);

    expect(logoutResponse.status).toBe(200);

    const updatedAdmin = await Admin.findOne({ username: "testadmin" });
    expect(updatedAdmin!.tokenVersion).toBe(1);

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(401);
  });

  it("rejects a token for a nonexistent admin", async () => {
    const { Types } = await import("mongoose");
    const fakeId = new Types.ObjectId().toString();
    const token = jwt.sign(
      { adminId: fakeId, username: "nonexistent", role: "ADMIN" },
      "test-secret-that-is-at-least-32-characters-long",
    );

    const response = await request(app)
      .get("/api/admin/diagnostics/brevo-smtp")
      .set("Cookie", `admin-token=${token}`);

    expect(response.status).toBe(401);
  });

  describe("GET /api/admin/diagnostics/brevo-smtp", () => {
    const configured = {
      apiKeyPresent: true,
    };

    const notConfigured = {
      apiKeyPresent: false,
    };

    const loginAsAdmin = async () => {
      const login = await request(app)
        .post("/api/auth/login")
        .send({ username: "testadmin", password: "CorrectPassword123" });
      return login.headers["set-cookie"]?.[0]?.split(";")[0]!;
    };

    it("rejects unauthorized access without admin token", async () => {
      const response = await request(app).get("/api/admin/diagnostics/brevo-smtp");
      expect(response.status).toBe(401);
    });

    it("returns API key presence check for authenticated admin", async () => {
      vi.mocked(getBrevoPresenceChecks).mockReturnValue(configured);

      const adminCookie = await loginAsAdmin();

      const response = await request(app)
        .get("/api/admin/diagnostics/brevo-smtp")
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.smtpConfigured).toBe(true);
      expect(response.body.checks).toEqual(configured);
      expect(response.body).not.toHaveProperty("password");
      // No env var names or credential values are leaked in the response.
      expect(JSON.stringify(response.body)).not.toContain("BREVO_API_KEY");
    });

    it("returns smtpConfigured false when the API key is missing", async () => {
      vi.mocked(getBrevoPresenceChecks).mockReturnValue(notConfigured);

      const adminCookie = await loginAsAdmin();

      const response = await request(app)
        .get("/api/admin/diagnostics/brevo-smtp")
        .set("Cookie", adminCookie);

      expect(response.status).toBe(200);
      expect(response.body.smtpConfigured).toBe(false);
      expect(response.body.checks).toEqual(notConfigured);
    });
  });
});
