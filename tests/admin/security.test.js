const request = require("supertest");
const jwt = require("jsonwebtoken");
const mockingoose = require("mockingoose");
const bcrypt = require("bcrypt");
const express = require("express");

const securityRoutes = require("../../routes/admin/securityRoutes");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const Payment = require("../../models/Payment");
const Trade = require("../../models/Trade");
const Profile = require("../../models/Profile");
const Subscription = require("../../models/Subscription");

// Mock socket.io getIo emitter
const mockEmit = jest.fn();
jest.mock("../../middlewares/socketManager", () => ({
  getIo: () => ({
    to: () => ({
      emit: mockEmit,
    }),
  }),
}));

// Mock bcrypt functions
jest.mock("bcrypt");

// Express app with security routes
const app = express();
app.use(express.json());
app.use("/api/admin/settings/security", securityRoutes);

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
  role: "memberAdmin",
};

// Mock middleware (authorizedUser + isMemberAdmin)
jest.mock("../../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: user._id };
    next();
  },
  isMemberAdmin: (req, res, next) => next(),
}));

describe("Security Controller with Auth & Mocks", () => {
  let userToken;

  beforeAll(() => {
    userToken = generateToken(user);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore jest spies (like on User.findById)
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe("PATCH /change-password", () => {
    it("should return 400 if new passwords do not match", async () => {
      const res = await request(app)
        .patch("/api/admin/settings/security/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          currentPassword: "oldpass",
          newPassword: "newpass1",
          confirmPassword: "newpass2",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("New passwords do not match.");
    });

    it("should return 401 if current password is incorrect", async () => {
      // Mock User.findById to return user with hashed password
      mockingoose(User).toReturn(
        { _id: user._id, password: "hashedOldPass" },
        "findOne"
      );
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .patch("/api/admin/settings/security/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          currentPassword: "wrongOldPass",
          newPassword: "newpass",
          confirmPassword: "newpass",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Incorrect current password.");
    });

    it("should successfully change password and emit notification", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);

      // Spy on User.findById to return a user with save method
      jest.spyOn(User, "findById").mockResolvedValue({
        _id: user._id,
        password: "hashedOldPass",
        save: mockSave,
      });

      bcrypt.compare.mockResolvedValue(true);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedNewPass");

      const notificationMock = {
        _id: "notif123",
        recipient: user._id,
        type: "password_changed",
      };
      Notification.create = jest.fn().mockResolvedValue(notificationMock);

      const res = await request(app)
        .patch("/api/admin/settings/security/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          currentPassword: "oldpass",
          newPassword: "newpass",
          confirmPassword: "newpass",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Password updated successfully.");
      expect(mockSave).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalledWith({
        recipient: user._id,
        type: "password_changed",
        text: "Your password was successfully changed.",
        link: "/settings/security",
      });
      expect(mockEmit).toHaveBeenCalledWith(
        "new_notification",
        expect.objectContaining({
          recipient: user._id,
          type: "password_changed",
        })
      );
    });
  });

  describe("DELETE /me", () => {
    it("should delete user and associated data", async () => {
      mockingoose(Payment).toReturn({}, "deleteMany");
      mockingoose(Trade).toReturn({}, "deleteMany");
      mockingoose(Profile).toReturn({}, "deleteOne");
      mockingoose(Subscription).toReturn({}, "deleteOne");
      mockingoose(User).toReturn({}, "findOneAndDelete");

      const res = await request(app)
        .delete("/api/admin/settings/security/me")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe(
        "Your account and all associated data have been permanently deleted."
      );
    });
  });

  describe("GET /me/export", () => {
    it("should export user data", async () => {
      // Mock User.findById().select()
      jest.spyOn(User, "findById").mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          _id: user._id,
          fullName: "Test User",
          email: "test@example.com",
        }),
      }));

      mockingoose(Profile).toReturn({ bio: "Test bio" }, "findOne");
      mockingoose(Trade).toReturn(
        [{ _id: "trade1" }, { _id: "trade2" }],
        "find"
      );
      mockingoose(Subscription).toReturn({ plan: "basic" }, "findOne");
      mockingoose(Payment).toReturn([{ amount: 10 }], "find");

      const res = await request(app)
        .get("/api/admin/settings/security/me/export")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user._id).toBe(user._id);
      expect(res.body.profile.bio).toBe("Test bio");
      expect(res.body.trades).toHaveLength(2);
      expect(res.body.subscription.plan).toBe("basic");
      expect(res.body.payments).toHaveLength(1);
    });
  });
});
