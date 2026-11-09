import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { Product } from "../models/Product.js";
import {
  deleteAsset,
  extractPublicId,
  isCloudinaryConfigured,
} from "../services/cloudinary.js";
import {
  recordInventoryMovement,
} from "../services/inventory.js";
import type { AuthRequest } from "../middleware/auth.js";

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

  // Optional cost basis for profitability reporting.
  cost: z.number().min(0).optional(),

  reorderLevel: z.number().int().min(0).optional(),

  leadTimeDays: z.number().int().min(0).optional(),
});

const updateProductSchema = productSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required",
    },
  );

/*
|--------------------------------------------------------------------------
| GET ALL PRODUCTS (PAGINATED)
|--------------------------------------------------------------------------
| GET /api/products?page=1&limit=20&includeInactive=true
|--------------------------------------------------------------------------
| Backward-compatible pagination. When page/limit are omitted, returns
| all products (existing behavior preserved).
|--------------------------------------------------------------------------
*/

const productPaginationSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    includeInactive: z.string().optional(),
    search: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.page !== undefined) {
        const n = parseInt(data.page, 10);
        if (!Number.isFinite(n) || n < 1) return false;
      }
      if (data.limit !== undefined) {
        const n = parseInt(data.limit, 10);
        if (!Number.isFinite(n) || n < 1) return false;
      }
      return true;
    },
    {
      message: "Page and limit must be positive integers",
    },
  );

