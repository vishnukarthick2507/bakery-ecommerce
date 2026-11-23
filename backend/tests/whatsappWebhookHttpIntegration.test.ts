import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import whatsappRoutes from "../src/routes/whatsappRoutes.js";
import whatsappWebhookRoutes from "../src/routes/whatsappWebhookRoutes.js";
import { csrfProtection } from "../src/middleware/csrf.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";
import { getTrustedOrigins, normalizeOrigin } from "../src/lib/origin.js";

// Isolate DB/external side effects while keeping real middleware, routing,
// controller logic, and signature/raw-body parsing intact.
vi.mock("../src/models/WhatsAppWebhookEvent.js", () => ({
  WhatsAppWebhookEvent: {
    findOne: vi.fn(() => ({ lean: vi.fn(async () => null) })),
    create: vi.fn(async () => ({})),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  },
}));

vi.mock("../src/models/WhatsAppMessage.js", () => ({
  WhatsAppMessage: {
    create: vi.fn(async () => ({})),
    findOne: vi.fn(() => ({ lean: vi.fn(async () => null) })),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  },
}));

vi.mock("../src/models/Order.js", () => ({
  Order: {
    findOne: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn(async () => null) })),
      lean: vi.fn(async () => null),
    })),
  },
}));

vi.mock("../src/services/whatsappConsentService.js", async () => {
  const actual = await vi.importActual<typeof import("../src/services/whatsappConsentService.js")>(
    "../src/services/whatsappConsentService.js",
  );
  return {
    ...actual,
    withdrawAllConsent: vi.fn(async (input: { phone: string }) => ({
      phone: input.phone,
      transactional: { withdrawn: false, wasConsented: false, phone: input.phone, category: "TRANSACTIONAL" },
      marketing: { withdrawn: false, wasConsented: false, phone: input.phone, category: "MARKETING" },
    })),
  };
});

import { WhatsAppWebhookEvent } from "../src/models/WhatsAppWebhookEvent.js";
import { WhatsAppMessage } from "../src/models/WhatsAppMessage.js";
import { Order } from "../src/models/Order.js";
import { withdrawAllConsent } from "../src/services/whatsappConsentService.js";
import { verifyWebhookSignature } from "../src/controllers/whatsappWebhookController.js";

const TEST_APP_SECRET = "test-whatsapp-app-secret";
const TEST_VERIFY_TOKEN = "test-whatsapp-verify-token";
const ORIGINAL_ENV = { ...process.env };

function computeSignature(payload: Buffer | string, secret: string): string {
  // Mirror controller verification behavior: it HMACs the UTF-8 string representation
  // of the raw body (Buffer.toString("utf8") / String(...)).
  const data = Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
  return `sha256=${crypto.createHmac("sha256", secret).update(data).digest("hex")}`;
}

function createWebhookTestApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);

  // Reconstructed webhook-relevant middleware sequence from backend/src/server.ts
  // (without importing server.ts bootstrap/listener/db/workers/process handlers).
  app.use(helmet());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(csrfProtection);

  const corsOriginList = getTrustedOrigins();
  app.use(
    cors({
      origin: (
        _origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!_origin) {
          return callback(null, true);
        }
        const normalizedOrigin = normalizeOrigin(_origin);
        if (normalizedOrigin && corsOriginList.includes(normalizedOrigin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  // Real raw-body parser for WhatsApp webhook before global JSON parser.
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());

  // Actual WhatsApp route mounts in server order.
  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/whatsapp", whatsappWebhookRoutes);

  return app;
}

function resetDbMocks(): void {
  vi.mocked(WhatsAppWebhookEvent.findOne).mockImplementation(
    () => ({ lean: vi.fn(async () => null) }) as never,
  );
  vi.mocked(WhatsAppWebhookEvent.create).mockResolvedValue({} as never);
  vi.mocked(WhatsAppWebhookEvent.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);

  vi.mocked(WhatsAppMessage.create).mockResolvedValue({} as never);
  vi.mocked(WhatsAppMessage.findOne).mockImplementation(
    () => ({ lean: vi.fn(async () => null) }) as never,
  );
  vi.mocked(WhatsAppMessage.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);

  vi.mocked(Order.findOne).mockImplementation(
    () =>
      ({
        sort: vi.fn(() => ({ lean: vi.fn(async () => null) })),
        lean: vi.fn(async () => null),
      }) as never,
  );

  vi.mocked(withdrawAllConsent).mockResolvedValue({
    phone: "919000000000",
    transactional: { withdrawn: false, wasConsented: false, phone: "919000000000", category: "TRANSACTIONAL" },
    marketing: { withdrawn: false, wasConsented: false, phone: "919000000000", category: "MARKETING" },
  } as never);
}

function postRaw(
  app: express.Express,
  path: string,
  rawBody: Buffer | string,
  headers: Record<string, string> = {},
) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  let req = request(app).post(path);
  for (const [k, v] of Object.entries(headers)) {
    req = req.set(k, v);
  }
  // superagent/supertest may JSON-serialize Buffer objects when content-type is application/json.
  // Send as utf8 string to preserve exact signed bytes for JSON payloads in this test.
  const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    return req.send(body.toString("utf8"));
  }
  return req.send(body);
}

function dbProcessingInvoked(): boolean {
  return (
    vi.mocked(WhatsAppWebhookEvent.findOne).mock.calls.length > 0 ||
    vi.mocked(WhatsAppWebhookEvent.create).mock.calls.length > 0 ||
    vi.mocked(WhatsAppWebhookEvent.updateOne).mock.calls.length > 0 ||
    vi.mocked(WhatsAppMessage.create).mock.calls.length > 0 ||
    vi.mocked(WhatsAppMessage.findOne).mock.calls.length > 0 ||
    vi.mocked(WhatsAppMessage.updateOne).mock.calls.length > 0 ||
    vi.mocked(Order.findOne).mock.calls.length > 0 ||
    vi.mocked(withdrawAllConsent).mock.calls.length > 0
  );
}

describe("WhatsApp webhook HTTP integration (R1, reconstructed middleware stack)", () => {
  let app: express.Express;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.WHATSAPP_APP_SECRET = TEST_APP_SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
    resetDbMocks();
    app = createWebhookTestApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  describe("A. GET /api/whatsapp/webhook/verify (verification challenge)", () => {
    it("returns the challenge for correct mode/token/challenge", async () => {
      const res = await request(app)
        .get("/api/whatsapp/webhook/verify")
        .query({
          "hub.mode": "subscribe",
          "hub.verify_token": TEST_VERIFY_TOKEN,
          "hub.challenge": "challenge-abc-123",
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe("challenge-abc-123");
    });

    it("rejects an incorrect verification token", async () => {
      const res = await request(app)
        .get("/api/whatsapp/webhook/verify")
        .query({
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong-token",
          "hub.challenge": "challenge-abc-123",
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden" });
    });

    it("rejects missing required query parameters", async () => {
      const res = await request(app)
        .get("/api/whatsapp/webhook/verify")
        .query({ "hub.mode": "subscribe" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden" });
    });
  });

  describe("B/C/D/E. POST /api/whatsapp/webhook (signature, tamper, exact-byte path)", () => {
    it("accepts a valid signed synthetic payload through real raw parser/controller (DB processing isolated)", async () => {
      // Empty entry avoids controller DB-processing branches while still proving
      // HTTP -> raw middleware -> controller -> signature verification path.
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const signature = computeSignature(rawBody, TEST_APP_SECRET);

      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      // No message/status entries => no DB-backed processing should run.
      expect(dbProcessingInvoked()).toBe(false);
      expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it("rejects an invalid signature and does not invoke DB-backed processing", async () => {
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=invalidsignature",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("rejects a tampered body when at least one byte changes after signing", async () => {
      const original = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const signature = computeSignature(original, TEST_APP_SECRET);
      const tampered = Buffer.from('{"object":"whatsapp","entry":[ ]}', "utf8"); // one byte changed

      expect(Buffer.compare(original, tampered)).not.toBe(0);

      const res = await postRaw(app, "/api/whatsapp/webhook", tampered, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("preserves exact signed formatted JSON bytes through HTTP raw middleware and rejects a one-byte change", async () => {
      // Intentional whitespace/newlines are part of the signed bytes.
      const formattedRaw = Buffer.from(
        '{\n  "object": "whatsapp",\n  "entry": [\n\n  ]\n}\n',
        "utf8",
      );
      const signature = computeSignature(formattedRaw, TEST_APP_SECRET);

      const accepted = await postRaw(app, "/api/whatsapp/webhook", formattedRaw, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(accepted.status).toBe(200);
      expect(accepted.body).toEqual({ received: true });
      expect(dbProcessingInvoked()).toBe(false);

      // Note: controller verifies HMAC against UTF-8 string representation of the Buffer
      // (see whatsappWebhookController.verifyWebhookSignature); production behavior unchanged.
      const oneByteChanged = Buffer.from(formattedRaw);
      oneByteChanged[oneByteChanged.indexOf("\n")] = 0x20; // replace first newline with space
      expect(Buffer.compare(formattedRaw, oneByteChanged)).not.toBe(0);

      resetDbMocks();
      const rejected = await postRaw(app, "/api/whatsapp/webhook", oneByteChanged, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(rejected.status).toBe(400);
      expect(rejected.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("does not invoke DB-backed processing when a signed payload would contain events but signature is invalid (pre-check)", async () => {
      // Demonstrates rejection occurs before processing; event payload not used with valid signature here.
      const rawBody = Buffer.from(
        JSON.stringify({
          object: "whatsapp",
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    messages: [
                      {
                        id: "wamid.synthetic-1",
                        from: "15550000000",
                        type: "text",
                        text: { body: "HELP" },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
        "utf8",
      );

      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=wrong",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });
  });

  describe("F. Content-type behavior (observed through reconstructed stack)", () => {
    it("accepts a valid signed request with application/json content type", async () => {
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const signature = computeSignature(rawBody, TEST_APP_SECRET);
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });

    it("observes behavior for an unexpected content type without assuming rejection", async () => {
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const signature = computeSignature(rawBody, TEST_APP_SECRET);
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "text/plain",
        "X-Hub-Signature-256": signature,
      });

      // Evidence-based assertion: path-specific raw parser may not run for unexpected
      // content type and global JSON parser/body handling may alter request semantics.
      expect([200, 400, 415, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toEqual({ received: true });
      } else {
        expect(typeof res.body?.message).toBe("string");
      }
      // Must not expose secrets/stack traces regardless of outcome.
      expect(JSON.stringify(res.body)).not.toContain(TEST_APP_SECRET);
      expect(JSON.stringify(res.body)).not.toContain(TEST_VERIFY_TOKEN);
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain("stack");
    });
  });

  describe("G. Error handling", () => {
    it("rejects missing signature header", async () => {
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("rejects malformed signature header", async () => {
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "not-a-valid-signature-format",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("rejects malformed JSON when signature is valid", async () => {
      const rawBody = Buffer.from("{not-json", "utf8");
      const signature = computeSignature(rawBody, TEST_APP_SECRET);
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid JSON payload" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("rejects empty body (invalid signature) without invoking DB processing", async () => {
      const rawBody = Buffer.from("", "utf8");
      const res = await postRaw(app, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=deadbeef",
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Invalid webhook signature" });
      expect(dbProcessingInvoked()).toBe(false);
    });

    it("returns 503 when app secret is missing (isolated env) and does not expose secrets/stack traces", async () => {
      delete process.env.WHATSAPP_APP_SECRET;
      const isolatedApp = createWebhookTestApp();
      const rawBody = Buffer.from('{"object":"whatsapp","entry":[]}', "utf8");

      const res = await postRaw(isolatedApp, "/api/whatsapp/webhook", rawBody, {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=anything",
      });

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ message: "Webhook is not configured" });
      expect(JSON.stringify(res.body)).not.toContain(TEST_VERIFY_TOKEN);
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain("stack");
      expect(dbProcessingInvoked()).toBe(false);
    });
  });
});
