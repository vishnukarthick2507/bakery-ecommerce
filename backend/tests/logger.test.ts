import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { logger, info, warn, error } from "../src/lib/logger.js";

describe("Structured logger", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits JSON log lines for info", () => {
    info("Test message", { requestId: "abc123", orderId: "ord1" });
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("Test message");
    expect(parsed.requestId).toBe("abc123");
    expect(parsed.orderId).toBe("ord1");
    expect(parsed.timestamp).toBeDefined();
  });

  it("emits JSON log lines for warn", () => {
    warn("Warning message", { requestId: "xyz" });
    const output = consoleWarnSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("warn");
    expect(parsed.message).toBe("Warning message");
  });

  it("emits JSON log lines for error", () => {
    error("Error message", { requestId: "err1" });
    const output = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("Error message");
  });

  it("redacts sensitive fields from logs", () => {
    info("Order created", {
      requestId: "red1",
      password: "secret123",
      passwordHash: "hashed",
      token: "jwt-token",
      authorization: "Bearer xxx",
      apiKey: "ak-123",
      apiSecret: "sk-456",
      email: "user@example.com",
      phone: "9840916058",
      otp: "123456",
      razorpayKeySecret: "rsec",
      cloudinaryApiSecret: "csec",
      customerName: "John Doe",
      address: "123 Main St",
    });

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.passwordHash).toBe("[REDACTED]");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.authorization).toBe("[REDACTED]");
    expect(parsed.apiKey).toBe("[REDACTED]");
    expect(parsed.apiSecret).toBe("[REDACTED]");
    expect(parsed.email).toBe("[REDACTED]");
    expect(parsed.phone).toBe("[REDACTED]");
    expect(parsed.otp).toBe("[REDACTED]");
    expect(parsed.razorpayKeySecret).toBe("[REDACTED]");
    expect(parsed.cloudinaryApiSecret).toBe("[REDACTED]");
    expect(parsed.customerName).toBe("[REDACTED]");
    expect(parsed.address).toBe("[REDACTED]");
    // Non-sensitive fields preserved
    expect(parsed.requestId).toBe("red1");
  });

  it("redacts nested objects recursively", () => {
    info("Nested data", {
      requestId: "nest1",
      user: {
        email: "nested@example.com",
        name: "Nested User",
        phone: "9999999999",
        safeField: "visible",
      },
    });

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.user.email).toBe("[REDACTED]");
    expect(parsed.user.name).toBe("[REDACTED]");
    expect(parsed.user.phone).toBe("[REDACTED]");
    expect(parsed.user.safeField).toBe("visible");
  });

  it("does not expose internal stack traces to customers via logger", () => {
    const err = new Error("Database connection failed");
    error("Database error", { requestId: "stack1", error: err.message });

    const output = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    // Only the error message string is logged, not the stack
    expect(parsed.error).toBe("Database connection failed");
    expect(parsed.stack).toBeUndefined();
  });

  it("logger object exposes info, warn, error", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
