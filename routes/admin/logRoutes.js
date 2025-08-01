const express = require("express");
const router = express.Router();

const {
  createTrade,
  getAllTrades,
  getTradeById,
  updateTrade,
  deleteTrade,
  getTradeStats,
  getCalendarStats,
  getTradesForReport,
} = require("../../controllers/admin/logManagement");

const {
  isMemberAdmin,
  authorizedUser,
} = require("../../middlewares/authenticateUser");

const upload = require("../../middlewares/fileUpload");

router.get("/stats", authorizedUser, isMemberAdmin, getTradeStats);
router.get("/calendar", authorizedUser, isMemberAdmin, getCalendarStats);
router.get("/report", authorizedUser, isMemberAdmin, getTradesForReport);
router
  .route("/")
  .post(
    authorizedUser,
    upload.single("chartScreenshot"),
    isMemberAdmin,
    createTrade
  )
  .get(authorizedUser, isMemberAdmin, getAllTrades);

router
  .route("/:id")
  .get(authorizedUser, isMemberAdmin, getTradeById)
  .patch(
    authorizedUser,
    upload.single("chartScreenshot"),
    isMemberAdmin,
    updateTrade
  )
  .delete(authorizedUser, isMemberAdmin, deleteTrade);

module.exports = router;
