const Goal = require("../../models/Goal");
const Trade = require("../../models/Trade");
const { getPnl } = require("../../utils/tradeUtils");
const Notification = require("../../models/Notification");
const { getIo } = require("../../middlewares/socketManager");

// Helper to calculate PnL for user during period
const getUserPnlForPeriod = async (userId, startDate, endDate) => {
  const trades = await Trade.find({
    user: userId,
    status: "closed",
    exitDate: { $gte: startDate, $lte: endDate },
  });
  return trades.reduce((acc, trade) => acc + getPnl(trade), 0);
};

// Helper to calculate Win Rate for user during period
const getUserWinRateForPeriod = async (userId, startDate, endDate) => {
  const trades = await Trade.find({
    user: userId,
    status: "closed",
    exitDate: { $gte: startDate, $lte: endDate },
  });
  if (trades.length === 0) return 0;
  const wins = trades.filter((trade) => getPnl(trade) > 0);
  return (wins.length / trades.length) * 100;
};

// Create a new goal
exports.createGoal = async (req, res) => {
  try {
    const { type, period, targetValue, startDate, endDate } = req.body;
    const user = req.user._id; // Assuming you have authentication middleware

    if (new Date(startDate) >= new Date(endDate)) {
      return res
        .status(400)
        .json({ error: "startDate must be before endDate" });
    }

    const newGoal = new Goal({
      user,
      type,
      period,
      targetValue,
      startDate,
      endDate,
    });

    const savedGoal = await newGoal.save();

    const goalTypeLabel = type === "pnl" ? "P&L" : "Win Rate";
    const notificationText = `🎯 New ${goalTypeLabel} goal added for ${period}!`;

    const notification = await Notification.create({
      recipient: user,
      type: "goal_created",
      text: notificationText,
      link: "/goals",
    });
    getIo().to(user.toString()).emit("new_notification", notification);
    res.status(201).json(savedGoal);
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all goals for logged-in user with progress calculated
exports.getGoals = async (req, res) => {
  try {
    const user = req.user._id;
    const goals = await Goal.find({ user }).sort({ createdAt: -1 });

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        let progress = 0;
        if (goal.type === "pnl") {
          const pnl = await getUserPnlForPeriod(
            user,
            goal.startDate,
            goal.endDate
          );
          progress = (pnl / goal.targetValue) * 100;
        } else if (goal.type === "win_rate") {
          const winRate = await getUserWinRateForPeriod(
            user,
            goal.startDate,
            goal.endDate
          );
          progress = (winRate / goal.targetValue) * 100;
        }
        if (progress > 100) progress = 100;

        return {
          ...goal.toObject(),
          progress: progress.toFixed(1), // as percentage string with 1 decimal place
        };
      })
    );

    res.json(goalsWithProgress);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Update a goal by ID
exports.updateGoal = async (req, res) => {
  try {
    const user = req.user._id;
    const { id } = req.params;
    const updates = req.body;

    const goal = await Goal.findOne({ _id: id, user });
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    // Validate date range if updated
    if (
      updates.startDate &&
      updates.endDate &&
      new Date(updates.startDate) >= new Date(updates.endDate)
    ) {
      return res
        .status(400)
        .json({ error: "startDate must be before endDate" });
    }

    Object.assign(goal, updates);
    await goal.save();
    res.json(goal);
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete a goal by ID
exports.deleteGoal = async (req, res) => {
  try {
    const user = req.user._id;
    const { id } = req.params;
    const goal = await Goal.findOneAndDelete({ _id: id, user });
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json({ message: "Goal deleted" });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.checkAndNotifyGoalAchievement = async (userId) => {
  const now = new Date();
  const goals = await Goal.find({
    user: userId,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
  for (const goal of goals) {
    let progress = 0;
    if (goal.type === "pnl") {
      const pnl = await getUserPnlForPeriod(
        userId,
        goal.startDate,
        goal.endDate
      );
      progress = (pnl / goal.targetValue) * 100;
    } else if (goal.type === "win_rate") {
      const winRate = await getUserWinRateForPeriod(
        userId,
        goal.startDate,
        goal.endDate
      );
      progress = (winRate / goal.targetValue) * 100;
    }

    if (Math.round(progress) >= 100 && !goal.achieved) {
      // Mark goal as achieved so we don't notify repeatedly
      console.log(
        `[GoalCheck] Goal ${goal._id} has reached 100%, marking as achieved`
      );

      goal.achieved = true;
      await goal.save();

      // Create notification
      const goalTypeLabel = goal.type === "pnl" ? "P&L" : "Win Rate";
      const notificationText = `🎉 Congrats! You have achieved your ${goalTypeLabel} goal for ${goal.period}.`;

      const notification = await Notification.create({
        recipient: userId,
        type: "goal_achieved",
        text: notificationText,
        link: "/goals",
      });

      // Emit socket notification
      getIo().to(userId.toString()).emit("new_notification", notification);
    }
  }
};
