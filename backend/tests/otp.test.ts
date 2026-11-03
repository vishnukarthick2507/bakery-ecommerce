import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OtpSession } from "../src/models/OtpSession.js";
import { CustomerOtpProof } from "../src/models/CustomerOtpProof.js";
import { User } from "../src/models/User.js";
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

function setCookieValues(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function customerCookie(value: string | string[] | undefined): string | undefined {
  return setCookieValues(value)
    .find((cookie) => cookie.startsWith("customer-token="))
    ?.split(";")[0];
}

function registrationCookie(value: string | string[] | undefined): string | undefined {
  return setCookieValues(value)
    .find((cookie) => cookie.startsWith("otp-registration-token="))
    ?.split(";")[0];
}

function makeRegistrationCookie(
  phone: string,
  overrides: Record<string, unknown> = {},
  expiresIn = "10m",
): string {
  const token = jwt.sign(
    {
      phone,
      purpose: "REGISTRATION",
      accountType: "REGISTRATION",
      proofId: `proof-${phone}`,
      ...overrides,
    },
    process.env.JWT_SECRET!,
    { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] },
  );
  return `otp-registration-token=${token}`;
}

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
      await verifyOtp("user@example.com", "333333", "LOGIN");
      await verifyOtp("user@example.com", "444444", "LOGIN");

      // 5 wrong attempts should invalidate the session
      const blocked = await verifyOtp("user@example.com", "555555", "LOGIN");
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

  describe("Customer password authentication (integration)", () => {
    beforeAll(async () => {
      process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
    });

    async function registerCustomer(data: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }) {
      return request(app)
        .post("/api/auth/register")
        .send(data);
    }

    async function loginCustomer(email: string, password: string) {
      return request(app)
        .post("/api/auth/customer/login")
        .send({ email, password });
    }

    it("rejects password-based registration (disabled)", async () => {
      const res = await registerCustomer({
        name: "Alice",
        email: "alice@example.com",
        phone: "9840916058",
        password: "Password1",
      });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("disabled");
    });

    it("authenticates a customer with correct email and password", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Bob",
        email: "bob@example.com",
        phone: "9840916059",
        passwordHash: await bcrypt.hash("Secret22", 12),
        active: true,
      });
      const res = await loginCustomer("bob@example.com", "Secret22");
      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
      expect(setCookieValues(res.headers["set-cookie"]).some((cookie) => cookie.startsWith("customer-token="))).toBe(true);
      expect(res.body.user.email).toBe("bob@example.com");
    });

    it("rejects login with incorrect password", async () => {
      const { User } = await import("../src/models/User.js");
      await User.create({
        name: "Eve",
        email: "eve@example.com",
        phone: "9840916063",
        passwordHash: await bcrypt.hash("Correct77", 12),
        active: true,
      });
      const res = await loginCustomer("eve@example.com", "Wrong88");
      expect(res.status).toBe(401);
    });

    it("rejects duplicate email registration via password", async () => {
      await registerCustomer({
        name: "Carol",
        email: "carol@example.com",
        phone: "9840916060",
        password: "Password3",
      });
      const res = await registerCustomer({
        name: "Carol2",
        email: "carol@example.com",
        phone: "9840916061",
        password: "Password4",
      });
      expect(res.status).toBe(403);
    });

    it("rejects duplicate phone registration via password", async () => {
      await registerCustomer({
        name: "Dan",
        email: "dan@example.com",
        phone: "9840916062",
        password: "Password5",
      });
      const res = await registerCustomer({
        name: "Dan2",
        email: "dan2@example.com",
        phone: "9840916062",
        password: "Password6",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Customer phone OTP authentication (integration)", () => {
    beforeAll(async () => {
      process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
    });

    async function registerCustomer(data: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }) {
      return request(app).post("/api/auth/register").send(data);
    }

    async function sendOtpRequest(phone: string) {
      return request(app).post("/api/auth/otp/send").send({ phone, identifier: phone });
    }

    async function verifyOtpRequest(
      phone: string,
      otp: string,
    ) {
      return request(app)
        .post("/api/auth/otp/verify")
        .send({ phone, otp, identifier: phone });
    }

    let regCallCounter = 0;

    async function completeRegistrationRequest(
      name?: string,
      email?: string,
      cookie?: string,
      untrustedPhone?: string,
    ) {
      regCallCounter += 1;
      return request(app)
        .post("/api/auth/otp/register-complete")
        .set("Cookie", cookie || "")
        .send({
          ...(name !== undefined ? { name } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(untrustedPhone !== undefined ? { phone: untrustedPhone } : {}),
        });
    }

    it("sends an OTP and returns it in development mode", async () => {
      const res = await sendOtpRequest("9840916058");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("OTP sent successfully");
      expect(res.body.otp).toMatch(/^\d{6}$/);
    });

    it("normalizes +91 country code", async () => {
      const res = await sendOtpRequest("+919840916058");
      expect(res.status).toBe(200);
      expect(res.body.otp).toMatch(/^\d{6}$/);
    });

    it("normalizes phone with spaces and dashes", async () => {
      const res = await sendOtpRequest("+91 98409-16058");
      expect(res.status).toBe(200);
      expect(res.body.otp).toMatch(/^\d{6}$/);
    });

    it("rejects invalid phone format", async () => {
      const res = await sendOtpRequest("123");
      expect(res.status).toBe(400);
    });

    it("returns the same response and proof cookie for existing, new, and inactive phones", async () => {
      await User.create({
        name: "Existing User",
        email: "enumeration-existing@example.com",
        phone: "9840917101",
        active: true,
      });
      await User.create({
        name: "Inactive User",
        email: "enumeration-inactive@example.com",
        phone: "9840917102",
        active: false,
      });

      const verifiedResponses = [];
      for (const phone of ["9840917101", "9840917103", "9840917102"]) {
        const sendResponse = await sendOtpRequest(phone);
        expect(sendResponse.status).toBe(200);

        const response = await verifyOtpRequest(phone, sendResponse.body.otp);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: "OTP verified successfully" });
        expect(response.body.token).toBeUndefined();
        expect(response.body.user).toBeUndefined();
        expect(registrationCookie(response.headers["set-cookie"])).toMatch(/^otp-registration-token=/);
        expect(setCookieValues(response.headers["set-cookie"]).some((cookie) =>
          cookie.startsWith("customer-token="),
        )).toBe(false);
        verifiedResponses.push(response.body);
      }

      expect(verifiedResponses[0]).toEqual(verifiedResponses[1]);
      expect(verifiedResponses[1]).toEqual(verifiedResponses[2]);
    });

    it("sets the OTP proof cookie with production security attributes", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await OtpSession.create({
          identifier: "9840917104",
          otpHash: hashOtp("123456", "production-cookie-salt"),
          otpSalt: "production-cookie-salt",
          purpose: "AUTH",
          attempts: 0,
          consumed: false,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        const response = await verifyOtpRequest("9840917104", "123456");
        const proofCookie = setCookieValues(response.headers["set-cookie"])
          .find((cookie) => cookie.startsWith("otp-registration-token="));

        expect(response.status).toBe(200);
        expect(proofCookie).toMatch(/HttpOnly/i);
        expect(proofCookie).toMatch(/Secure/i);
        expect(proofCookie).toMatch(/SameSite=None/i);
        expect(response.body.token).toBeUndefined();
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("verifies OTP and logs in an existing customer, preserving their _id", async () => {
      const existingUser = await User.create({
        name: "Existing User",
        email: "existing@example.com",
        phone: "9840917058",
        active: true,
      });

      const sendRes = await sendOtpRequest("9840917058");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("9840917058", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual({ message: "OTP verified successfully" });
      const proofCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      expect(proofCookie).toMatch(/^otp-registration-token=/);
      expect(customerCookie(verifyRes.headers["set-cookie"])).toBeUndefined();

      const completion = await completeRegistrationRequest(
        "Changed Submitted Name",
        "changed-submitted@example.com",
        proofCookie,
      );
      expect(completion.status).toBe(200);
      expect(completion.body).toEqual({ message: "Authentication request processed" });
      expect(completion.body.token).toBeUndefined();
      const sessionCookie = customerCookie(completion.headers["set-cookie"]);
      expect(sessionCookie).toMatch(/^customer-token=/);
      expect(completion.status).toBe(200);
      expect(completion.body).toEqual({ message: "Authentication request processed" });

      const profile = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);
      expect(profile.status).toBe(200);
      expect(profile.body.user.id).toBe(existingUser._id.toString());
      expect(profile.body.user.name).toBe("Existing User");
      expect(profile.body.user.email).toBe("existing@example.com");

      const replay = await completeRegistrationRequest(
        "Replay Name",
        "replay@example.com",
        proofCookie,
      );
      expect(replay.status).toBe(401);
      expect(customerCookie(replay.headers["set-cookie"])).toBeUndefined();
    });

    it("does not allow two concurrent completions to consume the same proof", async () => {
      await User.create({
        name: "Concurrent User",
        email: "concurrent@example.com",
        phone: "9840917111",
        active: true,
      });
      const sent = await sendOtpRequest("9840917111");
      const verified = await verifyOtpRequest("9840917111", sent.body.otp);
      const proofCookie = registrationCookie(verified.headers["set-cookie"]);

      const responses = await Promise.all([
        completeRegistrationRequest("Concurrent Name", "concurrent@example.com", proofCookie),
        completeRegistrationRequest("Concurrent Name", "concurrent@example.com", proofCookie),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
      expect(responses.filter((response) => customerCookie(response.headers["set-cookie"]))).toHaveLength(1);
    });

    it("rejects malformed, expired, and wrong-purpose registration proof cookies", async () => {
      const malformed = await completeRegistrationRequest(
        undefined,
        undefined,
        "otp-registration-token=not-a-jwt",
      );
      expect(malformed.status).toBe(401);

      const expired = await completeRegistrationRequest(
        undefined,
        undefined,
        makeRegistrationCookie("9840917112", {}, "-1s"),
      );
      expect(expired.status).toBe(401);

      const wrongPurpose = await completeRegistrationRequest(
        undefined,
        undefined,
        makeRegistrationCookie("9840917113", { purpose: "LOGIN" }),
      );
      expect(wrongPurpose.status).toBe(401);
    });

    it("returns registration_required for a new customer after OTP verification", async () => {
      const sendRes = await sendOtpRequest("9840917059");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("9840917059", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual({ message: "OTP verified successfully" });
      expect(verifyRes.body.token).toBeUndefined();
      const proofCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      expect(proofCookie).toMatch(/^otp-registration-token=/);

      // Confirm no account was created yet
      const user = await User.findOne({ phone: "9840917059" });
      expect(user).toBeNull();

      const completion = await completeRegistrationRequest(
        undefined,
        undefined,
        proofCookie,
      );
      expect(completion.status).toBe(400);
      expect(completion.body.code).toBe("PROFILE_REQUIRED");
      const proofId = (jwt.decode(proofCookie!.split("=")[1]!) as { jti: string }).jti;
      expect(await CustomerOtpProof.exists({ proofId })).not.toBeNull();

      const completed = await completeRegistrationRequest(
        "New Customer",
        "new-customer@example.com",
        proofCookie,
      );
      expect(completed.status).toBe(200);
      expect(customerCookie(completed.headers["set-cookie"])).toMatch(/^customer-token=/);
    });

    it("requires profile fields before authenticating an existing customer without consuming proof", async () => {
      const existingUser = await User.create({
        name: "Saved Name",
        email: "saved-profile@example.com",
        phone: "9840917116",
        active: true,
      });
      const sent = await sendOtpRequest("9840917116");
      const verified = await verifyOtpRequest("9840917116", sent.body.otp);
      const proofCookie = registrationCookie(verified.headers["set-cookie"]);
      const proofId = (jwt.decode(proofCookie!.split("=")[1]!) as { jti: string }).jti;

      const missingProfile = await completeRegistrationRequest(undefined, undefined, proofCookie);
      expect(missingProfile.status).toBe(400);
      expect(missingProfile.body.code).toBe("PROFILE_REQUIRED");
      expect(await CustomerOtpProof.exists({ proofId })).not.toBeNull();

      const completion = await completeRegistrationRequest(
        "Attempted Overwrite",
        "attempted-overwrite@example.com",
        proofCookie,
      );
      expect(completion.status).toBe(200);
      const sessionCookie = customerCookie(completion.headers["set-cookie"]);
      const profile = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);
      expect(profile.body.user.id).toBe(existingUser._id.toString());
      expect(profile.body.user.name).toBe("Saved Name");
      expect(profile.body.user.email).toBe("saved-profile@example.com");
    });

    it("completes registration for a new customer after OTP verification", async () => {
      const sendRes = await sendOtpRequest("9840917060");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("9840917060", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual({ message: "OTP verified successfully" });

      // Complete registration with the registration token cookie from verify
      const regCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      const regRes = await completeRegistrationRequest("Priya", "priya@example.com", regCookie);
      expect(regRes.status).toBe(200);
      expect(regRes.body.token).toBeUndefined();
      const sessionCookie = customerCookie(regRes.headers["set-cookie"]);
      expect(sessionCookie).toMatch(/^customer-token=/);
      expect(regRes.body).toEqual({ message: "Authentication request processed" });

      // Confirm account was created
      const user = await User.findOne({ phone: "9840917060" });
      expect(user).not.toBeNull();
      expect(user?.name).toBe("Priya");
      expect(user?.email).toBe("priya@example.com");

      const profile = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);
      expect(profile.status).toBe(200);
      expect(profile.body.user.name).toBe("Priya");
      expect(profile.body.user.phone).toBe("9840917060");
    });

    it("returns the same completion status and body for existing and new phones", async () => {
      await User.create({
        name: "Existing Phone User",
        email: "same-completion-existing@example.com",
        phone: "9840917114",
        active: true,
      });

      const existingOtp = await sendOtpRequest("9840917114");
      const existingVerification = await verifyOtpRequest("9840917114", existingOtp.body.otp);
      const existingCompletion = await completeRegistrationRequest(
        "Ignored Name",
        "ignored@example.com",
        registrationCookie(existingVerification.headers["set-cookie"]),
      );

      const newOtp = await sendOtpRequest("9840917115");
      const newVerification = await verifyOtpRequest("9840917115", newOtp.body.otp);
      const newCompletion = await completeRegistrationRequest(
        "New Phone User",
        "same-completion-new@example.com",
        registrationCookie(newVerification.headers["set-cookie"]),
      );

      expect(existingCompletion.status).toBe(200);
      expect(newCompletion.status).toBe(existingCompletion.status);
      expect(newCompletion.body).toEqual(existingCompletion.body);
    });

    it("prevents duplicate phone accounts - existing customer is auto-logged in on re-verification", async () => {
      // Pre-register an existing customer directly in DB
      const existingUser = await User.create({
        name: "Alice",
        email: "alice@example.com",
        phone: "9840917061",
        active: true,
      });

      // Send OTP to Alice's phone (first OTP send)
      const sendRes1 = await sendOtpRequest("9840917061");
      expect(sendRes1.status).toBe(200);
      const otp1 = sendRes1.body.otp;

      // Verify OTP - should auto-login existing customer, not offer registration
      const verifyRes1 = await verifyOtpRequest("9840917061", otp1);
      expect(verifyRes1.status).toBe(200);
      expect(verifyRes1.body).toEqual({ message: "OTP verified successfully" });
      const proofCookie = registrationCookie(verifyRes1.headers["set-cookie"]);
      const completion = await completeRegistrationRequest(
        "Ignored Inactive Name",
        "ignored-inactive@example.com",
        proofCookie,
      );
      expect(completion.status).toBe(200);
      const sessionCookie = customerCookie(completion.headers["set-cookie"]);
      const profile = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);
      expect(profile.body.user.id).toBe(existingUser._id.toString());

      // Confirm no duplicate accounts were created
      const count = await User.countDocuments({ phone: "9840917061" });
      expect(count).toBe(1);
    });

    it("prevents duplicate email accounts via registration complete", async () => {
      // Register with email first
      const sendRes1 = await sendOtpRequest("9840917062");
      expect(sendRes1.status).toBe(200);
      const otp1 = sendRes1.body.otp;
      const verifyRes1 = await verifyOtpRequest("9840917062", otp1);
      expect(verifyRes1.status).toBe(200);
      const regCookie1 = registrationCookie(verifyRes1.headers["set-cookie"]);
      const successfulCompletion = await completeRegistrationRequest(
        "Alice",
        "alice@example.com",
        regCookie1,
      );
      expect(successfulCompletion.status).toBe(200);
      expect(successfulCompletion.body).toEqual({ message: "Authentication request processed" });

      // Try same email with different phone
      const sendRes2 = await sendOtpRequest("9840917063");
      expect(sendRes2.status).toBe(200);
      const otp2 = sendRes2.body.otp;
      const verifyRes2 = await verifyOtpRequest("9840917063", otp2);
      expect(verifyRes2.status).toBe(200);
      const regCookie2 = registrationCookie(verifyRes2.headers["set-cookie"]);
      const regRes = await completeRegistrationRequest("Bob", "alice@example.com", regCookie2);
      expect(regRes.status).toBe(successfulCompletion.status);
      expect(regRes.body).toEqual(successfulCompletion.body);
      expect(customerCookie(regRes.headers["set-cookie"])).toBeUndefined();
      expect(await User.findOne({ phone: "9840917063" })).toBeNull();
      expect(regRes.body.message).not.toContain("email");
      expect(regRes.body.message).not.toContain("phone");
      expect(customerCookie(regRes.headers["set-cookie"])).toBeUndefined();
    });

    it("rejects registration complete with missing registration token", async () => {
      const res = await completeRegistrationRequest("Priya", "priya@example.com");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired registration session. Please request OTP again.");
    });

    it("rejects LOGIN OTP for an inactive customer", async () => {
      await User.create({
        name: "Inactive User",
        email: "inactive@example.com",
        phone: "9840917075",
        active: false,
      });

      const sendRes = await sendOtpRequest("9840917075");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("9840917075", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual({ message: "OTP verified successfully" });
      expect(verifyRes.body.token).toBeUndefined();
      const proofCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      expect(proofCookie).toMatch(/^otp-registration-token=/);
      expect(customerCookie(verifyRes.headers["set-cookie"])).toBeUndefined();

      const completion = await completeRegistrationRequest(
        "Inactive Name",
        "inactive-completion@example.com",
        proofCookie,
      );
      expect(completion.status).toBe(200);
      expect(completion.body).toEqual({ message: "Authentication request processed" });
      expect(customerCookie(completion.headers["set-cookie"])).toBeUndefined();
    });

    it("returns registration_required for an unknown phone (no account created)", async () => {
      const sendRes = await sendOtpRequest("9840917070");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("9840917070", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual({ message: "OTP verified successfully" });
      expect(verifyRes.body.token).toBeUndefined();
      expect(registrationCookie(verifyRes.headers["set-cookie"])).toMatch(/^otp-registration-token=/);

      // Confirm no account was created
      const user = await User.findOne({ phone: "9840917070" });
      expect(user).toBeNull();
    });

    it("rejects an incorrect OTP", async () => {
      await sendOtpRequest("9840917061");
      const res = await verifyOtpRequest("9840917061", "000000");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });

    it("rejects an expired OTP", async () => {
      await OtpSession.create({
        identifier: "9840917062",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "AUTH",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await verifyOtpRequest("9840917062", "123456");
      expect(res.status).toBe(401);
    });

    it("invalidates the session after 5 incorrect attempts", async () => {
      await sendOtpRequest("9840917063");

      await verifyOtpRequest("9840917063", "000000");
      await verifyOtpRequest("9840917063", "111111");
      await verifyOtpRequest("9840917063", "222222");
      await verifyOtpRequest("9840917063", "333333");
      await verifyOtpRequest("9840917063", "444444");

      const blocked = await verifyOtpRequest("9840917063", "555555");
      expect(blocked.status).toBe(401);

      const session = await OtpSession.findOne({
        identifier: "9840917063",
        purpose: "AUTH",
      });
      expect(session?.consumed).toBe(true);
    });

    it("returns 502 in production mode when TWOFACTOR_API_KEY is missing, without creating an OTP session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalApiKey = process.env.TWOFACTOR_API_KEY;
      process.env.NODE_ENV = "production";
      delete process.env.TWOFACTOR_API_KEY;
      try {
        const res = await request(app)
          .post("/api/auth/otp/send")
          .send({ phone: "9840917080", identifier: "9840917080" });
        expect(res.status).toBe(502);
        expect(res.body.message).toContain("Unable to send OTP");

        // Confirm no OTP session was created
        const session = await OtpSession.findOne({ identifier: "9840917080" });
        expect(session).toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalApiKey === undefined) delete process.env.TWOFACTOR_API_KEY;
        else process.env.TWOFACTOR_API_KEY = originalApiKey;
      }
    });

    it("returns 200 in production mode when SMS is submitted successfully, without exposing the OTP, and creates a session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalApiKey = process.env.TWOFACTOR_API_KEY;
      process.env.NODE_ENV = "production";
      process.env.TWOFACTOR_API_KEY = "test-api-key";
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ Status: "Success" }), { status: 200 })
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      try {
        const res = await request(app)
          .post("/api/auth/otp/send")
          .send({ phone: "9840917081", identifier: "9840917081" });
        expect(res.status).toBe(200);
        expect(res.body.message).toContain("OTP sent successfully");
        expect(res.body.otp).toBeUndefined();

        // Confirm an OTP session was created and is unconsumed
        const session = await OtpSession.findOne({ identifier: "9840917081" });
        expect(session).not.toBeNull();
        expect(session?.consumed).toBe(false);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalApiKey === undefined) delete process.env.TWOFACTOR_API_KEY;
        else process.env.TWOFACTOR_API_KEY = originalApiKey;
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
      }
    });

    it("returns 502 in production mode when SMS submission fails, without creating an OTP session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalApiKey = process.env.TWOFACTOR_API_KEY;
      process.env.NODE_ENV = "production";
      process.env.TWOFACTOR_API_KEY = "test-api-key";
      const fetchMock = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));
      const originalFetch = globalThis.fetch;
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      try {
        const res = await request(app)
          .post("/api/auth/otp/send")
          .send({ phone: "9840917082", identifier: "9840917082" });
        expect(res.status).toBe(502);
        expect(res.body.message).toContain("Unable to send OTP");

        // Confirm no OTP session was created
        const session = await OtpSession.findOne({ identifier: "9840917082" });
        expect(session).toBeNull();

        const retry = await request(app)
          .post("/api/auth/otp/send")
          .send({ phone: "9840917082", identifier: "9840917082" });
        expect(retry.status).toBe(502);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(await OtpSession.findOne({ identifier: "9840917082", consumed: false })).toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalApiKey === undefined) delete process.env.TWOFACTOR_API_KEY;
        else process.env.TWOFACTOR_API_KEY = originalApiKey;
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
      }
    });

    // ---- OTP resend cooldown tests ----

    it("returns 429 with retryAfter when OTP sent within 60 seconds for same phone+purpose", async () => {
      // Create a recent OTP session (30 seconds ago)
      await OtpSession.create({
        identifier: "9840917090",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "GUEST_CHECKOUT",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      });

      const res = await request(app)
        .post("/api/auth/otp/send")
        .send({ phone: "9840917090", purpose: "GUEST_CHECKOUT" });

      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBeGreaterThan(0);
      expect(res.body.retryAfter).toBeLessThanOrEqual(60);
      expect(res.body.message).toContain("Please wait");

      // Confirm no new session was created
      const sessions = await OtpSession.find({ identifier: "9840917090" });
      expect(sessions).toHaveLength(1);
    });

    it("allows OTP send after 60 seconds cooldown for same phone+purpose", async () => {
      // Create an expired OTP session (70 seconds ago)
      await OtpSession.create({
        identifier: "9840917091",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "LOGIN",
        attempts: 0,
        consumed: true,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
        createdAt: new Date(Date.now() - 70 * 1000), // 70 seconds ago
      });

      const res = await request(app)
        .post("/api/auth/otp/send")
        .send({ phone: "9840917091", purpose: "LOGIN" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("OTP sent successfully");

      // Confirm a new session was created
      const sessions = await OtpSession.find({ identifier: "9840917091" });
      expect(sessions).toHaveLength(2);
    });

    it("serializes concurrent OTP sends for the same normalized phone and purpose", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalApiKey = process.env.TWOFACTOR_API_KEY;
      const originalFetch = globalThis.fetch;
      process.env.NODE_ENV = "production";
      process.env.TWOFACTOR_API_KEY = "test-api-key";

      let markFirstFetchStarted!: () => void;
      const firstFetchStarted = new Promise<void>((resolve) => {
        markFirstFetchStarted = resolve;
      });
      let releaseFirstFetch!: (response: Response) => void;
      const fetchMock = vi.fn(() => {
        if (fetchMock.mock.calls.length === 1) {
          markFirstFetchStarted();
          return new Promise<Response>((resolve) => {
            releaseFirstFetch = resolve;
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ Status: "Success" }), { status: 200 }),
        );
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      try {
        const firstRequest = sendOtpRequest("9840917096");
        await firstFetchStarted;

        const secondResponse = await sendOtpRequest("+91 98409 17096");
        expect(secondResponse.status).toBe(429);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        releaseFirstFetch(
          new Response(JSON.stringify({ Status: "Success" }), { status: 200 }),
        );
        const firstResponse = await firstRequest;
        expect(firstResponse.status).toBe(200);

        const activeSessions = await OtpSession.find({
          identifier: "9840917096",
          purpose: "AUTH",
          consumed: false,
        });
        expect(activeSessions).toHaveLength(1);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalApiKey === undefined) delete process.env.TWOFACTOR_API_KEY;
        else process.env.TWOFACTOR_API_KEY = originalApiKey;
        globalThis.fetch = originalFetch;
      }
    });

    it("rate-limits OTP sends across normalized phone formats", async () => {
      const phone = "9840917093";
      expect((await sendOtpRequest(phone)).status).toBe(200);
      expect((await sendOtpRequest("+91 98409 17093")).status).toBe(429);
      expect((await sendOtpRequest("91-98409-17093")).status).toBe(429);

      const limited = await sendOtpRequest(phone);
      expect(limited.status).toBe(429);
      expect(limited.body.message).toBe("Too many OTP requests. Please try again after 1 hour.");
    });

    it("rate-limits OTP verification attempts by normalized phone and IP", async () => {
      const phone = "9840917094";
      const sent = await sendOtpRequest(phone);
      const wrongOtp = sent.body.otp === "000000" ? "000001" : "000000";

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await verifyOtpRequest(
          attempt % 2 === 0 ? phone : `+91 ${phone}`,
          wrongOtp,
        );
        expect(response.status).toBe(401);
      }

      const limited = await verifyOtpRequest(phone, wrongOtp);
      expect(limited.status).toBe(429);
      expect(limited.body.message).toContain("Too many OTP verification attempts");
    });

    it("rate-limits registration completion using only the verified cookie phone", async () => {
      const verifiedPhone = "9840917095";
      const untrustedPhone = "9840917096";
      const sent = await sendOtpRequest(verifiedPhone);
      const verified = await verifyOtpRequest(verifiedPhone, sent.body.otp);
      const proofCookie = registrationCookie(verified.headers["set-cookie"]);
      expect(proofCookie).toMatch(/^otp-registration-token=/);

      for (let attempt = 0; attempt < 9; attempt += 1) {
        const response = await completeRegistrationRequest(
          undefined,
          undefined,
          proofCookie,
          untrustedPhone,
        );
        expect(response.status).toBe(400);
        expect(response.body.code).toBe("PROFILE_REQUIRED");
      }

      const limited = await completeRegistrationRequest(
        undefined,
        undefined,
        proofCookie,
        untrustedPhone,
      );
      expect(limited.status).toBe(429);

      const otherSent = await sendOtpRequest(untrustedPhone);
      const otherVerified = await verifyOtpRequest(untrustedPhone, otherSent.body.otp);
      const otherProof = registrationCookie(otherVerified.headers["set-cookie"]);
      const otherCompletion = await completeRegistrationRequest(
        undefined,
        undefined,
        otherProof,
      );
      expect(otherCompletion.status).toBe(400);
      expect(otherCompletion.body.code).toBe("PROFILE_REQUIRED");
    });
  });
});
