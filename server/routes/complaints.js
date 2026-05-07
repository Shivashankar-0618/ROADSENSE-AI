const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isUser, isGramAdmin, isSuperAdmin } = require("../middleware/roleGuard");
const complaintController = require("../controllers/complaintController");
const { upload } = require("../utils/cloudinary");

// All complaint routes require authentication
router.use(protect);

// ─────────────────────────────────────────
// User Routes
// ─────────────────────────────────────────

// POST /api/complaints — Submit new complaint
router.post(
  "/",
  isUser,
  upload.array("images", 5),
  complaintController.createComplaint
);

// GET /api/complaints/my — Get current user's complaints
router.get("/my", isUser, complaintController.getMyComplaints);

// GET /api/complaints/nearby — Get complaints near a lat/lng
router.get("/nearby", isUser, complaintController.getNearbyComplaints);

// POST /api/complaints/:id/upvote — Upvote a complaint
router.post("/:id/upvote", isUser, complaintController.upvoteComplaint);

// ─────────────────────────────────────────
// Gram Admin / Super Admin Routes
// ─────────────────────────────────────────

// GET /api/complaints — Get all complaints (filtered)
router.get("/", isGramAdmin, complaintController.getAllComplaints);

// GET /api/complaints/:id — Get single complaint detail
router.get("/:id", isGramAdmin, complaintController.getComplaint);

// PATCH /api/complaints/:id/status — Update complaint status
router.patch("/:id/status", isGramAdmin, complaintController.updateStatus);

// PATCH /api/complaints/:id/assign — Assign complaint to a user/team
router.patch("/:id/assign", isGramAdmin, complaintController.assignComplaint);

// PATCH /api/complaints/:id/priority — Set priority
router.patch("/:id/priority", isGramAdmin, complaintController.setPriority);

// DELETE /api/complaints/:id — Delete complaint (super admin only)
router.delete("/:id", isSuperAdmin, complaintController.deleteComplaint);

module.exports = router;
