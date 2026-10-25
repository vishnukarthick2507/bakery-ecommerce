import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { Admin } from "../models/Admin.js";
import { getJwtSecret } from "../config/jwt.js";

const JWT_EXPIRES_IN = "7d";

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

    const admin = await Admin.findOne({ username }).lean();

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

    res.status(200).json({
      message: "Login successful",
      token,
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.substring(7);

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
