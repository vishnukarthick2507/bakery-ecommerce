import { afterEach, describe, expect, it } from "vitest";
import {
  assertEmailDeliverySafetyConfig,
  isExternalEmailDeliveryBlocked,
  parseEmailExternalDeliveryBlockedEnv,
} from "../src/config/emailDeliverySafety.js";

const original = process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
  } else {
    process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = original;
  }
});

describe("emailDeliverySafety config", () => {
  it("defaults to false when missing", () => {
    delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
    expect(parseEmailExternalDeliveryBlockedEnv(undefined)).toBe(false);
    expect(isExternalEmailDeliveryBlocked()).toBe(false);
    expect(() => assertEmailDeliverySafetyConfig()).not.toThrow();
  });

  it("accepts true/false case-insensitively with trimming", () => {
    expect(parseEmailExternalDeliveryBlockedEnv("true")).toBe(true);
    expect(parseEmailExternalDeliveryBlockedEnv("FALSE")).toBe(false);
    expect(parseEmailExternalDeliveryBlockedEnv("  True ")).toBe(true);
    expect(parseEmailExternalDeliveryBlockedEnv(" false ")).toBe(false);
  });

  it("treats env true as blocked", () => {
    process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
    expect(isExternalEmailDeliveryBlocked()).toBe(true);
    expect(() => assertEmailDeliverySafetyConfig()).not.toThrow();
  });

  it("rejects invalid values", () => {
    expect(() => parseEmailExternalDeliveryBlockedEnv("1")).toThrow(
      "Invalid EMAIL_EXTERNAL_DELIVERY_BLOCKED value. Use true or false.",
    );
    expect(() => parseEmailExternalDeliveryBlockedEnv("yes")).toThrow();
    expect(() => parseEmailExternalDeliveryBlockedEnv("")).toThrow();
    process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "nope";
    expect(() => assertEmailDeliverySafetyConfig()).toThrow(
      "Invalid EMAIL_EXTERNAL_DELIVERY_BLOCKED value. Use true or false.",
    );
  });
});
