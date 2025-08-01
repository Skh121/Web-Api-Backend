const dotenv = require("dotenv");
dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const { setupSocket } = require("./middlewares/socketManager");

const PORT = process.env.PORT || 5050;

const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocket(server);
app.set("io", io);

const startServer = async () => {
  try {
    await connectDB();
    if (process.env.NODE_ENV !== "test") {
      const { initScheduledJobs } = require("./services/scheduler");
      initScheduledJobs();
    }
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server startup error:", err);
  }
};

startServer();
