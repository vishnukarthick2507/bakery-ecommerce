import { describe, expect, it, beforeEach, vi } from "vitest";
import { requestIdMiddleware, getRequestId } from "../src/middleware/requestId.js";

describe("Request ID middleware", () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      setHeader: vi.fn(),
    };
    nextFn = vi.fn();
  });

  it("generates a request ID and attaches it to req and response header", () => {
    requestIdMiddleware(mockReq, mockRes, nextFn);

    expect(mockReq.id).toBeDefined();
    expect(typeof mockReq.id).toBe("string");
    expect(mockReq.id.length).toBeGreaterThan(0);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      mockReq.id,
    );
    expect(nextFn).toHaveBeenCalled();
  });

  it("generates unique request IDs for each request", () => {
    requestIdMiddleware(mockReq, mockRes, nextFn);
    const firstId = mockReq.id;

    mockReq = {};
    mockRes = { setHeader: vi.fn() };
    nextFn = vi.fn();

    requestIdMiddleware(mockReq, mockRes, nextFn);
    expect(mockReq.id).not.toBe(firstId);
  });

  it("getRequestId returns the request ID from req", () => {
    requestIdMiddleware(mockReq, mockRes, nextFn);
    expect(getRequestId(mockReq)).toBe(mockReq.id);
  });

  it("getRequestId returns undefined when no ID set", () => {
    expect(getRequestId({} as any)).toBeUndefined();
  });
});
