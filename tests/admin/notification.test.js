const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mockingoose = require("mockingoose");
const Notification = require("../../models/Notification");

const notificationRoutes = require("../../routes/admin/notificationRoutes");

// Mock authentication middleware
jest.mock("../../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: "user123" };
    next();
  },
  isMemberAdmin: (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use("/api/admin/notifications", notificationRoutes);

// Token generator
const userToken = jwt.sign(
  { _id: "user123", fullName: "Test User", role: "memberAdmin" },
  process.env.SECRET || "testsecret"
);

describe("Notification Controller", () => {
  afterEach(() => {
    mockingoose.resetAll();
    jest.restoreAllMocks();
  });

  describe("GET /api/admin/notifications", () => {
    it("should return a list of notifications sorted by latest", async () => {
      const mockNotification = {
        _id: "notif1",
        message: "Welcome!",
        isRead: false,
        createdAt: new Date().toISOString(),
        sender: {
          _id: "sender123",
          fullName: "Admin",
        },
      };

      // Instead of using mockingoose here, mock Mongoose directly
      jest.spyOn(Notification, "find").mockReturnValueOnce({
        sort: () => ({
          limit: () => ({
            populate: () => Promise.resolve([mockNotification]),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/notifications")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].sender.fullName).toBe("Admin");
    });
  });

  describe("POST /api/admin/notifications/read", () => {
    it("should mark unread notifications as read", async () => {
      const updateMock = jest
        .spyOn(Notification, "updateMany")
        .mockResolvedValue({
          modifiedCount: 3,
          acknowledged: true,
        });

      const res = await request(app)
        .post("/api/admin/notifications/read")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Notifications marked as read.");
      expect(updateMock).toHaveBeenCalledWith(
        { recipient: "user123", isRead: false },
        { isRead: true }
      );
    });
  });
});
