import bcrypt from "bcryptjs";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { getJwtSecret } from "../config/jwt.js";
import {
  createOtpSession,
  generateOtp,
  verifyOtp as verifyOtpCode,
} from "../services/otpService.js";
import { sendOtpSms } from "../services/smsService.js";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

const otpSendSchema = z.object({
  phone: z.string().trim().min(1),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH"]).optional(),
});

const otpVerifySchema = z.object({
  phone: z.string().trim().min(1),
  otp: z.string().length(6, "OTP must be a 6-digit code"),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH"]).optional(),
});

const registrationCompleteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  return cleaned.replace(/^(\+91|91)/, "");
}

function isValidIndianPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

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
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}): {
  id: string;
  name: string;
  email: string | null | undefined;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
} {
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

const REGISTRATION_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function createRegistrationToken(phone: string): string {
  return jwt.sign(
    { phone, purpose: "REGISTRATION", accountType: "REGISTRATION" },
    getJwtSecret(),
    { expiresIn: "10m" },
  );
}

function setRegistrationTokenCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("otp-registration-token", token, {
    httpOnly: true,
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: REGISTRATION_TOKEN_EXPIRY_MS,
  });
}

function clearRegistrationTokenCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("otp-registration-token", {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
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
    if (
      !user ||
      !user.active ||
      !user.passwordHash ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    ) {
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

/*
||--------------------------------------------------------------------------
|| OTP SEND
|| POST /api/auth/otp/send
||--------------------------------------------------------------------------
|| Creates a 6-digit OTP session for the given Indian mobile number.
|| Rate limited: 3 sends per identifier/IP per hour (otpSendLimiter).
|| In development/test mode the OTP is returned in the response so it can
|| be used without a real SMS provider. Never exposes the OTP in production.
*/
export const sendOtp = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = otpSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    return;
  }

  const { phone: rawPhone } = parsed.data;
  const phone = normalizePhone(rawPhone);

  if (!isValidIndianPhone(phone)) {
    res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    // Production: deliver the OTP via the 2Factor SMS provider before creating
    // an OTP session. Fail closed if SMS submission fails - no session and no
    // success response is returned when delivery fails.
    try {
      const otp = generateOtp();

      const smsSent = await sendOtpSms(phone, otp);
      if (!smsSent) {
        res.status(502).json({ message: "Unable to send OTP. Please try again later." });
        return;
      }

      await createOtpSession(phone, "AUTH", otp);

      // Never expose the OTP in production.
      res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("OTP send failed:", error);
      res.status(500).json({ message: "Unable to send OTP" });
    }
    return;
  }

  try {
    const { otp } = await createOtpSession(phone, "AUTH");

    // Development/test mode: expose OTP for testing without an SMS provider.
    // Never expose the OTP in production.
    res.status(200).json({ message: "OTP sent successfully", otp });
  } catch (error) {
    console.error("OTP send failed:", error);
    res.status(500).json({ message: "Unable to send OTP" });
  }
};

/*
||--------------------------------------------------------------------------
|| OTP VERIFY
|| POST /api/auth/otp/verify
||--------------------------------------------------------------------------
|| Verifies a 6-digit OTP for the given Indian mobile number.
|| On success, finds or creates the customer by phone and issues the
|| existing secure customer JWT cookie. Rate limited: 10 attempts per
|| identifier/IP per 15 minutes (otpVerifyLimiter).
*/
export const verifyOtp = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    return;
  }

  const { phone: rawPhone, otp } = parsed.data;
  const phone = normalizePhone(rawPhone);

  if (!isValidIndianPhone(phone)) {
    res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  try {
    const isValid = await verifyOtpCode(phone, otp, "AUTH");

    if (!isValid) {
      res.status(401).json({ message: "Invalid or expired OTP" });
      return;
    }

    // Check if customer already exists for this verified phone.
    const user = await User.findOne({ phone }).lean();

    if (user) {
      // Existing customer: automatically authenticate and issue session.
      if (!user.active) {
        res.status(403).json({ message: "This account is inactive. Please contact support." });
        return;
      }

      const token = createCustomerToken(user._id.toString(), user.tokenVersion ?? 0);
      setCustomerTokenCookie(res, token);

      res.status(200).json({
        message: "OTP verified successfully",
        token,
        user: publicCustomer(user),
      });
      return;
    }

    // New customer: issue a signed registration token and require registration.
    // Never trust a phone number from the request body; the verified identity
    // comes from the registration token cookie set below.
    const regToken = createRegistrationToken(phone);
    setRegistrationTokenCookie(res, regToken);

    res.status(200).json({
      message: "OTP verified successfully",
      status: "registration_required",
      phone,
    });
  } catch (error) {
    console.error("OTP verification failed:", error);
    res.status(500).json({ message: "Unable to verify OTP" });
  }
};

/*
||--------------------------------------------------------------------------
|| REGISTRATION COMPLETE
|| POST /api/auth/otp/register-complete
||--------------------------------------------------------------------------
|| Completes phone-only customer registration after OTP verification.
|| The verified phone identity comes exclusively from the signed
|| otp-registration-token httpOnly cookie - never from the request body.
|| Rate limited: 10 registrations per identifier/IP per 15 minutes.
*/
export const completeRegistration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const token = req.cookies?.["otp-registration-token"];
  if (!token) {
    res.status(401).json({
      message: "Registration session expired or missing. Please request OTP again.",
    });
    return;
  }

  let decoded: {
    phone?: string;
    purpose?: string;
    accountType?: string;
  };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as {
      phone?: string;
      purpose?: string;
      accountType?: string;
    };
  } catch {
    res.status(401).json({
      message: "Invalid or expired registration session. Please request OTP again.",
    });
    return;
  }

  if (
    decoded.accountType !== "REGISTRATION" ||
    decoded.purpose !== "REGISTRATION" ||
    !decoded.phone
  ) {
    res.status(401).json({ message: "Invalid registration session." });
    return;
  }

  const phone = decoded.phone;

  const parsed = registrationCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid registration details",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const { name, email } = parsed.data;

  // Prevent duplicate phone and email accounts, including concurrent attempts.
  const existing = await User.findOne({ $or: [{ email }, { phone }] }).lean();
  if (existing) {
    res.status(409).json({
      message: "An account with that email or phone number already exists",
    });
    return;
  }

  try {
    const created = await User.create({
      name: name.trim(),
      email,
      phone,
      active: true,
    });
    const user = created.toObject();

    if (!user) {
      res.status(500).json({ message: "Unable to create customer account" });
      return;
    }

    // Issue the normal customer JWT and httpOnly customer-token cookie.
    const customerToken = createCustomerToken(
      user._id.toString(),
      user.tokenVersion ?? 0,
    );
    setCustomerTokenCookie(res, customerToken);

    // Clear the registration token cookie - single use only.
    clearRegistrationTokenCookie(res);

    res.status(200).json({
      message: "Account created successfully",
      token: customerToken,
      user: publicCustomer(user),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      res.status(409).json({
        message: "An account with that email or phone number already exists",
      });
      return;
    }
    console.error("Customer registration failed:", error);
    res.status(500).json({ message: "Unable to create customer account" });
  }
};
