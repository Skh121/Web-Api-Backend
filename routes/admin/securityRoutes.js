const express = require("express");
const router = express.Router();
const {
  authorizedUser,
  isMemberAdmin,
} = require("../../middlewares/authenticateUser");
const {
  changePassword,
  deleteMyAccount,
  exportMyData,
} = require("../../controllers/admin/securityController");

router.patch("/change-password", authorizedUser, isMemberAdmin, changePassword);
router.delete("/me", authorizedUser, isMemberAdmin, deleteMyAccount);
router.get("/me/export", authorizedUser, isMemberAdmin, exportMyData);

module.exports = router;
