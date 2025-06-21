const Trade = require('../../models/Trade');

/**
 * @desc    Create a new trade
 * @route   POST /api/trades
 * @access  Private
 */
const createTrade = async (req, res) => {
  try {
    // FIXED: Get the text fields from the body
    const { tags, ...otherTradeData } = req.body;

    // UPDATED: Check for an uploaded file and create a full URL
    let chartScreenshotUrl = '';
    if (req.file) {
      // Constructs a full URL that the frontend can use directly
      chartScreenshotUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, "/")}`;
    }

    // Create a new trade instance
    const trade = new Trade({
      ...otherTradeData, // Spread the rest of the text fields
      user: req.user.id,
      // FIXED: Parse the tags string from FormData back into an array
      tags: tags ? JSON.parse(tags) : [],
      // Use the new URL field (ensure your model has this field)
      chartScreenshotUrl: chartScreenshotUrl,
    });

    const createdTrade = await trade.save();
    res.status(201).json(createdTrade);
  } catch (error) {
    console.error("Error creating trade:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @desc    Get all trades for the logged-in user
 * @route   GET /api/trades
 * @access  Private
 */
const getAllTrades = async (req, res) => {
  try {
    const trades = await Trade.find({ user: req.user.id }).sort({ entryDate: -1 });
    res.json(trades);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @desc    Get a single trade by its ID
 * @route   GET /api/trades/:id
 * @access  Private
 */
const getTradeById = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    if (trade.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to view this trade' });
    }

    res.json(trade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @desc    Update an existing trade
 * @route   PATCH /api/trades/:id
 * @access  Private
 */
const updateTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    if (trade.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to update this trade' });
    }

    const updateData = { ...req.body };

    // If a new file is uploaded, create its URL and add it to the update data.
    if (req.file) {
      updateData.chartScreenshotUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, "/")}`;
    } 
    // If the URL was explicitly sent as an empty string, respect it.
    // This handles the "Remove Image" case.
    else if (req.body.chartScreenshotUrl === "") {
      updateData.chartScreenshotUrl = "";
      // Optional: You could add logic here to delete the old file from your /uploads folder
    }

    if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = JSON.parse(updateData.tags);
    }
    
    const updatedTrade = await Trade.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedTrade);
  } catch (error) {
    console.error("Error updating trade:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};
 
const deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    if (trade.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this trade' });
    }

    // Optional: Add logic here to delete the associated image from the /uploads folder if it exists
    // const fs = require('fs');
    // if (trade.chartScreenshotUrl) { ... fs.unlinkSync(...) ... }

    await trade.deleteOne();

    res.json({ message: 'Trade removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};


module.exports = {
  createTrade,
  getAllTrades,
  getTradeById,
  updateTrade,
  deleteTrade,
};