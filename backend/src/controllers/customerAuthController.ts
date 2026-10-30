import bcrypt from "bcryptjs";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
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
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function setCustomerTokenCookie(res: Response, token: string): void {
  res.cookie("customer-token", token, {
    httpOnly: true,
    path: "/",
    sameSite: isProduction() ? "none" : "lax",
    secure: isProduction(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiry
  });
}

function clearCustomerTokenCookie(res: Response): void {
  res.clearCookie("customer-token", {
    path: "/",
    sameSite: isProduction() ? "none" : "lax",
    secure: isProduction(),
  });
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
    const token = createCustomerToken(user._id.toString(), user.tokenVersion ?? 0);
    setCustomerTokenCookie(res, token);
    res.status(201).json({
      token,
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
    if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = createCustomerToken(user._id.toString(), user.tokenVersion ?? 0);
    setCustomerTokenCookie(res, token);
    res.status(200).json({
      token,
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
  clearCustomerTokenCookie(res);
  res.status(200).json({ message: "Logged out" });
};
