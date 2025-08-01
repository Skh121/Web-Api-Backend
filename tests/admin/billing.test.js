const request = require("supertest");
const mockingoose = require("mockingoose");
const app = require("../../app");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const Profile = require("../../models/Profile");

jest.mock("../../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: "user123", role: "member" }; // simulate a logged-in member
    next();
  },
  isMemberAdmin: (req, res, next) => {
    if (["member", "admin"].includes(req.user?.role)) return next();
    return res
      .status(403)
      .json({ message: "Access denied (member or admin only)" });
  },
  isAdmin: (req, res, next) => {
    if (req.user?.role === "admin") return next();
    return res.status(403).json({ message: "Access denied" });
  },
}));

describe("Billing Controller", () => {
  afterEach(() => mockingoose.resetAll());

  describe("GET /api/admin/settings/billing/status", () => {
    it("should return active subscription", async () => {
      const mockSubscription = {
        _id: "sub123",
        userId: "user123",
        plan: "Pro",
        billingCycle: "monthly",
        status: "active",
      };

      mockingoose(Subscription).toReturn(mockSubscription, "findOne");

      const res = await request(app).get("/api/admin/settings/billing/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("plan", "Pro");
    });
  });

  describe("POST /api/admin/settings/billing/create", () => {
    it("should cancel old and create new subscription with payment", async () => {
      const newSubscription = {
        _id: "subNew",
        userId: "user123",
        plan: "Pro",
        billingCycle: "monthly",
        price: 30,
      };

      mockingoose(Subscription).toReturn(
        { acknowledged: true, modifiedCount: 1 },
        "updateMany"
      );
      mockingoose(Subscription).toReturn(newSubscription, "save");
      mockingoose(Subscription).toReturn(newSubscription, "subscribe"); // optional, but safe
      mockingoose(Payment).toReturn({}, "subscribe");
      mockingoose(Profile).toReturn({}, "findOneAndUpdate");

      const res = await request(app)
        .post("/api/admin/settings/billing/subscribe")
        .send({ plan: "Pro", billingCycle: "monthly", price: 30 });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Subscription created successfully");
    });
  });

  describe("GET /api/admin/settings/billing/history", () => {
    it("should return payment history", async () => {
      const mockPayments = [
        { _id: "p1", userId: "user123", amount: 30, createdAt: new Date() },
      ];

      mockingoose(Payment).toReturn(mockPayments, "find");

      const res = await request(app).get("/api/admin/settings/billing/history");

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty("amount", 30);
    });
  });
});
