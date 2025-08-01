const request = require("supertest");
const mockingoose = require("mockingoose");
const app = require("../app");
const Payment = require("../models/Payment");
const jwt = require("jsonwebtoken");

// Mock token middleware
jest.mock("../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: "user123", role: "user" };
    next();
  },
  isAdmin: (req, res, next) => {
    if (req.user?.role === "admin") return next();
    return res.status(403).json({ message: "Access denied" });
  },
  isMemberAdmin: (req, res, next) => {
    if (["member", "admin"].includes(req.user?.role)) return next();
    return res
      .status(403)
      .json({ message: "Access denied (member or admin only)" });
  },
}));

describe("Payment Controller", () => {
  afterEach(() => {
    mockingoose.resetAll();
  });

  describe("GET /api/auth/payment/my", () => {
    it("should return payment history for the authenticated user", async () => {
      const mockPayments = [
        {
          _id: "1",
          userId: "user123",
          amount: 288,
          createdAt: new Date(),
        },
      ];

      mockingoose(Payment).toReturn(mockPayments, "find");

      const res = await request(app).get("/api/auth/payment/my");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        amount: 288,
        status: expect.any(String),
      });
    });

    it("should return 404 if no payments found", async () => {
      mockingoose(Payment).toReturn([], "find");

      const res = await request(app).get("/api/auth/payment/my");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No payment history found.");
    });

    it("should return 500 if an error occurs", async () => {
      mockingoose(Payment).toReturn(new Error("DB Error"), "find");

      const res = await request(app).get("/api/auth/payment/my");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Server error.");
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("should handle invoice.payment_succeeded event", async () => {
      const event = {
        type: "invoice.payment_succeeded",
        data: { object: { subscription: "sub_123" } },
      };

      const res = await request(app)
        .post("/api/auth/payment/webhook")
        .send(event);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it("should handle invoice.payment_failed event", async () => {
      const event = {
        type: "invoice.payment_failed",
        data: { object: { subscription: "sub_456" } },
      };

      const res = await request(app)
        .post("/api/auth/payment/webhook")
        .send(event);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it("should handle unhandled event types gracefully", async () => {
      const event = {
        type: "random.unknown_event",
        data: { object: {} },
      };

      const res = await request(app)
        .post("/api/auth/payment/webhook")
        .send(event);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });
});
