import { motion } from "framer-motion";

/**
 * StatsWidget
 * @param {string} label - KPI label
 * @param {string|number} value - Main value
 * @param {string} icon - Emoji icon
 * @param {string} trend - Optional trend text (e.g. "+12% this week")
 * @param {string} color - "primary" | "danger" | "warning" | "success"
 * @param {number} index - Animation delay index
 */
export default function StatsWidget({ label, value, icon, trend, color = "primary", index = 0 }) {
  const colorMap = {
    primary: "text-primary bg-primary/10 border-primary/20 shadow-glow",
    danger:  "text-danger  bg-danger/10  border-danger/20  shadow-glow-red",
    warning: "text-warning bg-warning/10 border-warning/20 shadow-glow-yellow",
    success: "text-success bg-success/10 border-success/20 shadow-glow-green",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="glass rounded-2xl p-5 flex items-start gap-4"
    >
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white font-display">{value ?? "—"}</p>
        {trend && <p className="text-xs text-muted mt-1">{trend}</p>}
      </div>
    </motion.div>
  );
}
