import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { OtpSession } from "../src/models/OtpSession.js";
import {
  createOtpSession,
  generateOtp,
  hashOtp,
  verifyOtp,
} from "../src/services/otpService.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

vi.mock("../src/services/emailService.js", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

const app = createAuthTestApp();

describe("OTP service", () => {
  beforeAll(async () => {
    process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-16-chars";
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe("generateOtp", () => {
    it("returns a 6-digit string including leading zeroes", () => {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(999999);
    });

    it("produces different values across calls", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i += 1) {
        seen.add(generateOtp());
      }
      // 100 random 6-digit OTPs should almost certainly not all be identical
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  describe("hashOtp", () => {
    it("is deterministic given the same inputs", () => {
      const h1 = hashOtp("123456", "salt123");
      const h2 = hashOtp("123456", "salt123");
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64); // SHA-256 hex digest
    });

    it("produces different hashes for different salts", () => {
      expect(hashOtp("123456", "saltA")).not.toBe(hashOtp("123456", "saltB"));
    });

    it("requires OTP_SECRET", () => {
      const original = process.env.OTP_SECRET;
      delete process.env.OTP_SECRET;
      expect(() => hashOtp("123456", "salt")).toThrow();
      process.env.OTP_SECRET = original;
    });
  });

  describe("createOtpSession and verifyOtp", () => {
    it("verifies a correct OTP and consumes it", async () => {
      const { otp } = await createOtpSession("user@example.com", "LOGIN");
      const valid = await verifyOtp("user@example.com", otp, "LOGIN");
      expect(valid).toBe(true);

      // Same OTP cannot be reused
      const reused = await verifyOtp("user@example.com", otp, "LOGIN");
      expect(reused).toBe(false);
    });

    it("rejects an incorrect OTP and increments attempts", async () => {
      await createOtpSession("user@example.com", "LOGIN");

      await verifyOtp("user@example.com", "000000", "LOGIN");
      await verifyOtp("user@example.com", "111111", "LOGIN");
      await verifyOtp("user@example.com", "222222", "LOGIN");

      // 3 wrong attempts should invalidate the session
      const blocked = await verifyOtp("user@example.com", "333333", "LOGIN");
      expect(blocked).toBe(false);

      // Session should be marked consumed
      const session = await OtpSession.findOne({
        identifier: "user@example.com",
        purpose: "LOGIN",
      });
      expect(session?.consumed).toBe(true);
    });

    it("rejects an expired OTP", async () => {
      await OtpSession.create({
        identifier: "user@example.com",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "LOGIN",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      const valid = await verifyOtp("user@example.com", "123456", "LOGIN");
      expect(valid).toBe(false);
    });

    it("allows only one concurrent verification to succeed", async () => {
      const { otp } = await createOtpSession("user@example.com", "LOGIN");

      // Fire 10 concurrent verification attempts with the same correct OTP
      const results = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => verifyOtp("user@example.com", otp, "LOGIN"))
      );

      const successes = results.filter((r) => r === true).length;
      expect(successes).toBe(1);
      const failures = results.filter((r) => r === false).length;
      expect(failures).toBe(9);
    });

    it("scopes sessions by identifier and purpose", async () => {
      const { otp: loginOtp } = await createOtpSession(
        "login@example.com",
        "LOGIN"
      );
      const { otp: registerOtp } = await createOtpSession(
        "register@example.com",
        "REGISTER"
      );

      // LOGIN OTP should not verify with REGISTER purpose
      expect(await verifyOtp("login@example.com", loginOtp, "REGISTER")).toBe(
        false
      );
      // REGISTER OTP should not verify with LOGIN purpose
      expect(await verifyOtp("register@example.com", registerOtp, "LOGIN")).toBe(
        false
      );

      // Each verifies with its own purpose
      expect(await verifyOtp("login@example.com", loginOtp, "LOGIN")).toBe(
        true
      );
    });
  });

  describe("User creation via OTP verify (integration)", () => {
    beforeAll(async () => {
      process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
    });

    async function registerWithOtp(
      identifier: string,
      purpose: "LOGIN" | "REGISTER" = "REGISTER"
    ) {
      const { otp } = await createOtpSession(identifier, purpose);
      return request(app)
        .post("/api/auth/auth/otp/verify")
        .send({ identifier, otp, purpose });
    }

    it("allows multiple phone-only registrations with distinct phone numbers", async () => {
      const r1 = await registerWithOtp("9840916058");
      expect(r1.status).toBe(200);
      expect(r1.body.user.email).toBeUndefined();
      expect(r1.body.user.phone).toBe("9840916058");

      const r2 = await registerWithOtp("9840916059");
      expect(r2.status).toBe(200);
      expect(r2.body.user.email).toBeUndefined();
      expect(r2.body.user.phone).toBe("9840916059");
    });

    it("allows multiple email-only registrations with distinct email addresses", async () => {
      const r1 = await registerWithOtp("alice@example.com");
      expect(r1.status).toBe(200);
      expect(r1.body.user.email).toBe("alice@example.com");
      expect(r1.body.user.phone).toBeUndefined();

      const r2 = await registerWithOtp("bob@example.com");
      expect(r2.status).toBe(200);
      expect(r2.body.user.email).toBe("bob@example.com");
      expect(r2.body.user.phone).toBeUndefined();
    });

    it("does not create a duplicate account for an existing email", async () => {
      const r1 = await registerWithOtp("alice@example.com");
      expect(r1.status).toBe(200);
      const userId = r1.body.user.id;

      const r2 = await registerWithOtp("alice@example.com");
      expect(r2.status).toBe(200);
      expect(r2.body.user.id).toBe(userId);
      expect(r2.body.user.email).toBe("alice@example.com");
    });

    it("does not create a duplicate account for an existing phone number", async () => {
      const r1 = await registerWithOtp("9840916058");
      expect(r1.status).toBe(200);
      const userId = r1.body.user.id;

      const r2 = await registerWithOtp("9840916058");
      expect(r2.status).toBe(200);
      expect(r2.body.user.id).toBe(userId);
      expect(r2.body.user.phone).toBe("9840916058");
    });
  });
});
