import crypto from "crypto";
import { OtpSession } from "../models/OtpSession.js";
import { OtpSendCooldown } from "../models/OtpSendCooldown.js";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export interface OtpSendCooldownClaim {
  key: string;
  claimId: string;
}

function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("OTP_SECRET must be configured with at least 16 characters");
  }
  return secret;
}

export function generateOtp(): string {
  const range = 1_000_000;
  // Largest multiple of range that fits in a uint32 (avoids modulo bias)
  const threshold = Math.floor(0xffffffff / range) * range;
  let value: number;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= threshold);
  return (value % range).toString().padStart(6, "0");
}

export function hashOtp(otp: string, salt: string): string {
  const secret = getOtpSecret();
  // Derive HMAC key from server secret + per-session salt.
  // The server secret protects stored OTP hashes; the salt ensures
  // each session has a unique key even if two OTPs happen to match.
  const key = crypto.createHmac("sha256", secret).update(salt).digest("hex");
  return crypto.createHmac("sha256", key).update(otp).digest("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function claimOtpSendCooldown(
  identifier: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT",
): Promise<{ claim: OtpSendCooldownClaim } | { retryAfter: number }> {
  const normalizedIdentifier = identifier.toLowerCase().trim();
  const key = `${purpose}:${normalizedIdentifier}`;
  const now = new Date();
  const claimId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);

  const renewed = await OtpSendCooldown.findOneAndUpdate(
    { _id: key, expiresAt: { $lte: now } },
    { $set: { claimId, expiresAt } },
    { returnDocument: "after" },
  ).lean();
  if (renewed) {
    return { claim: { key, claimId } };
  }

  try {
    await OtpSendCooldown.create({ _id: key, claimId, expiresAt });
    return { claim: { key, claimId } };
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) {
      throw error;
    }

    const activeClaim = await OtpSendCooldown.findById(key).lean();
    const retryAfter = activeClaim
      ? Math.max(1, Math.ceil((activeClaim.expiresAt.getTime() - Date.now()) / 1000))
      : 1;
    return { retryAfter };
  }
}

export async function commitOtpSendCooldown(
  claim: OtpSendCooldownClaim,
): Promise<void> {
  await OtpSendCooldown.updateOne(
    { _id: claim.key, claimId: claim.claimId },
    { $set: { expiresAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS) } },
  );
}

export async function releaseOtpSendCooldown(
  claim: OtpSendCooldownClaim,
): Promise<void> {
  await OtpSendCooldown.deleteOne({ _id: claim.key, claimId: claim.claimId });
}

export async function createOtpSession(
  identifier: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT",
  otp?: string,
): Promise<{ otp: string }> {
  const resolvedOtp = otp ?? generateOtp();
  const salt = generateSalt();
  const otpHash = hashOtp(resolvedOtp, salt);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Invalidate any existing unconsumed OTP sessions for this identifier
  await OtpSession.updateMany(
    { identifier, consumed: false },
    { consumed: true }
  );

  await OtpSession.create({
    identifier: identifier.toLowerCase().trim(),
    otpHash,
    otpSalt: salt,
    purpose,
    attempts: 0,
    consumed: false,
    expiresAt,
  });

  return { otp: resolvedOtp };
}

export async function verifyOtp(
  identifier: string,
  otp: string,
  purpose: "LOGIN" | "REGISTER" | "AUTH" | "GUEST_CHECKOUT",
): Promise<boolean> {
  const normId = identifier.toLowerCase().trim();

  const session = await OtpSession.findOne({
    identifier: normId,
    purpose,
    consumed: false,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    return false;
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    await OtpSession.updateOne({ _id: session._id }, { consumed: true });
    return false;
  }

  const expectedHash = hashOtp(otp, session.otpSalt);
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const actualBuffer = Buffer.from(session.otpHash, "utf8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    // Wrong OTP: atomically increment attempts, invalidate at the limit.
    const updated = await OtpSession.findOneAndUpdate(
      { _id: session._id, consumed: false },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );
    if (updated && updated.attempts >= MAX_ATTEMPTS) {
      await OtpSession.updateOne({ _id: session._id }, { consumed: true });
    }
    return false;
  }

  // Correct OTP: atomically claim single-use consumption. Only one
  // concurrent request can transition consumed:false → true.
  const claimed = await OtpSession.findOneAndUpdate(
    { _id: session._id, consumed: false },
    { $set: { consumed: true } },
    { returnDocument: "after" }
  );

  return !!claimed;
}

export async function invalidateOtpSessions(identifier: string): Promise<void> {
  await OtpSession.updateMany(
    { identifier: identifier.toLowerCase().trim(), consumed: false },
    { consumed: true }
  );
}
