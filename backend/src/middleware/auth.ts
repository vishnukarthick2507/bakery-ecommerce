import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { getJwtSecret } from "../config/jwt.js";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
  };
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export const authenticateAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, getJwtSecret()) as {
      adminId: string;
      username: string;
      role: string;
    };

    if (!decoded.adminId || "customerId" in decoded) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    req.admin = {
      id: decoded.adminId,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

async function resolveCustomerToken(
  req: AuthRequest,
  res: Response,
  required: boolean,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    if (required) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    next();
    return;
  }

  try {
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Invalid authorization header");
    }

    const decoded = jwt.verify(authHeader.substring(7), getJwtSecret()) as {
      customerId?: string;
      accountType?: string;
      tokenVersion?: number;
    };

    if (decoded.accountType !== "CUSTOMER" || !decoded.customerId) {
      throw new Error("Invalid customer token");
    }

    const customer = await User.findById(decoded.customerId)
      .select("name email phone active +tokenVersion")
      .lean();

    if (
      !customer ||
      !customer.active ||
      (customer.tokenVersion ?? 0) !== decoded.tokenVersion
    ) {
      throw new Error("Customer account is unavailable");
    }

    req.customer = {
      id: customer._id.toString(),
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired customer token" });
  }
}

export const authenticateCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  void resolveCustomerToken(req, res, true, next);
};

export const optionalCustomerAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  void resolveCustomerToken(req, res, false, next);
};
