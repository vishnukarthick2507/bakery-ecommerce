import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import customCakeRoutes from "./routes/customCakeRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import adminCustomerRoutes from "./routes/adminCustomerRoutes.js";
import adminInventoryRoutes from "./routes/adminInventoryRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import customerUploadRoutes from "./routes/customerUploadRoutes.js";
import { getJwtSecret } from "./config/jwt.js";
import { Order } from "./models/Order.js";
import { startInventoryExpiryWorker, stopInventoryExpiryWorker } from "./services/inventoryExpiry.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { logger } from "./lib/logger.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(cookieParser());

// Request ID middleware — must come early so all downstream handlers
// can access req.id for log correlation.
app.use(requestIdMiddleware);

// CSRF protection for cookie-authenticated state-changing requests.
// Must come after cookieParser() to read cookies, and before route handlers.
app.use(csrfProtection);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

// Razorpay webhook signature must be verified against the exact
// raw bytes, so this route is parsed as raw before express.json().
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
);

app.use(express.json());

// Health check endpoint — no secrets, no database dependency.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "bakery-api" });
});

app.get("/", (_req, res) => {
  res.json({
    message: "The Cake Point API is running",
  });
});

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/custom-cake-requests", customCakeRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", authRoutes);
app.use("/api/admin", analyticsRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/inventory", adminInventoryRoutes);
app.use("/api/admin/uploads", uploadRoutes);
app.use("/api/customer/uploads", customerUploadRoutes);
app.use("/api/settings", settingsRoutes);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async (): Promise<void> => {
  getJwtSecret();
  await connectDB();
  await Order.init();
  startInventoryExpiryWorker();

  server = app.listen(PORT, () => {
    logger.info("API server started", {
      port: PORT,
      env: process.env.NODE_ENV,
    });
  });
};

startServer();

// Graceful shutdown: close HTTP server, MongoDB, and expiry worker.
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  const srv = server;
  if (srv) {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
  await mongoose.disconnect();
  stopInventoryExpiryWorker();
  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
  process.exit(1);
});