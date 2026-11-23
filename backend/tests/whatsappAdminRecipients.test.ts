import { afterEach, describe, expect, it } from "vitest";

import {
  ADMIN_WHATSAPP_RECIPIENTS_ENV,
  getValidatedAdminWhatsAppRecipients,
  isAdminWhatsAppRecipientsConfigValid,
} from "../src/services/whatsappAdminRecipients.js";

const original = process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV];

afterEach(() => {
  if (original === undefined) {
    delete process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV];
  } else {
    process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV] = original;
  }
});

describe("whatsappAdminRecipients (Phase A)", () => {
  it("returns not configured when env is missing or empty", () => {
    delete process.env[ADMIN_WHATSAPP_RECIPIENTS_ENV];
    expect(getValidatedAdminWhatsAppRecipients()).toEqual({
      configured: false,
      recipients: [],
      invalid: [],
      duplicatesRemoved: 0,
    });
  });

  it("validates, normalizes, deduplicates, and reports invalid recipients", () => {
    const result = getValidatedAdminWhatsAppRecipients(
      "9840916058, +919840916058, 09840916059;invalid,12345\n919840916060",
    );

    expect(result.configured).toBe(true);
    expect(result.recipients).toEqual(["919840916058", "919840916059", "919840916060"]);
    expect(result.invalid).toEqual(["invalid", "12345"]);
    expect(result.duplicatesRemoved).toBe(1);
    expect(isAdminWhatsAppRecipientsConfigValid("9840916058,919840916060")).toBe(true);
    expect(isAdminWhatsAppRecipientsConfigValid("9840916058,invalid")).toBe(false);
  });

  it("does not expose recipients and does not auto-use admin accounts (config-only support)", () => {
    // This module only parses/validates server-side env config; no DB/user lookups or exposure paths exist here.
    const result = getValidatedAdminWhatsAppRecipients("919840916058");
    expect(result.recipients).toEqual(["919840916058"]);
  });
});
