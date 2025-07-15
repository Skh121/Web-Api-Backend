const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["pnl", "win_rate"], required: true },
  period: { type: String, enum: ["weekly", "monthly"], required: true },
  targetValue: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  achieved: { type: Boolean, default: false },
});

const Goal = mongoose.model("Goal", goalSchema);

module.exports = Goal;
