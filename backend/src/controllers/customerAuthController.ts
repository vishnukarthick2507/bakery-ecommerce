import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { PendingRegistration } from "../models/PendingRegistration.js";
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
import { sendOtpEmail, isBrevoConfigured } from "../services/emailService.js";
import {
  verifyGoogleIdToken,
  isGoogleConfigured,
} from "../services/googleAuth.js";
import { OtpSession } from "../models/OtpSession.js";
import { CustomerOtpProof } from "../models/CustomerOtpProof.js";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

const otpSendSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH", "GUEST_CHECKOUT", "PASSWORD_RESET"]).optional(),
});

const otpVerifySchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  otp: z.string().length(6, "OTP must be a 6-digit code"),
  purpose: z.enum(["LOGIN", "REGISTER", "AUTH", "GUEST_CHECKOUT", "PASSWORD_RESET"]).optional(),
});

const registrationCompleteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  // Email is optional in the body because the verified email comes from the
  // httpOnly registration token cookie (set after OTP verification). It is
  // accepted here only for forward-compatibility and is not authoritative.
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()).optional(),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().regex(PHONE_PATTERN, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(8).max(72).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include a letter and a number"),
  confirmPassword: z.string().optional(),
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  redirectTo: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(72).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include a letter and a number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  return cleaned.replace(/^(\+91|91)/, "");
}

function isValidIndianPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

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
}): {
  id: string;
  name: string;
  email: string | null | undefined;
  phone?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
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
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const INVALID_REGISTRATION_PROOF_MESSAGE = "Invalid or expired registration session. Please request OTP again.";
const INVALID_RESET_PROOF_MESSAGE = "Invalid or expired reset session. Please request password reset again.";
const GENERIC_AUTH_COMPLETION_RESPONSE = { message: "Authentication request processed" };
const GENERIC_RESET_RESPONSE = { message: "If an account exists for this email, a reset code has been sent." };
const GENERIC_FORGOT_RESPONSE = { message: "If an account exists for this email, a verification code has been sent." };

async function createRegistrationToken(email: string): Promise<string> {
  const proofId = randomUUID();
  const expiresAt = new Date(Date.now() + REGISTRATION_TOKEN_EXPIRY_MS);
  // The CustomerOtpProof.phone field is a plain String (no phone-specific DB
  // constraint), so it stores the verified contact identifier. After the
  // migration from SMS to email OTP, that identifier is the customer's email.
  await CustomerOtpProof.create({ proofId, phone: email, expiresAt });

  return jwt.sign(
    { email, purpose: "REGISTRATION", accountType: "REGISTRATION" },
    getJwtSecret(),
    { expiresIn: "10m", jwtid: proofId },
  );
}

async function consumeRegistrationProof(
  proofId: string,
  email: string,
): Promise<boolean> {
  const proof = await CustomerOtpProof.findOneAndDelete({
    proofId,
    phone: email,
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

function setResetTokenCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("otp-reset-token", token, {
    httpOnly: true,
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: RESET_TOKEN_EXPIRY_MS,
  });
}

function clearResetTokenCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("otp-reset-token", {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
}

async function createResetToken(email: string): Promise<string> {
  const proofId = randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await CustomerOtpProof.create({ proofId, phone: email, expiresAt });

  return jwt.sign(
    { email, purpose: "PASSWORD_RESET", accountType: "PASSWORD_RESET" },
    getJwtSecret(),
    { expiresIn: "10m", jwtid: proofId },
  );
}

async function consumeResetProof(
  proofId: string,
  email: string,
): Promise<boolean> {
  const proof = await CustomerOtpProof.findOneAndDelete({
    proofId,
    phone: email,
    expiresAt: { $gt: new Date() },
  });
  return proof !== null;
}

export const registerCustomer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    return;
  }

  const { name, email, phone, password } = parsed.data;

  try {
    // Check if email already exists as an active customer - generic response
    // to avoid email enumeration.
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      res.status(200).json({
        message: "If an account does not already exist for this email, a verification code has been sent. Please check your email.",
      });
      return;
    }

    // Check if phone already exists as an active customer or pending registration.
    // Return the same generic response as email-exists to avoid phone-number
    // enumeration via status code or message differences.
    const existingPhoneUser = await User.findOne({ phone: normalizePhone(phone) }).lean();
    const existingPendingPhone = await PendingRegistration.findOne({ phone: normalizePhone(phone) }).lean();
    if (existingPhoneUser || existingPendingPhone) {
      res.status(200).json({
        message:
          "If an account does not already exist for this email, a verification code has been sent. Please check your email.",
      });
      return;
    }

    // Check if there is already a pending registration for this email.
    const existingPending = await PendingRegistration.findOne({ email }).lean();
    if (existingPending) {
      res.status(200).json({
        message: "An account with this email already exists. Please check your email for the verification code.",
      });
      return;
    }

    // Remove any existing pending registration for this email.
    await PendingRegistration.deleteOne({ email });

    // Hash the password now so it's ready when OTP is verified.
    const passwordHash = await bcrypt.hash(password, 12);

    // Store pending registration data.
    await PendingRegistration.create({
      email,
      name: name.trim(),
      phone: normalizePhone(phone),
      passwordHash,
      expiresAt: new Date(Date.now() + REGISTRATION_TOKEN_EXPIRY_MS),
    });

    // Send OTP via Brevo.
    if (!isBrevoConfigured()) {
      // Clean up pending registration if email is not configured.
      await PendingRegistration.deleteOne({ email });
      res.status(503).json({
        message: "Email service is not configured. Please contact support.",
        code: "EMAIL_CONFIG_MISSING",
      });
      return;
    }

    const otp = generateOtp();
    const emailSent = await sendOtpEmail(email, otp, "REGISTER");
    if (!emailSent) {
      await PendingRegistration.deleteOne({ email });
      res.status(502).json({
        message: "Unable to send verification email. Please try again later.",
        code: "EMAIL_DELIVERY_FAILED",
      });
      return;
    }

    // Create OTP session for verification.
    await createOtpSession(email, "REGISTER", otp);

    res.status(200).json({
      message: "verification code sent to your email. Please check your inbox.",
    });
  } catch (error) {
    console.error("Customer registration failed:", error);
    res.status(500).json({ message: "Unable to register" });
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
      user: publicCustomer(user),
    });
  } catch (error) {
    console.error("Customer login failed:", error);
    res.status(500).json({ message: "Unable to login" });
  }
};

