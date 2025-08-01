const express = require("express");
const router = express.Router();
const goalController = require("../../controllers/admin/goalController");
const {
  authorizedUser,
  isMemberAdmin,
} = require("../../middlewares/authenticateUser");

router.post("/", authorizedUser, isMemberAdmin, goalController.createGoal);
router.get("/", authorizedUser, isMemberAdmin, goalController.getGoals);
router.put("/:id", authorizedUser, isMemberAdmin, goalController.updateGoal);
router.delete("/:id", authorizedUser, isMemberAdmin, goalController.deleteGoal);


module.exports = router;
