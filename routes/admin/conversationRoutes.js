const express = require("express");
const router = express.Router();
const { authorizedUser, isMemberAdmin } = require("../../middlewares/authenticateUser");
const {
  getConversations,
  getMessages,
  createMessage,
  findOrCreateConversation,
  getChatUsers
} = require("../../controllers/admin/conversationController");
const upload = require("../../middlewares/fileUpload");

router.get("/", authorizedUser, isMemberAdmin, getConversations);
router.get('/users', authorizedUser,isMemberAdmin, getChatUsers);
router.get(
  "/:conversationId/messages",
  authorizedUser,
  isMemberAdmin,
  getMessages
);
router.post("/messages", authorizedUser, isMemberAdmin,upload.single("file"), createMessage);
router.post('/find-or-create', authorizedUser,isMemberAdmin, findOrCreateConversation);


module.exports = router;
