import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { Admin } from "../models/Admin.js";
import { getJwtSecret } from "../config/jwt.js";

const JWT_EXPIRES_IN = "7d";

function setAdminTokenCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("admin-token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_EXPIRES_IN
  });
}

function clearAdminTokenCookie(res: Response): void {
  res.clearCookie("admin-token", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getTokenFromRequest(req: Request): string | null {
  // Prefer the httpOnly cookie (single source of truth).
  const cookieToken = req.cookies?.["admin-token"];
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization: Bearer header for API clients.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});

/*
||--------------------------------------------------------------------------
|| ADMIN LOGIN
||--------------------------------------------------------------------------
|| POST /api/auth/login
||--------------------------------------------------------------------------
*/

export const adminLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid credentials",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { username, password } = parsed.data;

    const admin = await Admin.findOne({ username })
      .select("+password")
      .lean();

    if (!admin) {
      res.status(401).json({
        message: "Invalid credentials",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      admin.password as string,
    );

    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid credentials",
      });
      return;
    }

    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        role: admin.role,
      },
      getJwtSecret(),
      { expiresIn: JWT_EXPIRES_IN },
    );

    setAdminTokenCookie(res, token);

    res.status(200).json({
      message: "Login successful",
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login failed:", error);
    res.status(500).json({
      message: "Unable to login",
    });
  }
};

/*
||--------------------------------------------------------------------------
|| VERIFY TOKEN
||--------------------------------------------------------------------------
|| GET /api/auth/verify
||--------------------------------------------------------------------------
*/

export const verifyToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      res.status(401).json({
        message: "No token provided",
      });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      adminId: string;
      username: string;
      role: string;
    };

    const admin = await Admin.findById(decoded.adminId).lean();

    if (!admin) {
      res.status(401).json({
        message: "Invalid token",
      });
      return;
    }

    res.status(200).json({
      valid: true,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(401).json({
      message: "Invalid token",
    });
  }
};

/*
||--------------------------------------------------------------------------
|| ADMIN ME
|| GET /api/admin/me
||--------------------------------------------------------------------------
|| Returns whether the current httpOnly cookie holds a valid admin session.
|| Never exposes the JWT or sensitive admin data.
*/
export const adminMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      res.status(200).json({ isAdmin: false });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      adminId?: string;
      username?: string;
      role?: string;
      customerId?: string;
      accountType?: string;
      tokenVersion?: number;
    };

    // A customer JWT carries customerId (not adminId) and accountType
    // "CUSTOMER". It is not an admin session, so delegate to the customer
    // /me handler (getCurrentCustomer) which returns { user }. Without this
    // the customer profile request wrongly returns { isAdmin: false } and the
    // frontend clears a valid customer session, causing a login redirect loop.
    if (!decoded.adminId || decoded.accountType === "CUSTOMER") {
      return next();
    }

    const admin = await Admin.findById(decoded.adminId).lean();

    res.status(200).json({ isAdmin: !!admin });
  } catch {
    // Invalid / expired / tampered cookie: not an authenticated admin.
    res.status(200).json({ isAdmin: false });
  }
};

/*
||--------------------------------------------------------------------------
|| ADMIN LOGOUT
|| POST /api/admin/logout
||--------------------------------------------------------------------------
|| Clears the httpOnly admin-token cookie.
*/
export const adminLogout = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  clearAdminTokenCookie(res);
  res.status(200).json({ message: "Logged out" });
};
