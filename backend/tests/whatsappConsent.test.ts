import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  grantConsent,
  withdrawConsent,
  withdrawAllConsent,
  getConsentStatus,
  hasValidConsent,
  hasValidTransactionalConsent,
  hasValidMarketingConsent,
  normalisePhone,
} from "../src/services/whatsappConsentService.js";
import { WhatsAppConsent } from "../src/models/WhatsAppConsent.js";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await WhatsAppConsent.deleteMany({});
});

afterEach(async () => {
  await WhatsAppConsent.deleteMany({});
});

describe("normalisePhone", () => {
  it("converts a 10-digit Indian mobile to international format", () => {
    expect(normalisePhone("9840916058")).toBe("919840916058");
  });

  it("strips spaces and dashes", () => {
    expect(normalisePhone("98409 16058")).toBe("919840916058");
    expect(normalisePhone("98-409-16-058")).toBe("919840916058");
  });

  it("strips the leading + from E.164 numbers", () => {
    expect(normalisePhone("+919840916058")).toBe("919840916058");
  });

  it("passes through an already-normalised 12-digit number", () => {
    expect(normalisePhone("919840916058")).toBe("919840916058");
  });

  it("converts a leading-zero national format", () => {
    expect(normalisePhone("09840916058")).toBe("919840916058");
  });

  it("rejects numbers that do not start with 6-9", () => {
    expect(normalisePhone("5840916058")).toBeNull();
  });

  it("returns null for invalid or empty numbers", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});

describe("grantConsent", () => {
  it("grants consent for a new phone number", async () => {
    const result = await grantConsent({
      phone: "9840916058",
      source: "CHECKOUT",
      consentText: "I agree to receive WhatsApp notifications.",
    });

    expect(result.granted).toBe(true);
    expect(result.alreadyConsented).toBe(false);
    expect(result.phone).toBe("919840916058");

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record).not.toBeNull();
    expect(record!.status).toBe("GRANTED");
    expect(record!.source).toBe("CHECKOUT");
    expect(record!.consentText).toBe("I agree to receive WhatsApp notifications.");
    expect(record!.consentTimestamp).toBeInstanceOf(Date);
  });

  it("is idempotent: granting again returns alreadyConsented", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    const result = await grantConsent({ phone: "9840916058", source: "CHECKOUT" });

    expect(result.granted).toBe(true);
    expect(result.alreadyConsented).toBe(true);
  });

  it("re-grants consent after WITHDRAWN", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    await withdrawConsent({ phone: "9840916058", reason: "No longer needed" });

    const result = await grantConsent({ phone: "9840916058", source: "CHECKOUT" });

    expect(result.granted).toBe(true);
    expect(result.alreadyConsented).toBe(false);

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record!.status).toBe("GRANTED");
    expect(record!.optOutTimestamp).toBeNull();
  });

  it("returns failure for an invalid phone number", async () => {
    const result = await grantConsent({
      phone: "invalid",
      source: "CHECKOUT",
    });

    expect(result.granted).toBe(false);
    expect(result.alreadyConsented).toBe(false);
  });
});

describe("withdrawConsent", () => {
  it("withdraws consent and records history", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });

    const result = await withdrawConsent({
      phone: "9840916058",
      reason: "Customer opted out",
      source: "CHECKOUT",
    });

    expect(result.withdrawn).toBe(true);
    expect(result.wasConsented).toBe(true);
    expect(result.phone).toBe("919840916058");

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record!.status).toBe("WITHDRAWN");
    expect(record!.optOutTimestamp).toBeInstanceOf(Date);
    expect(record!.withdrawalReason).toBe("Customer opted out");
    expect(record!.withdrawalHistory).toHaveLength(1);
    expect(record!.withdrawalHistory![0]?.reason).toBe("Customer opted out");
  });

  it("is idempotent: withdrawing again returns withdrawn: false", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    await withdrawConsent({ phone: "9840916058", reason: "First opt-out" });

    const result = await withdrawConsent({ phone: "9840916058", reason: "Second opt-out" });

    expect(result.withdrawn).toBe(false);
    expect(result.wasConsented).toBe(false);

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record!.withdrawalHistory).toHaveLength(1);
  });

  it("records a denial when no consent record exists", async () => {
    const result = await withdrawConsent({
      phone: "9840916058",
      reason: "Never consented",
    });

    expect(result.withdrawn).toBe(false);
    expect(result.wasConsented).toBe(false);

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record!.status).toBe("DENIED");
  });
});