export const googleAuth = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  if (!isGoogleConfigured()) {
    res.status(503).json({
      message: "Google sign-in is not configured. Please contact support.",
      code: "GOOGLE_CONFIG_MISSING",
    });
    return;
  }

  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }

  const { idToken, redirectTo = "/account" } = parsed.data;

  try {
    const { googleId, email, emailVerified, name } = await verifyGoogleIdToken(idToken);

    if (!emailVerified) {
      res.status(400).json({ message: "Google email is not verified. Please verify your email with Google." });
      return;
    }

    // Find existing user by Google ID or email.
    let user: any = await User.findOne({ $or: [{ googleId }, { email }] }).select("+passwordHash +tokenVersion").lean();

    if (!user) {
      // Create new customer account from Google profile.
      const googleName: string = name;
      const displayName = googleName || email.split("@")[0];
      const created = await User.create({
        name: String(displayName),
        email,
        googleId,
        emailVerified: true,
        active: true,
      });
      user = created.toObject();
    } else if (!user.googleId) {
      // Link Google account to existing email-based account.
      await User.updateOne(
        { _id: user._id },
        { $set: { googleId, emailVerified: true } },
      );
      user = { ...user, googleId, emailVerified: true };
    }

    if (!user) {
      res.status(500).json({ message: "Unable to create account" });
      return;
    }

    const token = createCustomerToken(user._id.toString(), user.tokenVersion ?? 0);
    setCustomerTokenCookie(res, token);

    // Validate redirectTo to prevent open redirects.
    let safeRedirect = redirectTo;
    if (!safeRedirect || !safeRedirect.startsWith("/")) {
      safeRedirect = "/account";
    }

    res.status(200).json({
      message: "Google sign-in successful",
      redirectTo: safeRedirect,
    });
  } catch (error) {
    console.error("Google auth failed:", error);
    res.status(401).json({ message: "Invalid Google credentials" });
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

  const { email } = parsed.data;

  const purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET" =
    parsed.data.purpose ?? "AUTH";

  // Enforce 60-second cooldown between OTP sends for the same email+purpose.
  const retryAfter = await checkOtpCooldown(email, purpose);
  if (retryAfter !== null) {
    res.status(429).json({
      message: "Please wait before requesting another OTP.",
      retryAfter,
    });
    return;
  }

  let cooldownClaim;
  try {
    cooldownClaim = await claimOtpSendCooldown(email, purpose);
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

  const otp = generateOtp();
  let providerAccepted = false;
  try {
    if (process.env.NODE_ENV === "production") {
      if (!isBrevoConfigured()) {
        res.status(503).json({
          message: "Email service is not configured. Please contact support.",
          code: "EMAIL_CONFIG_MISSING",
        });
        return;
      }

      const emailSent = await sendOtpEmail(email, otp, purpose);
      if (!emailSent) {
        await releaseOtpSendCooldown(cooldownClaim.claim);
        res.status(502).json({
          message: "Unable to send OTP. Please try again later.",
          code: "EMAIL_DELIVERY_FAILED",
        });
        return;
      }

      providerAccepted = true;
      await commitOtpSendCooldown(cooldownClaim.claim);
      await createOtpSession(email, purpose as "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET", otp);
      res.status(200).json({ message: "OTP sent successfully" });
      return;
    }

    // Development/test: create the session and return the OTP so it can be
    // used without configuring a real email provider.
    await commitOtpSendCooldown(cooldownClaim.claim);
    await createOtpSession(email, purpose as "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET", otp);
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
|| Verifies a 6-digit OTP for the given customer email address.
|| For REGISTER purpose with pending registration, creates the account
|| directly and sets the customer JWT cookie.
|| Otherwise, sets the otp-registration-token cookie for subsequent
|| registration completion (preserving existing behavior).
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

  const { email, otp } = parsed.data;
  const purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET" =
    parsed.data.purpose ?? "AUTH";

  try {
    const isValid = await verifyOtpCode(email, otp, purpose);

    if (!isValid) {
      res.status(401).json({ message: "Invalid or expired OTP" });
      return;
    }

    // If this is a REGISTER verification with a pending registration,
    // create the account directly and set the customer JWT cookie.
    if (purpose === "REGISTER") {
      const pending = await PendingRegistration.findOne({ email }).lean();
      if (pending) {
        // Create the customer account with the stored hashed password.
        const created = await User.create({
          name: pending.name,
          email: pending.email,
          phone: pending.phone,
          passwordHash: pending.passwordHash,
          emailVerified: true,
          active: true,
        });
        const user = created.toObject();

        await PendingRegistration.deleteOne({ email });

        const customerToken = createCustomerToken(
          user._id.toString(),
          user.tokenVersion ?? 0,
        );
        setCustomerTokenCookie(res, customerToken);

        res.status(200).json({
          message: "Account created and signed in successfully",
          redirectTo: "/account",
        });
        return;
      }
    }

    // Preserve existing behavior: set the otp-registration-token cookie
    // for subsequent registration completion.
    const regToken = await createRegistrationToken(email);
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
|| FORGOT PASSWORD
|| POST /api/auth/forgot-password
||--------------------------------------------------------------------------
|| Sends a password reset OTP to the customer's email.
|| Never reveals whether an email address is registered.
*/
export const forgotPassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    // Generic response to avoid email enumeration.
    res.status(200).json(GENERIC_FORGOT_RESPONSE);
    return;
  }

  const { email } = parsed.data;

  // Only send OTP if the email is registered.
  const user = await User.findOne({ email }).lean();
  if (!user) {
    res.status(200).json(GENERIC_FORGOT_RESPONSE);
    return;
  }

  // Enforce cooldown.
  const retryAfter = await checkOtpCooldown(email, "PASSWORD_RESET");
  if (retryAfter !== null) {
    res.status(429).json({
      message: "Please wait before requesting another reset code.",
      retryAfter,
    });
    return;
  }

  let cooldownClaim;
  try {
    cooldownClaim = await claimOtpSendCooldown(email, "PASSWORD_RESET");
  } catch (error) {
    console.error("Password reset OTP reservation failed:", error);
    res.status(500).json({ message: "Unable to process request" });
    return;
  }

  if (!("claim" in cooldownClaim)) {
    res.status(429).json({
      message: "Please wait before requesting another reset code.",
      retryAfter: cooldownClaim.retryAfter,
    });
    return;
  }

  const otp = generateOtp();
  try {
    if (process.env.NODE_ENV === "production") {
      if (!isBrevoConfigured()) {
        await releaseOtpSendCooldown(cooldownClaim.claim);
        res.status(503).json({
          message: "Email service is not configured. Please contact support.",
          code: "EMAIL_CONFIG_MISSING",
        });
        return;
      }

      const emailSent = await sendOtpEmail(email, otp, "PASSWORD_RESET");
      if (!emailSent) {
        await releaseOtpSendCooldown(cooldownClaim.claim);
        res.status(502).json({
          message: "Unable to send reset email. Please try again later.",
          code: "EMAIL_DELIVERY_FAILED",
        });
        return;
      }
    }

    await commitOtpSendCooldown(cooldownClaim.claim);
    await createOtpSession(email, "PASSWORD_RESET" as "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT" | "PASSWORD_RESET", otp);

    res.status(200).json(GENERIC_FORGOT_RESPONSE);
  } catch (error) {
    try {
      await releaseOtpSendCooldown(cooldownClaim.claim);
    } catch {
      // The claim expires automatically if it cannot be released.
    }
    console.error("Forgot password failed:", error);
    res.status(200).json(GENERIC_FORGOT_RESPONSE);
  }
};

/*
||--------------------------------------------------------------------------
|| VERIFY RESET OTP
|| POST /api/auth/verify-reset-otp
||--------------------------------------------------------------------------
|| Verifies the password reset OTP and sets a reset proof cookie.
*/
export const verifyResetOtp = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    return;
  }

  const { email, otp } = parsed.data;

  try {
    const isValid = await verifyOtpCode(email, otp, "PASSWORD_RESET");

    if (!isValid) {
      res.status(401).json({ message: "Invalid or expired OTP" });
      return;
    }

    const resetToken = await createResetToken(email);
    setResetTokenCookie(res, resetToken);

    res.status(200).json({
      message: "Reset code verified successfully",
    });
  } catch (error) {
    console.error("Reset OTP verification failed:", error);
    res.status(500).json({ message: "Unable to verify reset code" });
  }
};

