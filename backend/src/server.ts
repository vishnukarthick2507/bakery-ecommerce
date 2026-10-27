import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import customCakeRoutes from "./routes/customCakeRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { getJwtSecret } from "./config/jwt.js";
import { Order } from "./models/Order.js";
import { startInventoryExpiryWorker } from "./services/inventoryExpiry.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(cookieParser());

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
app.use("/api/admin/uploads", uploadRoutes);
app.use("/api/settings", settingsRoutes);

const startServer = async (): Promise<void> => {
  getJwtSecret();
  await connectDB();
  await Order.init();
  startInventoryExpiryWorker();

  app.listen(PORT, () => {
    console.log(
      `STARTED The Cake Point API running on http://localhost:${PORT}`,
    );
  });
};

startServer();