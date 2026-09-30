import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Product } from "../models/Product.js";

const createProductSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  slug: z.string().trim().min(1, "slug is required"),
  description: z.string().trim().min(1, "description is required"),
  price: z.number().gt(0, "price must be greater than 0"),
  category: z.string().trim().min(1, "category is required"),
  images: z.array(z.string()).optional(),
  stock: z.number().min(0, "stock must be 0 or greater").optional(),
  availability: z.enum(["AVAILABLE", "OUT_OF_STOCK", "DISABLED"]).optional(),
  preparationTime: z.number().min(0, "preparationTime must be 0 or greater"),
  active: z.boolean().optional(),
});

const isValidObjectId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;

export const getProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ active: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid product id" });
      return;
    }

    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid product data",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const product = await Product.create(parsed.data);
    res.status(201).json(product);
  } catch (error) {
    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && "code" in error && (error as { code: number }).code === 11000)
    ) {
      const message =
        error instanceof mongoose.Error.ValidationError
          ? error.message
          : "A product with this slug already exists";
      res.status(400).json({ message });
      return;
    }

    console.error("Failed to create product:", error);
    res.status(500).json({ message: "Failed to create product" });
  }
};
