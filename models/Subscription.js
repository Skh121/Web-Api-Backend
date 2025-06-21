const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      required: true, // e.g., 'Basic', 'Pro'
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired"],
      default: "active",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Set the end date before saving
SubscriptionSchema.pre("save", function (next) {
  if (this.isNew) {
    const now = new Date();
    if (this.billingCycle === "yearly") {
      this.endDate = new Date(now.setFullYear(now.getFullYear() + 1));
    } else {
      this.endDate = new Date(now.setMonth(now.getMonth() + 1));
    }
  }
  next();
});

module.exports = mongoose.model("Subscription",SubscriptionSchema)