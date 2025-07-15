const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const Profile = require("../../models/Profile");

const getSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user.id,
      status: "active",
    });
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const createSubscription = async (req, res) => {
  const { plan, billingCycle, price } = req.body;
  try {
    await Subscription.updateMany(
      { userId: req.user.id },
      { status: "canceled" }
    );
    const newSubscription = await Subscription.create({
      userId: req.user.id,
      plan,
      billingCycle,
      price,
    });

    await Payment.create({
      userId: req.user.id,
      subscriptionId: newSubscription._id,
      amount: price,
    });

    await Profile.findOneAndUpdate(
      { user: req.user.id },
      { subscription: newSubscription._id },
      { upsert: true }
    );

    res.status(201).json({ message: "Subscription created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(payments);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getSubscriptionStatus,
  createSubscription,
  getPaymentHistory,
};
