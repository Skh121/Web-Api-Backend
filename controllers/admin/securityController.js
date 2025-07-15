const User = require("../../models/User");
const Profile = require("../../models/Profile");
const Trade = require("../../models/Trade");
const Subscription = require("../../models/Subscription");
const Payment = require("../../models/Payment");
const bcrypt = require("bcrypt");
const Notification = require("../../models/Notification");
const { getIo } = require("../../middlewares/socketManager");

const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New passwords do not match." });
  }

  try {
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    const notification = await Notification.create({
      recipient: req.user.id,
      type: "password_changed",
      text: "Your password was successfully changed.",
      link: "/settings/security",
    });
    getIo().to(req.user.id.toString()).emit("new_notification", notification);

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const deleteMyAccount = async (req, res) => {
  try {
    await Payment.deleteMany({ userId: req.user.id });
    await Trade.deleteMany({ user: req.user.id });
    await Profile.deleteOne({ user: req.user.id });
    await Subscription.deleteOne({ userId: req.user.id });

    await User.findByIdAndDelete(req.user.id);

    res.json({
      message:
        "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

const exportMyData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    const profile = await Profile.findOne({ user: req.user.id });
    const trades = await Trade.find({ user: req.user.id });
    const subscription = await Subscription.findOne({ userId: req.user.id });
    const payments = await Payment.find({ userId: req.user.id });

    const user_data = {
      user,
      profile,
      subscription,
      payments,
      trades,
    };

    res.json(user_data);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  changePassword,
  deleteMyAccount,
  exportMyData,
};
