const User = require("../../models/User");
const Subscription = require("../../models/Subscription");

exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchTerm = req.query.search || "";

    const query = {
      fullName: { $regex: searchTerm, $options: "i" },
    };
    const totalUsers = await User.countDocuments(query);
    const activeUserIds = await Subscription.distinct("userId", {
      status: "active",
    });
    const activeUserCount = await User.countDocuments({ _id: { $in: activeUserIds } });
    const inactiveUsersCount = totalUsers - activeUserCount
    const revenueData = await Subscription.aggregate([
      // <-- NEW
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const totalRevenue = revenueData[0]?.total || 0; // <-- NEW

    const usersWithSubscription = await User.aggregate([
      { $match: query },
      // ... (The rest of your aggregation pipeline is unchanged)
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "userId",
          as: "subscriptions",
        },
      },
      {
        $addFields: {
          latestSubscription: { $arrayElemAt: ["$subscriptions", -1] },
        },
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          joinDate: "$createdAt",
          plan: "$latestSubscription.plan",
          status: "$latestSubscription.status",
          startDate: "$latestSubscription.startDate",
          endDate: "$latestSubscription.endDate",
          _id: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    // --- 3. UPDATE THE FINAL JSON RESPONSE ---
    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      activeUserCount,
      inactiveUsersCount,
      totalRevenue,
      users: usersWithSubscription,
    });
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getOneUser = async (req, res) => {
  const _id = req.params.id;
  try {
    const user = await User.findById(_id);
    return res
      .status(200)
      .json({ success: true, msg: "User received", data: user });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Internal Server Error" });
  }
};

exports.updateUser = async (req, res) => {
  const _id = req.params.id;
  const { fullName, plan, status } = req.body;

  try {
    // 1. Update fullName in User
    const userUpdate = await User.updateOne(
      { _id },
      { $set: { fullName: fullName } }
    );

    // 2. Update plan and status in Subscription
    const subscriptionUpdate = await Subscription.updateOne(
      { userId: _id },
      { $set: { plan: plan, status: status } }
    );

    return res.status(200).json({
      success: true,
      msg: "User and Subscription Updated Successfully",
      data: {
        userUpdate,
        subscriptionUpdate,
      },
    });
  } catch (e) {
    console.error("Error updating user and subscription:", e);
    return res
      .status(500)
      .json({ success: false, msg: "Internal Server Error" });
  }
};

exports.deleteUser = async (req, res) => {
  const _id = req.params.id;
  try {
    const user = await User.deleteOne({ _id: _id });
    return res
      .status(200)
      .json({ success: true, msg: "User Deleted Successfully" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Internal Server Error" });
  }
};
