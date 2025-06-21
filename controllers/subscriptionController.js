const Subscription = require("../models/Subscription");

exports.getMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      status: "active",
    });

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found." });
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      status: "active",
    });

    if (!subscription) {
      return res
        .status(404)
        .json({ message: "No active subscription to cancel." });
    }

    subscription.status = "canceled";
    subscription.endDate = new Date();

    await subscription.save();
    res
      .status(200)
      .json({ message: "Subscription canceled successfully.", subscription });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate(
      "userId",
      "fullName email"
    );
    res.status(200).json(subscriptions);
  } catch (error) {
    console.error("Error fetching all subscriptions:", error);
    res.status(500).json({ message: "Server error." });
  }
};
