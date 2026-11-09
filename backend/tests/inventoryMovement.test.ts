import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import { Product } from "../src/models/Product.js";
import { InventoryMovement } from "../src/models/InventoryMovement.js";
import {
  reserveInventory,
  restoreInventory,
  InventoryUnavailableError,
} from "../src/services/inventory.js";
import {
  connectTestDB,
  clearTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

let mongoServer: MongoMemoryServer;

async function createProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: "Test Product",
    slug: `test-product-${Date.now()}`,
    description: "A test product",
    price: 100,
    category: "Cakes",
    stock: 10,
    preparationTime: 60,
    availability: "AVAILABLE",
    active: true,
    ...overrides,
  });
}

describe("Inventory movement ledger", () => {
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

  async function withSession<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      return await fn(session);
    } finally {
      await session.endSession();
    }
  }

  it("records ORDER_RESERVATION movement when stock is reserved", async () => {
    const product = await createProduct({ stock: 10 });

    await withSession(async (session) => {
      await reserveInventory(
        session,
        [{ productId: product._id, quantity: 3 }],
        new mongoose.Types.ObjectId(),
      );
    });

    const movements = await InventoryMovement.find({
      productId: product._id,
      reason: "ORDER_RESERVATION",
    });

    expect(movements).toHaveLength(1);
    const movement = movements[0]!;
    expect(movement.quantityChange).toBe(-3);
    expect(movement.previousStock).toBe(10);
    expect(movement.newStock).toBe(7);
  });

  it("records ORDER_RESTORE movement when stock is restored", async () => {
    const product = await createProduct({ stock: 5 });

    await withSession(async (session) => {
      await restoreInventory(
        session,
        [{ productId: product._id, quantity: 3 }],
        new mongoose.Types.ObjectId(),
      );
    });

    const movements = await InventoryMovement.find({
      productId: product._id,
      reason: "ORDER_RESTORE",
    });

    expect(movements).toHaveLength(1);
    const movement = movements[0]!;
    expect(movement.quantityChange).toBe(3);
    expect(movement.previousStock).toBe(5);
    expect(movement.newStock).toBe(8);
  });

  it("prevents duplicate movements on retry (idempotency)", async () => {
    const product = await createProduct({ stock: 10 });
    const orderId = new mongoose.Types.ObjectId();

    await withSession(async (session) => {
      await reserveInventory(
        session,
        [{ productId: product._id, quantity: 3 }],
        orderId,
      );
      await reserveInventory(
        session,
        [{ productId: product._id, quantity: 3 }],
        orderId,
      );
    });

    const movements = await InventoryMovement.find({
      productId: product._id,
      reason: "ORDER_RESERVATION",
    });

    expect(movements).toHaveLength(1);
  });

  it("throws InventoryUnavailableError when stock is insufficient", async () => {
    const product = await createProduct({ stock: 2 });

    await withSession(async (session) => {
      await expect(
        reserveInventory(session, [{ productId: product._id, quantity: 5 }]),
      ).rejects.toBeInstanceOf(InventoryUnavailableError);
    });
  });

  it("does not create a ledger entry when quantity is zero on restore", async () => {
    const product = await createProduct({ stock: 5 });

    await withSession(async (session) => {
      await restoreInventory(
        session,
        [{ productId: product._id, quantity: 0 }],
        new mongoose.Types.ObjectId(),
      );
    });

    const movements = await InventoryMovement.find({
      productId: product._id,
    });

    expect(movements).toHaveLength(0);
  });

  it("uses transactions consistently for inventory and ledger", async () => {
    const product = await createProduct({ stock: 10 });
    const orderId = new mongoose.Types.ObjectId();

    const result = await withSession(async (session) => {
      await reserveInventory(
        session,
        [{ productId: product._id, quantity: 2 }],
        orderId,
      );
      const updated = await Product.findById(product._id).session(session);
      return updated?.stock;
    });

    expect(result).toBe(8);

    const movements = await InventoryMovement.find({
      productId: product._id,
      reason: "ORDER_RESERVATION",
    });
    expect(movements).toHaveLength(1);
  });
});
