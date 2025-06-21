const express = require("express");
const { 
    getMyPaymentHistory, 
    handlePaymentWebhook 
} = require("../controllers/paymentController");
const {authorizedUser} = require("../middlewares/authenticateUser");

const router = express.Router();

router.get("/my", authorizedUser, getMyPaymentHistory);
router.post("/webhook", handlePaymentWebhook);


module.exports = router;
