const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Validation rules
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role")
    .optional()
    .isIn(["user", "gram_admin", "traffic_admin"])
    .withMessage("Invalid role"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

// POST /api/auth/register
router.post("/register", registerValidation, authController.register);

// POST /api/auth/login
router.post("/login", loginValidation, authController.login);

// POST /api/auth/send-otp
router.post("/send-otp", protect, authController.sendOTP);

// POST /api/auth/verify-otp
router.post("/verify-otp", protect, authController.verifyOTP);

// POST /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// POST /api/auth/reset-password/:token
router.post("/reset-password/:token", authController.resetPassword);

// GET /api/auth/me
router.get("/me", protect, authController.getMe);

// POST /api/auth/logout
router.post("/logout", protect, authController.logout);

// PATCH /api/auth/update-fcm-token
router.patch("/update-fcm-token", protect, authController.updateFcmToken);

module.exports = router;
