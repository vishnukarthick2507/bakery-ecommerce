import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
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

    const decoded = jwt.verify(token, JWT_SECRET) as {
      adminId: string;
      username: string;
      role: string;
    };

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
