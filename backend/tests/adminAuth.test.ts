import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import { Admin } from "../src/models/Admin.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

const app = createAuthTestApp();

describe("Admin authentication API", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
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
    expect(response.headers["set-cookie"][0]).toMatch(/^admin-token=/);
    expect(response.body.admin).toMatchObject({
      username: "testadmin",
      role: "ADMIN",
    });
    expect(response.body.admin).not.toHaveProperty("password");
  });
});
