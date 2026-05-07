const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "pothole_detected",
        "heavy_traffic",
        "signal_delay",
        "unsafe_road",
        "road_maintenance",
        "accident",
        "flood",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number] }, // [lng, lat]
      address: String,
      region: String,
    },
    radius: {
      type: Number,
      default: 1000, // meters — alert broadcast radius
    },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
    },
    pushSent: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

alertSchema.index({ "location.coordinates": "2dsphere" });
alertSchema.index({ isActive: 1, expiresAt: 1 });
alertSchema.index({ type: 1, severity: 1 });

const Alert = mongoose.model("Alert", alertSchema);
module.exports = Alert;
