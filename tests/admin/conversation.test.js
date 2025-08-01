const request = require("supertest");
const mockingoose = require("mockingoose");
const mongoose = require("mongoose");
const app = require("../../app");
const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const User = require("../../models/User");

function mockFindWithPopulate(model, methodName, returnData) {
  const query = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(returnData),
  };
  jest.spyOn(model, methodName).mockReturnValue(query);
}
// Mock auth middleware to inject user with id and role
jest.mock("../../middlewares/authenticateUser", () => ({
  authorizedUser: (req, res, next) => {
    req.user = { id: "user123", role: "member" };
    next();
  },
  isMemberAdmin: (req, res, next) => {
    if (["member", "admin"].includes(req.user?.role)) return next();
    return res.status(403).json({ message: "Access denied" });
  },
  isAdmin: (req, res, next) => {
    if (req.user?.role === "admin") return next();
    return res.status(403).json({ message: "Access denied" });
  },
}));

describe("Conversation Controller", () => {
  afterEach(() => {
    mockingoose.resetAll();
  });

  describe("GET /api/admin/conversations/:conversationId/messages", () => {
    it("should return messages for conversation", async () => {
      const mockMessages = [
        {
          _id: new mongoose.Types.ObjectId(),
          conversationId: new mongoose.Types.ObjectId(),
          sender: new mongoose.Types.ObjectId(),
          recipient: new mongoose.Types.ObjectId(),
          text: "Hello",
        },
      ];
      mockingoose(Message).toReturn(mockMessages, "find");

      const res = await request(app).get(
        `/api/admin/conversations/${mockMessages[0].conversationId}/messages`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("text", "Hello");
    });
  });


  describe("POST /api/admin/conversations/find-or-create", () => {
    const mongoose = require("mongoose");
    const Conversation = require("../../models/Conversation");
    const Message = require("../../models/Message");
    const User = require("../../models/User");

    function mockFindWithPopulate(model, methodName, returnData) {
      const query = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(returnData),
      };
      jest.spyOn(model, methodName).mockReturnValue(query);
    }

    it("should return 400 if recipientId missing", async () => {
      const res = await request(app)
        .post("/api/admin/conversations/find-or-create")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "Recipient ID is required.");
    });
  });

  describe("GET /api/admin/conversations/users", () => {
    it("should return chat users for admin", async () => {
      // Override req.user to admin role for this test
      jest
        .spyOn(require("../../middlewares/authenticateUser"), "authorizedUser")
        .mockImplementation((req, res, next) => {
          req.user = { id: "admin123", role: "admin" };
          next();
        });

      const mockUsers = [
        {
          _id: new mongoose.Types.ObjectId(),
          fullName: "Admin User",
          role: "admin",
        },
        {
          _id: new mongoose.Types.ObjectId(),
          fullName: "Member User",
          role: "member",
        },
      ];
      mockingoose(User).toReturn(mockUsers, "find");

      const res = await request(app).get("/api/admin/conversations/users");

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty("role", "admin");
    });

    it("should return chat users for member", async () => {
      // Override req.user to member role for this test
      jest
        .spyOn(require("../../middlewares/authenticateUser"), "authorizedUser")
        .mockImplementation((req, res, next) => {
          req.user = { id: "member123", role: "member" };
          next();
        });

      const mockUsers = [
        {
          _id: new mongoose.Types.ObjectId(),
          fullName: "Admin User",
          role: "admin",
        },
      ];
      mockingoose(User).toReturn(mockUsers, "find");

      const res = await request(app).get("/api/admin/conversations/users");

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty("role", "admin");
    });
  });
});
