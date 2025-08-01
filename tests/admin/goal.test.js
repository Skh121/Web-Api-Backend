// tests/admin/goal.test.js
const request = require("supertest");
const mockingoose = require("mockingoose");
const app = require("../../app");
const Goal = require("../../models/Goal");
const Trade = require("../../models/Trade");
const Notification = require("../../models/Notification");
const mongoose = require("mongoose");
const mockValidObjectId = new mongoose.Types.ObjectId();

// Mock socket
jest.mock("../../middlewares/socketManager", () => ({
  getIo: () => ({
    to: () => ({
      emit: jest.fn(),
    }),
  }),
}));

jest.mock("../../middlewares/authenticateUser", () => {
  return {
    authorizedUser: (req, res, next) => {
      req.user = { _id: mockValidObjectId, role: "member" };
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
  };
});

describe("Goal Controller", () => {
  afterEach(() => {
    mockingoose.resetAll();
    jest.clearAllMocks();
  });

  describe("POST /api/admin/goals", () => {
    it("should create a new goal", async () => {
      const goalPayload = {
        type: "pnl",
        period: "weekly",
        targetValue: 1000,
        startDate: "2025-07-01",
        endDate: "2025-07-30",
      };

      const mockSavedGoal = {
        ...goalPayload,
        _id: new mongoose.Types.ObjectId(),
      };

      mockingoose(Goal).toReturn(mockSavedGoal, "save");
      mockingoose(Notification).toReturn({}, "create");

      const res = await request(app).post("/api/admin/goals").send(goalPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("type", "pnl");
    });

    it("should return 400 if startDate >= endDate", async () => {
      const res = await request(app).post("/api/admin/goals").send({
        type: "pnl",
        period: "weekly",
        targetValue: 1000,
        startDate: "2025-08-01",
        endDate: "2025-07-01",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        "error",
        "startDate must be before endDate"
      );
    });
  });

  describe("GET /api/admin/goals", () => {
    it("should return all goals with progress", async () => {
      const mockGoals = [
        {
          _id: new mongoose.Types.ObjectId(),
          user: mockValidObjectId,
          type: "pnl",
          period: "weekly",
          targetValue: 1000,
          startDate: new Date("2025-07-01"),
          endDate: new Date("2025-07-30"),
          toObject() {
            return this;
          },
        },
      ];

      const mockTrades = [
        { entryPrice: 100, exitPrice: 120, positionSize: 1, side: "long" },
        { entryPrice: 200, exitPrice: 180, positionSize: 1, side: "short" },
      ];

      mockingoose(Goal).toReturn(mockGoals, "find");
      mockingoose(Trade).toReturn(mockTrades, "find");

      const res = await request(app).get("/api/admin/goals");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("progress");
    });
  });

  describe("PUT /api/admin/goals/:id", () => {
    it("should update an existing goal", async () => {
      const goalId = new mongoose.Types.ObjectId();
      const updated = { period: "monthly" };

      const mockGoalDoc = {
        _id: goalId,
        user: mockValidObjectId,
        type: "pnl",
        period: "weekly",
        targetValue: 1000,
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-30"),
        save: jest.fn().mockResolvedValue({
          _id: goalId,
          user: mockValidObjectId,
          ...updated,
        }),
      };

      mockingoose(Goal).toReturn(mockGoalDoc, "findOne");

      const res = await request(app)
        .put(`/api/admin/goals/${goalId}`)
        .send(updated);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("period", "monthly");
    });

    it("should return 404 if goal not found", async () => {
      mockingoose(Goal).toReturn(null, "findOne");

      const res = await request(app)
        .put(`/api/admin/goals/123456789012`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Goal not found");
    });

    it("should return 400 if invalid date range", async () => {
      const goalId = new mongoose.Types.ObjectId();
      mockingoose(Goal).toReturn(
        { _id: goalId, user: mockValidObjectId },
        "findOne"
      );

      const res = await request(app)
        .put(`/api/admin/goals/${goalId}`)
        .send({ startDate: "2025-08-01", endDate: "2025-07-01" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        "error",
        "startDate must be before endDate"
      );
    });
  });

  describe("DELETE /api/admin/goals/:id", () => {
    it("should delete the goal", async () => {
      const goalId = new mongoose.Types.ObjectId();
      mockingoose(Goal).toReturn({ _id: goalId }, "findOneAndDelete");

      const res = await request(app).delete(`/api/admin/goals/${goalId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Goal deleted");
    });

    it("should return 404 if goal not found", async () => {
      mockingoose(Goal).toReturn(null, "findOneAndDelete");

      const res = await request(app).delete(`/api/admin/goals/123456789012`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Goal not found");
    });
  });
});
