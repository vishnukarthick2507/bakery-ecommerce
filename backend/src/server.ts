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
import whatsappRoutes from "./routes/whatsappRoutes.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhookRoutes.js";
import adminWhatsAppRoutes from "./routes/adminWhatsAppRoutes.js";
import { getJwtSecret } from "./config/jwt.js";
import { Order } from "./models/Order.js";
import { startInventoryExpiryWorker, stopInventoryExpiryWorker } from "./services/inventoryExpiry.js";
import { startProposalExpiryWorker, stopProposalExpiryWorker } from "./services/proposalExpiry.js";
import { startNotificationOutboxWorker, stopNotificationOutboxWorker } from "./services/notificationOutboxWorker.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { logger } from "./lib/logger.js";
import { getTrustedOrigins, normalizeOrigin } from "./lib/origin.js";
import {
  assertUatSafeModeConfig,
  assertUatSafeModeMongoTarget,
  getUatSafeModeStartupErrorMessage,
  isUatSafeModeEnabled,
} from "./config/uatSafeMode.js";

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

const corsOriginList = getTrustedOrigins();

app.use(
  cors({
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. same-origin, mobile apps, curl).
      if (!_origin) {
        return callback(null, true);
      }
      const normalizedOrigin = normalizeOrigin(_origin);
      if (normalizedOrigin && corsOriginList.includes(normalizedOrigin)) {
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

// WhatsApp webhook signature must be verified against the exact
// raw bytes Meta sent, so this route is parsed as raw before express.json().
app.use(
  "/api/whatsapp/webhook",
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
app.use("/api/admin/whatsapp", adminWhatsAppRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/whatsapp", whatsappWebhookRoutes);

let server: ReturnType<typeof app.listen> | null = null;

/**
 * Connect to MongoDB in the background. In normal mode this never calls
 * process.exit — a database outage must degrade the service, not kill the
 * HTTP server. In UAT_SAFE_MODE, target validation/connection safety is
 * enforced and startup must fail safely instead of falling back.
 */
async function connectDatabase(): Promise<void> {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (isUatSafeModeEnabled()) {
      assertUatSafeModeMongoTarget(mongoURI);
    }

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
    if (isUatSafeModeEnabled()) {
      throw new Error(getUatSafeModeStartupErrorMessage(error));
    }
    logger.error(
      "Database connection failed: " +
        (error instanceof Error ? error.message : String(error)) +
        ". Check MONGODB_URI and MongoDB Atlas Network Access. The HTTP server will keep running in degraded mode.",
    );
  }
}

const startServer = async (): Promise<void> => {
  // Validate UAT_SAFE_MODE and (when enabled) the verified local UAT MongoDB
  // target before listening/connecting/starting workers. In UAT_SAFE_MODE this
  // must fail safely and never fall back to another database.
  if (isUatSafeModeEnabled()) {
    try {
      assertUatSafeModeConfig();
    } catch (error) {
      logger.error("UAT_SAFE_MODE startup validation failed", {
        error: getUatSafeModeStartupErrorMessage(error),
      });
      process.exit(1);
    }
  }

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

  // Start the HTTP server first so /health responds immediately in normal mode.
  // In UAT_SAFE_MODE we must not continue with an unverified database target.
  server = app.listen(PORT, () => {
    logger.info("API server started", {
      port: PORT,
      env: process.env.NODE_ENV,
      database: dbReady ? "connected" : "connecting",
      uatSafeMode: isUatSafeModeEnabled(),
    });
  });

  // Connect to the database. In UAT_SAFE_MODE this is safety-critical and
  // failures must abort startup instead of continuing in degraded/fallback mode.
  try {
    await connectDatabase();
  } catch (error) {
    if (isUatSafeModeEnabled()) {
      logger.error("UAT_SAFE_MODE database validation/connection failed", {
        error: getUatSafeModeStartupErrorMessage(error),
      });
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      process.exit(1);
    }
  }

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

  // Start background workers only when DB is ready. Workers depend on MongoDB;
  // starting them without a connection causes avoidable noisy failures.
  if (dbReady) {
    try {
      startInventoryExpiryWorker();
    } catch (error) {
      logger.error(
        "Inventory expiry worker failed to start: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    // Start the proposal expiry worker. External notifications are centrally
    // blocked in UAT_SAFE_MODE.
    try {
      startProposalExpiryWorker();
    } catch (error) {
      logger.error(
        "Proposal expiry worker failed to start: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    // Start the notification outbox worker. It processes durable WhatsApp/email
    // outbox jobs; external delivery remains fail-closed by UAT_SAFE_MODE and
    // template/consent validation gates.
    try {
      startNotificationOutboxWorker();
    } catch (error) {
      logger.error(
        "Notification outbox worker failed to start: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  } else {
    logger.warn("Background workers not started: database not ready");
  }
};

// Start the server. Any startup error is logged clearly (no secrets)
// instead of crashing the process silently.
void startServer().catch((error) => {
  logger.error(
    "Server startup failed: " +
      (error instanceof Error ? error.message : String(error)),
  );
  if (isUatSafeModeEnabled()) {
    process.exit(1);
  }
});

// Graceful shutdown: close HTTP server, MongoDB, and expiry worker.
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  const srv = server;
  if (srv) {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
  stopInventoryExpiryWorker();
  stopProposalExpiryWorker();
  await stopNotificationOutboxWorker();
  await mongoose.disconnect();
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
