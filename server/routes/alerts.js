const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isUser, isTrafficAdmin } = require("../middleware/roleGuard");
const Alert = require("../models/Alert");
const { sendMulticastNotification } = require("../config/firebase");
const User = require("../models/User");

router.use(protect);

// GET /api/alerts — Get active alerts (optionally near a location)
router.get("/", isUser, async (req, res, next) => {
  try {
    const { longitude, latitude, radius = 5000, type, severity } = req.query;

    const filter = { isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    if (longitude && latitude) {
      filter["location.coordinates"] = {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: Number(radius),
        },
      };
    }

    const alerts = await Alert.find(filter)
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 })
      .limit(50);

    // Increment view count
    const ids = alerts.map((a) => a._id);
    await Alert.updateMany({ _id: { $in: ids } }, { $inc: { viewCount: 1 } });

    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/alerts — Create a new alert (Traffic Admin+)
router.post("/", isTrafficAdmin, async (req, res, next) => {
  try {
    const { type, title, message, severity, longitude, latitude, address, region, radius, expiresInMinutes } = req.body;

    const alert = await Alert.create({
      type,
      title,
      message,
      severity,
      location: {
        type: "Point",
        coordinates: longitude && latitude ? [parseFloat(longitude), parseFloat(latitude)] : undefined,
        address,
        region,
      },
      radius,
      createdBy: req.user._id,
      expiresAt: expiresInMinutes
        ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
        : null,
    });

    // Emit via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(region || "global").emit("new_alert", alert);
    }

    // Send push notification to users in region (batch)
    const usersInRegion = await User.find({
      region,
      fcmToken: { $ne: null },
      isActive: true,
    }).select("fcmToken");

    const tokens = usersInRegion.map((u) => u.fcmToken).filter(Boolean);
    if (tokens.length > 0) {
      await sendMulticastNotification(tokens, title, message, {
        type,
        alertId: alert._id.toString(),
        severity,
      });
      await Alert.findByIdAndUpdate(alert._id, { pushSent: true });
    }

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/alerts/:id/deactivate — Deactivate alert
router.patch("/:id/deactivate", isTrafficAdmin, async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: "Alert not found." });
    res.json({ success: true, message: "Alert deactivated.", data: alert });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/alerts/:id
router.delete("/:id", isTrafficAdmin, async (req, res, next) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Alert deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
