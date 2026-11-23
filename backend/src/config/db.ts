import mongoose from "mongoose";
import {
  assertUatSafeModeMongoTarget,
  getUatSafeModeStartupErrorMessage,
  isUatSafeModeEnabled,
} from "./uatSafeMode.js";

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (isUatSafeModeEnabled()) {
      assertUatSafeModeMongoTarget(mongoURI);
    }

    if (!mongoURI) {
      throw new Error("MONGODB_URI is not defined in .env");
    }

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      isUatSafeModeEnabled()
        ? getUatSafeModeStartupErrorMessage(error)
        : error instanceof Error
          ? error.message
          : error,
    );
    if (!isUatSafeModeEnabled()) {
      console.error(
        "Check that MONGODB_URI in backend/.env is correct and that this machine's IP is allowed in MongoDB Atlas (Network Access).",
      );
    }
    process.exit(1);
  }
};
