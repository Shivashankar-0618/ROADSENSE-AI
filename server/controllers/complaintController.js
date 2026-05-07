const Complaint = require("../models/Complaint");
const Alert = require("../models/Alert");
const User = require("../models/User");

// ─────────────────────────────────────────
// @route   POST /api/complaints
// @access  User+
// ─────────────────────────────────────────
exports.createComplaint = async (req, res, next) => {
  try {
    const { longitude, latitude, address, region, description, severity } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Location coordinates are required.",
      });
    }

    // Build images array from Cloudinary upload
    const images = req.files?.map((file) => ({
      url: file.path,
      publicId: file.filename,
    })) || [];

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image is required.",
      });
    }

    // Mock AI analysis — in production, call your AI service here
    const aiAnalysis = {
      confidence: Math.floor(75 + Math.random() * 25),
      detectedSeverity: severity,
      modelVersion: "v1.0",
      analyzedAt: new Date(),
    };

    const complaint = await Complaint.create({
      reportedBy: req.user._id,
      images,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address,
        region,
      },
      description,
      severity: aiAnalysis.detectedSeverity || severity,
      aiAnalysis,
    });

    // Update user's total reports count
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalReports: 1 } });

    // Emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.to(region || "global").emit("new_complaint", {
        id: complaint._id,
        complaintId: complaint.complaintId,
        severity: complaint.severity,
        location: complaint.location,
      });
    }

    // Auto-create alert for critical complaints
    if (severity === "critical") {
      await Alert.create({
        type: "pothole_detected",
        title: "Critical Pothole Detected",
        message: `A critical pothole has been reported at ${address || "your area"}.`,
        severity: "critical",
        location: complaint.location,
        createdBy: req.user._id,
        relatedComplaint: complaint._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      data: complaint,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   GET /api/complaints/my
// @access  User+
// ─────────────────────────────────────────
exports.getMyComplaints = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { reportedBy: req.user._id };
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-statusHistory");

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: complaints,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   GET /api/complaints/nearby
// @access  User+
// ─────────────────────────────────────────
exports.getNearbyComplaints = async (req, res, next) => {
  try {
    const { longitude, latitude, radius = 2000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ success: false, message: "Coordinates required." });
    }

    const complaints = await Complaint.find({
      "location.coordinates": {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: Number(radius),
        },
      },
      status: { $ne: "completed" },
    }).limit(50);

    res.json({ success: true, data: complaints, count: complaints.length });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   GET /api/complaints
// @access  Gram Admin+
// ─────────────────────────────────────────
exports.getAllComplaints = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, severity, region, sortBy = "createdAt", order = "desc" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (region) filter["location.region"] = region;

    // Gram admins only see their region
    if (req.user.role === "gram_admin" && req.user.region) {
      filter["location.region"] = req.user.region;
    }

    const complaints = await Complaint.find(filter)
      .populate("reportedBy", "name email phone")
      .populate("assignedTo", "name email")
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: complaints,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   GET /api/complaints/:id
// @access  Gram Admin+
// ─────────────────────────────────────────
exports.getComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("reportedBy", "name email phone")
      .populate("assignedTo", "name email")
      .populate("verifiedBy", "name email")
      .populate("statusHistory.changedBy", "name role");

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found." });
    }

    res.json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   PATCH /api/complaints/:id/status
// @access  Gram Admin+
// ─────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, rejectionReason, repairNotes } = req.body;

    const validStatuses = ["pending", "approved", "rejected", "in_progress", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found." });
    }

    complaint.status = status;
    if (status === "approved" || status === "rejected") {
      complaint.verifiedBy = req.user._id;
      complaint.verifiedAt = new Date();
    }
    if (status === "completed") complaint.resolvedAt = new Date();
    if (rejectionReason) complaint.rejectionReason = rejectionReason;
    if (repairNotes) complaint.repairNotes = repairNotes;

    complaint.statusHistory.push({
      status,
      changedBy: req.user._id,
      note,
    });

    await complaint.save();

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("complaint_status_update", {
        id: complaint._id,
        complaintId: complaint.complaintId,
        status,
      });
    }

    res.json({ success: true, message: "Status updated.", data: complaint });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   PATCH /api/complaints/:id/assign
// @access  Gram Admin+
// ─────────────────────────────────────────
exports.assignComplaint = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { assignedTo, status: "in_progress" },
      { new: true }
    ).populate("assignedTo", "name email");

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found." });
    }

    res.json({ success: true, message: "Complaint assigned.", data: complaint });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   PATCH /api/complaints/:id/priority
// @access  Gram Admin+
// ─────────────────────────────────────────
exports.setPriority = async (req, res, next) => {
  try {
    const { priority } = req.body;
    if (priority < 1 || priority > 5) {
      return res.status(400).json({ success: false, message: "Priority must be 1-5." });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { priority },
      { new: true }
    );

    res.json({ success: true, message: "Priority updated.", data: complaint });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   POST /api/complaints/:id/upvote
// @access  User+
// ─────────────────────────────────────────
exports.upvoteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: "Not found." });

    const userId = req.user._id;
    const hasUpvoted = complaint.upvotes.includes(userId);

    if (hasUpvoted) {
      complaint.upvotes.pull(userId);
    } else {
      complaint.upvotes.push(userId);
    }

    await complaint.save();
    res.json({ success: true, upvoted: !hasUpvoted, upvoteCount: complaint.upvotes.length });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @route   DELETE /api/complaints/:id
// @access  Super Admin
// ─────────────────────────────────────────
exports.deleteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, message: "Complaint deleted." });
  } catch (error) {
    next(error);
  }
};
