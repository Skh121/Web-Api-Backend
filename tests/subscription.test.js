const request = require("supertest");
const jwt = require("jsonwebtoken");
const mockingoose = require("mockingoose");
const app = require("../app"); // or "../index" — your express app export
const Subscription = require("../models/Subscription");
const User = require("../models/User");

// Helper to generate JWT token for a user
const generateToken = (user) => {
  return jwt.sign(user, process.env.SECRET || "testsecret", {
    expiresIn: "1h",
  });
};

// Mock users for tests
const user = {
  _id: "507f1f77bcf86cd799439011",
  fullName: "Test User",
  email: "testuser@example.com",
  role: "user",
};

const admin = {
  _id: "507f1f77bcf86cd799439099",
  fullName: "Admin User",
  email: "admin@example.com",
  role: "admin",
};

beforeEach(() => {
  // 🛠 Mock User.findOne for the auth middleware
  mockingoose(User).toReturn((query) => {
    const id = query.getQuery()._id;
    if (id === user._id) return user;
    if (id === admin._id) return admin;
    return null;
  }, "findOne");
});

describe("Subscription Controller (with mock auth & mockingoose)", () => {
  let userToken;
  let adminToken;

  beforeAll(() => {
    userToken = generateToken(user);
    adminToken = generateToken(admin);
  });

  afterEach(() => {
    mockingoose.resetAll();
  });

  describe("GET /api/auth/subscription/my", () => {
    it("should return 404 if user has no active subscription", async () => {
      mockingoose(Subscription).toReturn(null, "findOne");

      const res = await request(app)
        .get("/api/auth/subscription/my")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No active subscription found.");
    });

    it("should return active subscription if exists", async () => {
      const fakeSubscription = {
        _id: "60f7f27b8f1b2c001f6e2abc",
        userId: user._id,
        status: "active",
        plan: "basic",
        startDate: new Date(),
        endDate: null,
      };

      mockingoose(Subscription).toReturn(fakeSubscription, "findOne");

      const res = await request(app)
        .get("/api/auth/subscription/my")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("active");
      expect(res.body.userId).toBe(user._id);
    });
  });

  describe("PUT /api/auth/subscription/cancel", () => {
    it("should return 404 if no active subscription exists", async () => {
      mockingoose(Subscription).toReturn(null, "findOne");

      const res = await request(app)
        .put("/api/auth/subscription/cancel")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No active subscription to cancel.");
    });

    it("should cancel active subscription", async () => {
      const doc = new Subscription({
        _id: "60f7f27b8f1b2c001f6e2abc",
        userId: user._id,
        status: "active",
      });

      doc.save = jest
        .fn()
        .mockResolvedValue({ ...doc.toObject(), status: "canceled" });

      mockingoose(Subscription).toReturn(doc, "findOne");

      const res = await request(app)
        .put("/api/auth/subscription/cancel")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Subscription canceled successfully.");
      expect(res.body.subscription.status).toBe("canceled");
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe("GET /api/auth/subscription/ (admin only)", () => {
    it("should forbid non-admins", async () => {
      const res = await request(app)
        .get("/api/auth/subscription/")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Admin privilage required");
    });

    it("should return all subscriptions for admin", async () => {
      const fakeSubscriptions = [
        {
          _id: "60f7f27b8f1b2c001f6e2abc",
          userId: {
            _id: "507f1f77bcf86cd799439011",
            fullName: "Test User",
            email: "testuser@example.com",
          },
          plan: "basic",
          status: "active",
        },
        {
          _id: "60f7f27b8f1b2c001f6e2def",
          userId: {
            _id: "507f1f77bcf86cd799439022",
            fullName: "Other User",
            email: "otheruser@example.com",
          },
          plan: "premium",
          status: "canceled",
        },
      ];

      // Properly mock .populate().exec() and await-able populate
      jest.spyOn(Subscription, "find").mockReturnValue({
        populate: jest.fn().mockImplementation(() => ({
          exec: jest.fn().mockResolvedValue(fakeSubscriptions),
          then: (cb) => cb(fakeSubscriptions),
        })),
      });

      const res = await request(app)
        .get("/api/auth/subscription/")
        .set("Authorization", `Bearer ${adminToken}`);

      console.log("RES.BODY =>", JSON.stringify(res.body, null, 2));

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].userId.fullName).toBe("Test User");
    });
  });
});
