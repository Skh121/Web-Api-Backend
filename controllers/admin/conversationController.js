const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const User = require("../../models/User");
const { getIo } = require("../../middlewares/socketManager");

// Get all conversations for a user (for the sidebar)
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
    })
      .populate("participants", "fullName role")
      .sort({ updatedAt: -1 });

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
    })
      .populate("sender", "fullName role")
      .populate("recipient", "fullName role")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("getMessages error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Create a new message and save it to the DB
const createMessage = async (req, res) => {
  try {
    const { conversationId, recipient, text, tempId } = req.body;
    const senderId = req.user.id;

    if (!text && !req.file) {
      return res
        .status(400)
        .json({ message: "Message text or file is required." });
    }

    let fileUrl = "";
    if (req.file) {
      fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.filename
      }`;
    }

    const messageData = {
      conversationId,
      sender: senderId,
      recipient,
      text,
      file: fileUrl,
    };

    const message = await Message.create(messageData);

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName role")
      .populate("recipient", "fullName role");

    const messageToEmit = populatedMessage.toObject();
    if (tempId) {
      messageToEmit.tempId = tempId;
    }

    const io = getIo();
    io.to(conversationId.toString()).emit("receive_message", messageToEmit); // <-- Use receive_message and conversationId room

    if (senderId.toString() !== recipient.toString()) {
      io.to(recipient.toString()).emit(
        "new_message", // Or change to "receive_message" for full consistency
        messageToEmit
      );
    }
    io.to(senderId.toString()).emit(
      "new_message", // Or change to "receive_message" for full consistency
      messageToEmit
    );

    await Conversation.findByIdAndUpdate(
      conversationId,
      { updatedAt: new Date() },
      { new: true }
    );

    // FIX: Respond with the populated message instead of the unpopulated one
    res.status(201).json(populatedMessage); // <--- THIS IS THE CHANGE
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
    let isNew = false;

    if (!conversation) {
      const newConversation = await Conversation.create({
        participants: [currentUserId, recipientId],
      });

      conversation = await Conversation.findById(newConversation._id).populate(
        "participants",
        "fullName role"
      );
      isNew = true;
    }

    res.json({ conversation: conversation.toObject(), isNew: isNew });
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
