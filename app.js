require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// Routes
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const adminRoutes = require("./routes/admin/adminRoutes");
const logRoutes = require("./routes/admin/logRoutes");
const profileRoutes = require("./routes/admin/profileRoutes");
const securityRoutes = require("./routes/admin/securityRoutes");
const billingRoutes = require("./routes/admin/billingRoutes");
const conversationRoutes = require("./routes/admin/conversationRoutes");
const notificationRoutes = require("./routes/admin/notificationRoutes");
const goalRoutes = require("./routes/admin/goalRoutes");

const app = express();
const corsOptions = {
  origin: "*",
};

app.use(express.json());
app.use(cors(corsOptions));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/auth", userRoutes);
app.use("/api/auth/payment", paymentRoutes);
app.use("/api/auth/checkout", checkoutRoutes);
app.use("/api/auth/subscription", subscriptionRoutes);
app.use("/api/admin/user", adminRoutes);
app.use("/api/admin/log", logRoutes);
app.use("/api/admin/settings/profile", profileRoutes);
app.use("/api/admin/settings/security", securityRoutes);
app.use("/api/admin/settings/billing", billingRoutes);
app.use("/api/admin/conversations", conversationRoutes);
app.use("/api/admin/notifications", notificationRoutes);
app.use("/api/admin/goals", goalRoutes);

module.exports = app;
