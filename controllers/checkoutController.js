const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");

exports.handleCheckout = async (req, res) => {
  const userId = req.user.id;
  const { plan, isYearly, paymentDetails } = req.body;

  if (!plan || typeof isYearly === "undefined" || !paymentDetails) {
    return res.status(400).json({
      message:
        "Missing required fields: plan, isYearly, and paymentDetails are required.",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newSubscription = new Subscription({
      userId: user._id,
      plan: plan.name,
      billingCycle: isYearly ? "yearly" : "monthly",
      price: isYearly ? plan.yearlyPrice : plan.monthlyPrice,
      status: "active",
    });
    await newSubscription.save();

    const newPayment = new Payment({
      userId: user._id,
      subscriptionId: newSubscription._id,
      amount: newSubscription.price,
      paymentMethod: paymentDetails.method || "card",
      status: "succeeded",
    });
    await newPayment.save();

    user.role = "member";
    await user.save();

    res.status(201).json({
      message: "Subscription created successfully!",
      subscription: newSubscription,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ message: "Server error during checkout." });
  }
};
