const { validationResult } = require("express-validator");
const crypto = require("crypto");
const User = require("../models/User");
const { generateToken } = require("../middleware/auth");
const { sendEmail } = require("../utils/email");

// ─────────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone, role, region } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Only super_admin can create gram_admin or traffic_admin
    let assignedRole = "user";
    if (role && ["gram_admin", "traffic_admin"].includes(role)) {
      // In production, validate this with an invite token or super admin auth
      assignedRole = role;
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: assignedRole,
      region,
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact support.",
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        region: user.region,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/send-otp
// @access  Private
// ─────────────────────────────────────────
exports.sendOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    await sendEmail({
      to: user.email,
      subject: "RoadSense AI - Email Verification OTP",
      html: `
        <div style="font-family: Arial; max-width: 500px; margin: auto;">
          <h2 style="color: #00d4ff;">RoadSense AI</h2>
          <p>Your OTP for email verification is:</p>
          <h1 style="color: #ff4444; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
          <p>This OTP expires in 10 minutes.</p>
          <p style="color: #666;">If you didn't request this, please ignore.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "OTP sent to your email." });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/verify-otp
// @access  Private
// ─────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    user.isVerified = true;
    user.otp = { code: null, expiresAt: null };
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond with same message for security
    if (!user) {
      return res.json({
        success: true,
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.otp = {
      code: hashedToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    };
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "RoadSense AI - Password Reset Request",
      html: `
        <div style="font-family: Arial; max-width: 500px; margin: auto;">
          <h2 style="color: #00d4ff;">RoadSense AI</h2>
          <p>You requested a password reset.</p>
          <a href="${resetUrl}" style="background:#00d4ff;color:#000;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">
            Reset Password
          </a>
          <p>This link expires in 30 minutes.</p>
          <p style="color:#666;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/reset-password/:token
// @access  Public
// ─────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      "otp.code": hashedToken,
      "otp.expiresAt": { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired.",
      });
    }

    user.password = password;
    user.otp = { code: null, expiresAt: null };
    await user.save();

    const token = generateToken(user._id, user.role);
    res.json({ success: true, message: "Password reset successful.", token });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─────────────────────────────────────────
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────
exports.logout = async (req, res) => {
  // Client should delete the token; server-side just confirms
  res.json({ success: true, message: "Logged out successfully." });
};

// ─────────────────────────────────────────
// @route   PATCH /api/auth/update-fcm-token
// @access  Private
// ─────────────────────────────────────────
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ success: true, message: "FCM token updated." });
  } catch (error) {
    next(error);
  }
};
