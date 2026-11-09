import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
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
import { User } from "../src/models/User.js";
import customerUploadRoutes from "../src/routes/customerUploadRoutes.js";
import {
  clearTestDB,
  connectTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/customer/uploads", customerUploadRoutes);
  return app;
}

const app = createTestApp();

function makeCustomerToken(customerId: string, tokenVersion = 0): string {
  return jwt.sign(
    {
      customerId,
      accountType: "CUSTOMER",
      tokenVersion,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function makeAdminToken(adminId: string): string {
  return jwt.sign(
    { adminId, username: "testadmin", role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

describe("Customer Cloudinary Upload Signature", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
    await User.create({
      name: "Priya Customer",
      phone: "9840916058",
      active: true,
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("POST /api/customer/uploads/signature", () => {
    it("returns a signed upload signature for an authenticated customer", async () => {
      const customer = await User.findOne({ phone: "9840916058" });
      const token = makeCustomerToken(customer!._id.toString());

      const response = await request(app)
        .post("/api/customer/uploads/signature")
        .set("Cookie", `customer-token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.signature).toBeDefined();
      expect(response.body.signature.timestamp).toBeDefined();
      expect(response.body.signature.signature).toBeDefined();
      expect(response.body.signature.apiKey).toBe(
        process.env.CLOUDINARY_API_KEY,
      );
      expect(response.body.signature.cloudName).toBe(
        process.env.CLOUDINARY_CLOUD_NAME,
      );
      expect(response.body.signature.folder).toBe("sv-bakery/custom-cakes");

      // API secret must never be returned
      expect(response.body.signature.apiSecret).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(
        process.env.CLOUDINARY_API_SECRET,
      );
    });

    it("rejects customer signature without a customer token", async () => {
      const response = await request(app)
        .post("/api/customer/uploads/signature");

      expect(response.status).toBe(401);
    });

    it("rejects customer signature with an admin token", async () => {
      await Admin.create({
        username: "testadmin",
        password: await bcrypt.hash("CorrectPassword123", 10),
        role: "ADMIN",
        tokenVersion: 0,
      });
      const admin = await Admin.findOne({ username: "testadmin" });
      const token = makeAdminToken(admin!._id.toString());

      const response = await request(app)
        .post("/api/customer/uploads/signature")
        .set("Cookie", `admin-token=${token}`);

      expect(response.status).toBe(401);
    });

    it("signature timestamp is current", async () => {
      const customer = await User.findOne({ phone: "9840916058" });
      const token = makeCustomerToken(customer!._id.toString());

      const before = Math.round(Date.now() / 1000);

      const response = await request(app)
        .post("/api/customer/uploads/signature")
        .set("Cookie", `customer-token=${token}`);

      const after = Math.round(Date.now() / 1000);

      expect(response.status).toBe(200);
      expect(response.body.signature.timestamp).toBeGreaterThanOrEqual(before);
      expect(response.body.signature.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
