import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import crypto from "node:crypto";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-s07-idempotency";

import customCakeRoutes from "../src/routes/customCakeRoutes.js";
import { csrfProtection } from "../src/middleware/csrf.js";
import { connectTestDB, clearTestDB, disconnectTestDB } from "./testDatabase.js";
import { createCustomCakeRequestLimiter } from "../src/middleware/rateLimit.js";
import { ipKeyGenerator } from "express-rate-limit";
import { CustomCakeRequest } from "../src/models/CustomCakeRequest.js";
import { CustomCakeSubmissionIdempotency } from "../src/models/CustomCakeSubmissionIdempotency.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";

function createTestApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/custom-cake-requests", customCakeRoutes);
  return app;
}

const app = createTestApp();

async function resetLimiterKeys() {
  const keys = ["127.0.0.1", "::ffff:127.0.0.1", "::1", "unknown"];
  for (const key of keys) {
    await createCustomCakeRequestLimiter.resetKey(ipKeyGenerator(key) ?? key);
    await createCustomCakeRequestLimiter.resetKey(key);
  }
}

const validPayload = {
  name: "Test Customer",
  phone: "9876543210",
  flavour: "Chocolate",
  weight: "1 kg",
  theme: "Birthday",
  messageOnCake: "Happy Birthday",
  instructions: "No nuts",
  referenceImageUrl: "",
  whatsappConsent: false,
};

function postCustomCake(payload: Record<string, unknown> = validPayload, headers: Record<string, string> = {}) {
  let req = request(app)
    .post("/api/custom-cake-requests")
    .set("Origin", "http://localhost:3000");
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return req.send(payload);
}

