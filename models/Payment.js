const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.ObjectId,
      ref: "Subscription",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    paymentMethod: {
      type: String,
      default: "card", // Could be 'card', 'bank', etc.
    },
    status: {
      type: String,
      enum: ["succeeded", "pending", "failed"],
      default: "succeeded",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
