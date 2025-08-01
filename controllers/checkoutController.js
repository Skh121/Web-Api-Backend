const stripe = require("../config/stripe");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");

function buildSuccessUrl(clientUrl) {
  // Remove trailing slash if any for consistency
  const trimmedUrl = clientUrl.endsWith("/")
    ? clientUrl.slice(0, -1)
    : clientUrl;

  if (trimmedUrl.endsWith("/checkout-success")) {
    return `${trimmedUrl}?session_id={CHECKOUT_SESSION_ID}`;
  } else {
    return `${trimmedUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`;
  }
}

exports.handleCheckout = async (req, res) => {
  const userId = req.user.id;
  const { plan, isYearly, clientUrl } = req.body;

  if (!plan || typeof isYearly === "undefined" || !clientUrl) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: plan, isYearly, and clientUrl are required.",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const price = Number(isYearly ? plan?.yearlyPrice : plan?.monthlyPrice);

    if (!price || isNaN(price)) {
      return res.status(400).json({
        success: false,
        message: "Invalid price provided. Please check the plan details.",
      });
    }

    const successUrl = buildSuccessUrl(clientUrl);
    const cancelUrl = clientUrl.endsWith("/")
      ? clientUrl.slice(0, -1)
      : clientUrl;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.name} Plan (${isYearly ? "Yearly" : "Monthly"})`,
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: successUrl,
      cancel_url: `${cancelUrl}/checkout-cancel`,
      metadata: {
        userId: user._id.toString(),
        plan: plan.name,
        isYearly: isYearly.toString(), // stringify boolean for consistency
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error);
    res.status(500).json({ message: "Server error during checkout." });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const { userId, plan, isYearly } = session.metadata;
    const price = session.amount_total / 100;

    try {
      const user = await User.findById(userId);
      if (!user) return;

      const newSubscription = new Subscription({
        userId,
        plan,
        billingCycle: isYearly === "true" ? "yearly" : "monthly",
        price,
        status: "active",
      });
      await newSubscription.save();

      const newPayment = new Payment({
        userId,
        subscriptionId: newSubscription._id,
        amount: price,
        paymentMethod: "card",
        status: "succeeded",
      });
      await newPayment.save();

      user.role = "member";
      await user.save();
    } catch (err) {
      console.error("Webhook processing error:", err.message);
    }
  }

  res.status(200).send("Received webhook");
};

exports.verifyPayment = async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const userId = session.metadata.userId;
      const plan = session.metadata.plan;
      const isYearly = session.metadata.isYearly === "true";
      const price = session.amount_total / 100;

      const existingSubscription = await Subscription.findOne({
        userId,
        plan,
        price,
      });

      if (!existingSubscription) {
        const newSubscription = new Subscription({
          userId,
          plan,
          billingCycle: isYearly ? "yearly" : "monthly",
          price,
          status: "active",
        });
        await newSubscription.save();

        const newPayment = new Payment({
          userId,
          subscriptionId: newSubscription._id,
          amount: price,
          paymentMethod: "card",
          status: "succeeded",
        });
        await newPayment.save();

        const user = await User.findById(userId);
        if (user) {
          user.role = "member";
          await user.save();
        }
      }

      return res.json({
        success:true,
        message: "Payment verified and subscription updated",
      });
    } else {
      return res.status(400).json({ message: "Payment not completed" });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return res
      .status(500)
      .json({ message: "Server error during payment verification" });
  }
};
