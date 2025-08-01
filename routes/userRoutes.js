const express = require("express");
const {
  registerUser,
  loginUser,
  sendResetLink,
  resetPassword,
  requestOtp,
  verifyOtp,
  resetPasswordWithOtp,
} = require("../controllers/userController");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/request-reset", sendResetLink);
router.post("/reset-password/:token", resetPassword);

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password-with-otp", resetPasswordWithOtp);

module.exports = router;
