import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import { Admin } from "../src/models/Admin.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

const app = createAuthTestApp();
const JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("Admin token verification API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    await Admin.create({
      username: "testadmin",
      password: await bcrypt.hash("CorrectPassword123", 10),
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("rejects a request without a token", async () => {
    const response = await request(app).get("/api/auth/verify");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("No token provided");
  });

  it("rejects an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/verify")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid token");
  });

  it("verifies a valid admin token", async () => {
    const admin = await Admin.findOne({ username: "testadmin" }).lean();

    expect(admin).not.toBeNull();

    const token = jwt.sign(
      {
        adminId: admin!._id.toString(),
        username: admin!.username,
        role: admin!.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    const response = await request(app)
      .get("/api/auth/verify")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.admin).toMatchObject({
      username: "testadmin",
      role: "ADMIN",
    });
    expect(response.body.admin).not.toHaveProperty("password");
  });

  it("verifies a token received via the login set-cookie header", async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        username: "testadmin",
        password: "CorrectPassword123",
      });

    expect(loginResponse.status).toBe(200);
    const setCookie = loginResponse.headers["set-cookie"];
    expect(setCookie).toBeDefined();

    // Extract just the "name=value" pair, dropping cookie attributes
    // (Path, HttpOnly, SameSite, etc.) that a browser would not resend.
    const cookieValue = Array.isArray(setCookie)
      ? setCookie[0].split(";")[0]
      : setCookie.split(";")[0];

    const verifyResponse = await request(app)
      .get("/api/auth/verify")
      .set("Cookie", cookieValue);

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.valid).toBe(true);
  });
});
