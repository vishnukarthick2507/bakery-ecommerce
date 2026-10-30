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
    // Prefer the httpOnly admin-token cookie (single source of truth).
    // Fall back to Authorization: Bearer header for API clients.
    let token: string | null = null;

    if (req.cookies && req.cookies["admin-token"]) {
      token = req.cookies["admin-token"];
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

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
  // Prefer the Authorization: Bearer header; fall back to the httpOnly
  // customer-token cookie so browser-sent customer cookies are honoured.
  let token: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies["customer-token"]) {
    token = req.cookies["customer-token"];
  }

  if (!token) {
    if (required) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
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
  } catch (error) {
    console.error(
      "Customer token verification failed:",
      error instanceof Error ? error.message : String(error),
    );
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
