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
import { sendOtpEmail, isBrevoConfigured } from "../src/services/emailService.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createAuthTestApp } from "./authTestApp.js";

vi.mock("../src/services/emailService.js", () => ({
  sendOtpEmail: vi.fn(),
  isBrevoConfigured: vi.fn(() => true),
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
  email: string,
  overrides: Record<string, unknown> = {},
  expiresIn = "10m",
): string {
  const token = jwt.sign(
    {
      email,
      purpose: "REGISTRATION",
      accountType: "REGISTRATION",
      proofId: `proof-${email}`,
      ...overrides,
    },
    process.env.JWT_SECRET!,
    { expiresIn: expiresIn } as any,
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
    // By default, Brevo email delivery succeeds in tests. Individual tests
    // override this to simulate delivery failure.
    (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
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
      const { otp } = await createOtpSession("dev@example.com", "LOGIN");
      const valid = await verifyOtp("dev@example.com", otp, "LOGIN");
      expect(valid).toBe(true);

      const reused = await verifyOtp("dev@example.com", otp, "LOGIN");
      expect(reused).toBe(false);
    });

    it("rejects an incorrect OTP and increments attempts", async () => {
      await createOtpSession("dev@example.com", "LOGIN");

      // MAX_ATTEMPTS is 3: the first 3 wrong attempts are recorded, the 4th is blocked.
      await verifyOtp("dev@example.com", "000000", "LOGIN");
      await verifyOtp("dev@example.com", "111111", "LOGIN");
      await verifyOtp("dev@example.com", "222222", "LOGIN");

      const blocked = await verifyOtp("dev@example.com", "333333", "LOGIN");
      expect(blocked).toBe(false);

      const session = await OtpSession.findOne({
        identifier: "dev@example.com",
        purpose: "LOGIN",
      });
      expect(session?.consumed).toBe(true);
    });

    it("rejects an expired OTP", async () => {
      await OtpSession.create({
        identifier: "dev@example.com",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "LOGIN",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      const valid = await verifyOtp("dev@example.com", "123456", "LOGIN");
      expect(valid).toBe(false);
    });

    it("allows only one concurrent verification to succeed", async () => {
      const { otp } = await createOtpSession("dev@example.com", "LOGIN");

      const results = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => verifyOtp("dev@example.com", otp, "LOGIN")),
      );

      const successes = results.filter((r) => r === true).length;
      expect(successes).toBe(1);
      const failures = results.filter((r) => r === false).length;
      expect(failures).toBe(9);
    });

    it("scopes sessions by identifier and purpose", async () => {
      const { otp: loginOtp } = await createOtpSession("login@example.com", "LOGIN");
      const { otp: registerOtp } = await createOtpSession("register@example.com", "REGISTER");

      expect(await verifyOtp("login@example.com", loginOtp, "REGISTER")).toBe(false);
      expect(await verifyOtp("register@example.com", registerOtp, "LOGIN")).toBe(false);
      expect(await verifyOtp("login@example.com", loginOtp, "LOGIN")).toBe(true);
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
      return request(app).post("/api/auth/register").send(data);
    }

    async function loginCustomer(email: string, password: string) {
      return request(app).post("/api/auth/customer/login").send({ email, password });
    }

    it("registers a new customer with email/password", async () => {
      const res = await registerCustomer({
        name: "Alice",
        email: "alice@example.com",
        phone: "9840916058",
        password: "Password1",
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("verification code");
    });

    it("authenticates a customer with correct email and password", async () => {
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
      expect(res.status).toBe(200);
      expect(res.body.message.toLowerCase()).toContain("already exist");
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
      expect(res.status).toBe(200);
      expect(res.body.message.toLowerCase()).toContain("does not already exist");
    });
  });

  describe("Customer email OTP authentication (integration)", () => {
    beforeAll(async () => {
      process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
    });

    async function sendOtpRequest(email: string) {
      return request(app).post("/api/auth/otp/send").send({ email, identifier: email });
    }

    async function verifyOtpRequest(email: string, otp: string) {
      return request(app)
        .post("/api/auth/otp/verify")
        .send({ email, otp, identifier: email });
    }

    async function completeRegistrationRequest(
      name?: string,
      email?: string,
      cookie?: string,
    ) {
      return request(app)
        .post("/api/auth/otp/register-complete")
        .set("Cookie", cookie || "")
        .send({
          ...(name !== undefined ? { name } : {}),
          ...(email !== undefined ? { email } : {}),
        });
    }

    it("sends an OTP and returns it in development mode", async () => {
      const res = await sendOtpRequest("otp-dev@example.com");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("OTP sent successfully");
      expect(res.body.otp).toMatch(/^\d{6}$/);
    });

    it("rejects an invalid email address", async () => {
      const res = await sendOtpRequest("not-an-email");
      expect(res.status).toBe(400);
    });

    it("does not expose the OTP in production mode and creates a session when email is sent", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const res = await sendOtpRequest("otp-prod@example.com");
        expect(res.status).toBe(200);
        expect(res.body.message).toContain("OTP sent successfully");
        expect(res.body.otp).toBeUndefined();

        expect(sendOtpEmail).toHaveBeenCalledTimes(1);
        const call = (sendOtpEmail as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect(call[0]).toBe("otp-prod@example.com");
        expect(call[1]).toMatch(/^\d{6}$/);
        expect(call[2]).toBe("AUTH");

        const session = await OtpSession.findOne({ identifier: "otp-prod@example.com" });
        expect(session).not.toBeNull();
        expect(session?.consumed).toBe(false);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("returns 502 in production mode when email delivery fails, without creating an OTP session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      try {
        const res = await sendOtpRequest("otp-fail@example.com");
        expect(res.status).toBe(502);
        expect(res.body.message).toContain("Unable to send OTP");
        expect(res.body.code).toBe("EMAIL_DELIVERY_FAILED");

        const session = await OtpSession.findOne({ identifier: "otp-fail@example.com" });
        expect(session).toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      }
    });

    it("returns 503 in production mode when Brevo API is not configured, without creating an OTP session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
      try {
        const res = await sendOtpRequest("otp-config@example.com");
        expect(res.status).toBe(503);
        expect(res.body.message).toContain("Email service is not configured");
        expect(res.body.code).toBe("EMAIL_CONFIG_MISSING");

        // Confirm no OTP session was created
        const session = await OtpSession.findOne({ identifier: "otp-config@example.com" });
        expect(session).toBeNull();
        // Confirm sendOtpEmail was never called
        expect(sendOtpEmail).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        (isBrevoConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      }
    });

    it("returns 500 in production mode when Brevo email throws, without creating an OTP session", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      (sendOtpEmail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("SMTP failure"));
      try {
        const res = await sendOtpRequest("otp-throw@example.com");
        // An unexpected provider exception is a server error (500), fail closed.
        expect(res.status).toBe(500);
        expect(res.body.message).toContain("Unable to send OTP");

        const session = await OtpSession.findOne({ identifier: "otp-throw@example.com" });
        expect(session).toBeNull();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        (sendOtpEmail as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      }
    });

    it("returns the same response and proof cookie for existing, new, and inactive emails", async () => {
      await User.create({
        name: "Existing User",
        email: "enum-existing@example.com",
        phone: "9840917101",
        active: true,
      });
      await User.create({
        name: "Inactive User",
        email: "enum-inactive@example.com",
        phone: "9840917102",
        active: false,
      });

      const verifiedResponses = [];
      for (const email of [
        "enum-existing@example.com",
        "enum-new@example.com",
        "enum-inactive@example.com",
      ]) {
        const sendResponse = await sendOtpRequest(email);
        expect(sendResponse.status).toBe(200);

        const response = await verifyOtpRequest(email, sendResponse.body.otp);
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
          identifier: "cookie@example.com",
          otpHash: hashOtp("123456", "production-cookie-salt"),
          otpSalt: "production-cookie-salt",
          purpose: "AUTH",
          attempts: 0,
          consumed: false,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        const response = await verifyOtpRequest("cookie@example.com", "123456");
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

      const sendRes = await sendOtpRequest("existing@example.com");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("existing@example.com", otp);
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
      const sent = await sendOtpRequest("concurrent@example.com");
      const verified = await verifyOtpRequest("concurrent@example.com", sent.body.otp);
      const proofCookie = registrationCookie(verified.headers["set-cookie"]);

      const responses = await Promise.all([
        completeRegistrationRequest("Concurrent Name", "concurrent@example.com", proofCookie),
        completeRegistrationRequest("Concurrent Name", "concurrent@example.com", proofCookie),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
      expect(responses.filter((response) => customerCookie(response.headers["set-cookie"]))).toHaveLength(1);
    });

    it("returns registration_required for a new customer after OTP verification", async () => {
      const sendRes = await sendOtpRequest("new-customer@example.com");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("new-customer@example.com", otp);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeUndefined();
      const proofCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      expect(proofCookie).toMatch(/^otp-registration-token=/);

      const user = await User.findOne({ email: "new-customer@example.com" });
      expect(user).toBeNull();

      const completion = await completeRegistrationRequest(undefined, undefined, proofCookie);
      expect(completion.status).toBe(400);
      expect(completion.body.code).toBe("PROFILE_REQUIRED");

      const completed = await completeRegistrationRequest(
        "New Customer",
        "new-customer@example.com",
        proofCookie,
      );
      expect(completed.status).toBe(200);
      expect(customerCookie(completed.headers["set-cookie"])).toMatch(/^customer-token=/);

      const createdUser = await User.findOne({ email: "new-customer@example.com" });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.name).toBe("New Customer");
    });

    it("requires profile fields before authenticating an existing customer without consuming proof", async () => {
      const existingUser = await User.create({
        name: "Saved Name",
        email: "saved-profile@example.com",
        phone: "9840917116",
        active: true,
      });
      const sent = await sendOtpRequest("saved-profile@example.com");
      const verified = await verifyOtpRequest("saved-profile@example.com", sent.body.otp);
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
      const sendRes = await sendOtpRequest("priya@example.com");
      expect(sendRes.status).toBe(200);
      const otp = sendRes.body.otp;

      const verifyRes = await verifyOtpRequest("priya@example.com", otp);
      expect(verifyRes.status).toBe(200);

      const regCookie = registrationCookie(verifyRes.headers["set-cookie"]);
      const regRes = await completeRegistrationRequest("Priya", "priya@example.com", regCookie);
      expect(regRes.status).toBe(200);
      expect(regRes.body.token).toBeUndefined();
      const sessionCookie = customerCookie(regRes.headers["set-cookie"]);
      expect(sessionCookie).toMatch(/^customer-token=/);
      expect(regRes.body).toEqual({ message: "Authentication request processed" });

      const user = await User.findOne({ email: "priya@example.com" });
      expect(user).not.toBeNull();
      expect(user?.name).toBe("Priya");
      expect(user?.email).toBe("priya@example.com");
    });

    it("returns the same completion status and body for existing and new emails", async () => {
      await User.create({
        name: "Existing Email User",
        email: "same-existing@example.com",
        phone: "9840917114",
        active: true,
      });

      const existingOtp = await sendOtpRequest("same-existing@example.com");
      const existingVerification = await verifyOtpRequest("same-existing@example.com", existingOtp.body.otp);
      const existingCompletion = await completeRegistrationRequest(
        "Ignored Name",
        "ignored@example.com",
        registrationCookie(existingVerification.headers["set-cookie"]),
      );

      const newOtp = await sendOtpRequest("same-new@example.com");
      const newVerification = await verifyOtpRequest("same-new@example.com", newOtp.body.otp);
      const newCompletion = await completeRegistrationRequest(
        "New Email User",
        "same-new@example.com",
        registrationCookie(newVerification.headers["set-cookie"]),
      );

      expect(existingCompletion.status).toBe(200);
      expect(newCompletion.status).toBe(existingCompletion.status);
      expect(newCompletion.body).toEqual(existingCompletion.body);
    });

    it("prevents duplicate email accounts - existing customer is auto-logged in on re-verification", async () => {
      const existingUser = await User.create({
        name: "Alice",
        email: "alice-auto@example.com",
        phone: "9840917061",
        active: true,
      });

      const sendRes1 = await sendOtpRequest("alice-auto@example.com");
      expect(sendRes1.status).toBe(200);
      const otp1 = sendRes1.body.otp;

      const verifyRes1 = await verifyOtpRequest("alice-auto@example.com", otp1);
      expect(verifyRes1.status).toBe(200);
      const proofCookie = registrationCookie(verifyRes1.headers["set-cookie"]);
      const completion = await completeRegistrationRequest(
        "Ignored Name",
        "ignored@example.com",
        proofCookie,
      );
      expect(completion.status).toBe(200);
      const sessionCookie = customerCookie(completion.headers["set-cookie"]);
      const profile = await request(app)
        .get("/api/auth/me")
        .set("Cookie", sessionCookie!);
      expect(profile.body.user.id).toBe(existingUser._id.toString());

      const count = await User.countDocuments({ email: "alice-auto@example.com" });
      expect(count).toBe(1);
    });

    it("prevents duplicate email accounts via registration complete", async () => {
      // Alice registers with alice-dup@example.com
      const sendRes1 = await sendOtpRequest("alice-dup@example.com");
      expect(sendRes1.status).toBe(200);
      const otp1 = sendRes1.body.otp;
      const verifyRes1 = await verifyOtpRequest("alice-dup@example.com", otp1);
      expect(verifyRes1.status).toBe(200);
      const regCookie1 = registrationCookie(verifyRes1.headers["set-cookie"]);
      const successfulCompletion = await completeRegistrationRequest(
        "Alice",
        "alice-dup@example.com",
        regCookie1,
      );
      expect(successfulCompletion.status).toBe(200);
      const aliceCookie = customerCookie(successfulCompletion.headers["set-cookie"]);
      expect(aliceCookie).toMatch(/^customer-token=/);
      const aliceUser = await User.findOne({ email: "alice-dup@example.com" });
      expect(aliceUser).not.toBeNull();
      expect(aliceUser?.name).toBe("Alice");

      // Re-verifying the same email auto-logs into Alice's existing account
      // instead of creating a duplicate account.
      const regRes = await completeRegistrationRequest(
        "Different Name",
        "alice-dup@example.com",
        regCookie1,
      );
      expect(regRes.status).toBe(401); // proof already consumed

      // No duplicate account was created for alice-dup@example.com.
      const count = await User.countDocuments({ email: "alice-dup@example.com" });
      expect(count).toBe(1);
    });

    it("rejects registration complete with missing registration token", async () => {
      const res = await completeRegistrationRequest("Priya", "priya@example.com");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired registration session. Please request OTP again.");
    });

    it("rejects an incorrect OTP", async () => {
      await sendOtpRequest("incorrect@example.com");
      const res = await verifyOtpRequest("incorrect@example.com", "000000");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });

    it("rejects an expired OTP", async () => {
      await OtpSession.create({
        identifier: "expired@example.com",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "AUTH",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await verifyOtpRequest("expired@example.com", "123456");
      expect(res.status).toBe(401);
    });

    it("invalidates the session after 3 incorrect attempts", async () => {
      await sendOtpRequest("attempts@example.com");

      // MAX_ATTEMPTS is 3: the first 3 wrong attempts invalidate the session.
      await verifyOtpRequest("attempts@example.com", "000000");
      await verifyOtpRequest("attempts@example.com", "111111");
      await verifyOtpRequest("attempts@example.com", "222222");

      const blocked = await verifyOtpRequest("attempts@example.com", "333333");
      expect(blocked.status).toBe(401);

      const session = await OtpSession.findOne({
        identifier: "attempts@example.com",
        purpose: "AUTH",
      });
      expect(session?.consumed).toBe(true);
    });

    // ---- OTP resend cooldown tests ----

    it("returns 429 with retryAfter when OTP sent within 60 seconds for same email+purpose", async () => {
      await OtpSession.create({
        identifier: "cooldown@example.com",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "GUEST_CHECKOUT",
        attempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 1000),
      });

      const res = await request(app)
        .post("/api/auth/otp/send")
        .send({ email: "cooldown@example.com", purpose: "GUEST_CHECKOUT" });

      expect(res.status).toBe(429);
      expect(res.body.retryAfter).toBeGreaterThan(0);
      expect(res.body.retryAfter).toBeLessThanOrEqual(60);
      expect(res.body.message).toContain("Please wait");

      const sessions = await OtpSession.find({ identifier: "cooldown@example.com" });
      expect(sessions).toHaveLength(1);
    });

    it("allows OTP send after 60 seconds cooldown for same email+purpose", async () => {
      await OtpSession.create({
        identifier: "cooldown2@example.com",
        otpHash: hashOtp("123456", "salt"),
        otpSalt: "salt",
        purpose: "LOGIN",
        attempts: 0,
        consumed: true,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
        createdAt: new Date(Date.now() - 70 * 1000),
      });

      const res = await request(app)
        .post("/api/auth/otp/send")
        .send({ email: "cooldown2@example.com", purpose: "LOGIN" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("OTP sent successfully");

      const sessions = await OtpSession.find({ identifier: "cooldown2@example.com" });
      expect(sessions).toHaveLength(2);
    });

    it("rate-limits OTP sends across email formats", async () => {
      const email = "sendratelimit@example.com";
      // The first send for a fresh email should not be blocked.
      const first = await sendOtpRequest(email);
      expect(first.status).toBe(200);

      // Repeated sends for the same email eventually hit the 3-per-hour limit.
      // Use different purposes so the 60-second per-purpose cooldown does not
      // trigger before the email/IP rate limiter.
      const purposes = ["LOGIN", "REGISTER", "AUTH", "GUEST_CHECKOUT"];
      let limited = false;
      for (const purpose of purposes) {
        const response = await request(app)
          .post("/api/auth/otp/send")
          .send({ email, purpose });
        if (response.status === 429) {
          limited = true;
          expect(response.body.message).toBe("Too many OTP requests. Please try again after 1 hour.");
          break;
        }
        expect(response.status).toBe(200);
      }
      expect(limited).toBe(true);
    });

    it("rate-limits OTP verification attempts by email and IP", async () => {
      const email = "verifyratelimit@example.com";
      const sent = await sendOtpRequest(email);
      const wrongOtp = sent.body.otp === "000000" ? "000001" : "000000";

      // Repeated wrong verifications eventually hit the 10-per-15-minutes limit.
      let limited = false;
      for (let i = 0; i < 14; i += 1) {
        const response = await verifyOtpRequest(email, wrongOtp);
        if (response.status === 429) {
          limited = true;
          expect(response.body.message).toContain("Too many OTP verification attempts");
          break;
        }
        expect(response.status).toBe(401);
      }
      expect(limited).toBe(true);
    });
  });
});
