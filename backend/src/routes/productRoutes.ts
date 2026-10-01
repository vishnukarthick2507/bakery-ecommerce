import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| PRODUCT ROUTES
|--------------------------------------------------------------------------
*/

// Get all active products
router.get("/", getProducts);

// Get one product
router.get("/:id", getProductById);

// Create product
router.post("/", createProduct);

// Update product
router.patch("/:id", updateProduct);

// Disable product
router.delete("/:id", deleteProduct);

export default router;