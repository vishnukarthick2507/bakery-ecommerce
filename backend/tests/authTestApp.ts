import express from "express";
import type { Express } from "express";
import cookieParser from "cookie-parser";
import authRoutes from "../src/routes/authRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";

export function createAuthTestApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/admin", authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/orders", orderRoutes);

  return app;
}
