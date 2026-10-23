import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import customCakeRoutes from "./routes/customCakeRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { adminLogin, verifyToken } from "./controllers/authController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
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

// Admin authentication
app.post("/api/auth/login", adminLogin);
app.get("/api/auth/verify", verifyToken);

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(
      `STARTED The Cake Point API running on http://localhost:${PORT}`,
    );
  });
};

startServer();