describe("getConsentStatus", () => {
  it("returns GRANTED status with details", async () => {
    await grantConsent({
      phone: "9840916058",
      source: "CHECKOUT",
      consentText: "Consent text v1",
    });

    const status = await getConsentStatus("919840916058");

    expect(status).not.toBeNull();
    expect(status!.phone).toBe("919840916058");
    expect(status!.status).toBe("GRANTED");
    expect(status!.hasConsent).toBe(true);
    expect(status!.source).toBe("CHECKOUT");
    expect(status!.consentTimestamp).toBeInstanceOf(Date);
    expect(status!.optOutTimestamp).toBeUndefined();
  });

  it("returns WITHDRAWN status after opt-out", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    await withdrawConsent({ phone: "9840916058", reason: "Opted out" });

    const status = await getConsentStatus("919840916058");

    expect(status!.status).toBe("WITHDRAWN");
    expect(status!.hasConsent).toBe(false);
    expect(status!.optOutTimestamp).toBeInstanceOf(Date);
  });

  it("returns null for a phone with no record", async () => {
    const status = await getConsentStatus("919840916058");
    expect(status).toBeNull();
  });

  it("returns null for an invalid phone number", async () => {
    const status = await getConsentStatus("invalid");
    expect(status).toBeNull();
  });
});

describe("hasValidConsent", () => {
  it("returns true when consent is GRANTED", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    expect(await hasValidConsent("919840916058")).toBe(true);
  });

  it("returns false when consent is WITHDRAWN", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" });
    await withdrawConsent({ phone: "9840916058", reason: "Opted out" });
    expect(await hasValidConsent("919840916058")).toBe(false);
  });

  it("returns false when consent is DENIED", async () => {
    await withdrawConsent({ phone: "9840916058", reason: "Never consented" });
    expect(await hasValidConsent("919840916058")).toBe(false);
  });

  it("returns false when no record exists", async () => {
    expect(await hasValidConsent("919840916058")).toBe(false);
  });

  it("returns false for an invalid phone number", async () => {
    expect(await hasValidConsent("invalid")).toBe(false);
  });
});

describe("separate TRANSACTIONAL and MARKETING consent (Phase A)", () => {
  it("keeps marketing independent and explicit (transactional grant does not imply marketing)", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT", category: "TRANSACTIONAL" });

    const tx = await getConsentStatus("919840916058", "TRANSACTIONAL");
    const mk = await getConsentStatus("919840916058", "MARKETING");

    expect(tx?.hasConsent).toBe(true);
    expect(mk?.hasConsent).toBe(false);
    expect(mk?.status).toBe("DENIED");

    expect(await hasValidTransactionalConsent("919840916058")).toBe(true);
    expect(await hasValidMarketingConsent("919840916058")).toBe(false);
  });

  it("grants and withdraws marketing consent independently without changing transactional consent", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT", category: "TRANSACTIONAL" });
    await grantConsent({ phone: "9840916058", source: "MARKETING_OPT_IN", category: "MARKETING" });

    expect(await hasValidTransactionalConsent("919840916058")).toBe(true);
    expect(await hasValidMarketingConsent("919840916058")).toBe(true);

    const withdrawn = await withdrawConsent({
      phone: "9840916058",
      source: "OPT_IN_MESSAGE",
      reason: "STOP marketing",
      category: "MARKETING",
    });
    expect(withdrawn.withdrawn).toBe(true);

    expect(await hasValidTransactionalConsent("919840916058")).toBe(true);
    expect(await hasValidMarketingConsent("919840916058")).toBe(false);

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record?.status).toBe("GRANTED");
    expect(record?.marketingStatus).toBe("WITHDRAWN");
    expect(Array.isArray(record?.consentHistory)).toBe(true);
    expect((record?.consentHistory ?? []).some((h: any) => h.category === "MARKETING" && h.action === "WITHDRAW")).toBe(true);
  });

  it("withdrawAllConsent (STOP behavior) prevents subsequent marketing and transactional WhatsApp messages", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT", category: "TRANSACTIONAL" });
    await grantConsent({ phone: "9840916058", source: "MARKETING_OPT_IN", category: "MARKETING" });

    const result = await withdrawAllConsent({
      phone: "9840916058",
      source: "OPT_IN_MESSAGE",
      reason: "STOP command via WhatsApp",
    });

    expect(result.transactional.withdrawn).toBe(true);
    expect(result.marketing.withdrawn).toBe(true);
    expect(await hasValidTransactionalConsent("919840916058")).toBe(false);
    expect(await hasValidMarketingConsent("919840916058")).toBe(false);

    const record = await WhatsAppConsent.findOne({ phone: "919840916058" }).lean();
    expect(record?.status).toBe("WITHDRAWN");
    expect(record?.marketingStatus).toBe("WITHDRAWN");
    expect(record?.withdrawalReason).toBe("STOP command via WhatsApp");
    expect(record?.marketingWithdrawalReason).toBe("STOP command via WhatsApp");
  });

  it("preserves backward-compatible transactional API behavior and extends status with category details", async () => {
    await grantConsent({ phone: "9840916058", source: "CHECKOUT" }); // default transactional
    const status = await getConsentStatus("919840916058"); // default transactional

    expect(status).not.toBeNull();
    expect(status?.status).toBe("GRANTED");
    expect(status?.hasConsent).toBe(true);
    expect(status?.transactional?.status).toBe("GRANTED");
    expect(status?.marketing?.status).toBe("DENIED");
  });
});
