import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import { authenticateAdmin, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router();

/*
|--------------------------------------------------------------------------
| PRODUCT ROUTES
|--------------------------------------------------------------------------
*/

// Public storefront reads expose only customer-facing fields. The admin
// product screen requests includeInactive=true and must authenticate.
router.get(
  "/",
  (req, res, next) => {
    if (req.query.includeInactive === "true") {
      return authenticateAdmin(req as AuthRequest, res, next);
    }
    next();
  },
  getProducts,
);

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
