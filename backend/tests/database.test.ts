import { describe, expect, it, afterAll } from "vitest";
import {
  connectTestDB,
  disconnectTestDB,
} from "./testDatabase.js";

describe("Test database", () => {
  afterAll(async () => {
    await disconnectTestDB();
  });

  it("connects to an isolated MongoDB instance", async () => {
    await connectTestDB();

    expect(true).toBe(true);
  });
});
