const express = require("express");
const { registerUser,loginUser,sendResetLink,resetPassword } = require("../controllers/userController");
const router = express.Router();

router.post("/register",registerUser)
router.post("/login",loginUser)
router.post("/request-reset", sendResetLink);
router.post("/reset-password/:token", resetPassword);

module.exports = router;