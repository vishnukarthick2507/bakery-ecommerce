import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| PRODUCT ROUTES
|--------------------------------------------------------------------------
*/

// Get all active products
router.get("/", getProducts);

// Get one product by slug
router.get("/slug/:slug", getProductBySlug);

// Get one product by ID
router.get("/:id", getProductById);

// Create product (admin only)
router.post("/", authenticateAdmin, createProduct);

// Update product (admin only)
router.patch("/:id", authenticateAdmin, updateProduct);

// Disable product (admin only)
router.delete("/:id", authenticateAdmin, deleteProduct);

export default router;
