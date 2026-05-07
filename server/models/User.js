const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{10,15}$/, "Please enter a valid phone number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ["user", "gram_admin", "traffic_admin", "super_admin"],
      default: "user",
    },
    region: {
      type: String,
      trim: true, // For gram_admin: the panchayat region they manage
    },
    avatar: {
      type: String,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null, // Firebase Cloud Messaging token for push notifications
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    otp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    totalReports: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────
// Pre-save: Hash password
// ─────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─────────────────────────────────────────
// Methods
// ─────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateOTP = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otp = {
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  };
  return code;
};

userSchema.methods.verifyOTP = function (code) {
  if (!this.otp.code || !this.otp.expiresAt) return false;
  if (Date.now() > this.otp.expiresAt.getTime()) return false;
  return this.otp.code === code;
};

// ─────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ region: 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;
