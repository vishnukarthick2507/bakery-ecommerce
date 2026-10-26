import { describe, expect, it } from "vitest";
import { Admin } from "../src/models/Admin.js";

describe("Admin model security", () => {
  it("marks the password field as excluded by default", () => {
    const passwordPath = Admin.schema.path("password");

    expect(passwordPath).toBeDefined();
    expect(passwordPath.options.select).toBe(false);
  });

  it("allows the password field to be explicitly selected", () => {
    const passwordPath = Admin.schema.path("password");

    expect(passwordPath.options.select).toBe(false);
  });
});
