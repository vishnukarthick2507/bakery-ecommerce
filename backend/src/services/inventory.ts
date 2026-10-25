import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import { Product } from "../models/Product.js";

export class InventoryUnavailableError extends Error {}

type InventoryLine = {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
};

function aggregateLines(items: InventoryLine[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId.toString();
    quantities.set(productId, (quantities.get(productId) ?? 0) + item.quantity);
  }
  return [...quantities.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export async function reserveInventory(
  session: ClientSession,
  items: InventoryLine[],
): Promise<void> {
  for (const [productId, quantity] of aggregateLines(items)) {
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        active: true,
        availability: "AVAILABLE",
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
      { returnDocument: "after", session },
    ).lean();

    if (!product) {
      throw new InventoryUnavailableError("Product availability or stock changed");
    }
  }
}

export async function restoreInventory(
  session: ClientSession,
  items: InventoryLine[],
): Promise<void> {
  for (const [productId, quantity] of aggregateLines(items)) {
    const result = await Product.updateOne(
      { _id: productId },
      { $inc: { stock: quantity } },
      { session },
    );

    if (result.matchedCount !== 1) {
      throw new Error("Cannot restore inventory for a missing product");
    }
  }
}