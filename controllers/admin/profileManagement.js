const User = require("../../models/User");
const Profile = require("../../models/Profile");
const Subscription = require("../../models/Subscription");

const getMyProfile = async (req, res) => {
  try {
    // First, try to find an existing profile
    let profile = await Profile.findOne({ user: req.user.id })
      .populate("user", "fullName email")
      .populate("subscription", "plan");

    // If a complete profile is found, return it immediately
    if (profile) {
      return res.json(profile);
    }

    const user = await User.findById(req.user.id).select("fullName email");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const subscription = await Subscription.findOne({
      userId: req.user.id,
    }).select("plan");
    const nameParts = user.fullName.split(" ") || [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    // 3. Construct the default profile object for the frontend
    const defaultProfileView = {
      user: {
        fullName: user.fullName,
        email: user.email,
      },
      subscription: subscription ? subscription.plan : null,
      firstName: firstName,
      lastName: lastName,
      bio: "",
      avatar: "",
    };

    res.json(defaultProfileView);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};
const updateMyProfile = async (req, res) => {
  const { firstName, lastName, bio } = req.body;
  const userId = req.user.id;

  try {
    // 1. Find all necessary documents first
    let profile = await Profile.findOne({ user: userId });
    const user = await User.findById(userId);
    const subscription = await Subscription.findOne({ userId: userId });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 2. Handle Profile Creation or Update
    if (!profile) {
      // If no profile exists, create a new one
      profile = new Profile({
        user: userId,
        firstName,
        lastName,
        bio,
        subscription: subscription ? subscription._id : null,
      });
    } else {
      // If profile exists, update its fields
      if (firstName) profile.firstName = firstName;
      if (lastName) profile.lastName = lastName;
      if (bio !== undefined) profile.bio = bio;
      if (subscription) profile.subscription = subscription._id;
    }

    // 3. Handle avatar file upload
    if (req.file) {
      const avatarUrl = `${req.protocol}://${req.get(
        "host"
      )}/${req.file.path.replace(/\\/g, "/")}`;
      profile.avatar = avatarUrl;
    }

    // 4. Safely update the fullName on the main User model
    const newFirstName = firstName || profile.firstName;
    const newLastName = lastName || profile.lastName;

    if (newFirstName && newLastName) {
      user.fullName = `${newFirstName} ${newLastName}`.trim();
      await user.save();
    }

    // 5. Save the profile changes
    await profile.save();

    // 6. Populate the final response to match the GET request structure
    await profile.populate([
      { path: "subscription", select: "plan" },
      { path: "user", select: "fullName email" },
    ]);

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
};
module.exports = {
  getMyProfile,
  updateMyProfile,
};
