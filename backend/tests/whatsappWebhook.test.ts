import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setWhatsAppWebhookEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

function clearWhatsAppWebhookEnv() {
  for (const key of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_API_VERSION",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
  ]) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearWhatsAppWebhookEnv();
});

afterEach(() => {
  clearWhatsAppWebhookEnv();
  process.env = { ...originalEnv };
});

function computeSignature(
  payload: string | Buffer,
  secret: string,
): string {
  const crypto = require("node:crypto");
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
}

type MockRequest = Record<string, unknown> & {
  get?: (name: string) => string | undefined;
  query?: Record<string, unknown>;
  body?: Buffer | string;
};

type MockResponse = Record<string, unknown> & {
  status?: (code: number) => MockResponse;
  send?: (body: unknown) => void;
  json?: (body: unknown) => void;
};

function makeRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    get: vi.fn(),
    query: {},
    body: {},
    ...overrides,
  } as MockRequest;
}

function makeResponse(overrides: Partial<MockResponse> = {}): MockResponse {
  const statusMock = vi.fn().mockReturnThis();
  const sendMock = vi.fn();
  const jsonMock = vi.fn();
  return {
    status: statusMock,
    send: sendMock,
    json: jsonMock,
    ...overrides,
  } as MockResponse;
}

async function importWebhookController() {
  return await import("../src/controllers/whatsappWebhookController.js");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-app-secret";
  const payload = JSON.stringify({ object: "whatsapp" });

  beforeEach(() => {
    setWhatsAppWebhookEnv({ WHATSAPP_APP_SECRET: secret });
  });

  afterEach(() => {
    clearWhatsAppWebhookEnv();
  });

  it("returns true for a valid signature", async () => {
    const signature = computeSignature(payload, secret);
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it("returns true for a valid signature with a Buffer payload", async () => {
    const signature = computeSignature(Buffer.from(payload), secret);
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(Buffer.from(payload), signature)).toBe(true);
  });

  it("returns false when the app secret is not configured", async () => {
    clearWhatsAppWebhookEnv();
    const signature = computeSignature(payload, secret);
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(payload, signature)).toBe(false);
  });

  it("returns false when the signature header is missing", async () => {
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(payload, undefined)).toBe(false);
  });

  it("returns false when the algorithm is not sha256", async () => {
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(payload, "sha1=abcdef")).toBe(false);
  });

  it("returns false for a tampered payload", async () => {
    const signature = computeSignature(payload, secret);
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature("tampered-payload", signature)).toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    const signature = computeSignature(payload, "wrong-secret");
    const mod = await importWebhookController();
    expect(mod.verifyWebhookSignature(payload, signature)).toBe(false);
  });
});

describe("verifyWebhook (GET)", () => {
  const verifyToken = "test-verify-token";
  const challenge = "challenge-123";

  beforeEach(() => {
    setWhatsAppWebhookEnv({ WHATSAPP_VERIFY_TOKEN: verifyToken });
  });
  afterEach(() => {
    clearWhatsAppWebhookEnv();
  });

  it("returns the challenge when mode, token and challenge match", async () => {
    const { verifyWebhook } = await importWebhookController();
    const req = makeRequest({
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": challenge,
      },
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await verifyWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(challenge);
  });

  it("returns 403 when the verify token does not match", async () => {
    const { verifyWebhook } = await importWebhookController();
    const req = makeRequest({
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": challenge,
      },
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await verifyWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("returns 403 when mode is not subscribe", async () => {
    const { verifyWebhook } = await importWebhookController();
    const req = makeRequest({
      query: {
        "hub.mode": "unsubscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": challenge,
      },
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await verifyWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when the verify token is not configured", async () => {
    clearWhatsAppWebhookEnv();
    const { verifyWebhook } = await importWebhookController();
    const req = makeRequest({
      query: {
        "hub.mode": "subscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": challenge,
      },
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await verifyWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("receiveWebhook (POST)", () => {
  const secret = "test-app-secret";
  const verifyToken = "test-verify-token";

  beforeEach(() => {
    setWhatsAppWebhookEnv({
      WHATSAPP_APP_SECRET: secret,
      WHATSAPP_VERIFY_TOKEN: verifyToken,
    });
  });
  afterEach(() => {
    clearWhatsAppWebhookEnv();
  });

  it("returns 503 when the app secret is not configured", async () => {
    clearWhatsAppWebhookEnv();
    const { receiveWebhook } = await importWebhookController();
    const req = makeRequest({
      get: vi.fn().mockReturnValue(undefined),
      body: Buffer.from("{}"),
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await receiveWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("returns 400 for an invalid signature", async () => {
    const { receiveWebhook } = await importWebhookController();
    const req = makeRequest({
      get: vi.fn().mockReturnValue("sha256=invalid"),
      body: Buffer.from(JSON.stringify({ object: "whatsapp" })),
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await receiveWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid webhook signature",
    });
  });

  it("returns 200 for a valid webhook with no changes", async () => {
    const payload = { object: "whatsapp", entry: [] };
    const signature = computeSignature(JSON.stringify(payload), secret);
    const { receiveWebhook } = await importWebhookController();
    const req = makeRequest({
      get: vi.fn().mockReturnValue(signature),
      body: Buffer.from(JSON.stringify(payload)),
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await receiveWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("returns 400 for invalid JSON payload", async () => {
    const { receiveWebhook } = await importWebhookController();
    const req = makeRequest({
      get: vi.fn().mockReturnValue(computeSignature("not-json", secret)),
      body: Buffer.from("not-json"),
    }) as unknown as Request;
    const res = makeResponse() as unknown as Response;

    await receiveWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid JSON payload" });
  });
});
