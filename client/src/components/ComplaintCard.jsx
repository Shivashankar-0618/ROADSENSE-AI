import { motion } from "framer-motion";

const SEVERITY_CLASS = {
  critical: "badge-critical",
  high:     "badge-high",
  medium:   "badge-medium",
  low:      "badge-low",
};

const STATUS_CLASS = {
  pending:     "status-pending",
  approved:    "status-approved",
  in_progress: "status-in_progress",
  completed:   "status-completed",
  rejected:    "status-rejected",
};

export default function ComplaintCard({ complaint, onStatusChange, showActions = false, index = 0 }) {
  const { complaintId, images, location, severity, status, description, aiAnalysis, createdAt, upvoteCount } = complaint;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-2xl overflow-hidden hover:border-primary/20 border border-transparent transition-all duration-200"
    >
      {/* Image */}
      {images?.[0] && (
        <div className="relative h-40 overflow-hidden">
          <img
            src={images[0].url}
            alt="Pothole"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className={SEVERITY_CLASS[severity]}>{severity?.toUpperCase()}</span>
            {aiAnalysis?.confidence && (
              <span className="bg-primary/20 text-primary border border-primary/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                AI {aiAnalysis.confidence}%
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-muted">{complaintId}</span>
          <span className={STATUS_CLASS[status]}>{status?.replace("_", " ")}</span>
        </div>

        {/* Location */}
        <p className="text-sm text-white font-medium truncate mb-1">
          📍 {location?.address || `${location?.coordinates?.[1]?.toFixed(4)}, ${location?.coordinates?.[0]?.toFixed(4)}`}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted line-clamp-2 mb-3">{description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>👍 {upvoteCount || 0}</span>
          <span>{new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        {/* Actions (admin only) */}
        {showActions && onStatusChange && (
          <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
            {["approved", "in_progress", "completed", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(complaint._id, s)}
                disabled={status === s}
                className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                  status === s
                    ? "opacity-40 cursor-not-allowed border-border text-muted"
                    : "border-border hover:border-primary/40 text-muted hover:text-white"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