describe("S07 custom cake abuse protection", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await resetLimiterKeys();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe("Honeypot", () => {
    it("allows normal anonymous submission without honeypot field", async () => {
      const res = await postCustomCake(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.request.referenceNumber).toBeTruthy();
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
    });

    it("allows submission with empty honeypot", async () => {
      const res = await postCustomCake({ ...validPayload, companyWebsite: "" });
      expect(res.status).toBe(201);
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
    });

    it("rejects filled honeypot with generic 400 and no side effects", async () => {
      const res = await postCustomCake({ ...validPayload, companyWebsite: "https://spam.example" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Please check the form and try again" });
      expect(await CustomCakeRequest.countDocuments()).toBe(0);
      expect(await WhatsAppConsent.countDocuments()).toBe(0);
    });

    it("handles malformed honeypot values safely", async () => {
      const res = await postCustomCake({ ...validPayload, companyWebsite: ["spam"] as any });
      expect(res.status).toBe(400);
      expect(await CustomCakeRequest.countDocuments()).toBe(0);
    });
  });

  describe("Idempotency", () => {
    it("missing idempotency key remains backward-compatible", async () => {
      const res = await postCustomCake(validPayload);
      expect(res.status).toBe(201);
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
    });

    it("same key + same payload replays original response without duplicate or repeated consent", async () => {
      const payload = { ...validPayload, whatsappConsent: true };
      const key = "idem-same-payload-0001";

      const first = await postCustomCake(payload, { "Idempotency-Key": key });
      expect(first.status).toBe(201);
      const second = await postCustomCake(payload, { "Idempotency-Key": key });
      expect(second.status).toBe(201);
      expect(second.body.request.referenceNumber).toBe(first.body.request.referenceNumber);
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
      expect(await WhatsAppConsent.countDocuments()).toBe(1);

      const idem = await CustomCakeSubmissionIdempotency.findOne({ idempotencyKey: key }).lean();
      expect(idem?.status).toBe("COMPLETED");
      expect(idem?.requestFingerprint).toBeTruthy();
      // No raw PII stored in response snapshot.
      expect(JSON.stringify(idem?.responseBody ?? {})).not.toContain(payload.phone);
      expect(JSON.stringify(idem?.responseBody ?? {})).not.toContain(payload.name);
    });

    it("same key + different payload returns 409 conflict", async () => {
      const key = "idem-diff-payload-0001";
      const first = await postCustomCake(validPayload, { "Idempotency-Key": key });
      expect(first.status).toBe(201);
      const second = await postCustomCake({ ...validPayload, theme: "Different theme" }, { "Idempotency-Key": key });
      expect(second.status).toBe(409);
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
    });

    it("concurrent same-key same-payload submissions create exactly one request", async () => {
      const key = "idem-concurrent-000001";
      const [a, b] = await Promise.all([
        postCustomCake(validPayload, { "Idempotency-Key": key }),
        postCustomCake(validPayload, { "Idempotency-Key": key }),
      ]);
      const statuses = [a.status, b.status].sort((x, y) => x - y);
      // One must succeed; the other may replay 201 or return in-progress 409.
      expect(statuses[0]).toBe(201);
      expect([201, 409]).toContain(statuses[1]);
      expect(await CustomCakeRequest.countDocuments()).toBe(1);
    });

    it("in-progress duplicate returns 409 retry message", async () => {
      const key = "idem-inprogress-00001";
      const normalized = {
        name: validPayload.name.trim(),
        phone: validPayload.phone.trim(),
        flavour: validPayload.flavour.trim(),
        weight: validPayload.weight.trim().toLowerCase().replace(/\s+/g, " "),
        theme: validPayload.theme.trim(),
        messageOnCake: (validPayload.messageOnCake ?? "").trim(),
        instructions: (validPayload.instructions ?? "").trim(),
        referenceImageUrl: (validPayload.referenceImageUrl ?? "").trim(),
        whatsappConsent: Boolean(validPayload.whatsappConsent),
      };
      const requestFingerprint = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(JSON.stringify(normalized)).digest("hex");
      await CustomCakeSubmissionIdempotency.create({
        idempotencyKey: key,
        requestFingerprint,
        status: "IN_PROGRESS",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const res = await postCustomCake(validPayload, { "Idempotency-Key": key });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already being processed");
      expect(await CustomCakeRequest.countDocuments()).toBe(0);
    });

    it("expired key becomes reusable", async () => {
      const key = "idem-expired-00000001";
      const fingerprint = "stale";
      await CustomCakeSubmissionIdempotency.create({
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        status: "COMPLETED",
        responseStatus: 201,
        responseBody: { message: "old", request: { id: "x", referenceNumber: "OLD", status: "PENDING" } },
        expiresAt: new Date(Date.now() - 1000),
      });
      const res = await postCustomCake(validPayload, { "Idempotency-Key": key });
      expect(res.status).toBe(201);
      expect(res.body.request.referenceNumber).not.toBe("OLD");
    });

    it("storage failure returns generic 503 and does not create request", async () => {
      const spy = vi.spyOn(CustomCakeSubmissionIdempotency, "create").mockRejectedValueOnce(new Error("db down"));
      const res = await postCustomCake(validPayload, { "Idempotency-Key": "idem-db-fail-0000001" });
      expect(res.status).toBe(503);
      expect(res.body.message).toContain("Unable to submit");
      expect(await CustomCakeRequest.countDocuments()).toBe(0);
      spy.mockRestore();
    });

    it("invalid idempotency key format is rejected generically", async () => {
      const res = await postCustomCake(validPayload, { "Idempotency-Key": "bad key!" });
      expect(res.status).toBe(400);
      expect(await CustomCakeRequest.countDocuments()).toBe(0);
    });

    it("recovers safely when request was created but idempotency completion was lost", async () => {
      const key = "idem-recover-00000001";
      const normalized = {
        name: validPayload.name.trim(),
        phone: validPayload.phone.trim(),
        flavour: validPayload.flavour.trim(),
        weight: validPayload.weight.trim().toLowerCase().replace(/\s+/g, " "),
        theme: validPayload.theme.trim(),
        messageOnCake: (validPayload.messageOnCake ?? "").trim(),
        instructions: (validPayload.instructions ?? "").trim(),
        referenceImageUrl: (validPayload.referenceImageUrl ?? "").trim(),
        whatsappConsent: Boolean(validPayload.whatsappConsent),
      };
      const requestFingerprint = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(JSON.stringify(normalized)).digest("hex");
      const requestDoc = await CustomCakeRequest.create({
        ...validPayload,
        referenceNumber: "CCR-RECOVER1",
      });
      await CustomCakeSubmissionIdempotency.create({
        idempotencyKey: key,
        requestFingerprint,
        status: "IN_PROGRESS",
        createdRequestId: requestDoc._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await postCustomCake(validPayload, { "Idempotency-Key": key });
      expect(res.status).toBe(201);
      expect(res.body.request.referenceNumber).toBe("CCR-RECOVER1");
      expect(await CustomCakeRequest.countDocuments()).toBe(1);

      const idem = await CustomCakeSubmissionIdempotency.findOne({ idempotencyKey: key }).lean();
      expect(idem?.status).toBe("COMPLETED");
      expect(idem?.responseBody?.request?.referenceNumber).toBe("CCR-RECOVER1");
    });
  });
});