export const getProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = productPaginationSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { page, limit, includeInactive, search } = parsed.data;
    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
    const hasPagination = pageNum !== undefined && limitNum !== undefined;

    // Admin product management needs to see disabled
    // products too; the storefront uses the default.
    const filter: Record<string, unknown> =
      includeInactive === "true" ? {} : { active: true };

    if (search) {
      const searchTerm = search.trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { slug: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const countQuery = Product.countDocuments(filter);
    const findQuery = Product.find(filter).sort({ createdAt: -1 }).lean();

    if (hasPagination) {
      const safePage = Math.max(1, pageNum);
      const safeLimit = Math.min(100, Math.max(1, limitNum));
      const skip = (safePage - 1) * safeLimit;

      findQuery.skip(skip).limit(safeLimit);
    }

    const [products, total] = await Promise.all([findQuery, countQuery]);

    if (hasPagination) {
      res.status(200).json({
        products,
        pagination: {
          page: Math.max(1, pageNum),
          limit: Math.min(100, Math.max(1, limitNum)),
          total,
          totalPages: Math.ceil(total / Math.min(100, Math.max(1, limitNum))),
        },
      });
    } else {
      res.status(200).json(products);
    }
  } catch (error) {
    console.error(
      "Get products failed:",
      error,
    );

    res.status(500).json({
      message: "Unable to fetch products",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET PRODUCT BY SLUG
|--------------------------------------------------------------------------
| GET /api/products/slug/:slug
|--------------------------------------------------------------------------
*/

export const getProductBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const slug = String(req.params.slug ?? "")
      .trim()
      .toLowerCase();

    if (!slug || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      res.status(400).json({
        message: "Invalid product slug",
      });
      return;
    }

    const product = await Product.findOne({
      slug,
      active: true,
    }).lean();

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Get product by slug failed:", error);

    res.status(500).json({
      message: "Unable to fetch product",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET PRODUCT BY ID
|--------------------------------------------------------------------------
| GET /api/products/:id
|--------------------------------------------------------------------------
*/

export const getProductById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const productId = String(
      req.params.id ?? "",
    ).trim();

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        message: "Invalid product ID",
      });

      return;
    }

    const product = await Product.findOne({
      _id: productId,
      active: true,
    }).lean();

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });

      return;
    }

    res.status(200).json(product);
  } catch (error) {
    console.error(
      "Get product failed:",
      error,
    );

    res.status(500).json({
      message: "Unable to fetch product",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE PRODUCT
|--------------------------------------------------------------------------
| POST /api/products
|--------------------------------------------------------------------------
*/

export const createProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = productSchema.safeParse(
      req.body,
    );

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid product data",
        errors: parsed.error.flatten(),
      });

      return;
    }

    // Strip undefined values so Mongoose optional fields (with
    // exactOptionalPropertyTypes) receive only defined values.
    const productData: Record<string, unknown> = {
      ...parsed.data,
      images: parsed.data.images ?? [],
      stock: parsed.data.stock ?? 0,
      availability:
        parsed.data.availability ?? "AVAILABLE",
      active: parsed.data.active ?? true,
    };

    for (const [key, value] of Object.entries(productData)) {
      if (value === undefined) {
        delete productData[key];
      }
    }

    const product =
      await Product.create(productData);

    res.status(201).json({
      message:
        "Product created successfully",
      product,
    });
  } catch (error) {
    console.error(
      "Create product failed:",
      error,
    );

    res.status(500).json({
      message: "Unable to create product",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PRODUCT
|--------------------------------------------------------------------------
| PATCH /api/products/:id
|--------------------------------------------------------------------------
| Used by admin to change:
| - name
| - description
| - price
| - category
| - images
| - stock
| - availability
| - preparation time
|--------------------------------------------------------------------------
*/

export const updateProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const productId = String(
      req.params.id ?? "",
    ).trim();

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        message: "Invalid product ID",
      });

      return;
    }

    const parsed =
      updateProductSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid product data",
        errors: parsed.error.flatten(),
      });

      return;
    }

    const adminId =
      (req as Request & { admin?: { id: string } }).admin?.id;

    // Fetch the existing product so we can detect images that are removed
    // or replaced during this update, and clean them up from Cloudinary.
    const existing = await Product.findById(productId).lean();
    if (!existing) {
      res.status(404).json({
        message: "Product not found",
      });

      return;
    }

    const existingImages = (existing.images ?? []).filter(Boolean);
    const newImages = (parsed.data.images ?? []).filter(Boolean);
    const removedImages = existingImages.filter(
      (img) => !newImages.includes(img),
    );

    const newStock =
      parsed.data.stock !== undefined
        ? parsed.data.stock
        : existing.stock;

    const stockChanged =
      parsed.data.stock !== undefined && newStock !== existing.stock;

    let product: typeof existing & { _id: mongoose.Types.ObjectId } | undefined =
      undefined;

    // Use a MongoDB transaction when available so the stock update and
    // inventory movement ledger entry are atomic. If the movement fails,
    // the stock update rolls back. Falls back to non-transactional mode
    // only in non-production environments (local development/test).
    let session: mongoose.ClientSession | null = null;
    let transactionUnsupported = false;
    let transactionError: any = null;

    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const updated = await Product.findByIdAndUpdate(
          productId,
          { $set: parsed.data },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          },
        ).lean();

        if (!updated) {
          throw new Error("Product not found during update");
        }

        product = updated as typeof existing & {
          _id: mongoose.Types.ObjectId;
        };

        // Record inventory movement atomically with the stock update.
        if (stockChanged) {
          const existingStock = existing.stock ?? 0;
          await recordInventoryMovement({
            session: session!,
            productId: new mongoose.Types.ObjectId(productId),
            quantityChange: newStock - existingStock,
            previousStock: existingStock,
            newStock,
            reason: "MANUAL_ADJUSTMENT",
            ...(adminId
              ? { relatedUserId: new mongoose.Types.ObjectId(adminId) }
              : {}),
          });
        }
      });
    } catch (txError: any) {
      transactionError = txError;
      if (
        txError.message?.includes("retryable writes") ||
        txError.message?.includes("Transaction numbers") ||
        txError.code === 20
      ) {
        transactionUnsupported = true;
      }
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }

    if (transactionUnsupported) {
      if (process.env.NODE_ENV === "production") {
        // Production requires transactional integrity; do not silently fall
        // back to a non-transactional stock update.
        res.status(500).json({
          message:
            "Stock adjustment requires MongoDB transaction support",
        });
        return;
      }

      // Non-production fallback: local development/test databases that do
      // not support transactions. Stock update is best-effort; movement
      // recording failure is logged but does not block the update.
      const updated = await Product.findByIdAndUpdate(
        productId,
        { $set: parsed.data },
        {
          returnDocument: "after",
          runValidators: true,
        },
      ).lean();

      if (!updated) {
        res.status(404).json({
          message: "Product not found",
        });

        return;
      }

      product = updated as typeof existing & {
        _id: mongoose.Types.ObjectId;
      };

      if (stockChanged) {
        const existingStock = existing.stock ?? 0;
        try {
          await recordInventoryMovement({
            productId: new mongoose.Types.ObjectId(productId),
            quantityChange: newStock - existingStock,
            previousStock: existingStock,
            newStock,
            reason: "MANUAL_ADJUSTMENT",
            ...(adminId
              ? { relatedUserId: new mongoose.Types.ObjectId(adminId) }
              : {}),
          });
        } catch (movementError) {
          console.error(
            `Inventory movement recording failed for product ${productId}:`,
            movementError,
          );
        }
      }
    } else if (transactionError) {
      console.error("Update product failed:", transactionError);
      res.status(500).json({ message: "Unable to update product" });
      return;
    }

    if (!product) {
      res.status(500).json({ message: "Unable to update product" });
      return;
    }

    // Safe Cloudinary asset cleanup for removed images. Only delete an
    // asset when no other product still references it, so shared images
    // are never destroyed. A cleanup failure never blocks the update.
    if (removedImages.length > 0 && isCloudinaryConfigured()) {
      for (const url of removedImages) {
        try {
          // Skip deletion if any other product still references this URL.
          const stillReferenced = await Product.exists({
            _id: { $ne: productId },
            images: url,
          });
          if (stillReferenced) {
            continue;
          }

          const publicId = extractPublicId(url);
          if (publicId) {
            await deleteAsset(publicId);
          }
        } catch (cleanupError) {
          console.error(
            `Cloudinary cleanup failed for ${url}:`,
            cleanupError,
          );
        }
      }
    }

    res.status(200).json({
      message:
        "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error(
      "Update product failed:",
      error,
    );

    res.status(500).json({
      message: "Unable to update product",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DISABLE PRODUCT
|--------------------------------------------------------------------------
| DELETE /api/products/:id
|--------------------------------------------------------------------------
|
| We do NOT permanently delete the product.
|
| Instead:
| active = false
| availability = DISABLED
|
| This keeps old order records safe.
|--------------------------------------------------------------------------
*/

export const deleteProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const productId = String(
      req.params.id ?? "",
    ).trim();

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        message: "Invalid product ID",
      });

      return;
    }

    const product =
      await Product.findByIdAndUpdate(
        productId,
        {
          $set: {
            active: false,
            availability: "DISABLED",
          },
        },
        {
          returnDocument: "after",
        },
      ).lean();

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });

      return;
    }

    res.status(200).json({
      message:
        "Product disabled successfully",
      product,
    });
  } catch (error) {
    console.error(
      "Delete product failed:",
      error,
    );

    res.status(500).json({
      message: "Unable to disable product",
    });
  }
};