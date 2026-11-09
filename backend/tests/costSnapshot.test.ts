import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { z } from "zod";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

import { Product } from "../src/models/Product.js";
import { Order } from "../src/models/Order.js";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

const productSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: z.number().positive(),
  category: z.string().trim().min(1),
  images: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
  availability: z
    .enum(["AVAILABLE", "OUT_OF_STOCK", "DISABLED"])
    .optional(),
  preparationTime: z.number().min(0),
  active: z.boolean().optional(),
  cost: z.number().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
});

async function createProduct(overrides: Record<string, unknown> = {}) {
  const data = {
    name: "Test Product",
    slug: `test-product-${Date.now()}`,
    description: "A test product",
    price: 100,
    cost: 40,
    category: "Cakes",
    stock: 10,
    preparationTime: 60,
    availability: "AVAILABLE",
    active: true,
    ...overrides,
  };
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid product: ${parsed.error}`);
  const productData: Record<string, unknown> = { ...parsed.data };
  if (productData.images === undefined) delete productData.images;
  return Product.create(productData) as Promise<mongoose.Document & { _id: mongoose.Types.ObjectId }>;
}

async function createOrderWithItem(
  productId: mongoose.Types.ObjectId,
  costSnapshot: number | undefined,
  totalAmount = 100,
): Promise<mongoose.Document & { _id: mongoose.Types.ObjectId }> {
  return Order.create({
    orderNumber: `SV-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerName: "Test Customer",
    phone: "9840916058",
    fulfillmentType: "PICKUP",
    scheduledDate: "2026-12-01",
    scheduledTime: "10:00 AM",
    paymentMethod: "COD",
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
    items: [
      {
        productId,
        productName: "Test Product",
        variantId: "default",
        quantity: 1,
        unitPrice: totalAmount,
        itemTotal: totalAmount,
        totalPrice: totalAmount,
        ...(costSnapshot !== undefined ? { costSnapshot } : {}),
      },
    ],
    subtotal: totalAmount,
    totalAmount,
  });
}

describe("Order cost snapshots", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("stores costSnapshot when product cost is recorded", async () => {
    const product = await createProduct({ cost: 40 });

    const order = await createOrderWithItem(product._id, 40, 100);
    const saved = await Order.findById(order._id).lean();
    const item = saved!.items[0]!;
    expect(item.costSnapshot).toBe(40);
  });

  it("stores undefined costSnapshot when product cost is not recorded", async () => {
    const product = await createProduct(); // no cost field

    const order = await createOrderWithItem(product._id, undefined, 100);
    const saved = await Order.findById(order._id).lean();
    const item = saved!.items[0]!;
    expect(item.costSnapshot).toBeUndefined();
  });

  it("cost snapshot is a separate field that can differ from current product cost", async () => {
    const product = await createProduct({ cost: 40 });

    // Order captures cost 40
    const order = await createOrderWithItem(product._id, 40, 100);

    // Product cost changes to 99 later
    await Product.findByIdAndUpdate(product._id, { cost: 99 });

    // Order snapshot preserved at 40
    const saved = await Order.findById(order._id).lean();
    expect(saved!.items[0]!.costSnapshot).toBe(40);
    // Product now has new cost
    const updated = await Product.findById(product._id).lean();
    expect(updated!.cost).toBe(99);
  });

  it("order model accepts costSnapshot on order items", async () => {
    const product = await createProduct({ cost: 55 });

    const order = await createOrderWithItem(product._id, 55, 200);
    const saved = await Order.findById(order._id).lean();
    expect(saved!.items[0]!.costSnapshot).toBe(55);
  });

  it("product model accepts optional cost, reorderLevel, leadTimeDays", async () => {
    const product = await createProduct({
      cost: 30,
      reorderLevel: 5,
      leadTimeDays: 3,
    });
    const saved = await Product.findById(product._id).lean();
    expect(saved!.cost).toBe(30);
    expect(saved!.reorderLevel).toBe(5);
    expect(saved!.leadTimeDays).toBe(3);
  });
});
