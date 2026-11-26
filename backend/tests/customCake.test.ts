import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import supertestRequest from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import { CustomCakeRequest } from "../src/models/CustomCakeRequest.js";
import { User } from "../src/models/User.js";
import { Admin } from "../src/models/Admin.js";
import { Order } from "../src/models/Order.js";
import customCakeRoutes from "../src/routes/customCakeRoutes.js";
import { csrfProtection } from "../src/middleware/csrf.js";
import { clearTestDB, disconnectTestDB } from "./testDatabase.js";

process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";
process.env.CORS_ORIGIN = "http://localhost:3000";

let mongoServer: MongoMemoryServer | undefined;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use("/api/custom-cake-requests", customCakeRoutes);
  return app;
}

const app = createTestApp();

function makeAdminToken(adminId: string): string {
  return jwt.sign(
    { adminId, username: "testadmin", role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

function makeCustomerToken(customerId: string): string {
  return jwt.sign(
    { customerId, accountType: "CUSTOMER", tokenVersion: 0 },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );
}

async function createTestAdmin() {
  return Admin.create({
    username: "testadmin",
    password: await require("bcryptjs").hash("CorrectPassword123", 10),
    role: "ADMIN",
  });
}

async function createTestCustomer() {
  return User.create({
    name: "Test Customer",
    email: `cake${Date.now()}@example.com`,
    phone: `9${String(Date.now()).slice(-9)}`,
    passwordHash: await require("bcryptjs").hash("Password123", 10),
    active: true,
    tokenVersion: 0,
  });
}

async function createTestCustomCakeRequest(customerId?: string, phone?: string) {
  return CustomCakeRequest.create({
    referenceNumber: `CC-TEST-${Date.now()}`,
    name: "Test Customer",
    phone: phone ?? "9840912345",
    flavour: "Chocolate Truffle",
    weight: "1 kg",
    theme: "Birthday",
    messageOnCake: "Happy Birthday",
    instructions: "Eggless",
    referenceImageUrl: "",
    status: "PENDING",
    userId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
  } as any);
}

describe("Custom Cake Proposal Workflow", () => {
  beforeAll(
    async () => {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          args: ["--replSet", "cake-rs"],
          launchTimeout: 60000,
        },
      });
      const uri = mongoServer.getUri();
      await mongoose.connect(uri, { directConnection: true });

      const db = mongoose.connection.db;
      if (!db) throw new Error("Database connection not established");
      const adminDb = db.admin();
      let lastError: unknown;
      for (let i = 0; i < 10; i++) {
        try {
          await adminDb.command({ replSetInitiate: {} });
          break;
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    },
    120000,
  );

  beforeEach(async () => {
    await clearTestDB();
    await createTestAdmin();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = undefined;
    }
  });


  describe("GET /api/custom-cake-requests/:id access", () => {
    it("allows an authenticated admin cookie to read a request", async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      const adminToken = makeAdminToken(admin!._id.toString());
      const cakeRequest = await createTestCustomCakeRequest();

      const response = await supertestRequest(app)
        .get(`/api/custom-cake-requests/${cakeRequest._id}`)
        .set("Cookie", `admin-token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.request._id).toBe(cakeRequest._id.toString());
    });

    it("allows only the owning authenticated customer to read a request", async () => {
      const customer = await createTestCustomer();
      const cakeRequest = await createTestCustomCakeRequest(customer._id.toString(), customer.phone ?? undefined);
      const customerToken = makeCustomerToken(customer._id.toString());

      const ownResponse = await supertestRequest(app)
        .get(`/api/custom-cake-requests/${cakeRequest._id}`)
        .set("Cookie", `customer-token=${customerToken}`);
      expect(ownResponse.status).toBe(200);

      const otherCustomer = await createTestCustomer();
      const otherToken = makeCustomerToken(otherCustomer._id.toString());
      const otherResponse = await supertestRequest(app)
        .get(`/api/custom-cake-requests/${cakeRequest._id}`)
        .set("Cookie", `customer-token=${otherToken}`);
      expect(otherResponse.status).toBe(403);
    });

    it("rejects unauthenticated detail requests", async () => {
      const cakeRequest = await createTestCustomCakeRequest();
      const response = await supertestRequest(app)
        .get(`/api/custom-cake-requests/${cakeRequest._id}`);
      expect(response.status).toBe(401);
    });
  });

  describe("Admin propose proposal", () => {
    let adminToken: string;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
    });

    it("admin can propose price and delivery on a pending request", async () => {
      const request = await createTestCustomCakeRequest();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Eggless chocolate truffle cake with fresh berries",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Proposal submitted");
      expect(response.body.request.status).toBe("CONTACTED");
      expect(response.body.request.proposedPrice).toBe(1250);
      expect(response.body.request.proposedDeliveryDate).toBe(deliveryDate);
      expect(response.body.request.proposedDeliveryTime).toBe(
        "2:00 PM - 4:00 PM",
      );
      expect(response.body.request.adminNotes).toContain("chocolate truffle");
      expect(response.body.request.adminContactedAt).toBeDefined();
      expect(response.body.request.customerConfirmed).toBe("PENDING");
    });

    it("admin cannot propose on a non-PENDING request", async () => {
      const request = await createTestCustomCakeRequest();
      request.status = "CONTACTED";
      await request.save();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Test proposal",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("already been contacted");
    });

    it("admin cannot propose on a CONFIRMED request", async () => {
      const request = await createTestCustomCakeRequest();
      request.status = "CONFIRMED";
      await request.save();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Test proposal",
        });

      expect(response.status).toBe(409);
    });

    it("admin cannot propose with negative price", async () => {
      const request = await createTestCustomCakeRequest();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: -100,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
        });

      expect(response.status).toBe(400);
    });

    it("admin cannot propose with past delivery date", async () => {
      const request = await createTestCustomCakeRequest();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const deliveryDate = yesterday.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("future");
    });

    it("unauthenticated admin cannot propose", async () => {
      const request = await createTestCustomCakeRequest();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
        });

      expect(response.status).toBe(401);
    });

    it("non-admin customer cannot propose", async () => {
      const customer = await createTestCustomer();
      const customerToken = makeCustomerToken(customer._id.toString());
      const request = await createTestCustomCakeRequest();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Customer respond to proposal", () => {
    let adminToken: string;
    let customerToken: string;
    let customer: any;
    let request: any;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      customer = await createTestCustomer();
      customerToken = makeCustomerToken(customer._id.toString());
      request = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);

      // Create a proposal
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Eggless chocolate truffle cake",
        });
    });

    it("customer can accept a proposal", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("confirmed");
      expect(response.body.request.customerConfirmed).toBe("CONFIRMED");
      expect(response.body.request.customerConfirmedAt).toBeDefined();
    });

    it("customer can decline a proposal", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "DECLINED" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("declined");
      expect(response.body.request.customerConfirmed).toBe("DECLINED");
      expect(response.body.request.customerConfirmedAt).toBeDefined();
    });

    it("another customer cannot respond to someone else's request", async () => {
      const otherCustomer = await createTestCustomer();
      const otherToken = makeCustomerToken(otherCustomer._id.toString());

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(403);
    });

    it("unauthenticated customer cannot respond", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(401);
    });

    it("responding to non-CONTACTED request fails", async () => {
      // Create a fresh PENDING request (no proposal yet)
      const pendingRequest = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${pendingRequest._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("not been contacted");
    });

    it("duplicate response is rejected", async () => {
      // First response
      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "CONFIRMED" });

      // Second response should be rejected
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "DECLINED" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("already been responded");
    });

    it("invalid response value is rejected", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "MAYBE" });

      expect(response.status).toBe(400);
    });
  });

  describe("Existing workflow compatibility", () => {
    let adminToken: string;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
    });

    it("existing requests without proposal fields remain accessible", async () => {
      const request = await createTestCustomCakeRequest();

      const response = await supertestRequest(app)
        .get("/api/custom-cake-requests")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.requests)).toBe(true);
      expect(
        response.body.requests.some((r: any) => r.referenceNumber === request.referenceNumber),
      ).toBe(true);
    });

    it("admin can still update status on existing requests", async () => {
      const request = await createTestCustomCakeRequest();

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "CONTACTED" });

      expect(response.status).toBe(200);
      expect(response.body.request.status).toBe("CONTACTED");
    });

    it("proposal does not create an Order", async () => {
      const request = await createTestCustomCakeRequest();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Test proposal",
        });

      const updated = await CustomCakeRequest.findById(request._id).lean();
      expect(updated!.convertedOrderId).toBeNull();
    });
  });

  describe("Customer response security verification", () => {
    let adminToken: string;
    let customerToken: string;
    let customer: any;
    let request: any;

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      customer = await createTestCustomer();
      customerToken = makeCustomerToken(customer._id.toString());
      request = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);

      // Create a proposal
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];

      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: "2:00 PM - 4:00 PM",
          adminNotes: "Eggless chocolate truffle cake",
        });
    });

    it("customer with valid cookie and correct Origin passes CSRF", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${customerToken}`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      // Should pass CSRF (Origin matches trusted origin), may fail at auth
      // but should NOT be rejected by CSRF (403)
      expect(response.status).not.toBe(403);
    });

    it("customer with valid cookie but wrong Origin gets CSRF rejection", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${customerToken}`)
        .set("Origin", "https://evil.com")
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("untrusted origin");
    });

    it("customer without cookie but with Origin header is not CSRF-protected (no auth cookie)", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      // No auth cookie = no CSRF check, falls through to auth middleware (401)
      expect(response.status).toBe(401);
    });

    it("another customer cannot respond to someone else's request (cross-customer blocked)", async () => {
      const otherCustomer = await createTestCustomer();
      const otherToken = makeCustomerToken(otherCustomer._id.toString());

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${otherToken}`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not authorized");
    });

    it("customer with mismatched phone cannot respond (phone normalization consistency)", async () => {
      // Create a customer with a different phone than the request
      const mismatchedCustomer = await User.create({
        name: "Mismatched Customer",
        email: `mismatch${Date.now()}@example.com`,
        phone: "9876543210",
        passwordHash: await require("bcryptjs").hash("Password123", 10),
        active: true,
        tokenVersion: 0,
      });
      const mismatchedToken = makeCustomerToken(mismatchedCustomer._id.toString());

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${mismatchedToken}`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not authorized");
    });

    it("phone-based ownership: customer responds successfully with matching phone", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${customerToken}`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("confirmed");
      expect(response.body.request.customerConfirmed).toBe("CONFIRMED");
    });

    it("customer with tampered JWT cannot respond", async () => {
      const tamperedToken = customerToken + "tampered";

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${request._id}/respond`)
        .set("Cookie", `customer-token=${tamperedToken}`)
        .set("Origin", "http://localhost:3000")
        .send({ response: "CONFIRMED" });

      expect(response.status).toBe(401);
    });
  });


  describe("Admin convert to order", () => {
    let adminToken: string;
    let customer: any;
    let customerToken: string;
    let eligibleRequest: any;

    async function proposeAndConfirm(requestId: string, custToken: string) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];
      const deliveryTime = "2:00 PM";

      const proposeRes = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${requestId}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          proposedPrice: 1250,
          proposedDeliveryDate: deliveryDate,
          proposedDeliveryTime: deliveryTime,
          adminNotes: "Eggless chocolate truffle cake",
        });
      expect(proposeRes.status).toBe(200);

      const respondRes = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${requestId}/respond`)
        .set("Authorization", `Bearer ${custToken}`)
        .send({ response: "CONFIRMED" });
      expect(respondRes.status).toBe(200);
    }

    beforeEach(async () => {
      const admin = await Admin.findOne({ username: "testadmin" });
      adminToken = makeAdminToken(admin!._id.toString());
      customer = await createTestCustomer();
      customerToken = makeCustomerToken(customer._id.toString());
      eligibleRequest = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);
      await proposeAndConfirm(eligibleRequest._id.toString(), customerToken);
    });

    it("converts an accepted request to a PAY_AT_STORE pending PLACED order, links request, and preserves customer/tracking details without auto-linking userId", async () => {
      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(201);
      expect(response.body.message).toContain("converted");
      expect(response.body.order.paymentMethod).toBe("PAY_AT_STORE");
      expect(response.body.order.paymentStatus).toBe("PENDING");
      expect(response.body.order.orderStatus).toBe("PLACED");
      expect(response.body.order.fulfillmentType).toBe("PICKUP");
      expect(response.body.order.totalAmount).toBe(1250);
      expect(response.body.order.scheduledDate).toBe(eligibleRequest.proposedDeliveryDate || (await CustomCakeRequest.findById(eligibleRequest._id).lean())!.proposedDeliveryDate);
      expect(response.body.order.customCakeRequestId).toBe(eligibleRequest._id.toString());
      expect(response.body.order.userId).toBeNull();
      expect(response.body.order.orderNumber).toMatch(/^SV-\d{8}-\d{4}$/);

      const orderInDb = await Order.findById(response.body.order.id).lean();
      expect(orderInDb).toBeTruthy();
      expect(orderInDb!.paymentMethod).toBe("PAY_AT_STORE");
      expect(orderInDb!.paymentStatus).toBe("PENDING");
      expect(orderInDb!.orderStatus).toBe("PLACED");
      expect(orderInDb!.customCakeRequestId?.toString()).toBe(eligibleRequest._id.toString());
      expect(orderInDb!.userId).toBeUndefined();
      expect(orderInDb!.customerName).toBe("Test Customer");
      expect(orderInDb!.phone).toBe(customer.phone);
      expect(orderInDb!.customer?.name).toBe("Test Customer");
      expect(orderInDb!.customer?.phone).toBe(customer.phone);
      expect(orderInDb!.items).toHaveLength(1);
      expect(orderInDb!.items[0]!.productName).toContain("Chocolate Truffle");
      expect(orderInDb!.items[0]!.unitPrice).toBe(1250);
      expect(orderInDb!.items[0]!.quantity).toBe(1);
      expect(orderInDb!.items[0]!.productId).toBeUndefined();

      const requestInDb = await CustomCakeRequest.findById(eligibleRequest._id).lean();
      expect(requestInDb!.convertedOrderId?.toString()).toBe(orderInDb!._id.toString());
      expect(requestInDb!.convertedAt).toBeTruthy();
    });

    it("rejects conversion when request is not CONTACTED or not customer-confirmed", async () => {
      const pending = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);
      const resPending = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${pending._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();
      expect(resPending.status).toBe(409);
      expect(await Order.countDocuments()).toBe(0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const declined = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);
      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${declined._id}/propose`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ proposedPrice: 900, proposedDeliveryDate: tomorrow.toISOString().split("T")[0], proposedDeliveryTime: "3:00 PM" });
      await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${declined._id}/respond`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ response: "DECLINED" });
      const resDeclined = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${declined._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();
      expect(resDeclined.status).toBe(409);
      expect(await Order.countDocuments()).toBe(0);
    });

    it("requires admin authentication", async () => {
      const resNoAuth = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .send();
      expect(resNoAuth.status).toBe(401);

      const resCustomer = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send();
      expect(resCustomer.status).toBe(401);
      expect(await Order.countDocuments()).toBe(0);
    });

    it("is idempotent for duplicate conversion requests", async () => {
      const first = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();
      expect(first.status).toBe(201);

      const second = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();
      expect(second.status).toBe(200);
      expect(second.body.order.id).toBe(first.body.order.id);
      expect(second.body.order.orderNumber).toBe(first.body.order.orderNumber);
      expect(await Order.countDocuments()).toBe(1);

      const requestInDb = await CustomCakeRequest.findById(eligibleRequest._id).lean();
      expect(requestInDb!.convertedOrderId?.toString()).toBe(first.body.order.id);
    });

    it("handles concurrent conversion requests safely (creates exactly one order)", async () => {
      const [a, b, c] = await Promise.all([
        supertestRequest(app).patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`).set("Authorization", `Bearer ${adminToken}`).send(),
        supertestRequest(app).patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`).set("Authorization", `Bearer ${adminToken}`).send(),
        supertestRequest(app).patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`).set("Authorization", `Bearer ${adminToken}`).send(),
      ]);

      const statuses = [a.status, b.status, c.status].sort();
      expect(statuses.filter((s) => s === 201).length).toBe(1);
      expect(statuses.filter((s) => s === 200).length).toBe(2);
      expect(await Order.countDocuments()).toBe(1);

      const orderIds = [a.body.order?.id, b.body.order?.id, c.body.order?.id].filter(Boolean);
      expect(new Set(orderIds).size).toBe(1);
      const requestInDb = await CustomCakeRequest.findById(eligibleRequest._id).lean();
      expect(requestInDb!.convertedOrderId?.toString()).toBe(orderIds[0]);
    });

    it("does not reserve ordinary product inventory for custom cake orders", async () => {
      const movementsBefore = await mongoose.connection.db!.collection("inventorymovements").countDocuments();
      const productsBefore = await mongoose.connection.db!.collection("products").find({}).toArray();

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${eligibleRequest._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();
      expect(response.status).toBe(201);

      const movementsAfter = await mongoose.connection.db!.collection("inventorymovements").countDocuments();
      const productsAfter = await mongoose.connection.db!.collection("products").find({}).toArray();
      expect(movementsAfter).toBe(movementsBefore);
      expect(productsAfter).toEqual(productsBefore);
    });

    it("does not auto-link an existing active User with a matching but unverified phone, and conversion still succeeds without userId", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const matchedPhone = "9123456789";
      const existingUser = await User.create({
        name: "Existing Match",
        email: `match${Date.now()}@example.com`,
        phone: matchedPhone,
        passwordHash: "x",
        active: true,
        tokenVersion: 0,
        // no phone verification state exists/proven for this request
      } as any);

      const reqDoc = await CustomCakeRequest.create({
        referenceNumber: `CC-MATCH-${Date.now()}`,
        name: "Matching Customer",
        phone: matchedPhone,
        flavour: "Vanilla",
        weight: "1 kg",
        theme: "Simple",
        messageOnCake: "",
        instructions: "",
        referenceImageUrl: "",
        status: "CONTACTED",
        proposedPrice: 900,
        proposedDeliveryDate: tomorrow.toISOString().split("T")[0],
        proposedDeliveryTime: "3:00 PM",
        adminNotes: "",
        customerConfirmed: "CONFIRMED",
        customerConfirmedAt: new Date(),
        adminContactedAt: new Date(),
      } as any);

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${reqDoc._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(201);
      expect(response.body.order.userId).toBeNull();
      expect(response.body.order.customCakeRequestId).toBe(reqDoc._id.toString());

      const orderInDb = await Order.findById(response.body.order.id).lean();
      expect(orderInDb).toBeTruthy();
      expect(orderInDb!.userId).toBeUndefined();
      expect(existingUser._id.toString()).toBeTruthy(); // user exists but must not be linked
    });

    it("keeps customer details and order tracking information intact when converted without userId", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split("T")[0];
      const reqDoc = await CustomCakeRequest.create({
        referenceNumber: `CC-GUEST-${Date.now()}`,
        name: "Guest Name",
        phone: "9000000001",
        flavour: "Red Velvet",
        weight: "2 kg",
        theme: "Anniversary",
        messageOnCake: "Congrats",
        instructions: "No nuts",
        referenceImageUrl: "",
        status: "CONTACTED",
        proposedPrice: 1800,
        proposedDeliveryDate: deliveryDate,
        proposedDeliveryTime: "4:00 PM",
        adminNotes: "Handle with care",
        customerConfirmed: "CONFIRMED",
        customerConfirmedAt: new Date(),
        adminContactedAt: new Date(),
      } as any);

      const response = await supertestRequest(app)
        .patch(`/api/custom-cake-requests/${reqDoc._id}/convert`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();

      expect(response.status).toBe(201);
      expect(response.body.order.userId).toBeNull();
      expect(response.body.order.orderNumber).toMatch(/^SV-\d{8}-\d{4}$/);
      expect(response.body.order.paymentStatus).toBe("PENDING");
      expect(response.body.order.orderStatus).toBe("PLACED");
      expect(response.body.order.fulfillmentType).toBe("PICKUP");
      expect(response.body.order.scheduledDate).toBe(deliveryDate);
      expect(response.body.order.scheduledTime).toBe("4:00 PM");

      const orderInDb = await Order.findById(response.body.order.id).lean();
      expect(orderInDb!.userId).toBeUndefined();
      expect(orderInDb!.customerName).toBe("Guest Name");
      expect(orderInDb!.phone).toBe("9000000001");
      expect(orderInDb!.customer?.name).toBe("Guest Name");
      expect(orderInDb!.customer?.phone).toBe("9000000001");
      expect(orderInDb!.items[0]!.productName).toContain("Red Velvet");
      expect(orderInDb!.totalAmount).toBe(1800);
    });
  });


});
