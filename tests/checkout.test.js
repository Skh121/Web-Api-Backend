const request = require("supertest");
const mockingoose = require("mockingoose");
const stripe = require("stripe")(); // Use actual stripe in code, mocked below
const app = require("../app");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");

jest.mock("stripe", () => {
  const checkoutSessionMock = {
    id: "cs_test_123",
    url: "https://stripe.com/test-checkout",
    payment_status: "paid",
    metadata: {
      userId: "user123",
      plan: "Pro",
      isYearly: "true",
    },
    amount_total: 30000,
  };

  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue(checkoutSessionMock),
        retrieve: jest.fn().mockResolvedValue(checkoutSessionMock),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: checkoutSessionMock,
        },
      }),
    },
  }));
});

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

describe("POST /api/auth/checkout", () => {
  const validPlan = {
    name: "Pro",
    monthlyPrice: 30,
    yearlyPrice: 300,
  };

  afterEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app).post("/api/auth/checkout").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });
});

describe("POST /api/auth/checkout/verify-payment", () => {
  afterEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  it("should return 400 if sessionId is missing", async () => {
    const res = await request(app)
      .post("/api/auth/checkout/verify-payment")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Session ID is required/i);
  });

  it("should return 500 if Stripe throws an error", async () => {
    const stripe = require("stripe")();
    stripe.checkout.sessions.retrieve.mockRejectedValue(
      new Error("Stripe failed")
    );

    const res = await request(app)
      .post("/api/auth/checkout/verify-payment")
      .send({ sessionId: "cs_error" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Server error during payment verification");
  });
});
