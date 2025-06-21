const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tradeSchema = new Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'draft'],
    default: 'open',
  },
  assetClass: {
    type: String,
    required: true,
    enum: ['stocks', 'crypto', 'forex', 'commodities'],
  },
  tradeDirection: {
    type: String,
    required: true,
    enum: ['long', 'short'],
  },
  entryDate: {
    type: Date,
    required:true,
  },
  entryPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  positionSize: {
    type: Number,
    required: true,
    min: 0,
  },
  stopLoss: {
    type: Number,
    min: 0,
  },
  takeProfit: {
    type: Number,
    min: 0,
  },
  exitDate: {
    type: Date,
  },
  exitPrice: {
    type: Number,
    min: 0,
  },
  fees: {
    type: Number,
    default: 0,
  },
  tags: {
    type: [String],
    default: [],
  },
  notes: {
    type: String,
    trim: true,
  },
  chartScreenshotUrl: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade;