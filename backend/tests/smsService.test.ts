import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOtpSms } from "../src/services/smsService.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  delete process.env.TWOFACTOR_API_KEY;
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("sendOtpSms", () => {
  it("returns true when the provider reports success", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Status: "Success" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]![0]!);
    expect(url).toBe(
      "https://2factor.in/API/V1/sk_test_123/SMS/%2B919840916058/123456/BLUEBELL_OTP"
    );
  });

  it("returns false when TWOFACTOR_API_KEY is missing and does not call fetch", async () => {
    delete process.env.TWOFACTOR_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false on a non-ok provider response", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(false);
  });

  it("returns false on an invalid JSON response", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(false);
  });

  it("returns false when the provider status is not Success", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Status: "Failure" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(false);
  });

  it("returns false on a network failure", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendOtpSms("9840916058", "123456");

    expect(result).toBe(false);
  });

  it("returns false when the provider request times out", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request timed out", "TimeoutError")),
          { once: true },
        );
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = sendOtpSms("9840916058", "123456");
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toBe(false);
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
  });

  it("normalizes the phone number to +91 format", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Status: "Success" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendOtpSms("9840916058", "123456");

    const url = String(fetchMock.mock.calls[0]![0]!);
    expect(url).toContain("/SMS/%2B919840916058/");
  });

  it("uses the BLUEBELL_OTP template", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Status: "Success" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendOtpSms("9840916058", "123456");

    const url = String(fetchMock.mock.calls[0]![0]!);
    expect(url).toMatch(/BLUEBELL_OTP$/);
  });

  it("encodes the OTP value in the URL path", async () => {
    process.env.TWOFACTOR_API_KEY = "sk_test_123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Status: "Success" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendOtpSms("9840916058", "123456");

    const url = String(fetchMock.mock.calls[0]![0]!);
    expect(url).toContain("/123456/BLUEBELL_OTP");
  });
});
