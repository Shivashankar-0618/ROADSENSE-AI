const mongoose = require("mongoose");

const trafficDataSchema = new mongoose.Schema(
  {
    region: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number] }, // [lng, lat]
      roadName: String,
    },
    congestionLevel: {
      type: String,
      enum: ["free", "light", "moderate", "heavy", "gridlock"],
      required: true,
    },
    congestionScore: {
      type: Number,
      min: 0,
      max: 100, // 0 = free, 100 = gridlock
    },
    vehicleCount: { type: Number, default: 0 },
    averageSpeed: { type: Number }, // km/h
    signalDelay: { type: Number }, // seconds
    incidentReported: { type: Boolean, default: false },
    roadQualityScore: {
      type: Number,
      min: 0,
      max: 100, // 100 = perfect road
    },
    recordedAt: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ["sensor", "camera", "user_report", "ai_prediction", "manual"],
      default: "manual",
    },
  },
  { timestamps: true }
);

trafficDataSchema.index({ "location.coordinates": "2dsphere" });
trafficDataSchema.index({ region: 1, recordedAt: -1 });
trafficDataSchema.index({ congestionLevel: 1 });

const TrafficData = mongoose.model("TrafficData", trafficDataSchema);
module.exports = TrafficData;
