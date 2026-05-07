const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      // Auto-generated in pre-save
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String }, // Cloudinary public_id for deletion
      },
    ],
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: { type: String },
      region: { type: String },
      landmark: { type: String },
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    // AI Analysis Results
    aiAnalysis: {
      confidence: { type: Number, min: 0, max: 100 }, // percentage
      detectedSeverity: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
      },
      boundingBox: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
      },
      modelVersion: { type: String, default: "v1.0" },
      analyzedAt: { type: Date },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "in_progress", "completed"],
      default: "pending",
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3, // 1 = highest
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: { type: Date },
    resolvedAt: { type: Date },
    rejectionReason: { type: String },
    repairNotes: { type: String },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Status history for tracking
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: upvote count
complaintSchema.virtual("upvoteCount").get(function () {
  return this.upvotes?.length || 0;
});

// Pre-save: generate complaintId
complaintSchema.pre("save", async function (next) {
  if (!this.complaintId) {
    const count = await mongoose.model("Complaint").countDocuments();
    this.complaintId = `RS-${Date.now()}-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

// Geospatial index
complaintSchema.index({ "location.coordinates": "2dsphere" });
complaintSchema.index({ status: 1, severity: 1 });
complaintSchema.index({ "location.region": 1 });
complaintSchema.index({ reportedBy: 1 });
complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
module.exports = Complaint;
