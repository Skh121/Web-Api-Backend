const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const User = require("../../models/User");

// Get all conversations for a user (for the sidebar)
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
    }).populate("participants", "fullName");
    res.json(conversations);
  } catch (error) {
    console.error("getConversations error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get all messages for a specific conversation
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    });
    res.json(messages);
  } catch (error) {
    console.error("getMessages error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Create a new message and save it to the DB
const createMessage = async (req, res) => {
  try {
    const { conversationId, recipient, text } = req.body;

    let fileUrl = "";
    if (req.file) {
      fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
    }

    const messageData = {
      conversationId,
      sender: req.user.id,
      recipient,
      text,
      file: fileUrl,
    };

    const message = await Message.create(messageData);

    res.status(201).json(message);
  } catch (error) {
    console.error("createMessage error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get chat users based on current user's role
const getChatUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    let users = [];

    if (currentUser.role === "admin") {
      users = await User.find({
        _id: { $ne: currentUser.id },
        role: { $in: ["admin", "member"] },
      }).select("fullName role");
    } else if (currentUser.role === "member") {
      users = await User.find({ role: "admin" }).select("fullName role");
    }

    res.json(users);
  } catch (error) {
    console.error("getChatUsers error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Find or create a conversation between current user and recipient
const findOrCreateConversation = async (req, res) => {
  const { recipientId } = req.body;
  const currentUserId = req.user.id;

  if (!recipientId) {
    return res.status(400).json({ message: "Recipient ID is required." });
  }

  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, recipientId] },
    }).populate("participants", "fullName role");

    if (!conversation) {
      const newConversation = await Conversation.create({
        participants: [currentUserId, recipientId],
      });

      conversation = await Conversation.findById(newConversation._id).populate(
        "participants",
        "fullName role"
      );
    }

    res.json(conversation);
  } catch (error) {
    console.error("findOrCreateConversation error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getConversations,
  getMessages,
  createMessage,
  findOrCreateConversation,
  getChatUsers,
};
