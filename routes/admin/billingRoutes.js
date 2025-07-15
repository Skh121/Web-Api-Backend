const express = require("express");
const router = express.Router();
const {
  authorizedUser,
  isMemberAdmin,
} = require("../../middlewares/authenticateUser");
const {
  getSubscriptionStatus,
  createSubscription,
  getPaymentHistory
} = require("../../controllers/admin/billingManagement");

router.get("/status", authorizedUser, isMemberAdmin, getSubscriptionStatus);
router.get("/history", authorizedUser, isMemberAdmin, getPaymentHistory);
router.post("/subscribe", authorizedUser, isMemberAdmin, createSubscription);


module.exports = router;
