import type { Request, Response } from "express";
import { z } from "zod";

import { InventoryMovement } from "../models/InventoryMovement.js";
import { Product } from "../models/Product.js";
import type { AuthRequest } from "../middleware/auth.js";

const movementPaginationSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  productId: z.string().optional(),
  reason: z
    .enum([
      "ORDER_RESERVATION",
      "ORDER_RESTORE",
      "ORDER_COMMIT",
      "MANUAL_ADJUSTMENT",
      "RESTOCK",
      "EXPIRY_RELEASE",
    ])
    .optional(),
});

/*
|--------------------------------------------------------------------------
| GET INVENTORY MOVEMENTS (ADMIN ONLY)
|--------------------------------------------------------------------------
| GET /api/admin/inventory/movements?page=1&limit=20&productId=xxx&reason=MANUAL_ADJUSTMENT
|--------------------------------------------------------------------------
*/

export const getInventoryMovements = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const parsed = movementPaginationSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { page, limit, productId, reason } = parsed.data;
    const pageNum = page !== undefined ? Number(page) : undefined;
    const limitNum = limit !== undefined ? Number(limit) : undefined;
    const hasPagination = pageNum !== undefined && limitNum !== undefined;

    if (
      (pageNum !== undefined && (!Number.isInteger(pageNum) || pageNum < 1)) ||
      (limitNum !== undefined && (!Number.isInteger(limitNum) || limitNum < 1))
    ) {
      res.status(400).json({ message: "Page and limit must be positive integers" });
      return;
    }

    const filter: Record<string, unknown> = {};

    if (productId) {
      filter.productId = productId;
    }

    if (reason) {
      filter.reason = reason;
    }

    const countQuery = InventoryMovement.countDocuments(filter);
    const findQuery = InventoryMovement.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      const safePage = Math.max(1, pageNum);
      const safeLimit = Math.min(100, Math.max(1, limitNum));
      const skip = (safePage - 1) * safeLimit;

      findQuery.skip(skip).limit(safeLimit);
    }

    const [movements, total] = await Promise.all([findQuery, countQuery]);

    // Enrich movements with product names
    const productIds = [
      ...new Set(
        movements
          .map((m) => m.productId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const products = await Product.find(
      { _id: { $in: productIds } },
      { name: 1, slug: 1 },
    ).lean();

    const productNameMap = new Map(
      products.map((p) => [p._id.toString(), p.name]),
    );

    const enrichedMovements = movements.map((m) => ({
      id: m._id.toString(),
      productId: m.productId.toString(),
      productName: productNameMap.get(m.productId.toString()) ?? "",
      quantityChange: m.quantityChange,
      previousStock: m.previousStock,
      newStock: m.newStock,
      reason: m.reason,
      adjustmentReason: m.adjustmentReason ?? null,
      relatedOrderId: m.relatedOrderId?.toString() ?? null,
      relatedUserId: m.relatedUserId?.toString() ?? null,
      createdAt: m.createdAt,
    }));

    if (hasPagination) {
      res.status(200).json({
        movements: enrichedMovements,
        pagination: {
          page: Math.max(1, pageNum),
          limit: Math.min(100, Math.max(1, limitNum)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limitNum))),
        },
      });
    } else {
      res.status(200).json({ movements: enrichedMovements });
    }
  } catch (error) {
    console.error("Get inventory movements failed:", error);
    res.status(500).json({ message: "Unable to fetch inventory movements" });
  }
};
