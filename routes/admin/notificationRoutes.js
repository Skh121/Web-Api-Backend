const express = require("express");
const router = express.Router();
const {
  authorizedUser,
  isMemberAdmin,
} = require("../../middlewares/authenticateUser");
const {
  getMyNotifications,
  markNotificationsAsRead,
} = require("../../controllers/admin/notificationController");

router.get("/", authorizedUser, isMemberAdmin, getMyNotifications);
router.post("/read", authorizedUser, isMemberAdmin, markNotificationsAsRead);

module.exports = router;
