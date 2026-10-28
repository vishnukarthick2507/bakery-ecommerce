import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { OtpSession } from "../models/OtpSession.js";
import { createOtpSession, generateOtp, hashOtp, generateSalt, verifyOtp as verifyOtpCode } from "../services/otpService.js";
import { sendOtpEmail } from "../services/emailService.js";
import { getJwtSecret } from "../config/jwt.js";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().regex(PHONE_PATTERN, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(8).max(72).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include a letter and a number"),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

function createCustomerToken(customerId: string, tokenVersion: number): string {
  return jwt.sign(
    { customerId, accountType: "CUSTOMER", tokenVersion },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

function publicCustomer(user: {
  _id: { toString(): string };
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const registerCustomer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid registration details", errors: parsed.error.flatten() });
    return;
  }

  try {
    const { name, email, phone, password } = parsed.data;
    const existing = await User.findOne({ $or: [{ email }, { phone }] }).lean();
    if (existing) {
      res.status(409).json({ message: "An account with that email or phone number already exists" });
      return;
    }

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      active: true,
    });
    res.status(201).json({
      token: createCustomerToken(user._id.toString(), user.tokenVersion ?? 0),
      user: publicCustomer(user),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      res.status(409).json({ message: "An account with that email or phone number already exists" });
      return;
    }
    console.error("Customer registration failed:", error);
    res.status(500).json({ message: "Unable to create your account" });
  }
};

export const loginCustomer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid email or password" });
    return;
  }

  try {
    const user = await User.findOne({ email: parsed.data.email })
      .select("+passwordHash +tokenVersion");
    if (
      !user ||
      !user.active ||
      !(user.passwordHash && (await bcrypt.compare(parsed.data.password, user.passwordHash)))
    ) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    res.status(200).json({
      token: createCustomerToken(user._id.toString(), user.tokenVersion ?? 0),
      user: publicCustomer(user),
    });
  } catch (error) {
    console.error("Customer login failed:", error);
    res.status(500).json({ message: "Unable to login" });
  }
};

export const getCurrentCustomer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.customer) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const user = await User.findById(req.customer.id)
    .select("name email phone createdAt updatedAt")
    .lean();
  if (!user) {
    res.status(401).json({ message: "Customer account is unavailable" });
    return;
  }
  res.status(200).json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
};

export const logoutCustomer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!req.customer) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  await User.updateOne(
    { _id: req.customer.id },
    { $inc: { tokenVersion: 1 } },
  );
  res.status(200).json({ message: "Logged out" });
};

/*
||--------------------------------------------------------------------------
|| OTP SEND
|| POST /api/auth/otp/send
||--------------------------------------------------------------------------
|| Sends a 6-digit OTP to the given email address via email.
|| Rate limited: 3 sends per identifier per hour.
*/
export const sendOtp = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const schema = z.object({
    identifier: z.string().trim().min(1),
    purpose: z.enum(["LOGIN", "REGISTER"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const { identifier, purpose } = parsed.data;

  try {
    const { otp } = await createOtpSession(identifier, purpose);
    await sendOtpEmail(identifier, otp, purpose);

    res.status(200).json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("OTP send failed");
    res.status(500).json({ message: "Unable to send OTP" });
  }
};

/*
||--------------------------------------------------------------------------
|| OTP VERIFY
|| POST /api/auth/otp/verify
||--------------------------------------------------------------------------
|| Verifies a 6-digit OTP. If valid and purpose is LOGIN, returns a JWT.
|| If valid and purpose is REGISTER, returns a verified token to proceed with registration.
|| Rate limited: 10 attempts per IP per 15 minutes.
*/
export const verifyOtp = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const schema = z.object({
    identifier: z.string().trim().min(1),
    otp: z.string().trim().length(6),
    purpose: z.enum(["LOGIN", "REGISTER"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const { identifier, otp, purpose } = parsed.data;

  const isValid = await verifyOtpCode(identifier, otp, purpose);
  if (!isValid) {
    res.status(401).json({
      message: "Invalid or expired OTP",
    });
    return;
  }

  // Find or create customer
  let user = await User.findOne({ email: identifier.toLowerCase() }).lean();

  if (!user) {
    // Check if it looks like a phone number (Indian format)
    const phonePattern = /^[6-9]\d{9}$/;
    if (phonePattern.test(identifier.trim())) {
      user = await User.findOne({ phone: identifier.trim() }).lean();
    }

    if (!user) {
      // New customer - create account.
      // Omit the absent identifier field entirely so that sparse unique
      // indexes do not collide on null values (MongoDB sparse indexes
      // include documents where the field exists as null).
      const userData: { name: string; email?: string; phone?: string; active: boolean } = {
        name: identifier.split("@")[0] ?? "Customer",
        active: true,
      };
      if (identifier.includes("@")) {
        userData.email = identifier.toLowerCase();
      } else {
        userData.phone = identifier.trim();
      }
      const newUser = await User.create(userData);
      user = newUser.toObject();
    }
  }

  if (!user) {
    res.status(401).json({ message: "Unable to authenticate" });
    return;
  }

  if (!user.active) {
    res.status(401).json({ message: "Account is deactivated" });
    return;
  }

  const token = createCustomerToken(user._id.toString(), user.tokenVersion ?? 0);

  res.status(200).json({
    message: "OTP verified successfully",
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
};