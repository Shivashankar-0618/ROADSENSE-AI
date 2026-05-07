const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isUser, isTrafficAdmin } = require("../middleware/roleGuard");
const TrafficData = require("../models/TrafficData");
const { recalculateRouteETA, getRouteCache } = require("../services/aiTrafficService");

router.use(protect);

// GET /api/traffic/live — Get live traffic data for a region
router.get("/live", isUser, async (req, res, next) => {
  try {
    const { region, longitude, latitude, radius = 5000 } = req.query;

    let query = {};
    if (region) query.region = region;
    if (longitude && latitude) {
      query["location.coordinates"] = {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: Number(radius),
        },
      };
    }

    const data = await TrafficData.find(query)
      .sort({ recordedAt: -1 })
      .limit(100);

    // Also include live AI cache for Belagavi
    const liveCache = getRouteCache();

    res.json({ success: true, data, liveCache, count: data.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/traffic/heatmap — Congestion heatmap data
router.get("/heatmap", isUser, async (req, res, next) => {
  try {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    const data = await TrafficData.find({ recordedAt: { $gte: recent } })
      .select("location congestionScore congestionLevel recordedAt")
      .limit(500);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/traffic/eta — Current ETA for the Belagavi route
router.get("/eta", isUser, (req, res) => {
  const eta = recalculateRouteETA();
  res.json({ success: true, data: eta });
});

// POST /api/traffic — Create/update traffic data point (Traffic Admin)
router.post("/", isTrafficAdmin, async (req, res, next) => {
  try {
    const {
      region, longitude, latitude, roadName,
      congestionLevel, congestionScore, vehicleCount,
      averageSpeed, signalDelay, incidentReported, roadQualityScore,
    } = req.body;

    const trafficPoint = await TrafficData.create({
      region,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        roadName,
      },
      congestionLevel,
      congestionScore,
      vehicleCount,
      averageSpeed,
      signalDelay,
      incidentReported,
      roadQualityScore,
      source: "manual",
    });

    const io = req.app.get("io");
    if (io) {
      io.to(region || "global").emit("traffic_update", trafficPoint);
      const eta = recalculateRouteETA();
      io.to("belagavi_traffic").emit("eta_update", eta);
    }

    res.status(201).json({ success: true, data: trafficPoint });
  } catch (error) {
    next(error);
  }
});

// GET /api/traffic/analytics — Aggregated traffic analytics
router.get("/analytics", isTrafficAdmin, async (req, res, next) => {
  try {
    const { region, hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filter = { recordedAt: { $gte: since } };
    if (region) filter.region = region;

    const stats = await TrafficData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$congestionLevel",
          count: { $sum: 1 },
          avgScore: { $avg: "$congestionScore" },
          avgSpeed: { $avg: "$averageSpeed" },
        },
      },
    ]);

    const hourlyTrend = await TrafficData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $hour: "$recordedAt" },
          avgCongestion: { $avg: "$congestionScore" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, stats, hourlyTrend });
  } catch (error) {
    next(error);
  }
});

module.exports = router;