const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const mockingoose = require("mockingoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

jest.mock("nodemailer");

const sendMailMock = jest.fn();
nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

// Optional: mock getIo if used internally
jest.mock("../middlewares/socketManager", () => ({
  setupSocket: jest.fn(),
  getIo: jest.fn(() => ({
    to: jest.fn(() => ({ emit: jest.fn() })),
  })),
}));

describe("Auth Controller", () => {
  const testUser = {
    _id: "507f1f77bcf86cd799439011",
    fullName: "Test User",
    email: "test@example.com",
    password: "testpass123",
    role: "user",
  };

  let hashedPassword;
  let resetToken;

  beforeAll(async () => {
    process.env.EMAIL_USER = "dummy@example.com";
    process.env.EMAIL_PASS = "dummyPassword";
    process.env.CLIENT_URL = "http://localhost:5173";
    process.env.SECRET = "testsecret";

    hashedPassword = await bcrypt.hash(testUser.password, 10);
  });

  afterEach(() => {
    mockingoose.resetAll();
    sendMailMock.mockClear();
  });

  // ------------------ REGISTER ------------------
  describe("POST /api/auth/register", () => {
    it("should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testUser.email });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe("Please enter all the fields");
    });

    it("should register new user", async () => {
      mockingoose(User).toReturn(null, "findOne");
      mockingoose(User).toReturn(
        { ...testUser, password: hashedPassword },
        "save"
      );

      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });

    it("should return 409 for duplicate user", async () => {
      mockingoose(User).toReturn(testUser, "findOne");

      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.statusCode).toBe(409);
      expect(res.body.msg).toBe("User already exists");
    });
  });

  // ------------------ LOGIN ------------------
  describe("POST /api/auth/login", () => {
    it("should return 400 if fields missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email });

      expect(res.statusCode).toBe(400);
      expect(res.body.msg).toBe("Enter all the fields");
    });

    it("should return 404 if user not found", async () => {
      mockingoose(User).toReturn(null, "findOne");

      const res = await request(app).post("/api/auth/login").send({
        email: "unknown@example.com",
        password: "randompass",
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.msg).toBe("User not found");
    });

    it("should return 401 if password is incorrect", async () => {
      mockingoose(User).toReturn(
        { ...testUser, password: hashedPassword },
        "findOne"
      );

      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "wrongpass",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.msg).toBe("Invalid credentials");
    });

    it("should login successfully", async () => {
      mockingoose(User).toReturn(
        { ...testUser, password: hashedPassword },
        "findOne"
      );

      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.email).toBe(testUser.email);
    });
  });

  // ------------------ SEND RESET LINK ------------------
  describe("POST /api/auth/request-reset", () => {
    it("should return 404 if user is not found", async () => {
      mockingoose(User).toReturn(null, "findOne");

      const res = await request(app)
        .post("/api/auth/request-reset")
        .send({ email: "nouser@test.com" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should send reset email", async () => {
      mockingoose(User).toReturn(testUser, "findOne");

      const res = await request(app)
        .post("/api/auth/request-reset")
        .send({ email: testUser.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const html = sendMailMock.mock.calls[0][0].html;
      const match = html.match(/\/reset-password\/([\w-]+)/);
      resetToken = match ? match[1] : null;
      expect(resetToken).toBeTruthy();
    });
  });

  // ------------------ RESET PASSWORD ------------------
  describe("POST /api/auth/reset-password/:token", () => {
    it("should return 400 for invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password/invalidtoken")
        .send({
          password: "newpassword123",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid or expired token");
    });

    it("should reset password with valid token", async () => {
      const token = jwt.sign({ id: testUser._id }, process.env.SECRET, {
        expiresIn: "15m",
      });

      mockingoose(User).toReturn(testUser, "findByIdAndUpdate");

      const res = await request(app)
        .post(`/api/auth/reset-password/${token}`)
        .send({ password: "newpassword123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Password updated");
    });
  });
});
