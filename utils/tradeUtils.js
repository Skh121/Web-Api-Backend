const Trade = require("../models/Trade");

const getPnl = (trade) => {
  if (!trade.exitPrice || !trade.entryPrice) return 0;
  const size = trade.positionSize || 1;
  const fees = trade.fees || 0;
  return trade.tradeDirection === "long"
    ? (trade.exitPrice - trade.entryPrice) * size - fees
    : (trade.entryPrice - trade.exitPrice) * size - fees;
};

module.exports = {
  getPnl,
};
