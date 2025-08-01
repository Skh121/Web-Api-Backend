const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto")

const getTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const registerUser = async (req, res) => {
  const { fullName, email, password, role } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Please enter all the fields",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        msg: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      role: role || "user",
      password: hashedPassword,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      msg: "User registered successfully",
      data: newUser,
    });
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

    const user = await User.findOne({ email });
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
      role: user.role || "user",
    };

    const token = jwt.sign(payload, process.env.SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      success: true,
      msg: "Login successful",
      data: payload,
      token,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      msg: "Internal Server Error",
    });
  }
};

const sendResetLink = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign({ id: user._id }, process.env.SECRET, {
      expiresIn: "15m",
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
    const transporter = getTransporter();
    const mailOptions = {
      from: `"TradeVerse" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your password",
      html: `
        <p>You requested a password reset. Click the link below:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 15 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: "Reset email sent" });
  } catch (err) {
    console.error("Error in sendResetLink:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.SECRET);
    const hashed = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(decoded.id, { password: hashed });

    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("Reset Error:", err);
    return res.status(400).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const requestOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    // Set OTP to expire in 10 minutes
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    const transporter = getTransporter();
    const mailOptions = {
      from: `"TradeVerse" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Password Reset OTP",
      html: `
        <p>Your One-Time Password (OTP) for password reset is:</p>
        <h2>${otp}</h2>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res
      .status(200)
      .json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    console.error("Error in requestOtp:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error while sending OTP." });
  }
};

// NEW: Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    if (user.otpExpires < new Date()) {
      // Clear OTP fields if expired
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired." });
    }

    // OTP is valid. Clear OTP fields to prevent reuse.
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Generate a temporary token for the password reset stage
    const resetToken = jwt.sign(
      { id: user._id, email: user.email, purpose: "password_reset" },
      process.env.SECRET,
      {
        expiresIn: "10m", // Token valid for 10 minutes for password change
      }
    );

    return res
      .status(200)
      .json({
        success: true,
        message: "OTP verified successfully.",
        resetToken: resetToken,
      });
  } catch (err) {
    console.error("Error in verifyOtp:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error during OTP verification.",
      });
  }
};

// NEW: Reset Password with OTP (requires a valid resetToken from verifyOtp)
const resetPasswordWithOtp = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    const decoded = jwt.verify(resetToken, process.env.SECRET);

    // Ensure the token is for password reset purpose
    if (decoded.purpose !== "password_reset") {
      return res
        .status(403)
        .json({ success: false, message: "Invalid reset token purpose." });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Error in resetPasswordWithOtp:", err);
    if (err.name === "TokenExpiredError") {
      return res
        .status(400)
        .json({ success: false, message: "Reset token has expired." });
    }
    return res
      .status(400)
      .json({ success: false, message: "Invalid or expired reset token." });
  }
};

module.exports = {
  registerUser,
  loginUser,
  sendResetLink,
  resetPassword,
  resetPasswordWithOtp,
  verifyOtp,
  requestOtp
};