/*
||--------------------------------------------------------------------------
|| RESET PASSWORD
|| POST /api/auth/reset-password
||--------------------------------------------------------------------------
|| Resets the customer's password after OTP verification.
|| Invalidates existing sessions by incrementing tokenVersion.
*/
export const resetPassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const token = req.cookies?.["otp-reset-token"];
  if (!token) {
    clearResetTokenCookie(res);
    res.status(401).json({ message: INVALID_RESET_PROOF_MESSAGE });
    return;
  }

  let decoded: {
    email?: string;
    purpose?: string;
    accountType?: string;
    jti?: string;
  };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as {
      email?: string;
      purpose?: string;
      accountType?: string;
      jti?: string;
    };
  } catch {
    clearResetTokenCookie(res);
    res.status(401).json({ message: INVALID_RESET_PROOF_MESSAGE });
    return;
  }

  if (
    decoded.accountType !== "PASSWORD_RESET" ||
    decoded.purpose !== "PASSWORD_RESET" ||
    !decoded.email ||
    !decoded.jti
  ) {
    clearResetTokenCookie(res);
    res.status(401).json({ message: INVALID_RESET_PROOF_MESSAGE });
    return;
  }

  const email = decoded.email.toLowerCase();

  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "INVALID_PASSWORD",
      message: "Please provide a valid password.",
    });
    return;
  }

  const { newPassword } = parsed.data;

  // Consume the reset proof (single-use).
  const proofConsumed = await consumeResetProof(decoded.jti, email);
  if (!proofConsumed) {
    clearResetTokenCookie(res);
    res.status(401).json({ message: INVALID_RESET_PROOF_MESSAGE });
    return;
  }

  clearResetTokenCookie(res);

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updated = await User.findOneAndUpdate(
      { email },
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
      },
    );

    if (!updated) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    res.status(200).json({
      message: "Password reset successfully. Please sign in with your new password.",
    });
  } catch (error) {
    console.error("Password reset failed:", error);
    res.status(500).json({ message: "Unable to reset password" });
  }
};

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
    email?: string;
    purpose?: string;
    accountType?: string;
    jti?: string;
  };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as {
      email?: string;
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
    !decoded.email ||
    !decoded.jti
  ) {
    clearRegistrationTokenCookie(res);
    res.status(401).json({ message: INVALID_REGISTRATION_PROOF_MESSAGE });
    return;
  }

  // The verified email comes exclusively from the signed registration token
  // cookie - never from the request body.
  const email = decoded.email.toLowerCase();

  const parsed = registrationCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "PROFILE_REQUIRED",
      message: "Please provide your name to complete registration",
    });
    return;
  }

  const { name } = parsed.data;

  const existingUser = await User.findOne({ email }).select("+tokenVersion");
  if (existingUser) {
    const proofConsumed = await consumeRegistrationProof(decoded.jti, email);
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

  const proofConsumed = await consumeRegistrationProof(decoded.jti, email);
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
