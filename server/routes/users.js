const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isSuperAdmin, isGramAdmin } = require("../middleware/roleGuard");
const User = require("../models/User");

router.use(protect);

// GET /api/users — Get all users (Super Admin)
router.get("/", isSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password -otp")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id — Get single user
router.get("/:id", isSuperAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password -otp");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/role — Change user role
router.patch("/:id/role", isSuperAdmin, async (req, res, next) => {
  try {
    const { role, region } = req.body;
    const validRoles = ["user", "gram_admin", "traffic_admin", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, ...(region && { region }) },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, message: "Role updated.", data: user });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/toggle-active — Activate/deactivate user
router.patch("/:id/toggle-active", isSuperAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"}.`,
      isActive: user.isActive,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/gram-admins — Get all gram admins (for assignment dropdowns)
router.get("/list/gram-admins", isGramAdmin, async (req, res, next) => {
  try {
    const admins = await User.find({ role: "gram_admin", isActive: true })
      .select("name email region");
    res.json({ success: true, data: admins });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
