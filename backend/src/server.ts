import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "S.V. Sweets & Bakers API is running",
  });
});

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(
      `STARTED S.V. Sweets & Bakers API running on http://localhost:${PORT}`,
    );
  });
};

startServer();