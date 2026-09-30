import { Router } from "express";
import {
  createProduct,
  getProductById,
  getProducts,
} from "../controllers/productController.js";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", createProduct);

export default router;
