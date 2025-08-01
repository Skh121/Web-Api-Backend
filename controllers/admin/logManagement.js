const Trade = require("../../models/Trade");
const { checkAndNotifyGoalAchievement } = require("./goalController");
const {
  getPnl,
  calculateAdvancedRiskMetrics,
  calculateSizingMetrics,
  calculateExpectancy,
  calculateStrategyPerformance,
  calculateWinRate,
  calculateRRDistribution,
  calculateEquityCurve,
  groupTradesByMonth,
  calculateMonthlyPnL,
  getMonthlyPLChange,
  calculateAssetDistribution,
  calculateProfitFactor,
  getStartOfWeek,
} = require("../../utils/tradeUtils");

const createTrade = async (req, res) => {
  try {
    // FIXED: Get the text fields from the body
    const { tags, ...otherTradeData } = req.body;

    // UPDATED: Check for an uploaded file and create a full URL
    let chartScreenshotUrl = "";
    if (req.file) {
      // Constructs a full URL that the frontend can use directly
      chartScreenshotUrl = `${req.protocol}://${req.get(
        "host"
      )}/${req.file.path.replace(/\\/g, "/")}`;
    }
    let status = otherTradeData.status || "open"; // default open
    if (otherTradeData.exitPrice != null) {
      status = "closed";
    }

    // Create a new trade instance
    const trade = new Trade({
      ...otherTradeData, // Spread the rest of the text fields
      status,
      user: req.user.id,
      // FIXED: Parse the tags string from FormData back into an array
      tags: tags ? JSON.parse(tags) : [],
      // Use the new URL field (ensure your model has this field)
      chartScreenshotUrl: chartScreenshotUrl,
    });

    const createdTrade = await trade.save();
    if (createdTrade.status === "closed") {
      await checkAndNotifyGoalAchievement(req.user.id);
    }
    res.status(201).json(createdTrade);
  } catch (error) {
    console.error("Error creating trade:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

const getAllTrades = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalTrades = await Trade.countDocuments({ user: req.user.id });

    const trades = await Trade.find({ user: req.user.id })
      .sort({ entryDate: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(totalTrades / limit),
      totalTrades,
      trades,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

const getTradeById = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: "Trade not found" });
    }

    if (trade.user.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to view this trade" });
    }

    res.json(trade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade not found" });
    if (trade.user.toString() !== req.user.id)
      return res.status(401).json({ message: "Not authorized" });

    const updateData = { ...req.body };
    if (req.file) {
      updateData.chartScreenshotUrl = `${req.protocol}://${req.get(
        "host"
      )}/${req.file.path.replace(/\\/g, "/")}`;
    } else if (req.body.chartScreenshotUrl === "") {
      updateData.chartScreenshotUrl = "";
    }
    if (updateData.tags && typeof updateData.tags === "string") {
      updateData.tags = JSON.parse(updateData.tags);
    }

    let becameClosed = false;

    if (updateData.exitPrice && trade.status !== "closed") {
      updateData.status = "closed";
      becameClosed = true;

      const entryPrice = parseFloat(trade.entryPrice);
      const stopLoss = parseFloat(trade.stopLoss);
      const exitPrice = parseFloat(updateData.exitPrice);
      const positionSize = parseFloat(trade.positionSize) || 1;
      const fees = parseFloat(updateData.fees) || parseFloat(trade.fees) || 0;
      const pnl =
        trade.tradeDirection === "long"
          ? exitPrice * positionSize - entryPrice * positionSize - fees
          : entryPrice * positionSize - exitPrice * positionSize - fees;

      const initialRisk = Math.abs(entryPrice - stopLoss) * positionSize;

      if (initialRisk > 0) {
        updateData.rMultiple = parseFloat((pnl / initialRisk).toFixed(2));
      } else {
        updateData.rMultiple = 0;
      }
    }

    const updatedTrade = await Trade.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (becameClosed) {
      await checkAndNotifyGoalAchievement(req.user.id);
    }
    res.json(updatedTrade);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: "Trade not found" });
    }

    if (trade.user.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to delete this trade" });
    }
    await trade.deleteOne();

    res.json({ message: "Trade removed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const getTradeStats = async (req, res) => {
  try {
    const trades = await Trade.find({ user: req.user.id });
    const closedTrades = trades.filter((t) => t.status === "closed"); // Use closed trades for most stats

    const totalTrades = trades.length;
    const monthlyGrouped = groupTradesByMonth(trades);
    const riskMetrics = calculateAdvancedRiskMetrics(closedTrades);
    const sizingMetrics = calculateSizingMetrics(closedTrades);

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const previousMonthKey = `${now.getFullYear()}-${now.getMonth() - 1}`;

    const currentMonthTrades = monthlyGrouped[currentMonthKey] || [];
    const previousMonthTrades = monthlyGrouped[previousMonthKey] || [];

    const profitable = trades.filter((trade) => {
      if (trade.entryPrice && trade.exitPrice) {
        const size = trade.positionSize || 1;
        const fees = trade.fees || 0;
        return trade.tradeDirection === "long"
          ? (trade.exitPrice - trade.entryPrice) * size - fees > 0
          : (trade.entryPrice - trade.exitPrice) * size - fees > 0;
      }
      return false;
    });

    const winRate =
      totalTrades > 0
        ? ((profitable.length / totalTrades) * 100).toFixed(2)
        : "0.00";

    const totalPL = trades.reduce((acc, trade) => {
      if (trade.entryPrice && trade.exitPrice) {
        const size = trade.positionSize || 1;
        const fees = trade.fees || 0;
        const pl =
          trade.tradeDirection === "long"
            ? (trade.exitPrice - trade.entryPrice) * size - fees
            : (trade.entryPrice - trade.exitPrice) * size - fees;
        return acc + pl;
      }
      return acc;
    }, 0);

    const profitFactor = calculateProfitFactor(trades);

    const recentTrades = trades
      .filter((t) => t.status === "closed")
      .sort(
        (a, b) =>
          new Date(b.exitDate || b.updatedAt) -
          new Date(a.exitDate || a.updatedAt)
      )
      .slice(0, 5)
      .map((t) => ({
        ticker: t.symbol,
        type:
          t.tradeDirection.charAt(0).toUpperCase() + t.tradeDirection.slice(1),
        status: t.status,
        pnl:
          t.entryPrice && t.exitPrice
            ? t.tradeDirection === "long"
              ? (t.exitPrice - t.entryPrice) * t.positionSize - (t.fees || 0)
              : (t.entryPrice - t.exitPrice) * t.positionSize - (t.fees || 0)
            : 0,
        date: t.exitDate || t.updatedAt,
      }));

    const equityCurve = calculateEquityCurve(trades);
    const monthlyPnl = calculateMonthlyPnL(trades);
    const totalPLChangeStr = getMonthlyPLChange(monthlyPnl);

    const currentWinRate = calculateWinRate(currentMonthTrades);
    const prevWinRate = calculateWinRate(previousMonthTrades);
    const winRateChange = `${currentWinRate - prevWinRate >= 0 ? "+" : ""}${(
      currentWinRate - prevWinRate || 0
    ).toFixed(2)}%`;

    const currentProfitFactor = calculateProfitFactor(currentMonthTrades);
    const prevProfitFactor = calculateProfitFactor(previousMonthTrades);
    const profitFactorChange = `${
      currentProfitFactor - prevProfitFactor >= 0 ? "+" : ""
    }${(currentProfitFactor - prevProfitFactor || 0).toFixed(2)}%`;

    const currentTradeCount = currentMonthTrades.length;
    const prevTradeCount = previousMonthTrades.length;
    const tradeCountChange = `${
      currentTradeCount - prevTradeCount >= 0 ? "+" : ""
    }${
      prevTradeCount
        ? (
            ((currentTradeCount - prevTradeCount) / prevTradeCount) *
            100
          ).toFixed(2)
        : "0.00"
    }%`;

    const assetDistribution = calculateAssetDistribution(trades);

    const expectancy = calculateExpectancy(closedTrades);
    const currentMonthExpectancy = calculateExpectancy(currentMonthTrades);
    const previousMonthExpectancy = calculateExpectancy(previousMonthTrades);
    const expectancyChange = currentMonthExpectancy - previousMonthExpectancy;

    // 2. Calculate the R:R distribution
    const riskRewardDistribution = calculateRRDistribution(closedTrades);
    const strategyPerformance = calculateStrategyPerformance(trades);

    const startOfWeek = new Date(getStartOfWeek());
    const thisWeeksTrades = closedTrades.filter((trade) => {
      const tradeDate = new Date(trade.exitDate || trade.updatedAt);
      return tradeDate >= startOfWeek;
    });

    res.json({
      totalTrades,
      totalPL: Number(totalPL.toFixed(2)),
      winRate: parseFloat(winRate),
      recentTrades,
      equityCurve,
      monthlyPnl,
      totalPLChange: totalPLChangeStr,
      winRateChange,
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      profitFactorChange,
      totalTradesChange: tradeCountChange,
      assetDistribution,
      expectancy: expectancy.toFixed(2),
      expectancyChange: `${expectancyChange >= 0 ? "+$" : "-$"}${Math.abs(
        expectancyChange
      ).toFixed(2)}`,
      riskRewardDistribution: riskRewardDistribution,
      strategyPerformance: strategyPerformance,
      riskAnalysis: {
        ...riskMetrics,
        ...sizingMetrics,
      },
      grossProfit: riskMetrics.grossProfit,
      grossLoss: riskMetrics.grossLoss,
      thisWeeksTrades: thisWeeksTrades.map((t) => ({
        ticker: t.symbol,
        pnl:
          t.entryPrice && t.exitPrice
            ? t.tradeDirection === "long"
              ? (t.exitPrice - t.entryPrice) * t.positionSize - (t.fees || 0)
              : (t.entryPrice - t.exitPrice) * t.positionSize - (t.fees || 0)
            : 0,
        type: t.tradeDirection,
        date: t.exitDate || t.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getCalendarStats = async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month) - 1; // JS months are 0-11

    if (isNaN(year) || isNaN(month)) {
      return res
        .status(400)
        .json({ message: "Invalid year or month provided." });
    }

    // **FIX**: Use UTC to create date boundaries to avoid timezone shifts.
    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 1)); // End of month is start of next month

    const trades = await Trade.find({
      user: req.user.id,
      status: "closed",
      exitDate: {
        $gte: startDate,
        $lt: endDate, // Use $lt (less than) with the start of the next month
      },
    });

    const dailyData = {};

    trades.forEach((trade) => {
      // **FIX**: Use getUTCDate() to get the day number based on UTC, not server timezone.
      const day = new Date(trade.exitDate).getUTCDate();

      if (!dailyData[day]) {
        dailyData[day] = { totalPnl: 0, totalR: 0, wins: 0, tradeCount: 0 };
      }

      const pnl = getPnl(trade);
      dailyData[day].tradeCount++;
      dailyData[day].totalPnl += pnl;
      if (pnl > 0) dailyData[day].wins++;
      if (typeof trade.rMultiple === "number") {
        dailyData[day].totalR += trade.rMultiple;
      }
    });

    // Finalize calculations
    for (const day in dailyData) {
      const dayStats = dailyData[day];
      dailyData[day].winRate = parseFloat(
        ((dayStats.wins / dayStats.tradeCount) * 100).toFixed(0)
      );
      dailyData[day].totalPnl = parseFloat(dayStats.totalPnl.toFixed(2));
      dailyData[day].rMultiple = parseFloat(dayStats.totalR.toFixed(2));
    }

    res.json(dailyData);
  } catch (error) {
    console.error("Calendar stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getTradesForReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Please provide both a start and end date." });
  }

  try {
    const trades = await Trade.find({
      user: req.user.id,
      status: "closed",
      exitDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }).sort({ exitDate: "asc" });
    res.json(trades);
  } catch (error) {
    console.error("Error fetching trades for report:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  createTrade,
  getAllTrades,
  getTradeById,
  updateTrade,
  deleteTrade,
  getTradeStats,
  getCalendarStats,
  getTradesForReport,
  calculateWinRate,
};
