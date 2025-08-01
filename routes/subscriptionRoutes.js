const express = require("express");
const {
  getMySubscription,
  cancelSubscription,
  getAllSubscriptions,
  getAvailablePlans,
} = require("../controllers/subscriptionController");
const { authorizedUser, isAdmin } = require("../middlewares/authenticateUser");

const router = express.Router();

router.get("/plans", getAvailablePlans);
router.get("/my", authorizedUser, getMySubscription);
router.put("/cancel", authorizedUser, cancelSubscription);
router.get("/", authorizedUser, isAdmin, getAllSubscriptions);

module.exports = router;
