import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
process.env.CLOUDINARY_API_KEY = "testkey123";
process.env.CLOUDINARY_API_SECRET = "testsecret456";

import { Admin } from "../src/models/Admin.js";
import { Product } from "../src/models/Product.js";
import productRoutes from "../src/routes/productRoutes.js";
import {
  deleteAsset,
  extractPublicId,
} from "../src/services/cloudinary.js";
import {
  clearTestDB,
  connectTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

// Mock Cloudinary deleteAsset so we can assert whether deletion is called,
// and control failure behaviour, without touching real Cloudinary.
vi.mock("../src/services/cloudinary.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/cloudinary.js")>();
  return {
    ...actual,
    deleteAsset: vi.fn(),
  };
});

let mongoServer: MongoMemoryServer;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productRoutes);
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

async function seedAdmin(): Promise<string> {
  const admin = await Admin.create({
    username: "testadmin",
    password: await bcrypt.hash("CorrectPassword123", 10),
    role: "ADMIN",
  });
  return admin._id.toString();
}

async function createProduct(adminToken: string, images: string[]) {
  return request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Test Product",
      slug: `test-product-${Date.now()}`,
      description: "A test product",
      price: 100,
      category: "Cakes",
      stock: 10,
      preparationTime: 60,
      availability: "AVAILABLE",
      images,
    });
}

const UNIQUE_URL_1 =
  "https://res.cloudinary.com/testcloud/image/upload/v1/sv-bakery/products/unique-img";
const SHARED_URL =
  "https://res.cloudinary.com/testcloud/image/upload/v1/sv-bakery/products/shared-img";
const UNIQUE_URL_2 =
  "https://res.cloudinary.com/testcloud/image/upload/v1/sv-bakery/products/unique-img-2";

describe("Product image cleanup — cross-product reference safety", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
    await seedAdmin();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  async function adminToken(): Promise<string> {
    const admin = await Admin.findOne({ username: "testadmin" });
    return makeAdminToken(admin!._id.toString());
  }

  describe("PATCH /api/products/:id image cleanup", () => {
    it("deletes a Cloudinary asset when the image is used by only one product", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, [UNIQUE_URL_1]);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ images: [] });

      expect(res.status).toBe(200);
      expect(deleteAsset).toHaveBeenCalledTimes(1);
      const publicId = extractPublicId(UNIQUE_URL_1);
      expect(publicId).not.toBeNull();
      expect(deleteAsset).toHaveBeenCalledWith(publicId);
    });

    it("does NOT delete a Cloudinary asset shared by two products", async () => {
      const token = await adminToken();

      const productA = await createProduct(token, [SHARED_URL]);
      expect(productA.status).toBe(201);
      const productAId = productA.body.product._id;

      const productB = await createProduct(token, [SHARED_URL]);
      expect(productB.status).toBe(201);
      const productBId = productB.body.product._id;

      // Remove the shared image from product A only.
      const res = await request(app)
        .patch(`/api/products/${productAId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ images: [] });

      expect(res.status).toBe(200);

      // Product B still references SHARED_URL, so Cloudinary must not delete it.
      expect(deleteAsset).not.toHaveBeenCalled();

      // Product B's images must still contain SHARED_URL.
      const productBAfter = await Product.findById(productBId).lean();
      expect(productBAfter!.images).toContain(SHARED_URL);
    });

    it("removes an image from one product while another still uses it — deletes only the unshared image", async () => {
      const token = await adminToken();

      const productA = await createProduct(token, [UNIQUE_URL_1, SHARED_URL]);
      expect(productA.status).toBe(201);
      const productAId = productA.body.product._id;

      const productB = await createProduct(token, [SHARED_URL]);
      expect(productB.status).toBe(201);

      // Remove both images from product A. UNIQUE_URL_1 is unshared
      // (should be deleted); SHARED_URL is shared (should NOT be deleted).
      const res = await request(app)
        .patch(`/api/products/${productAId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ images: [] });

      expect(res.status).toBe(200);

      // deleteAsset called once, only for the unshared image's public ID.
      expect(deleteAsset).toHaveBeenCalledTimes(1);
      const uniquePublicId = extractPublicId(UNIQUE_URL_1);
      expect(uniquePublicId).not.toBeNull();
      expect(deleteAsset).toHaveBeenCalledWith(uniquePublicId);

      // Product B still has SHARED_URL.
      const productBAfter = await Product.findById(
        productB.body.product._id,
      ).lean();
      expect(productBAfter!.images).toContain(SHARED_URL);
    });

    it("succeeds with the product update when Cloudinary deletion fails", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, [UNIQUE_URL_2]);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      // Force deleteAsset to throw.
      (deleteAsset as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Cloudinary delete failed"),
      );

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ images: [] });

      // Product update still succeeds despite cleanup failure.
      expect(res.status).toBe(200);
      expect(res.body.product.images).toEqual([]);
    });
  });
});
