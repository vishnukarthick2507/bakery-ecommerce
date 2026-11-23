import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAdminLoginAlertOnce } from "../src/services/emailService.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const brevoEnvVars = [
  "BREVO_API_KEY",
  "BREVO_FROM_EMAIL",
  "BREVO_FROM_NAME",
  "ADMIN_NOTIFICATION_EMAIL",
  "UAT_SAFE_MODE",
  "EMAIL_EXTERNAL_DELIVERY_BLOCKED",
];

function clearEnv() {
  for (const key of brevoEnvVars) delete process.env[key];
}

function setConfiguredEnv() {
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.ADMIN_NOTIFICATION_EMAIL = "security@example.com";
  delete process.env.UAT_SAFE_MODE;
}

function getDiagnosticEvents(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls
    .map((call: unknown[]) => String(call[0] ?? ""))
    .map((line: string) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((v: Record<string, unknown> | null): v is Record<string, unknown> => !!v && typeof v.event === "string" && String(v.event).startsWith("admin_login_alert."));
}

function safeDiagnosticKeysOnly(payloads: Record<string, unknown>[]) {
  const allowed = new Set(["event", "outcome", "reason", "channel"]);
  return payloads.every((p) => Object.keys(p).every((k) => allowed.has(k)));
}

describe("emailService admin login alert - S05 remediation", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearEnv();
    setConfiguredEnv();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.useRealTimers();
  });

  afterEach(() => {
    infoSpy.mockRestore();
    vi.useRealTimers();
    clearEnv();
  });

  describe("C1 privacy transformations", () => {
    it("masks normal username (first and last characters), masks IPv4 final octet, omits unreliable UA, retains UTC timestamp, and keeps email escaped/secret-free", async () => {
      const eventId = "c1-normal-privacy";
      const result = await sendAdminLoginAlertOnce(eventId, {
        username: "adminuser",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "203.0.113.42",
        userAgent: "UnreliableAgent/xyz",
      });

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse(init.body as string) as { htmlContent: string; to: Array<{ email: string }> };
      expect(body.to).toEqual([{ email: "security@example.com" }]);
      expect(body.htmlContent).toContain("a***r");
      expect(body.htmlContent).not.toContain("adminuser");
      expect(body.htmlContent).toContain("203.0.113.xxx");
      expect(body.htmlContent).not.toContain("203.0.113.42");
      expect(body.htmlContent).not.toContain("Browser/device");
      expect(body.htmlContent).not.toContain("UnreliableAgent/xyz");
      expect(body.htmlContent).toContain("2026-11-20T10:00:00.000Z");
      // Footer disclaimer may mention "credentials"; ensure no actual secret/token values/types are present.
      expect(body.htmlContent).not.toMatch(/password|otp|jwt|cookie|secret|reset token/i);
    });

    it("uses *** for short and blank usernames", async () => {
      await sendAdminLoginAlertOnce("c1-short-username", {
        username: "ab",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.7",
      });
      await sendAdminLoginAlertOnce("c1-blank-username", {
        username: "   ",
        occurredAt: new Date("2026-11-20T10:00:01.000Z"),
        ipAddress: "198.51.100.8",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const body1 = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { htmlContent: string };
      const body2 = JSON.parse(fetchMock.mock.calls[1]![1].body as string) as { htmlContent: string };
      expect(body1.htmlContent).toContain("<td style=\"border-bottom:1px solid #eee\">***</td>");
      expect(body2.htmlContent).toContain("<td style=\"border-bottom:1px solid #eee\">***</td>");
      expect(body1.htmlContent).not.toContain(">ab<");
      expect(body2.htmlContent).not.toContain(">   <");
    });

    it("masks IPv6 by preserving first three groups and masking the rest, including compressed addresses", async () => {
      await sendAdminLoginAlertOnce("c1-ipv6-full", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      });
      await sendAdminLoginAlertOnce("c1-ipv6-compressed", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:01.000Z"),
        ipAddress: "2001:db8:85a3::8a2e:370:7334",
      });
      await sendAdminLoginAlertOnce("c1-ipv6-loopback", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:02.000Z"),
        ipAddress: "::1",
      });

      const bodies = fetchMock.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).htmlContent as string);
      expect(bodies[0]).toContain("2001:0db8:85a3:xxxx:xxxx:xxxx:xxxx:xxxx");
      expect(bodies[0]).not.toContain("8a2e");
      expect(bodies[0]).not.toContain("7334");
      expect(bodies[1]).toContain("2001:db8:85a3:xxxx:xxxx:xxxx:xxxx:xxxx");
      expect(bodies[1]).not.toContain("8a2e");
      expect(bodies[2]).toContain("0:0:0:xxxx:xxxx:xxxx:xxxx:xxxx");
      expect(bodies[2]).not.toContain("> ::1 <");
    });

    it("falls back to Unavailable for missing or unclassifiable IP and never emits raw unclassifiable address", async () => {
      await sendAdminLoginAlertOnce("c1-ip-missing", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
      });
      await sendAdminLoginAlertOnce("c1-ip-unclassifiable", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:01.000Z"),
        ipAddress: "not-an-ip-address",
      });

      const bodies = fetchMock.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).htmlContent as string);
      expect(bodies[0]).toContain("Unavailable");
      expect(bodies[1]).toContain("Unavailable");
      expect(bodies[1]).not.toContain("not-an-ip-address");
    });

    it("emits coarse browser/device description only when reliable and omits UA-derived field when missing or unreliable", async () => {
      await sendAdminLoginAlertOnce("c1-ua-reliable", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.10",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      });
      await sendAdminLoginAlertOnce("c1-ua-missing", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:01.000Z"),
        ipAddress: "198.51.100.11",
      });
      await sendAdminLoginAlertOnce("c1-ua-unreliable", {
        username: "administrator",
        occurredAt: new Date("2026-11-20T10:00:02.000Z"),
        ipAddress: "198.51.100.12",
        userAgent: "TotallyUnknownClient/1.0",
      });

      const bodies = fetchMock.mock.calls.map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).htmlContent as string);
      expect(bodies[0]).toContain("Browser/device");
      expect(bodies[0]).toContain("Chrome on Windows");
      expect(bodies[0]).not.toContain("Mozilla/5.0");
      expect(bodies[0]).not.toContain("124.0.0.0");

      expect(bodies[1]).not.toContain("Browser/device");
      expect(bodies[1]).not.toContain("Mozilla");

      expect(bodies[2]).not.toContain("Browser/device");
      expect(bodies[2]).not.toContain("TotallyUnknownClient/1.0");
    });
  });

  describe("C2 bounded, concurrency-safe, process-local deduplication", () => {
    it("claims and delivers first event, suppresses duplicate same event ID, and allows distinct event IDs for the same admin", async () => {
      const input = (occurredAt: string) => ({
        username: "sameadmin",
        occurredAt: new Date(occurredAt),
        ipAddress: "198.51.100.20",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
      });

      await expect(sendAdminLoginAlertOnce("same-event-1", input("2026-11-20T10:00:00.000Z"))).resolves.toBe(true);
      await expect(sendAdminLoginAlertOnce("same-event-1", input("2026-11-20T10:00:01.000Z"))).resolves.toBe(false);
      await expect(sendAdminLoginAlertOnce("distinct-event-2", input("2026-11-20T10:00:02.000Z"))).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("prevents concurrent duplicate delivery for the same event ID (single claim before async delivery)", async () => {
      let releaseFetch!: () => void;
      const gate = new Promise<void>((resolve) => { releaseFetch = resolve; });
      fetchMock.mockImplementationOnce(async () => {
        await gate;
        return { ok: true, status: 201 };
      });

      const input = {
        username: "concurrentadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.30",
      };

      const p1 = sendAdminLoginAlertOnce("concurrent-event", input);
      const p2 = sendAdminLoginAlertOnce("concurrent-event", input);
      // Allow microtasks so duplicate call observes the synchronous claim.
      await Promise.resolve();
      releaseFetch();
      const [r1, r2] = await Promise.all([p1, p2]);

      expect([r1, r2].sort()).toEqual([false, true]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("makes expired entries eligible again after TTL", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));
      const input = { username: "ttladmin", occurredAt: new Date("2026-11-20T10:00:00.000Z"), ipAddress: "198.51.100.40" };

      await expect(sendAdminLoginAlertOnce("ttl-event", input)).resolves.toBe(true);
      await expect(sendAdminLoginAlertOnce("ttl-event", input)).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date("2026-11-20T10:15:00.001Z"));
      await expect(sendAdminLoginAlertOnce("ttl-event", input)).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("enforces max 1000 entries with expired-first cleanup and oldest-entry eviction", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));
      const input = { username: "capadmin", occurredAt: new Date("2026-11-20T10:00:00.000Z"), ipAddress: "198.51.100.50" };

      // Fill to cap.
      for (let i = 0; i < 1000; i++) {
        await sendAdminLoginAlertOnce(`cap-${i}`, input);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1000);

      // Oldest (cap-0) should be evicted when inserting a new entry beyond cap.
      await expect(sendAdminLoginAlertOnce("cap-overflow-new", input)).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1001);
      await expect(sendAdminLoginAlertOnce("cap-0", input)).resolves.toBe(true); // evicted -> eligible
      expect(fetchMock).toHaveBeenCalledTimes(1002);
      await expect(sendAdminLoginAlertOnce("cap-999", input)).resolves.toBe(false); // still within retained window

      // Expired-first cleanup: expire early entries, add new ones, ensure expired are cleaned (eligible) not blocking capacity.
      vi.setSystemTime(new Date("2026-11-20T10:20:00.000Z")); // expire prior claims
      await expect(sendAdminLoginAlertOnce("cap-expired-reuse-1", input)).resolves.toBe(true);
      await expect(sendAdminLoginAlertOnce("cap-1", input)).resolves.toBe(true); // expired -> eligible via cleanup
    });

    it("retains claim after failed delivery, missing configuration, and UAT suppression for the same event ID", async () => {
      // Failed delivery
      fetchMock.mockRejectedValueOnce(new Error("network failure"));
      await expect(sendAdminLoginAlertOnce("retain-failed", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.60",
      })).resolves.toBe(false);
      fetchMock.mockResolvedValueOnce({ ok: true, status: 201 });
      await expect(sendAdminLoginAlertOnce("retain-failed", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.60",
      })).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Missing configuration
      const prevRecipient = process.env.ADMIN_NOTIFICATION_EMAIL;
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
      await expect(sendAdminLoginAlertOnce("retain-missing-config", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.61",
      })).resolves.toBe(false);
      process.env.ADMIN_NOTIFICATION_EMAIL = prevRecipient;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      await expect(sendAdminLoginAlertOnce("retain-missing-config", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.61",
      })).resolves.toBe(false);
      // no additional send for missing-config event
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // UAT suppression
      process.env.UAT_SAFE_MODE = "true";
      await expect(sendAdminLoginAlertOnce("retain-uat", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.62",
      })).resolves.toBe(false);
      delete process.env.UAT_SAFE_MODE;
      await expect(sendAdminLoginAlertOnce("retain-uat", {
        username: "retainadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.62",
      })).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("skips delivery for missing or blank event ID and emits safe suppressed diagnostic", async () => {
      await expect(sendAdminLoginAlertOnce("", {
        username: "blankid",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
      })).resolves.toBe(false);
      await expect(sendAdminLoginAlertOnce("   ", {
        username: "blankid",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
      })).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      const events = getDiagnosticEvents(infoSpy);
      const unavailable = events.filter((e: Record<string, unknown>) => e.outcome === "suppressed" && e.reason === "event_id_unavailable");
      expect(unavailable.length).toBeGreaterThanOrEqual(2);
      expect(safeDiagnosticKeysOnly(unavailable)).toBe(true);
    });
  });

  describe("C3 structured diagnostics (safe, minimal)", () => {
    it("emits attempted and sent for successful delivery", async () => {
      await sendAdminLoginAlertOnce("diag-sent", {
        username: "diagadmin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.70",
      });
      const events = getDiagnosticEvents(infoSpy);
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: "admin_login_alert.attempted", outcome: "attempted", channel: "email", reason: "delivery_started" }),
        expect.objectContaining({ event: "admin_login_alert.sent", outcome: "sent", channel: "email", reason: "delivery_accepted" }),
      ]));
      expect(safeDiagnosticKeysOnly(events)).toBe(true);
    });

    it("emits suppressed for duplicate event", async () => {
      await sendAdminLoginAlertOnce("diag-dup", { username: "diagadmin", occurredAt: new Date() });
      infoSpy.mockClear();
      await sendAdminLoginAlertOnce("diag-dup", { username: "diagadmin", occurredAt: new Date() });
      const events = getDiagnosticEvents(infoSpy);
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: "admin_login_alert.suppressed", outcome: "suppressed", reason: "duplicate_event" }),
      ]));
    });

    it("emits failed when provider does not accept or throws", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      await sendAdminLoginAlertOnce("diag-failed-status", { username: "diagadmin", occurredAt: new Date() });
      fetchMock.mockRejectedValueOnce(new Error("boom"));
      await sendAdminLoginAlertOnce("diag-failed-ex", { username: "diagadmin", occurredAt: new Date() });
      const events = getDiagnosticEvents(infoSpy);
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: "admin_login_alert.failed", outcome: "failed", reason: "delivery_not_accepted" }),
        expect.objectContaining({ event: "admin_login_alert.failed", outcome: "failed", reason: "delivery_exception" }),
      ]));
    });

    it("emits configuration_missing for missing/invalid recipient and unconfigured Brevo", async () => {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
      await sendAdminLoginAlertOnce("diag-missing-recipient", { username: "diagadmin", occurredAt: new Date() });
      process.env.ADMIN_NOTIFICATION_EMAIL = "not-an-email";
      await sendAdminLoginAlertOnce("diag-invalid-recipient", { username: "diagadmin", occurredAt: new Date() });
      process.env.ADMIN_NOTIFICATION_EMAIL = "security@example.com";
      delete process.env.BREVO_API_KEY;
      await sendAdminLoginAlertOnce("diag-missing-brevo", { username: "diagadmin", occurredAt: new Date() });

      const events = getDiagnosticEvents(infoSpy);
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: "admin_login_alert.configuration_missing", outcome: "configuration_missing", reason: "recipient_unavailable" }),
        expect.objectContaining({ event: "admin_login_alert.configuration_missing", outcome: "configuration_missing", reason: "recipient_invalid" }),
        expect.objectContaining({ event: "admin_login_alert.configuration_missing", outcome: "configuration_missing", reason: "brevo_unconfigured" }),
      ]));
    });

    it("emits uat_suppressed in UAT safe mode", async () => {
      process.env.UAT_SAFE_MODE = "true";
      await sendAdminLoginAlertOnce("diag-uat", { username: "diagadmin", occurredAt: new Date() });
      const events = getDiagnosticEvents(infoSpy);
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: "admin_login_alert.uat_suppressed", outcome: "uat_suppressed", reason: "uat_safe_mode" }),
      ]));
    });

    it("never includes sensitive values in diagnostics or email payload", async () => {
      process.env.ADMIN_NOTIFICATION_EMAIL = "secret-dest@example.com";
      await sendAdminLoginAlertOnce("diag-safe", {
        username: "SensitiveAdminName",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "203.0.113.99",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
      });

      const diagText = JSON.stringify(getDiagnosticEvents(infoSpy));
      expect(diagText).not.toContain("SensitiveAdminName");
      expect(diagText).not.toContain("203.0.113.99");
      expect(diagText).not.toContain("203.0.113.xxx");
      expect(diagText).not.toContain("secret-dest@example.com");
      expect(diagText).not.toContain("Chrome on Windows");
      expect(diagText).not.toContain("Mozilla/5.0");
      expect(diagText).not.toMatch(/password|jwt|cookie|otp|token|secret|credential/i);

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as { htmlContent: string; to: Array<{email:string}> };
      // Recipient is in delivery payload (required for transport) but not in diagnostics; email content remains privacy-minimized.
      expect(body.to[0]!.email).toBe("secret-dest@example.com");
      expect(body.htmlContent).not.toContain("SensitiveAdminName");
      expect(body.htmlContent).not.toContain("203.0.113.99");
      expect(body.htmlContent).not.toContain("Mozilla/5.0");
      // Footer disclaimer may mention "credentials"; ensure no actual secret/token values/types are present.
      expect(body.htmlContent).not.toMatch(/password|otp|jwt|cookie|secret|reset token/i);
    });
  });
  describe("Decision B: deduplication when EMAIL_EXTERNAL_DELIVERY_BLOCKED=true", () => {
    it("blocked attempt returns false, no Brevo call, and same eventId is retryable after unblock", async () => {
      process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
      const eventId = "blb48-blocked-retry";
      const input = {
        username: "admin",
        occurredAt: new Date("2026-11-20T10:00:00.000Z"),
        ipAddress: "198.51.100.90",
      };

      const first = await sendAdminLoginAlertOnce(eventId, input);
      expect(first).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      const second = await sendAdminLoginAlertOnce(eventId, input);

      expect(second).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("successful retry after unblock is deduped on subsequent attempts", async () => {
      process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
      const eventId = "blb48-blocked-then-dedupe";
      const input = { username: "admin", occurredAt: new Date("2026-11-20T10:00:00.000Z") };

      expect(await sendAdminLoginAlertOnce(eventId, input)).toBe(false);
      delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      expect(await sendAdminLoginAlertOnce(eventId, input)).toBe(true);
      expect(await sendAdminLoginAlertOnce(eventId, input)).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("different event IDs remain independent across block/unblock", async () => {
      const input = { username: "admin", occurredAt: new Date("2026-11-20T10:00:00.000Z") };
      process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
      expect(await sendAdminLoginAlertOnce("evt-a", input)).toBe(false);
      expect(await sendAdminLoginAlertOnce("evt-b", input)).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      expect(await sendAdminLoginAlertOnce("evt-a", input)).toBe(true);
      expect(await sendAdminLoginAlertOnce("evt-b", input)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("concurrent same-event attempts during block do not cause duplicate sends or claim corruption", async () => {
      process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED = "true";
      const input = { username: "admin", occurredAt: new Date("2026-11-20T10:00:00.000Z") };
      const eventId = "blb48-concurrent-blocked";

      const results = await Promise.all([
        sendAdminLoginAlertOnce(eventId, input),
        sendAdminLoginAlertOnce(eventId, input),
        sendAdminLoginAlertOnce(eventId, input),
      ]);

      expect(results.every((r) => r === false)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();

      delete process.env.EMAIL_EXTERNAL_DELIVERY_BLOCKED;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      const afterUnblock = await Promise.all([
        sendAdminLoginAlertOnce(eventId, input),
        sendAdminLoginAlertOnce(eventId, input),
      ]);
      expect(afterUnblock.filter(Boolean)).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await sendAdminLoginAlertOnce(eventId, input)).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("UAT suppression and missing-config suppression retain existing claim behavior", async () => {
      // UAT suppression: claim retained
      process.env.UAT_SAFE_MODE = "true";
      const input = { username: "admin", occurredAt: new Date("2026-11-20T10:00:00.000Z") };
      expect(await sendAdminLoginAlertOnce("uat-evt", input)).toBe(false);
      delete process.env.UAT_SAFE_MODE;
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      expect(await sendAdminLoginAlertOnce("uat-evt", input)).toBe(false); // still claimed
      expect(fetchMock).not.toHaveBeenCalled();

      // Missing config: claim retained
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
      expect(await sendAdminLoginAlertOnce("cfg-evt", input)).toBe(false);
      process.env.ADMIN_NOTIFICATION_EMAIL = "security@example.com";
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      expect(await sendAdminLoginAlertOnce("cfg-evt", input)).toBe(false); // still claimed
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

});
