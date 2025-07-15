const { Server } = require("socket.io");

let io; // Shared socket instance

// Initializes Socket.IO
const setupSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on("join_user_room", (userId) => {
      socket.join(userId);
      console.log(`User ${socket.id} joined private notification room: ${userId}`);
    });

    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.id} joined room: ${conversationId}`);
    });

    socket.on("send_message", (data) => {
      socket.to(data.conversationId).emit("receive_message", data);
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected", socket.id);
    });
  });

  return io;
};

// Returns the socket instance
const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = {
  setupSocket,
  getIo,
};
