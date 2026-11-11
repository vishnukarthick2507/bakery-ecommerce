import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import { Product } from "../models/Product.js";
import { InventoryMovement } from "../models/InventoryMovement.js";

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

/*
|--------------------------------------------------------------------------
| RECORD INVENTORY MOVEMENT
|--------------------------------------------------------------------------
| Creates an immutable ledger entry for a stock change. Idempotent: if a
| movement already exists for the same product, reason, and related order,
| no duplicate entry is created. Never fabricates historical records —
| only records changes that actually occurred.
|--------------------------------------------------------------------------
*/
export async function recordInventoryMovement(params: {
  session?: ClientSession;
  productId: mongoose.Types.ObjectId;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason:
    | "ORDER_RESERVATION"
    | "ORDER_RESTORE"
    | "ORDER_COMMIT"
    | "MANUAL_ADJUSTMENT"
    | "RESTOCK"
    | "EXPIRY_RELEASE";
  adjustmentReason?: string;
  relatedOrderId?: mongoose.Types.ObjectId;
  relatedUserId?: mongoose.Types.ObjectId;
}): Promise<void> {
  const session = params.session;

  // Idempotency check: skip if a movement already exists for this product,
  // reason, and related order (prevents duplicates on retry).
  const existing = params.relatedOrderId
    ? await InventoryMovement.findOne({
        productId: params.productId,
        reason: params.reason,
        relatedOrderId: params.relatedOrderId,
      })
    : await InventoryMovement.findOne({
        productId: params.productId,
        reason: params.reason,
        relatedOrderId: { $exists: false },
      });

  if (session) {
    // When a session is provided, re-run the check within the session to
    // maintain consistency.
    const existingInSession = params.relatedOrderId
      ? await InventoryMovement.findOne({
          productId: params.productId,
          reason: params.reason,
          relatedOrderId: params.relatedOrderId,
        }).session(session)
      : await InventoryMovement.findOne({
          productId: params.productId,
          reason: params.reason,
          relatedOrderId: { $exists: false },
        }).session(session);

    if (existingInSession) {
      return;
    }
  } else if (existing) {
    return;
  }

  // Build the document data, only including optional fields when defined
  // to satisfy exactOptionalPropertyTypes.
  const movementData: Record<string, unknown> = {
    productId: params.productId,
    quantityChange: params.quantityChange,
    previousStock: params.previousStock,
    newStock: params.newStock,
    reason: params.reason,
  };

  if (params.adjustmentReason) {
    movementData.adjustmentReason = params.adjustmentReason;
  }

  if (params.relatedOrderId) {
    movementData.relatedOrderId = params.relatedOrderId;
  }
  if (params.relatedUserId) {
    movementData.relatedUserId = params.relatedUserId;
  }

  if (session) {
    await InventoryMovement.create([movementData], { session });
  } else {
    await InventoryMovement.create([movementData]);
  }
}

export async function reserveInventory(
  session: ClientSession,
  items: InventoryLine[],
  relatedOrderId?: mongoose.Types.ObjectId,
  relatedUserId?: mongoose.Types.ObjectId,
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

    // Note: findOneAndUpdate with returnDocument: "after" returns the product
    // AFTER the $inc decrement. So product.stock is already the new stock.
    // previousStock = newStock + quantity (reverse the decrement).
    const newStock = product.stock ?? 0;
    const previousStock = newStock + quantity;

    // Record the reservation movement only if the stock actually changed.
    const movementParams: {
      session: ClientSession;
      productId: mongoose.Types.ObjectId;
      quantityChange: number;
      previousStock: number;
      newStock: number;
      reason: "ORDER_RESERVATION";
      relatedOrderId?: mongoose.Types.ObjectId;
      relatedUserId?: mongoose.Types.ObjectId;
    } = {
      session,
      productId: new mongoose.Types.ObjectId(productId),
      quantityChange: -quantity,
      previousStock,
      newStock,
      reason: "ORDER_RESERVATION",
    };

    if (relatedOrderId) {
      movementParams.relatedOrderId = relatedOrderId;
    }
    if (relatedUserId) {
      movementParams.relatedUserId = relatedUserId;
    }

    await recordInventoryMovement(movementParams);
  }
}

export async function restoreInventory(
  session: ClientSession,
  items: InventoryLine[],
  relatedOrderId?: mongoose.Types.ObjectId,
  relatedUserId?: mongoose.Types.ObjectId,
): Promise<void> {
  for (const [productId, quantity] of aggregateLines(items)) {
    const product = await Product.findById(productId).session(session).lean();

    const previousStock = product?.stock ?? 0;
    const newStock = previousStock + quantity;

    const result = await Product.updateOne(
      { _id: productId },
      { $inc: { stock: quantity } },
      { session },
    );

    if (result.matchedCount !== 1) {
      throw new Error("Cannot restore inventory for a missing product");
    }

    // Only record a movement if stock actually changed (quantity > 0).
    if (quantity > 0) {
      const movementParams: {
        session: ClientSession;
        productId: mongoose.Types.ObjectId;
        quantityChange: number;
        previousStock: number;
        newStock: number;
        reason: "ORDER_RESTORE";
        relatedOrderId?: mongoose.Types.ObjectId;
        relatedUserId?: mongoose.Types.ObjectId;
      } = {
        session,
        productId: new mongoose.Types.ObjectId(productId),
        quantityChange: quantity,
        previousStock,
        newStock,
        reason: "ORDER_RESTORE",
      };

      if (relatedOrderId) {
        movementParams.relatedOrderId = relatedOrderId;
      }
      if (relatedUserId) {
        movementParams.relatedUserId = relatedUserId;
      }

      await recordInventoryMovement(movementParams);
    }
  }
}
