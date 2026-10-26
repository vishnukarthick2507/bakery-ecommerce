import express from "express";
import authRoutes from "../src/routes/authRoutes.js";

export function createAuthTestApp() {
  const app = express();

  app.use(express.json());
  app.use("/api/auth", authRoutes);

  return app;
}
