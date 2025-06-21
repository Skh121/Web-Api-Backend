const express = require("express");
const { handleCheckout } = require("../controllers/checkoutController");
const { authorizedUser } = require("../middlewares/authenticateUser");

const router = express.Router();
router.post("/", authorizedUser, handleCheckout);

module.exports = router;
