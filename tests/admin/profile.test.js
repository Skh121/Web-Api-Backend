const request = require("supertest");
const express = require("express");
const mockingoose = require("mockingoose");
const jwt = require("jsonwebtoken");
const path = require("path");

const profileRoutes = require("../../routes/admin/profileRoutes");
const Profile = require("../../models/Profile");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");

const app = express();
app.use(express.json());

// NOTE: Remove multer from here to avoid conflicts with controller's multer setup
// app.use("/api/admin/settings/profile", upload.single("avatar"), profileRoutes);
app.use("/api/admin/settings/profile", profileRoutes);

const userId = "507f1f77bcf86cd799439011";
const userToken = jwt.sign(
  {
    _id: userId,
    fullName: "Test User",
    email: "testuser@example.com",
    role: "memberAdmin",
  },
  process.env.SECRET || "testsecret",
  { expiresIn: "1h" }
);

// Mock auth middleware
jest.mock("../../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: userId };
    next();
  },
  isMemberAdmin: (req, res, next) => next(),
}));

describe("Profile Controller", () => {
  beforeEach(() => {
    // Spy Subscription.findOne to always return a dummy plan
    jest.spyOn(Subscription, "findOne").mockResolvedValue({ plan: "basic" });
  });

  afterEach(() => {
    mockingoose.resetAll();
    jest.restoreAllMocks();
  });

  describe("GET /me", () => {
    it("should return 404 if user not found", async () => {
      mockingoose(Profile).toReturn(null, "findOne");
      mockingoose(User).toReturn(null, "findById");

      const res = await request(app)
        .get("/api/admin/settings/profile/me")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found.");
    });
  });

  describe("PATCH /me", () => {
    it("should create new profile if none exists", async () => {
      const saveMock = jest.fn().mockResolvedValue(true);
      const populateMock = jest.fn().mockImplementation(function () {
        this.user = { fullName: "NewFirst NewLast", email: "test@example.com" };
        this.subscription = { plan: "premium" };
        return Promise.resolve(this);
      });

      mockingoose(Profile).toReturn(null, "findOne");
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: userId,
        fullName: "Old Name",
        save: jest.fn().mockResolvedValue(true),
      });

      jest.spyOn(Profile.prototype, "save").mockImplementation(saveMock);
      jest
        .spyOn(Profile.prototype, "populate")
        .mockImplementation(populateMock);

      const res = await request(app)
        .patch("/api/admin/settings/profile/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          firstName: "NewFirst",
          lastName: "NewLast",
          bio: "New bio",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Profile updated successfully");
      expect(saveMock).toHaveBeenCalled();
    });

    it("should return 404 if user not found during update", async () => {
      mockingoose(Profile).toReturn(null, "findOne");
      jest.spyOn(User, "findById").mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/admin/settings/profile/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          firstName: "Fail",
          lastName: "Case",
          bio: "test",
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found.");
    });
  });
});
