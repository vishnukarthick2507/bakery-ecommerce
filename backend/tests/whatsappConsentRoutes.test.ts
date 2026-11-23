import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";

import whatsappRoutes from "../src/routes/whatsappRoutes.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/whatsapp", whatsappRoutes);
  return app;
}

describe("Public WhatsApp consent HTTP endpoints (F2 remediation)", () => {
  const app = createApp();

  it("disables unauthenticated GET /api/whatsapp/consent/status without exposing consent data", async () => {
    const res = await request(app).get("/api/whatsapp/consent/status?phone=919840916058");

    expect(res.status).toBe(410);
    expect(res.body).toEqual({
      error: "This consent endpoint is unavailable.",
      code: "CONSENT_ENDPOINT_DISABLED",
    });
    expect(JSON.stringify(res.body)).not.toContain("hasConsent");
    expect(JSON.stringify(res.body)).not.toContain("transactional");
    expect(JSON.stringify(res.body)).not.toContain("marketing");
    expect(JSON.stringify(res.body)).not.toContain("consentTimestamp");
  });

  it("disables unauthenticated POST /api/whatsapp/consent/grant for arbitrary numbers", async () => {
    const res = await request(app)
      .post("/api/whatsapp/consent/grant")
      .send({ phone: "919840916058", source: "CHECKOUT" });

    expect(res.status).toBe(410);
    expect(res.body).toEqual({
      error: "This consent endpoint is unavailable.",
      code: "CONSENT_ENDPOINT_DISABLED",
    });
    expect(JSON.stringify(res.body)).not.toContain("granted");
    expect(JSON.stringify(res.body)).not.toContain("consentId");
  });

  it("disables unauthenticated POST /api/whatsapp/consent/withdraw for arbitrary numbers", async () => {
    const res = await request(app)
      .post("/api/whatsapp/consent/withdraw")
      .send({ phone: "919840916058", reason: "STOP", category: "MARKETING" });

    expect(res.status).toBe(410);
    expect(res.body).toEqual({
      error: "This consent endpoint is unavailable.",
      code: "CONSENT_ENDPOINT_DISABLED",
    });
    expect(JSON.stringify(res.body)).not.toContain("withdrawn");
    expect(JSON.stringify(res.body)).not.toContain("consentId");
  });

  it("does not expose alternate unauthenticated consent endpoints under /api/whatsapp", async () => {
    const statusPost = await request(app).post("/api/whatsapp/consent/status").send({ phone: "919840916058" });
    const grantGet = await request(app).get("/api/whatsapp/consent/grant?phone=919840916058");
    const withdrawGet = await request(app).get("/api/whatsapp/consent/withdraw?phone=919840916058");

    expect([404, 405, 410]).toContain(statusPost.status);
    expect([404, 405, 410]).toContain(grantGet.status);
    expect([404, 405, 410]).toContain(withdrawGet.status);

    for (const res of [statusPost, grantGet, withdrawGet]) {
      expect(JSON.stringify(res.body)).not.toContain("hasConsent");
      expect(JSON.stringify(res.body)).not.toContain("transactional");
      expect(JSON.stringify(res.body)).not.toContain("marketing");
    }
  });
});
