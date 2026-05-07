import { motion, AnimatePresence } from "framer-motion";

const ALERT_CONFIG = {
  pothole_detected: { icon: "🕳️", color: "danger" },
  heavy_traffic:    { icon: "🚗", color: "warning" },
  signal_delay:     { icon: "🚦", color: "warning" },
  unsafe_road:      { icon: "⚠️", color: "danger" },
  road_maintenance: { icon: "🔧", color: "primary" },
  accident:         { icon: "🚨", color: "danger" },
  general:          { icon: "ℹ️", color: "primary" },
};

const COLOR_MAP = {
  danger:  "border-danger/40 bg-danger/10",
  warning: "border-warning/40 bg-warning/10",
  primary: "border-primary/40 bg-primary/10",
  success: "border-success/40 bg-success/10",
};

const TEXT_MAP = {
  danger:  "text-danger",
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
};

export default function AlertCard({ alert, onDismiss }) {
  const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.general;
  const color = alert.severity === "critical" ? "danger"
              : alert.severity === "warning"  ? "warning"
              : "primary";

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className={`rounded-xl border p-4 ${COLOR_MAP[color]} backdrop-blur-sm`}
    >
      <div className="flex items-start gap-3">
        <div className={`text-xl flex-shrink-0 animate-pulse-slow`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${TEXT_MAP[color]}`}>{alert.title}</p>
            <span className="text-xs text-muted flex-shrink-0">{timeAgo(alert.createdAt)}</span>
          </div>
          <p className="text-xs text-muted mt-1 line-clamp-2">{alert.message}</p>
          {alert.location?.address && (
            <p className="text-xs text-muted mt-1">📍 {alert.location.address}</p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(alert._id)}
            className="text-muted hover:text-white text-xs flex-shrink-0 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * AlertPanel — floating notification panel
 */
export function AlertPanel({ alerts = [], onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 w-80 space-y-2 pointer-events-none">
      <AnimatePresence>
        {alerts.slice(0, 5).map((alert) => (
          <div key={alert._id} className="pointer-events-auto">
            <AlertCard alert={alert} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
