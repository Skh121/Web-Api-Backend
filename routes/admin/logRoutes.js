const express = require('express');
const router = express.Router();

// Import controller functions
const {
  createTrade,
  getAllTrades,
  getTradeById,
  updateTrade,
  deleteTrade,
} = require('../../controllers/admin/logManagement');

// Import your authentication middleware
const { isMemberAdmin,authorizedUser } = require('../../middlewares/authenticateUser'); // Example middleware

 const upload = require("../../middlewares/fileUpload")

// Define the routes
// The 'isMemberAdmin' middleware will be run before any controller function,
// ensuring only logged-in users can access these routes.

router.route('/')
  .post(authorizedUser,upload.single('chartScreenshot'),isMemberAdmin, createTrade)
  .get(authorizedUser,isMemberAdmin, getAllTrades);

router.route('/:id')
  .get(authorizedUser,isMemberAdmin, getTradeById)
  .patch(authorizedUser,upload.single('chartScreenshot'),isMemberAdmin, updateTrade) // Using PATCH for partial updates is common
  .delete(authorizedUser,isMemberAdmin, deleteTrade);

module.exports = router;