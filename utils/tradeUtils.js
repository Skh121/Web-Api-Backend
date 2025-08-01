const Trade = require("../models/Trade");

const getPnl = (trade) => {
  if (!trade.exitPrice || !trade.entryPrice) return 0;
  const size = trade.positionSize || 1;
  const fees = trade.fees || 0;
  return trade.tradeDirection === "long"
    ? (trade.exitPrice - trade.entryPrice) * size - fees
    : (trade.entryPrice - trade.exitPrice) * size - fees;
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

const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
};


module.exports = {
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
  getStartOfWeek
};
