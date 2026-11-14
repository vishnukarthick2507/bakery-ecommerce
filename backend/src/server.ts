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
import { startProposalExpiryWorker, stopProposalExpiryWorker } from "./services/proposalExpiry.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { logger } from "./lib/logger.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// Database readiness, tracked so /health can report it accurately.
let dbReady = false;

app.use(helmet());

app.use(cookieParser());

// Request ID middleware — must come early so all downstream handlers
// can access req.id for log correlation.
app.use(requestIdMiddleware);

// CSRF protection for cookie-authenticated state-changing requests.
// Must come after cookieParser() to read cookies, and before route handlers.
app.use(csrfProtection);

function getCorsOriginList(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin || !corsOrigin.trim()) {
    return ["http://localhost:3000"];
  }
  return corsOrigin
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter((o): o is string => Boolean(o));
}

/**
 * Normalizes an origin string for consistent comparison.
 * - Trims whitespace
 * - Removes trailing slashes so "https://example.com/" matches "https://example.com"
 * - Validates the string is a parseable URL
 * Returns null for invalid origins.
 */
function normalizeOrigin(origin: string): string | null {
  try {
    const url = new URL(origin.trim());
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

const corsOriginList = getCorsOriginList();

app.use(
  cors({
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. same-origin, mobile apps, curl).
      if (!_origin) {
        return callback(null, true);
      }
      if (corsOriginList.includes(_origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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

// Health check endpoint — lightweight, no secrets, reports database readiness.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: dbReady ? "ok" : "degraded",
    service: "bakery-api",
    database: dbReady ? "connected" : "disconnected",
  });
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

/**
 * Connect to MongoDB in the background. Never calls process.exit — a
 * database outage must degrade the service, not kill the HTTP server, so
 * /health can keep responding and the platform can route traffic.
 */
async function connectDatabase(): Promise<void> {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      logger.error("Database connection skipped: MONGODB_URI is not configured.");
      return;
    }

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    dbReady = true;
    logger.info("MongoDB connected successfully");
  } catch (error) {
    dbReady = false;
    logger.error(
      "Database connection failed: " +
        (error instanceof Error ? error.message : String(error)) +
        ". Check MONGODB_URI and MongoDB Atlas Network Access. The HTTP server will keep running in degraded mode.",
    );
  }
}

const startServer = async (): Promise<void> => {
  // Validate JWT secret before listening — this is a required dependency.
  // Failure is logged clearly without exposing the secret value.
  try {
    getJwtSecret();
  } catch (error) {
    logger.error(
      "JWT_SECRET is not configured correctly (must be at least 32 characters). " +
        "Authentication will not work until it is set. " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  // Start the HTTP server first so /health responds immediately, even if
  // the database is not yet reachable. Render needs a listening process.
  server = app.listen(PORT, () => {
    logger.info("API server started", {
      port: PORT,
      env: process.env.NODE_ENV,
      database: dbReady ? "connected" : "connecting",
    });
  });

  // Connect to the database in the background — do not block startup.
  await connectDatabase();

  // Ensure Mongoose indexes exist. Non-fatal: orders still work without
  // index creation, just potentially slower queries.
  if (dbReady) {
    try {
      await Order.init();
    } catch (error) {
      logger.error(
        "Order index initialization failed: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // Start the inventory expiry worker. Non-fatal if the DB is unavailable.
  try {
    startInventoryExpiryWorker();
  } catch (error) {
    logger.error(
      "Inventory expiry worker failed to start: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  // Start the proposal expiry worker. Non-fatal if the DB is unavailable.
  try {
    startProposalExpiryWorker();
  } catch (error) {
    logger.error(
      "Proposal expiry worker failed to start: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
};

// Start the server. Any startup error is logged clearly (no secrets)
// instead of crashing the process silently.
void startServer().catch((error) => {
  logger.error(
    "Server startup failed: " +
      (error instanceof Error ? error.message : String(error)),
  );
});

// Graceful shutdown: close HTTP server, MongoDB, and expiry worker.
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  const srv = server;
  if (srv) {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
  await mongoose.disconnect();
  stopInventoryExpiryWorker();
  stopProposalExpiryWorker();
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
