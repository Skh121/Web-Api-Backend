const cron = require("node-cron");
const User = require("../models/User");
const Trade = require("../models/Trade");
const Notification = require("../models/Notification");
const { getIo } = require("../middlewares/socketManager");
const {
  getPnl,
  calculateWinRate,
} = require("../controllers/admin/logManagement");

const sendWeeklySummaries = async () => {
  console.log("Running weekly summary job...");
  try {
    const users = await User.find({});
    const oneWeekAgo = new Date(new Date().setDate(new Date().getDate() - 7));

    for (const user of users) {
      const weeklyTrades = await Trade.find({
        user: user._id,
        status: "closed",
        exitDate: { $gte: oneWeekAgo },
      });

      if (weeklyTrades.length > 0) {
        const weeklyPnl = weeklyTrades.reduce(
          (acc, trade) => acc + getPnl(trade),
          0
        );
        const weeklyWinRate = calculateWinRate(weeklyTrades);

        const notification = await Notification.create({
          recipient: user._id,
          type: "weekly_summary",
          text: `Your weekly report is ready! P&L: $${weeklyPnl.toFixed(
            2
          )} | Win Rate: ${weeklyWinRate.toFixed(1)}%`,
          link: "/analytics",
        });
        getIo().to(user._id.toString()).emit("new_notification", notification);
      }
    }
  } catch (error) {
    console.error("Error sending weekly summaries:", error);
  }
};

const initScheduledJobs = () => {
  // Schedule to run every Sunday at 8:00 PM
  cron.schedule("0 20 * * 0", sendWeeklySummaries, {
    timezone: "Asia/Kathmandu",
  });
};

module.exports = { initScheduledJobs };
