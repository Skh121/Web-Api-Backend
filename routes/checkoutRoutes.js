const express = require("express");
const {
  handleCheckout,
  handleStripeWebhook,
  verifyPayment
} = require("../controllers/checkoutController");
const { authorizedUser } = require("../middlewares/authenticateUser");

const router = express.Router();

router.post("/", authorizedUser, handleCheckout);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

router.post("/verify-payment", authorizedUser, verifyPayment);

module.exports = router;
