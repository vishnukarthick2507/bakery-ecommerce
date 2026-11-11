import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";
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
import { InventoryMovement } from "../src/models/InventoryMovement.js";
import productRoutes from "../src/routes/productRoutes.js";
import adminInventoryRoutes from "../src/routes/adminInventoryRoutes.js";
import {
  deleteAsset,
  extractPublicId,
} from "../src/services/cloudinary.js";
import { recordInventoryMovement } from "../src/services/inventory.js";

// Mock Cloudinary deleteAsset so we can assert whether deletion is called,
// and control failure behaviour, without touching real Cloudinary.
vi.mock("../src/services/cloudinary.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/cloudinary.js")>();
  return {
    ...actual,
    deleteAsset: vi.fn(),
  };
});

// Mock recordInventoryMovement so we can control whether it succeeds or
// throws within a transaction, testing transactional rollback behaviour.
// Delegates to the real implementation by default so ledger entries are
// actually created; individual tests can override with mockRejectedValueOnce.
vi.mock("../src/services/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/inventory.js")>();
  return {
    ...actual,
    recordInventoryMovement: vi.fn(actual.recordInventoryMovement),
  };
});

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
  app.use("/api/admin/inventory", adminInventoryRoutes);
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

async function createProduct(adminToken: string, stock: number = 10) {
  return request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Test Product",
      slug: `test-product-${Date.now()}`,
      description: "A test product",
      price: 100,
      category: "Cakes",
      stock,
      preparationTime: 60,
      availability: "AVAILABLE",
      images: [],
    });
}

describe("Inventory ledger consistency — manual stock adjustment", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        args: ["--replSet", "inventory-ledger-rs"],
      },
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, { directConnection: true });

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection not established");
    const adminDb = db.admin();
    let lastError: unknown;
    for (let i = 0; i < 15; i++) {
      try {
        await adminDb.command({ replSetInitiate: {} });
        break;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    // Wait for the replica set primary to be elected before running operations.
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    await seedAdmin();
  });

  async function adminToken(): Promise<string> {
    const admin = await Admin.findOne({ username: "testadmin" });
    return makeAdminToken(admin!._id.toString());
  }

  describe("Transactional stock adjustment (replica set)", () => {
    it("successfully updates stock and creates inventory movement ledger entry", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, 10);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ stock: 25, stockAdjustmentReason: "Morning bake count correction" });

      expect(res.status).toBe(200);

      // Stock was updated
      const updatedProduct = await Product.findById(productId).lean();
      expect(updatedProduct!.stock!).toBe(25);

      // Inventory movement ledger entry was created
      const movements = await InventoryMovement.find({
        productId: new mongoose.Types.ObjectId(productId),
        reason: "MANUAL_ADJUSTMENT",
      });
      expect(movements).toHaveLength(1);
      expect(movements[0]!.adjustmentReason).toBe("Morning bake count correction");
      expect(movements[0]!.createdAt).toBeInstanceOf(Date);
      expect(movements[0]!.quantityChange).toBe(15);

      const history = await request(app)
        .get("/api/admin/inventory/movements?page=1&limit=1")
        .set("Authorization", `Bearer ${token}`);
      expect(history.status).toBe(200);
      expect(history.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });
      expect(history.body.movements[0]).toMatchObject({
        adjustmentReason: "Morning bake count correction",
        reason: "MANUAL_ADJUSTMENT",
      });
      expect(history.body.movements[0].createdAt).toBeDefined();

      const invalidPage = await request(app)
        .get("/api/admin/inventory/movements?page=abc&limit=1")
        .set("Authorization", `Bearer ${token}`);
      expect(invalidPage.status).toBe(400);
      expect(movements[0]!.previousStock).toBe(10);
      expect(movements[0]!.newStock).toBe(25);
    });

    it("rolls back stock update when Cloudinary/deletion fails within transaction", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, 10);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      // Mock recordInventoryMovement to throw - this happens INSIDE the
      // transaction, so the entire transaction (including stock update)
      // should roll back.
      vi.mocked(recordInventoryMovement).mockRejectedValueOnce(
        new Error("Ledger write failed"),
      );

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ stock: 25 });

      // The update should fail because recordInventoryMovement throws within
      // the transaction, causing the entire transaction to abort
      expect(res.status).toBe(500);

      // Stock was NOT changed (rolled back)
      const updatedProduct = await Product.findById(productId).lean();
      expect(updatedProduct!.stock).toBe(10);

      // No movement ledger entry was created
      const movements = await InventoryMovement.find({
        productId: new mongoose.Types.ObjectId(productId),
        reason: "MANUAL_ADJUSTMENT",
      });
      expect(movements).toHaveLength(0);

      vi.restoreAllMocks();
    });

    it("does not create ledger entry when stock is unchanged", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, 10);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ stock: 10 });

      expect(res.status).toBe(200);

      // No movement ledger entry was created (stock didn't change)
      const movements = await InventoryMovement.find({
        productId: new mongoose.Types.ObjectId(productId),
        reason: "MANUAL_ADJUSTMENT",
      });
      expect(movements).toHaveLength(0);
    });
  });

  describe("Production transaction unavailability", () => {
    let originalNodeEnv: string | undefined;

    beforeEach(async () => {
      originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
    });

    afterEach(async () => {
      process.env.NODE_ENV = originalNodeEnv;
      vi.restoreAllMocks();
    });

    it("rejects stock adjustment when transactions are unavailable in production", async () => {
      const token = await adminToken();
      const createRes = await createProduct(token, 10);
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product._id;

      // Mock mongoose.startSession to throw a transaction-unsupported error
      const startSessionSpy = vi
        .spyOn(mongoose, "startSession")
        .mockRejectedValueOnce(
          new Error(
            "Transaction numbers are only allowed on a replica set member or mongos",
          ),
        );

      const res = await request(app)
        .patch(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ stock: 25 });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain("transaction support");

      // Stock was NOT changed
      const updatedProduct = await Product.findById(productId).lean();
      expect(updatedProduct!.stock).toBe(10);

      // No movement ledger entry was created
      const movements = await InventoryMovement.find({
        productId: new mongoose.Types.ObjectId(productId),
        reason: "MANUAL_ADJUSTMENT",
      });
      expect(movements).toHaveLength(0);

      startSessionSpy.mockRestore();
    });
  });
});

