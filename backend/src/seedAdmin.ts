import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Admin } from "./models/Admin.js";

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  await mongoose.connect(mongoURI);

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({ username: "admin" });

  if (existingAdmin) {
    console.log("Admin user already exists. Skipping seed.");
    await mongoose.connection.close();
    return;
  }

  // Create admin user
  const password = await bcrypt.hash("admin123", 10);

  const admin = await Admin.create({
    username: "admin",
    password,
    role: "ADMIN",
  });

  console.log("Admin user created successfully:");
  console.log("  Username: admin");
  console.log("  Password: admin123");
  console.log("  IMPORTANT: Change this password in production!");

  await mongoose.connection.close();
};

seedAdmin().catch(async (error) => {
  console.error("Failed to seed admin:", error);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
