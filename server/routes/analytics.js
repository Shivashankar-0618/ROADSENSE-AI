const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isSuperAdmin, isGramAdmin } = require("../middleware/roleGuard");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Alert = require("../models/Alert");
const TrafficData = require("../models/TrafficData");

router.use(protect);

// GET /api/analytics/overview — Platform-wide KPIs
router.get("/overview", isSuperAdmin, async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalComplaints,
      pendingComplaints,
      completedComplaints,
      criticalComplaints,
      activeAlerts,
      totalAdmins,
    ] = await Promise.all([
      User.countDocuments({ role: "user", isActive: true }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: "pending" }),
      Complaint.countDocuments({ status: "completed" }),
      Complaint.countDocuments({ severity: "critical", status: { $ne: "completed" } }),
      Alert.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $in: ["gram_admin", "traffic_admin"] }, isActive: true }),
    ]);

    const completionRate = totalComplaints > 0
      ? ((completedComplaints / totalComplaints) * 100).toFixed(1)
      : 0;

    // Average repair time (resolved complaints only)
    const avgRepairPipeline = await Complaint.aggregate([
      { $match: { status: "completed", resolvedAt: { $exists: true } } },
      {
        $project: {
          repairTimeHours: {
            $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: "$repairTimeHours" } } },
    ]);

    const avgRepairTimeHours = avgRepairPipeline[0]?.avgHours?.toFixed(1) || null;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalComplaints,
        pendingComplaints,
        completedComplaints,
        criticalComplaints,
        activeAlerts,
        totalAdmins,
        completionRate: `${completionRate}%`,
        avgRepairTimeHours,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/complaints — Complaint breakdown charts
router.get("/complaints", isGramAdmin, async (req, res, next) => {
  try {
    const { days = 30, region } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filter = { createdAt: { $gte: since } };
    if (region) filter["location.region"] = region;
    if (req.user.role === "gram_admin" && req.user.region) {
      filter["location.region"] = req.user.region;
    }

    const [bySeverity, byStatus, byRegion, trend] = await Promise.all([
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: "$location.region", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Complaint.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ success: true, data: { bySeverity, byStatus, byRegion, trend } });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/users — User growth (Super Admin)
router.get("/users", isSuperAdmin, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byRole, growthTrend, topReporters] = await Promise.all([
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.find({ role: "user" })
        .sort({ totalReports: -1 })
        .limit(10)
        .select("name email totalReports region"),
    ]);

    res.json({ success: true, data: { byRole, growthTrend, topReporters } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