describe("Standalone dev/test stock adjustment (no replica set)", () => {
  let mongoServerStandalone: MongoMemoryServer;

  beforeAll(async () => {
    mongoServerStandalone = await MongoMemoryServer.create();
    await mongoose.connect(mongoServerStandalone.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServerStandalone) {
      await mongoServerStandalone.stop();
    }
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    await seedAdmin();
  });

  async function adminTokenStandalone(): Promise<string> {
    const admin = await Admin.findOne({ username: "testadmin" });
    return makeAdminToken(admin!._id.toString());
  }

  async function createProductStandalone(adminToken: string, stock: number = 10) {
    return request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Product",
        slug: `test-product-${Date.now()}`,
        description: "A test product",
        price: 100,
        category: "Cakes",
        stock,
        preparationTime: 60,
        availability: "AVAILABLE",
        images: [],
      });
    }

  it("updates stock and creates ledger entry in standalone mode (dev/test fallback)", async () => {
    const token = await adminTokenStandalone();
    const createRes = await createProductStandalone(token, 10);
    expect(createRes.status).toBe(201);
    const productId = createRes.body.product._id;

    const res = await request(app)
      .patch(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ stock: 25 });

    expect(res.status).toBe(200);

    // Stock was updated
    const updatedProduct = await Product.findById(productId).lean();
    expect(updatedProduct!.stock).toBe(25);

    // Inventory movement ledger entry was created (best-effort in standalone mode)
    const movements = await InventoryMovement.find({
      productId: new mongoose.Types.ObjectId(productId),
      reason: "MANUAL_ADJUSTMENT",
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantityChange).toBe(15);
  });
});
