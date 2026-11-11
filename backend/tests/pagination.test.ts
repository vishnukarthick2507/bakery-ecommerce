import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

import { Admin } from "../src/models/Admin.js";
import { Product } from "../src/models/Product.js";
import { CustomCakeRequest } from "../src/models/CustomCakeRequest.js";
import productRoutes from "../src/routes/productRoutes.js";
import customCakeRoutes from "../src/routes/customCakeRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import { Order } from "../src/models/Order.js";
import { InventoryMovement } from "../src/models/InventoryMovement.js";
import adminInventoryRoutes from "../src/routes/adminInventoryRoutes.js";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

async function seedAdmin(): Promise<string> {
  const admin = await Admin.create({
    username: "testadmin",
    password: await bcrypt.hash("CorrectPassword123", 10),
    role: "ADMIN",
  });
  return admin._id.toString();
}

function makeAdminToken(adminId: string): string {
  return jwt.sign(
    { adminId, username: "testadmin", role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

describe("Product pagination", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedAdmin();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  async function createProducts(count: number, token: string) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        request(app)
          .post("/api/products")
          .set("Authorization", `Bearer ${token}`)
          .send({
            name: `Product ${i}`,
            slug: `product-${i}-${Date.now()}`,
            description: "desc",
            price: 100,
            category: "Cakes",
            stock: 10,
            preparationTime: 60,
            availability: "AVAILABLE",
          }),
      );
    }
    return Promise.all(promises);
  }

  function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/products", productRoutes);
    return app;
  }

  const app = createTestApp();

  it("returns all products when no pagination params (backward compatible)", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    await createProducts(5, token);

    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
  });

  it("returns paginated products with metadata", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    await createProducts(25, token);

    const res = await request(app)
      .get("/api/products?page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(10);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("returns second page correctly", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    await createProducts(25, token);

    const res = await request(app)
      .get("/api/products?page=2&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(10);
    expect(res.body.pagination.page).toBe(2);
  });

  it("clamps limit to maximum 100", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    await createProducts(5, token);

    const res = await request(app)
      .get("/api/products?page=1&limit=999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it("returns empty results for page beyond total", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    await createProducts(5, token);

    const res = await request(app)
      .get("/api/products?page=10&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
    expect(res.body.pagination.total).toBe(5);
  });

  it("rejects invalid page parameter", async () => {
    const token = await (async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      return makeAdminToken(admin!._id.toString());
    })();

    const res = await request(app)
      .get("/api/products?page=abc")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe("Custom cake requests pagination", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await seedAdmin();
  });

  beforeEach(async () => {
    await clearTestDB();
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

  function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/custom-cake-requests", customCakeRoutes);
    return app;
  }

  const app = createTestApp();

  async function createRequests(count: number) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        request(app).post("/api/custom-cake-requests").send({
          name: `Customer ${i}`,
          phone: `9${String(i).padStart(9, "0")}`,
          flavour: "Chocolate",
          weight: "1 kg",
          theme: "Birthday",
        }),
      );
    }
    return Promise.all(promises);
  }

  it("returns all requests when no pagination params (backward compatible)", async () => {
    await createRequests(5);

    const token = await adminToken();
    const res = await request(app)
      .get("/api/custom-cake-requests")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(5);
  });

  it("returns paginated requests with metadata", async () => {
    await createRequests(25);

    const token = await adminToken();
    const res = await request(app)
      .get("/api/custom-cake-requests?page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(10);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("rejects invalid page parameter", async () => {
    const token = await adminToken();
    const res = await request(app)
      .get("/api/custom-cake-requests?page=abc")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe("Admin order filters", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedAdmin();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);

  it("filters paginated orders by supported fulfillment type", async () => {
    const admin = await Admin.findOne({ username: "testadmin" });
    const token = makeAdminToken(admin!._id.toString());
    const common = {
      customerName: "Test Customer",
      phone: "9840916058",
      scheduledDate: "2026-12-01",
      scheduledTime: "10:00 AM",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
      items: [{ productId: new mongoose.Types.ObjectId(), productName: "Cake", variantId: "default", quantity: 1, unitPrice: 100, itemTotal: 100, totalPrice: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      totalAmount: 100,
    };
    await Order.insertMany([
      { ...common, orderNumber: "SV-PICKUP-001", fulfillmentType: "PICKUP", idempotencyKey: "pickup-key", idempotencyHash: "pickup-hash" },
      { ...common, orderNumber: "SV-DELIVERY-001", fulfillmentType: "DELIVERY", idempotencyKey: "delivery-key", idempotencyHash: "delivery-hash" },
    ]);

    const response = await request(app)
      .get("/api/orders?page=1&limit=5&fulfillmentType=PICKUP&paymentStatus=PENDING&orderStatus=PLACED")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.orders[0].fulfillmentType).toBe("PICKUP");
    expect(response.body.pagination.total).toBe(1);
  });

  it("rejects unsupported fulfillment types", async () => {
    const admin = await Admin.findOne({ username: "testadmin" });
    const token = makeAdminToken(admin!._id.toString());
    const response = await request(app)
      .get("/api/orders?fulfillmentType=SHIPMENT")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });
});

describe("Inventory movement pagination", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedAdmin();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/inventory", adminInventoryRoutes);

  it("returns only the requested page and pagination metadata", async () => {
    const admin = await Admin.findOne({ username: "testadmin" });
    const token = makeAdminToken(admin!._id.toString());
    const product = await Product.create({
      name: "Movement test product",
      slug: "movement-test-product",
      description: "Test product",
      price: 100,
      category: "Cakes",
      stock: 10,
      preparationTime: 30,
      availability: "AVAILABLE",
    });
    await InventoryMovement.insertMany(Array.from({ length: 3 }, (_, index) => ({
      productId: product._id,
      quantityChange: -1,
      previousStock: 10 - index,
      newStock: 9 - index,
      reason: "ORDER_RESERVATION",
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
    })));

    const response = await request(app)
      .get("/api/admin/inventory/movements?page=2&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.movements).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});
