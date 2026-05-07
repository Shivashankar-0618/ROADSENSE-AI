import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import toast from "react-hot-toast";

const MOCK_ROUTES = [
  {
    id: "fastest",
    label: "Fastest Route",
    icon: "⚡",
    color: "warning",
    borderColor: "border-warning/40",
    bgColor: "bg-warning/10",
    textColor: "text-warning",
    time: "12 min",
    distance: "4.2 km",
    trafficLevel: "Moderate",
    roadQuality: 62,
    riskLevel: "Medium",
    fuelEst: "0.38 L",
    description: "Fastest path but passes through 3 known potholes and moderate traffic zone.",
    waypoints: ["MG Road", "Station Circle", "Destination"],
  },
  {
    id: "safest",
    label: "Safest Route",
    icon: "🛡️",
    color: "success",
    borderColor: "border-success/40",
    bgColor: "bg-success/10",
    textColor: "text-success",
    time: "18 min",
    distance: "5.8 km",
    trafficLevel: "Light",
    roadQuality: 91,
    riskLevel: "Low",
    fuelEst: "0.42 L",
    description: "Best road condition. No reported potholes. Recommended for 2-wheelers.",
    waypoints: ["Bypass Road", "Old Town", "Destination"],
  },
  {
    id: "balanced",
    label: "Balanced Route",
    icon: "⚖️",
    color: "primary",
    borderColor: "border-primary/40",
    bgColor: "bg-primary/10",
    textColor: "text-primary",
    time: "15 min",
    distance: "5.0 km",
    trafficLevel: "Light",
    roadQuality: 78,
    riskLevel: "Low-Medium",
    fuelEst: "0.40 L",
    description: "Balanced between speed, safety, and fuel efficiency. AI recommended.",
    waypoints: ["Ring Road", "Market Area", "Destination"],
  },
];

export default function SmartRoute() {
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [routes, setRoutes]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [navigating, setNavigating] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!from.trim() || !to.trim()) return toast.error("Please enter origin and destination.");
    setLoading(true);
    setSelected(null);

    // Simulate AI route calculation
    await new Promise((r) => setTimeout(r, 1800));
    setRoutes(MOCK_ROUTES);
    setLoading(false);
    toast.success("3 routes found by AI!");
  };

  const startNav = (route) => {
    setSelected(route);
    setNavigating(true);
    toast.success(`Navigation started on ${route.label}!`);
  };

  const QualityBar = ({ value }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full rounded-full ${value >= 80 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-danger"}`}
        />
      </div>
      <span className="text-xs text-muted w-8">{value}%</span>
    </div>
  );

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-2xl text-white mb-1">Smart Route</h1>
            <p className="text-muted text-sm">AI-powered route optimization for safer travel</p>
          </div>

          {/* Search */}
          <div className="glass rounded-2xl p-6 mb-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">From</label>
                  <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="Enter starting point..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">To</label>
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Enter destination..."
                    className="input-field"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                    AI Calculating Routes...
                  </>
                ) : (
                  <>🤖 Find Smart Routes</>
                )}
              </button>
            </form>
          </div>

          {/* Loading animation */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass rounded-2xl p-8 text-center mb-6"
              >
                <div className="flex justify-center gap-2 mb-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-primary font-semibold text-sm">Analyzing traffic patterns...</p>
                <p className="text-muted text-xs mt-1">Checking pothole density & road quality</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Routes */}
          <AnimatePresence>
            {routes.length > 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <h2 className="font-semibold text-white text-lg">
                  AI Route Suggestions
                  <span className="text-xs text-muted font-normal ml-2">3 options found</span>
                </h2>

                {routes.map((route, i) => (
                  <motion.div
                    key={route.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => setSelected(route.id === selected?.id ? null : route)}
                    className={`glass rounded-2xl p-5 cursor-pointer border transition-all duration-200 ${
                      selected?.id === route.id
                        ? route.borderColor + " shadow-glow"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    {/* Route header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl border ${route.borderColor} ${route.bgColor} flex items-center justify-center text-xl`}>
                          {route.icon}
                        </div>
                        <div>
                          <p className={`font-semibold ${route.textColor}`}>{route.label}</p>
                          <p className="text-xs text-muted">{route.description.slice(0, 60)}...</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-lg">{route.time}</p>
                        <p className="text-muted text-xs">{route.distance}</p>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "Traffic", value: route.trafficLevel },
                        { label: "Risk Level", value: route.riskLevel },
                        { label: "Fuel Est.", value: route.fuelEst },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-surface rounded-lg p-2">
                          <p className="text-xs text-muted">{stat.label}</p>
                          <p className="text-sm text-white font-medium">{stat.value}</p>
                        </div>
                      ))}
                      <div className="bg-surface rounded-lg p-2">
                        <p className="text-xs text-muted mb-1">Road Quality</p>
                        <QualityBar value={route.roadQuality} />
                      </div>
                    </div>

                    {/* Waypoints */}
                    <div className="flex items-center gap-2 text-xs text-muted mb-4 flex-wrap">
                      {route.waypoints.map((wp, wi) => (
                        <span key={wi} className="flex items-center gap-1">
                          {wi > 0 && <span className="text-border">→</span>}
                          <span className="bg-surface rounded px-2 py-0.5">{wp}</span>
                        </span>
                      ))}
                    </div>

                    {/* Action */}
                    <button
                      onClick={(e) => { e.stopPropagation(); startNav(route); }}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        navigating && selected?.id === route.id
                          ? route.bgColor + " " + route.textColor + " " + route.borderColor + " border"
                          : "btn-ghost"
                      }`}
                    >
                      {navigating && selected?.id === route.id
                        ? "🔵 Navigating..."
                        : "▶ Start Navigation"
                      }
                    </button>
                  </motion.div>
                ))}

                {/* AI Recommendation note */}
                <div className="glass rounded-xl p-4 border border-primary/20 flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <p className="text-sm text-primary font-semibold">AI Recommendation</p>
                    <p className="text-xs text-muted mt-0.5">
                      Based on current pothole density, traffic conditions, and road quality scores,
                      the <strong className="text-primary">Balanced Route</strong> offers the best
                      overall experience for your journey.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {routes.length === 0 && !loading && (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">🧭</div>
              <p className="text-white font-semibold mb-2">Find Your Optimal Route</p>
              <p className="text-muted text-sm">
                AI analyzes traffic, potholes, and road quality to suggest the best path for you.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
