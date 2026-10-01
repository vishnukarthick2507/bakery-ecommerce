import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { Product } from "../models/Product.js";

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
| GET ALL PRODUCTS
|--------------------------------------------------------------------------
| GET /api/products
|--------------------------------------------------------------------------
*/

export const getProducts = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const products = await Product.find({
      active: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(products);
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

    const {
      images,
      ...productFields
    } = parsed.data;

    const productData =
      images === undefined
        ? productFields
        : {
            ...productFields,
            images,
          };

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

    const product =
      await Product.findByIdAndUpdate(
        productId,
        {
          $set: parsed.data,
        },
        {
          returnDocument: "after",
          runValidators: true,
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