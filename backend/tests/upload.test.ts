import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

// Cloudinary test env vars (not real secrets)
process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
process.env.CLOUDINARY_API_KEY = "testkey123";
process.env.CLOUDINARY_API_SECRET = "testsecret456";

import { Admin } from "../src/models/Admin.js";
import uploadRoutes from "../src/routes/uploadRoutes.js";
import {
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/uploads", uploadRoutes);
  return app;
}

const app = createTestApp();

function makeAdminToken(adminId: string): string {
  return jwt.sign(
    { adminId, username: "testadmin", role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function makeCustomerToken(customerId: string, tokenVersion = 0): string {
  return jwt.sign(
    { customerId, accountType: "CUSTOMER", tokenVersion },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

let counter = 0;

async function createTestUser(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    _id: new mongoose.Types.ObjectId(),
    name: `Img User ${counter}`,
    email: `img${counter}-${Date.now()}@example.com`,
    phone: `9${String(counter).padStart(9, "0")}`,
    ...overrides,
  };
}

describe("Cloudinary Upload Signature", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
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
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("POST /api/admin/uploads/signature", () => {
    it("returns a signed upload signature for an admin", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const response = await request(app)
        .post("/api/admin/uploads/signature")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.signature).toBeDefined();
      expect(response.body.signature.timestamp).toBeDefined();
      expect(response.body.signature.signature).toBeDefined();
      expect(response.body.signature.apiKey).toBe(process.env.CLOUDINARY_API_KEY);
      expect(response.body.signature.cloudName).toBe(process.env.CLOUDINARY_CLOUD_NAME);
      expect(response.body.signature.folder).toBe("sv-bakery/products");

      // API secret must never be returned
      expect(response.body.signature.apiSecret).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(
        process.env.CLOUDINARY_API_SECRET,
      );
    });

    it("rejects upload signature without admin token", async () => {
      const response = await request(app)
        .post("/api/admin/uploads/signature");

      expect(response.status).toBe(401);
    });

    it("rejects upload signature with a customer token", async () => {
      const user = await createTestUser();
      const token = makeCustomerToken(user._id.toString());

      const response = await request(app)
        .post("/api/admin/uploads/signature")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it("signature timestamp is current", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const before = Math.round(Date.now() / 1000);

      const response = await request(app)
        .post("/api/admin/uploads/signature")
        .set("Authorization", `Bearer ${token}`);

      const after = Math.round(Date.now() / 1000);

      expect(response.status).toBe(200);
      expect(response.body.signature.timestamp).toBeGreaterThanOrEqual(before);
      expect(response.body.signature.timestamp).toBeLessThanOrEqual(after);
    });

    it("does not expose Cloudinary secret in response body", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const response = await request(app)
        .post("/api/admin/uploads/signature")
        .set("Authorization", `Bearer ${token}`);

      const bodyString = JSON.stringify(response.body);
      expect(bodyString).not.toContain(process.env.CLOUDINARY_API_SECRET);
    });
  });
});
