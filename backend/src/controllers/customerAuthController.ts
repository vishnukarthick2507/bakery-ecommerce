import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { getJwtSecret } from "../config/jwt.js";
import {
  createOtpSession,
  claimOtpSendCooldown,
  commitOtpSendCooldown,
  generateOtp,
  OTP_RESEND_COOLDOWN_MS,
  releaseOtpSendCooldown,
  verifyOtp as verifyOtpCode,
} from "../services/otpService.js";
import { sendOtpSms } from "../services/smsService.js";
import { OtpSession } from "../models/OtpSession.js";
import { CustomerOtpProof } from "../models/CustomerOtpProof.js";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

const otpSendSchema = z.object({
  phone: z.string().trim().min(1),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH", "GUEST_CHECKOUT"]).optional(),
});

const otpVerifySchema = z.object({
  phone: z.string().trim().min(1),
  otp: z.string().length(6, "OTP must be a 6-digit code"),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH", "GUEST_CHECKOUT"]).optional(),
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
const INVALID_REGISTRATION_PROOF_MESSAGE = "Invalid or expired registration session. Please request OTP again.";
const GENERIC_AUTH_COMPLETION_RESPONSE = { message: "Authentication request processed" };

async function createRegistrationToken(phone: string): Promise<string> {
  const proofId = randomUUID();
  const expiresAt = new Date(Date.now() + REGISTRATION_TOKEN_EXPIRY_MS);
  await CustomerOtpProof.create({ proofId, phone, expiresAt });

  return jwt.sign(
    { phone, purpose: "REGISTRATION", accountType: "REGISTRATION" },
    getJwtSecret(),
    { expiresIn: "10m", jwtid: proofId },
  );
}

async function consumeRegistrationProof(
  proofId: string,
  phone: string,
): Promise<boolean> {
  const proof = await CustomerOtpProof.findOneAndDelete({
    proofId,
    phone,
    expiresAt: { $gt: new Date() },
  });
  return proof !== null;
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
  // Password-based customer registration is disabled.
  // New customers must register via phone OTP (/api/auth/otp/register-complete).
  // Existing customers can still log in with email/password via loginCustomer.
  res.status(403).json({
    message:
      "Password registration is disabled. Please use phone OTP to register, or sign in if you already have an account.",
  });
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
|| OTP SEND COOLDOWN CHECK
||--------------------------------------------------------------------------
|| Returns the number of seconds remaining before the next OTP send is
|| allowed for the given phone number and purpose, or null if no cooldown
|| is active. Enforced in addition to the IP+phone rate limiter.
*/
async function checkOtpCooldown(
  phone: string,
  purpose: string,
): Promise<number | null> {
  const recent = await (OtpSession as any).findOne({
    identifier: phone.toLowerCase().trim(),
    purpose,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!recent || !(recent as { createdAt?: Date }).createdAt) return null;

  const elapsed = Date.now() - (recent as { createdAt: Date }).createdAt.getTime();
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
  }
  return null;
}

/*
||--------------------------------------------------------------------------
|| OTP SEND
|| POST /api/auth/otp/send
||--------------------------------------------------------------------------
|| Creates a 6-digit OTP session for the given Indian mobile number.
|| Rate limited: 3 sends per identifier/IP per hour (otpSendLimiter).
|| Cooldown: minimum 60 seconds between sends for the same phone+purpose.
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

  const purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" =
    parsed.data.purpose ?? "AUTH";

  // Enforce 60-second cooldown between OTP sends for the same phone+purpose.
  const retryAfter = await checkOtpCooldown(phone, purpose);
  if (retryAfter !== null) {
    res.status(429).json({
      message: "Please wait before requesting another OTP.",
      retryAfter,
    });
    return;
  }

  let cooldownClaim;
  try {
    cooldownClaim = await claimOtpSendCooldown(phone, purpose);
  } catch (error) {
    console.error("OTP send reservation failed:", error);
    res.status(500).json({ message: "Unable to send OTP" });
    return;
  }

  if (!("claim" in cooldownClaim)) {
    res.status(429).json({
      message: "Please wait before requesting another OTP.",
      retryAfter: cooldownClaim.retryAfter,
    });
    return;
  }

  let providerAccepted = false;
  try {
    if (process.env.NODE_ENV === "production") {
      const otp = generateOtp();
      const smsSent = await sendOtpSms(phone, otp);
      if (!smsSent) {
        await releaseOtpSendCooldown(cooldownClaim.claim);
        res.status(502).json({ message: "Unable to send OTP. Please try again later." });
        return;
      }

      providerAccepted = true;
      await commitOtpSendCooldown(cooldownClaim.claim);
      await createOtpSession(phone, purpose, otp);
      res.status(200).json({ message: "OTP sent successfully" });
      return;
    }

    const { otp } = await createOtpSession(phone, purpose);
    await commitOtpSendCooldown(cooldownClaim.claim);
    res.status(200).json({ message: "OTP sent successfully", otp });
  } catch (error) {
    if (!providerAccepted) {
      try {
        await releaseOtpSendCooldown(cooldownClaim.claim);
      } catch {
        // The claim expires automatically if it cannot be released.
      }
    }
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
  const purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" =
    parsed.data.purpose ?? "AUTH";

  if (!isValidIndianPhone(phone)) {
    res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  try {
    const isValid = await verifyOtpCode(phone, otp, purpose);

    if (!isValid) {
      res.status(401).json({ message: "Invalid or expired OTP" });
      return;
    }

    // Keep the response and proof cookie identical regardless of account state.
    // The verified phone is carried only in this short-lived HTTP-only cookie.
    const regToken = await createRegistrationToken(phone);
    setRegistrationTokenCookie(res, regToken);
    res.status(200).json({
      message: "OTP verified successfully",
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
    clearRegistrationTokenCookie(res);
    res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
    return;
  }

  let decoded: {
    phone?: string;
    purpose?: string;
    accountType?: string;
    jti?: string;
  };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as {
      phone?: string;
      purpose?: string;
      accountType?: string;
      jti?: string;
    };
  } catch {
    clearRegistrationTokenCookie(res);
    res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
    return;
  }

  if (
    decoded.accountType !== "REGISTRATION" ||
    decoded.purpose !== "REGISTRATION" ||
    !decoded.phone ||
    !isValidIndianPhone(decoded.phone) ||
    !decoded.jti
  ) {
    clearRegistrationTokenCookie(res);
    res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
    return;
  }

  const phone = decoded.phone;

  const parsed = registrationCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "PROFILE_REQUIRED",
      message: "Please provide your name and email to complete registration",
    });
    return;
  }

  const { name, email } = parsed.data;

  const existingUser = await User.findOne({ phone }).select("+tokenVersion");
  if (existingUser) {
    const proofConsumed = await consumeRegistrationProof(decoded.jti, phone);
    if (!proofConsumed) {
      clearRegistrationTokenCookie(res);
      res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
      return;
    }

    clearRegistrationTokenCookie(res);
    if (!existingUser.active) {
      res.status(200).json(GENERIC_AUTH_COMPLETION_RESPONSE);
      return;
    }

    const customerToken = createCustomerToken(
      existingUser._id.toString(),
      existingUser.tokenVersion ?? 0,
    );
    setCustomerTokenCookie(res, customerToken);
    res.status(200).json(GENERIC_AUTH_COMPLETION_RESPONSE);
    return;
  }

  const proofConsumed = await consumeRegistrationProof(decoded.jti, phone);
  if (!proofConsumed) {
    clearRegistrationTokenCookie(res);
    res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
    return;
  }

  clearRegistrationTokenCookie(res);

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

    res.status(200).json(GENERIC_AUTH_COMPLETION_RESPONSE);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      res.status(200).json(GENERIC_AUTH_COMPLETION_RESPONSE);
      return;
    }
    console.error("Customer registration failed:", error);
    res.status(500).json({ message: "Unable to create customer account" });
  }
};
