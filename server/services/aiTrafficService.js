const axios = require("axios");
const TrafficData = require("../models/TrafficData");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Belagavi route checkpoints
const BELAGAVI_ROUTE = [
  {
    camera_id: "channamma_circle",
    road: "Channamma Circle",
    region: "belagavi",
    coordinates: [74.4977, 15.8584],
  },
  {
    camera_id: "rpd_cross",
    road: "RPD Cross",
    region: "belagavi",
    coordinates: [74.501, 15.856],
  },
  {
    camera_id: "central_bus_stand",
    road: "Central Bus Stand",
    region: "belagavi",
    coordinates: [74.5041, 15.8497],
  },
  {
    camera_id: "bogarves",
    road: "Bogarves",
    region: "belagavi",
    coordinates: [74.5102, 15.845],
  },
];

// In-memory cache of latest insights per camera
const trafficCache = {};

/**
 * Analyze a single frame/video through Python AI service.
 * Returns structured traffic insight and saves to MongoDB.
 */
async function analyzeFrame({ camera_id, road, region, coordinates, frameBase64, fps = 10 }) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/analyze`,
      {
        camera_id,
        road,
        frame: frameBase64,
        timestamp: new Date().toISOString(),
        fps,
      },
      { timeout: 8000 }
    );

    const insight = response.data;

    // Persist to MongoDB
    const saved = await TrafficData.create({
      region,
      location: {
        type: "Point",
        coordinates,
        roadName: road,
      },
      congestionLevel: insight.congestion_level,
      congestionScore: congestionLevelToScore(insight.congestion_level),
      vehicleCount: insight.vehicle_count,
      averageSpeed: insight.avg_speed_kmh,
      signalDelay: insight.delay_seconds,
      incidentReported: insight.incidents?.length > 0,
      source: camera_id.startsWith("user_") ? "user_report" : "camera",
    });

    // Update cache
    trafficCache[camera_id] = {
      ...insight,
      _id: saved._id,
      coordinates,
      region,
      updatedAt: new Date(),
    };

    return trafficCache[camera_id];
  } catch (err) {
    console.error(`[AI Service] Failed for ${camera_id}:`, err.message);

    // Return last cached value if AI is unavailable
    if (trafficCache[camera_id]) {
      return { ...trafficCache[camera_id], stale: true };
    }
    return null;
  }
}

/**
 * Analyze a user-uploaded video — extracts key frames and runs each through AI.
 */
async function analyzeUploadedVideo({ fileBuffer, road, region, coordinates }) {
  try {
    const formData = new (require("form-data"))();
    formData.append("video", fileBuffer, { filename: "upload.mp4", contentType: "video/mp4" });
    formData.append("road", road);
    formData.append("region", region);

    const response = await axios.post(`${AI_SERVICE_URL}/analyze-video`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024,
    });

    const insights = response.data.insights || [];

    // Save all insights to MongoDB
    if (insights.length > 0) {
      const docs = insights.map((ins) => ({
        region,
        location: { type: "Point", coordinates, roadName: road },
        congestionLevel: ins.congestion_level,
        congestionScore: congestionLevelToScore(ins.congestion_level),
        vehicleCount: ins.vehicle_count,
        averageSpeed: ins.avg_speed_kmh,
        signalDelay: ins.delay_seconds,
        incidentReported: ins.incidents?.length > 0,
        source: "user_report",
      }));
      await TrafficData.insertMany(docs);
    }

    // Return the most severe insight from the batch
    return insights.sort(
      (a, b) => congestionLevelToScore(b.congestion_level) - congestionLevelToScore(a.congestion_level)
    )[0] || null;
  } catch (err) {
    console.error("[AI Service] Video analysis failed:", err.message);
    throw new Error("AI video analysis failed: " + err.message);
  }
}

/**
 * Recalculate ETA for the full Channamma Circle → Bogarves route.
 * Uses cached traffic data; called every 30 seconds by the polling loop.
 */
function recalculateRouteETA() {
  const BASE_TIME_MINUTES = 8; // free-flow baseline
  const BASELINE_KM = 3.8;

  let totalDelaySeconds = 0;
  let worstLevel = "free";
  const segmentDetails = [];
  const levelOrder = ["free", "light", "moderate", "heavy", "gridlock"];

  for (const checkpoint of BELAGAVI_ROUTE) {
    const cached = trafficCache[checkpoint.camera_id];
    if (cached) {
      totalDelaySeconds += cached.delay_seconds || 0;
      if (levelOrder.indexOf(cached.congestion_level) > levelOrder.indexOf(worstLevel)) {
        worstLevel = cached.congestion_level;
      }
      segmentDetails.push({
        road: checkpoint.road,
        congestion_level: cached.congestion_level,
        vehicle_count: cached.vehicle_count,
        avg_speed_kmh: cached.avg_speed_kmh,
        delay_seconds: cached.delay_seconds,
        incidents: cached.incidents || [],
        heatmap_color: cached.heatmap_color,
        coordinates: checkpoint.coordinates,
      });
    }
  }

  const totalMinutes = BASE_TIME_MINUTES + Math.round(totalDelaySeconds / 60);
  const hasAlternate = worstLevel === "heavy" || worstLevel === "gridlock";

  return {
    route: "Channamma Circle → RPD Cross → Central Bus Stand → Bogarves",
    distance_km: BASELINE_KM,
    eta_minutes: totalMinutes,
    total_delay_seconds: totalDelaySeconds,
    worst_congestion: worstLevel,
    segments: segmentDetails,
    alternate_suggested: hasAlternate,
    alternate_route: hasAlternate
      ? {
          via: "Nehru Nagar Road → Tilakwadi",
          eta_minutes: totalMinutes - Math.round(totalDelaySeconds * 0.4 / 60),
          reason: `${worstLevel} congestion detected on main route`,
        }
      : null,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Get the current traffic cache for all Belagavi checkpoints.
 */
function getRouteCache() {
  return BELAGAVI_ROUTE.map((cp) => ({
    ...cp,
    ...(trafficCache[cp.camera_id] || {
      congestion_level: "unknown",
      vehicle_count: 0,
      avg_speed_kmh: 0,
      delay_seconds: 0,
      incidents: [],
    }),
  }));
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function congestionLevelToScore(level) {
  const map = { free: 5, light: 25, moderate: 50, heavy: 75, gridlock: 95 };
  return map[level] ?? 50;
}

module.exports = {
  analyzeFrame,
  analyzeUploadedVideo,
  recalculateRouteETA,
  getRouteCache,
  BELAGAVI_ROUTE,
  trafficCache,
};