import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { Admin } from "../models/Admin.js";
import type { AuthRequest } from "../middleware/auth.js";
import { getJwtSecret } from "../config/jwt.js";
import {
  getBrevoPresenceChecks,
  sendAdminLoginAlertOnce,
} from "../services/emailService.js";

const JWT_EXPIRES_IN = "7d";

function setAdminTokenCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("admin-token", token, {
    httpOnly: true,
    path: "/",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_EXPIRES_IN
  });
}

function clearAdminTokenCookie(res: Response): void {
  res.clearCookie("admin-token", {
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getTokenFromRequest(req: Request): string | null {
  // Prefer the Authorization: Bearer header so a customer JWT sent in the
  // header takes precedence over a stale admin-token cookie. Fall back to
  // the httpOnly admin-token cookie for browser-based admin sessions.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieToken = req.cookies?.["admin-token"];
  if (cookieToken) {
    return cookieToken;
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
        tokenVersion: admin.tokenVersion ?? 0,
      },
      getJwtSecret(),
      { expiresIn: JWT_EXPIRES_IN },
    );

    setAdminTokenCookie(res, token);

    const requestId = (req as Request & { id?: string }).id;
    if (requestId) {
      void sendAdminLoginAlertOnce(requestId, {
        username: admin.username,
        occurredAt: new Date(),
        ...(req.ip ? { ipAddress: req.ip } : {}),
        ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
      }).catch(() => undefined);
    }

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
      adminId?: string;
      username?: string;
      role?: string;
      accountType?: string;
      tokenVersion?: number;
    };

    if (!decoded.adminId || decoded.accountType === "CUSTOMER") {
      res.status(401).json({
        message: "Invalid token",
      });
      return;
    }

    const admin = await Admin.findById(decoded.adminId).lean();

    if (!admin) {
      res.status(401).json({
        message: "Invalid token",
      });
      return;
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const storedVersion = (admin as { tokenVersion?: number }).tokenVersion ?? 0;
    if (tokenVersion !== storedVersion) {
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
|| SESSION INTROSPECTION (GET /api/auth/me, GET /api/admin/me)
||--------------------------------------------------------------------------
|| Explicit, deterministic session introspection used by a single /me route
|| registration. Admin and customer contexts are handled separately:
|| - /api/admin/me: admin session status only ({ isAdmin: boolean }).
|| - /api/auth/me: preserves backward-compatible behavior for customer session
||   introspection and legacy admin-status checks without cross-account data
||   disclosure. Customer-profile resolution, when applicable, is delegated to
||   the customer auth chain in the same route registration.
*/
export const adminMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const isAuthMount = req.baseUrl === "/api/auth";
    const isAdminMount = req.baseUrl === "/api/admin";
    const hasBearerToken =
      typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ");

    // On /api/auth, a browser customer session may be present only as an
    // httpOnly customer cookie (no Authorization header). Delegate to the
    // customer auth chain so the response remains the customer profile shape.
    if (isAuthMount && !hasBearerToken && req.cookies?.["customer-token"]) {
      return next();
    }

    const token = getTokenFromRequest(req);

    // No usable token: preserve existing session-status behavior.
    // /api/auth/me returns { isAdmin: false } for unauthenticated requests;
    // customer-only unauthenticated requests with a customer cookie were handled
    // above and delegated to customer auth (which returns 401 if invalid/missing).
    if (!token) {
      res.status(200).json({ isAdmin: false });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      adminId?: string;
      customerId?: string;
      accountType?: string;
      tokenVersion?: number;
    };

    const isCustomerToken =
      decoded.accountType === "CUSTOMER" || typeof decoded.customerId === "string";

    // Customer tokens must never be treated as admin sessions.
    // On /api/auth, delegate to the customer auth chain for profile resolution.
    // On /api/admin (or other mounts), report no admin session only.
    if (isCustomerToken || !decoded.adminId) {
      if (isAuthMount) {
        return next();
      }
      res.status(200).json({ isAdmin: false });
      return;
    }

    // Admin-token path (isolated from customer profile resolution).
    const admin = await Admin.findById(decoded.adminId).lean();
    if (!admin) {
      res.status(200).json({ isAdmin: false });
      return;
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const storedVersion = (admin as { tokenVersion?: number }).tokenVersion ?? 0;
    if (tokenVersion !== storedVersion) {
      res.status(200).json({ isAdmin: false });
      return;
    }

    // Valid admin session status. This never returns customer profile data.
    res.status(200).json({ isAdmin: true });
  } catch {
    // Invalid/expired/tampered token: preserve non-admin session status shape.
    // Customer auth failures on delegated /api/auth requests are handled by the
    // customer auth chain when delegation occurs.
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
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      clearAdminTokenCookie(res);
      res.status(200).json({ message: "Logged out" });
      return;
    }

    let decoded: {
      adminId: string;
      tokenVersion?: number;
    };
    try {
      decoded = jwt.verify(token, getJwtSecret()) as {
        adminId: string;
        tokenVersion?: number;
      };
    } catch {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const storedVersion = admin.tokenVersion ?? 0;
    if (tokenVersion !== storedVersion) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    const versionFilter =
      storedVersion === 0
        ? {
            $or: [
              { tokenVersion: 0 },
              { tokenVersion: { $exists: false } },
            ],
          }
        : { tokenVersion: storedVersion };

    const result = await Admin.findOneAndUpdate(
      { _id: admin._id, ...versionFilter },
      { $inc: { tokenVersion: 1 } },
      { returnDocument: "after" },
    );

    if (!result) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    clearAdminTokenCookie(res);
    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    console.error("Admin logout failed:", error);
    res.status(500).json({ message: "Unable to logout" });
  }
};

/*
||--------------------------------------------------------------------------
|| BREVO API DIAGNOSTIC
|| GET /api/admin/diagnostics/brevo-smtp
||--------------------------------------------------------------------------
|| Protected admin diagnostic. Reports the presence of the Brevo API
|| configuration without performing a network call. Never exposes SMTP
|| credentials, OTPs, customer data, or environment variable values.
*/
export const brevoSmtpDiagnostic = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const checks = getBrevoPresenceChecks();
  const smtpConfigured = checks.apiKeyPresent;
  res.status(200).json({ smtpConfigured, checks });
};
