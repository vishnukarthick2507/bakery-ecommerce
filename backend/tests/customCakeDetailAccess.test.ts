
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
      const cakeRequest = await createTestCustomCakeRequest(customer._id.toString(), customer.phone);
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

