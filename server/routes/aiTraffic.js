const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { isUser, isTrafficAdmin } = require("../middleware/roleGuard");
const {
  analyzeFrame,
  analyzeUploadedVideo,
  recalculateRouteETA,
  getRouteCache,
  BELAGAVI_ROUTE,
} = require("../services/aiTrafficService");

// Multer — video upload in memory (max 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files are allowed"));
  },
});

router.use(protect);

// ─────────────────────────────────────────
// GET /api/ai-traffic/route — Full route status + ETA
// ─────────────────────────────────────────
router.get("/route", isUser, (req, res) => {
  const eta = recalculateRouteETA();
  res.json({ success: true, data: eta });
});

// ─────────────────────────────────────────
// GET /api/ai-traffic/checkpoints — Live data per checkpoint
// ─────────────────────────────────────────
router.get("/checkpoints", isUser, (req, res) => {
  const data = getRouteCache();
  res.json({ success: true, data });
});

// ─────────────────────────────────────────
// POST /api/ai-traffic/analyze-frame — Analyze a single JPEG frame
// Traffic admin: manual camera frame push
// Body: { camera_id, frameBase64 }
// ─────────────────────────────────────────
router.post("/analyze-frame", isTrafficAdmin, async (req, res, next) => {
  try {
    const { camera_id, frameBase64 } = req.body;

    const checkpoint = BELAGAVI_ROUTE.find((c) => c.camera_id === camera_id);
    if (!checkpoint) {
      return res.status(400).json({
        success: false,
        message: `Unknown camera_id. Valid: ${BELAGAVI_ROUTE.map((c) => c.camera_id).join(", ")}`,
      });
    }

    if (!frameBase64) {
      return res.status(400).json({ success: false, message: "frameBase64 is required" });
    }

    const insight = await analyzeFrame({
      ...checkpoint,
      frameBase64,
    });

    if (!insight) {
      return res.status(503).json({ success: false, message: "AI service unavailable" });
    }

    // Broadcast to Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to("belagavi_traffic").emit("traffic_update", insight);

      // Recalculate and broadcast ETA
      const eta = recalculateRouteETA();
      io.to("belagavi_traffic").emit("eta_update", eta);
    }

    res.json({ success: true, data: insight });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/ai-traffic/upload-video — User uploads a traffic video
// Body: multipart/form-data — video file + road + region
// ─────────────────────────────────────────
router.post("/upload-video", isUser, upload.single("video"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file provided" });
    }

    const { road, region } = req.body;

    // Find matching checkpoint or default to nearest
    const checkpoint =
      BELAGAVI_ROUTE.find(
        (c) => c.road.toLowerCase().includes((road || "").toLowerCase())
      ) || BELAGAVI_ROUTE[0];

    const insight = await analyzeUploadedVideo({
      fileBuffer: req.file.buffer,
      road: checkpoint.road,
      region: region || "belagavi",
      coordinates: checkpoint.coordinates,
    });

    if (!insight) {
      return res.status(503).json({ success: false, message: "AI video analysis failed" });
    }

    // Broadcast result
    const io = req.app.get("io");
    if (io) {
      io.to("belagavi_traffic").emit("traffic_update", {
        ...insight,
        camera_id: `user_upload_${checkpoint.camera_id}`,
        road: checkpoint.road,
        source: "user_report",
      });

      const eta = recalculateRouteETA();
      io.to("belagavi_traffic").emit("eta_update", eta);
    }

    res.json({ success: true, data: insight, message: "Video analyzed successfully" });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
// POST /api/ai-traffic/mock-update — Dev helper: inject mock AI data
// Traffic admin only — useful for testing without Python service
// ─────────────────────────────────────────
router.post("/mock-update", isTrafficAdmin, async (req, res, next) => {
  try {
    const TrafficData = require("../models/TrafficData");
    const levels = ["free", "light", "moderate", "heavy", "gridlock"];

    const docs = BELAGAVI_ROUTE.map((cp) => {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const score = { free: 5, light: 25, moderate: 50, heavy: 75, gridlock: 95 }[level];
      return {
        region: cp.region,
        location: { type: "Point", coordinates: cp.coordinates, roadName: cp.road },
        congestionLevel: level,
        congestionScore: score,
        vehicleCount: Math.floor(Math.random() * 150),
        averageSpeed: Math.floor(10 + Math.random() * 55),
        signalDelay: Math.floor(Math.random() * 200),
        incidentReported: Math.random() > 0.85,
        source: "ai_prediction",
      };
    });

    await TrafficData.insertMany(docs);

    const io = req.app.get("io");
    if (io) {
      docs.forEach((doc) => {
        io.to("belagavi_traffic").emit("traffic_update", {
          camera_id: doc.location.roadName.toLowerCase().replace(/ /g, "_"),
          road: doc.location.roadName,
          congestion_level: doc.congestionLevel,
          vehicle_count: doc.vehicleCount,
          avg_speed_kmh: doc.averageSpeed,
          delay_seconds: doc.signalDelay,
          incidents: doc.incidentReported ? [{ type: "detected" }] : [],
          heatmap_color: {
            free: "#30d158", light: "#a8e063", moderate: "#ffd60a",
            heavy: "#ff6b00", gridlock: "#ff2d55",
          }[doc.congestionLevel],
          coordinates: doc.location.coordinates,
        });
      });

      const eta = recalculateRouteETA();
      io.to("belagavi_traffic").emit("eta_update", eta);
    }

    res.json({ success: true, message: "Mock data injected", count: docs.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;