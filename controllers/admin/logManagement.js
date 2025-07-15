const Trade = require("../../models/Trade");
const { checkAndNotifyGoalAchievement } = require("./goalController");

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

const calculateAdvancedRiskMetrics = (trades) => {
  if (trades.length === 0) {
    return {
      maxDrawdown: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      recoveryFactor: 0,
    };
  }

  // --- Equity Curve and P&L ---
  const pnlPerTrade = trades.map((t) => getPnl(t));
  let equityCurve = [];
  let runningTotal = 0;
  pnlPerTrade.forEach((pnl) => {
    runningTotal += pnl;
    equityCurve.push(runningTotal);
  });

  // --- Max Drawdown ---
  let peak = -Infinity;
  let maxDrawdown = 0;
  let maxDrawdownInDollars = 0;
  equityCurve.forEach((equity) => {
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    const drawdownInDollars = peak - equity;

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (drawdownInDollars > maxDrawdownInDollars) {
      maxDrawdownInDollars = drawdownInDollars;
    }
  });

  // --- Sharpe Ratio (assuming risk-free rate is 0) ---
  const avgReturn = pnlPerTrade.reduce((a, b) => a + b, 0) / pnlPerTrade.length;
  const stdDev = Math.sqrt(
    pnlPerTrade.map((x) => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) /
      pnlPerTrade.length
  );
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // --- Profit Factor ---
  const grossProfit = pnlPerTrade
    .filter((p) => p > 0)
    .reduce((sum, p) => sum + p, 0);
  const grossLoss = Math.abs(
    pnlPerTrade.filter((p) => p < 0).reduce((sum, p) => sum + p, 0)
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity;

  // --- Recovery Factor ---
  const totalNetProfit = runningTotal;
  const recoveryFactor =
    maxDrawdownInDollars > 0 ? totalNetProfit / maxDrawdownInDollars : Infinity;

  return {
    maxDrawdown: parseFloat(maxDrawdown.toFixed(1)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    recoveryFactor: parseFloat(recoveryFactor.toFixed(1)),
    grossProfit: parseFloat(grossProfit.toFixed(1)),
    grossLoss: parseFloat(grossLoss.toFixed(1)),
  };
};

const calculateSizingMetrics = (trades) => {
  if (trades.length === 0) {
    return { avgPositionSize: 0, maxPositionSize: 0, avgRiskPerTrade: 0 };
  }

  // Position Size (assumes positionSize is a monetary value)
  const positionSizes = trades.map((t) => t.positionSize || 0);
  const avgPositionSize =
    positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length;
  const maxPositionSize = Math.max(...positionSizes);

  // Risk Per Trade (calculates initial risk based on stop loss)
  const risks = trades
    .map((t) => {
      if (t.entryPrice && t.stopLoss) {
        return Math.abs(t.entryPrice - t.stopLoss) * (t.positionSize || 1);
      }
      return 0;
    })
    .filter((r) => r > 0);

  const avgRiskPerTrade =
    risks.length > 0 ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;

  // NOTE: Returning as absolute values. To get percentages, you'd need portfolio equity at the time of each trade.
  return {
    avgPositionSize: parseFloat(avgPositionSize.toFixed(2)),
    maxPositionSize: parseFloat(maxPositionSize.toFixed(2)),
    avgRiskPerTrade: parseFloat(avgRiskPerTrade.toFixed(2)),
  };
};

const calculateStrategyPerformance = (trades) => {
  const strategies = {};
  const closedTrades = trades.filter(
    (t) => t.status === "closed" && t.tags && t.tags.length > 0
  );

  // Group trades by each tag
  closedTrades.forEach((trade) => {
    // A single trade can contribute to multiple strategies (tags)
    trade.tags.forEach((tag) => {
      if (!strategies[tag]) {
        strategies[tag] = {
          name: tag,
          trades: [],
        };
      }
      strategies[tag].trades.push(trade);
    });
  });

  // Calculate stats for each strategy (tag)
  return Object.values(strategies)
    .map((strat) => {
      const { trades } = strat;
      const tradeCount = trades.length;

      const wins = trades.filter((t) => getPnl(t) > 0).length;
      const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

      const totalPnl = trades.reduce((sum, t) => sum + getPnl(t), 0);
      const avgPnl = tradeCount > 0 ? totalPnl / tradeCount : 0;

      return {
        name: strat.name,
        tradeCount,
        winRate: parseFloat(winRate.toFixed(0)),
        avgPnl: parseFloat(avgPnl.toFixed(0)),
        totalPnl: parseFloat(totalPnl.toFixed(0)),
      };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl); // Sort by highest Total P&L
};

const getPnl = (trade) => {
  if (!trade.exitPrice || !trade.entryPrice) return 0;
  const size = trade.positionSize || 1;
  const fees = trade.fees || 0;
  return trade.tradeDirection === "long"
    ? (trade.exitPrice - trade.entryPrice) * size - fees
    : (trade.entryPrice - trade.exitPrice) * size - fees;
};

const calculateExpectancy = (trades) => {
  const closedTrades = trades.filter((t) => t.status === "closed");
  if (closedTrades.length === 0) return 0;

  const wins = closedTrades.filter((t) => getPnl(t) > 0);
  const losses = closedTrades.filter((t) => getPnl(t) <= 0);

  const winRate = wins.length / closedTrades.length;
  const lossRate = losses.length / closedTrades.length;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + getPnl(t), 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((sum, t) => sum + getPnl(t), 0) / losses.length
      : 0;

  // Expectancy Formula: (Win Rate * Avg Win) - (Loss Rate * Abs(Avg Loss))
  return winRate * avgWin - lossRate * Math.abs(avgLoss);
};

const calculateRRDistribution = (trades) => {
  const buckets = { Losses: 0, "0-1 R": 0, "1-2 R": 0, "2-3 R": 0, "3+ R": 0 };
  const closedTrades = trades.filter((t) => t.status === "closed");

  closedTrades.forEach((trade) => {
    if (typeof trade.rMultiple !== "number") return;

    const r = trade.rMultiple;
    if (r <= 0) buckets["Losses"]++;
    else if (r > 0 && r < 1) buckets["0-1 R"]++;
    else if (r >= 1 && r < 2) buckets["1-2 R"]++;
    else if (r >= 2 && r < 3) buckets["2-3 R"]++;
    else if (r >= 3) buckets["3+ R"]++;
  });

  // Convert to format needed by chart library
  return Object.entries(buckets).map(([name, value]) => ({ name, value }));
};

const calculateWinRate = (trades) => {
  const closedTrades = trades.filter(
    (trade) => trade.entryPrice && trade.exitPrice
  );

  const wins = closedTrades.filter((trade) => {
    const size = trade.positionSize || 1;
    const fees = trade.fees || 0;
    const pnl =
      trade.tradeDirection === "long"
        ? (trade.exitPrice - trade.entryPrice) * size - fees
        : (trade.entryPrice - trade.exitPrice) * size - fees;
    return pnl > 0;
  }).length;

  return closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
};

const calculateEquityCurve = (trades) => {
  const sortedTrades = [...trades].filter(
    (trade) => trade.exitPrice && trade.entryPrice
  );

  // Sort trades by exit date or updatedAt
  sortedTrades.sort((a, b) => {
    const dateA = new Date(a.exitDate || a.updatedAt);
    const dateB = new Date(b.exitDate || b.updatedAt);
    return dateA - dateB;
  });

  let runningTotal = 0;

  return sortedTrades.map((trade, index) => {
    const size = trade.positionSize || 1;
    const fees = trade.fees || 0;

    const pnl =
      trade.tradeDirection === "long"
        ? (trade.exitPrice - trade.entryPrice) * size - fees
        : (trade.entryPrice - trade.exitPrice) * size - fees;

    runningTotal += pnl;

    const date = new Date(trade.exitDate || trade.updatedAt);
    const label = `${date.toISOString().split("T")[0]}`;

    return { name: label, value: Number(runningTotal.toFixed(2)) };
  });
};

const groupTradesByMonth = (trades) => {
  const monthly = {};

  trades.forEach((trade) => {
    if (!trade.entryDate && !trade.exitDate && !trade.updatedAt) return;
    const date = new Date(trade.exitDate || trade.updatedAt);
    const month = date.getMonth();
    const year = date.getFullYear();
    const key = `${year}-${month}`;

    if (!monthly[key]) {
      monthly[key] = [];
    }
    monthly[key].push(trade);
  });

  return monthly;
};

const calculateMonthlyPnL = (trades) => {
  const monthly = {};

  trades.forEach((trade) => {
    if (!trade.exitPrice || !trade.entryPrice) return;

    const date = new Date(trade.exitDate || trade.updatedAt);
    const month = date.toLocaleString("default", { month: "short" });
    const key = `${month}-${date.getFullYear()}`;

    const size = trade.positionSize || 1;
    const fees = trade.fees || 0;
    const pnl =
      trade.tradeDirection === "long"
        ? (trade.exitPrice - trade.entryPrice) * size - fees
        : (trade.entryPrice - trade.exitPrice) * size - fees;

    if (!monthly[key]) {
      monthly[key] = {
        name: key,
        profit: 0,
        loss: 0,
        totalTrades: 0,
        winningTrades: 0,
      };
    }

    if (pnl >= 0) {
      monthly[key].profit += pnl;
      monthly[key].winningTrades += 1;
    } else {
      monthly[key].loss += pnl;
    }

    monthly[key].totalTrades += 1;
  });

  // Convert object to array and compute win rate
  return Object.values(monthly)
    .map((entry) => ({
      name: entry.name,
      profit: parseFloat(entry.profit.toFixed(2)),
      loss: parseFloat(entry.loss.toFixed(2)),
      winRate:
        entry.totalTrades > 0
          ? parseFloat(
              ((entry.winningTrades / entry.totalTrades) * 100).toFixed(2)
            )
          : 0,
    }))
    .sort((a, b) => new Date(`1 ${a.name}`) - new Date(`1 ${b.name}`));
};

const getMonthlyPLChange = (monthlyPnl) => {
  if (monthlyPnl.length < 2) return "+0.0%";

  const lastMonth = monthlyPnl[monthlyPnl.length - 1];
  const prevMonth = monthlyPnl[monthlyPnl.length - 2];

  const lastNet = lastMonth.profit + lastMonth.loss;
  const prevNet = prevMonth.profit + prevMonth.loss;

  if (prevNet === 0) {
    return lastNet >= 0 ? `+${lastNet.toFixed(1)}` : lastNet.toFixed(1);
  }

  const changePercent = ((lastNet - prevNet) / Math.abs(prevNet)) * 100;
  return `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;
};

const calculateAssetDistribution = (trades) => {
  const counts = {};
  trades.forEach((trade) => {
    const asset = trade.assetClass || "Unknown";
    counts[asset] = (counts[asset] || 0) + 1;
  });
  const total = trades.length || 1;
  return Object.entries(counts).map(([name, count]) => ({
    name,
    value: Number(((count / total) * 100).toFixed(2)),
  }));
};

const calculateProfitFactor = (trades) => {
  const closedTrades = trades.filter((t) => t.status === "closed");

  const grossProfit = closedTrades.reduce((sum, t) => {
    if (t.entryPrice && t.exitPrice) {
      const size = t.positionSize || 1;
      const fees = t.fees || 0;
      const pnl =
        t.tradeDirection === "long"
          ? (t.exitPrice - t.entryPrice) * size - fees
          : (t.entryPrice - t.exitPrice) * size - fees;
      return pnl > 0 ? sum + pnl : sum;
    }
    return sum;
  }, 0);

  const grossLoss = closedTrades.reduce((sum, t) => {
    if (t.entryPrice && t.exitPrice) {
      const size = t.positionSize || 1;
      const fees = t.fees || 0;
      const pnl =
        t.tradeDirection === "long"
          ? (t.exitPrice - t.entryPrice) * size - fees
          : (t.entryPrice - t.exitPrice) * size - fees;
      return pnl < 0 ? sum + Math.abs(pnl) : sum;
    }
    return sum;
  }, 0);

  return grossLoss === 0 ? Infinity : grossProfit / grossLoss;
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
  getPnl,
  calculateWinRate,
};
