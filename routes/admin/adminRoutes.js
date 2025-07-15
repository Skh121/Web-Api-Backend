const express = require("express")
const { getAllUsers, getOneUser, updateUser, deleteUser } = require("../../controllers/admin/userManagement");
const { authorizedUser, isAdmin } = require("../../middlewares/authenticateUser");
const router = express.Router()

router.get("/",authorizedUser,isAdmin,getAllUsers);
router.get("/:id",getOneUser);
router.put("/:id",updateUser);
router.delete("/:id",deleteUser);


module.exports = router