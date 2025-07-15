const express = require("express");
const {
  getMyProfile,
  updateMyProfile,
} = require("../../controllers/admin/profileManagement");
const {
  authorizedUser,
  isMemberAdmin,
} = require("../../middlewares/authenticateUser");
const upload = require("../../middlewares/fileUpload");
const router = express.Router();

router.get("/me", authorizedUser, isMemberAdmin, getMyProfile);
router.patch(
  "/me",
  authorizedUser,
  isMemberAdmin,
  upload.single("avatar"),
  updateMyProfile
);

module.exports = router;
