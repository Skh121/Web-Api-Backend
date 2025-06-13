const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  const { fullName, email, password} = req.body;

  try {
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, msg: "Please enter all the fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    return res
      .status(201)
      .json({ success: true, msg: "User registered successfully",data:newUser});
  } catch (e) {
    console.error("Registration Error:", e);
    return res.status(500).json({
      success: false,
      msg: "Internal Server Error",
    });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Enter all the fields",
      });
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    const validUser = await bcrypt.compare(password, user.password);
    if (!validUser) {
      return res.status(401).json({
        success: false,
        msg: "Invalid credentials",
      });
    }

    const payload = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      success: true,
      msg: "Login successful",
      data: payload,
      token: token,
    });
  } catch (e) {
    console.error("Login Error:", e);
    return res.status(500).json({
      success: false,
      msg: "Internal Server Error",
    });
  }
};

module.exports = { registerUser, loginUser };
