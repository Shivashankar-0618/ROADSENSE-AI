import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import StatsWidget from "../../components/StatsWidget";
import BelagaviMap from "./BelagaviMap";
import VideoUpload from "./VideoUpload";
import api from "../../lib/api";
import toast from "react-hot-toast";
import useSocket from "../../hooks/useSocket";
import useAuthStore from "../../store/authStore";

const CONGESTION_COLOR = {
  free:     "#30d158",
  light:    "#a8e063",
  moderate: "#ffd60a",
  heavy:    "#ff6b00",
  gridlock: "#ff2d55",
  unknown:  "#888780",
};

const MOCK_HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  congestion: Math.floor(20 + Math.random() * 70),
  vehicles:   Math.floor(100 + Math.random() * 400),
}));

// Belagavi route checkpoints (initial state)
const INITIAL_SEGMENTS = [
  { camera_id: "channamma_circle",  road: "Channamma Circle",   congestion_level: "unknown", vehicle_count: 0, avg_speed_kmh: 0, delay_seconds: 0, incidents: [] },
  { camera_id: "rpd_cross",         road: "RPD Cross",           congestion_level: "unknown", vehicle_count: 0, avg_speed_kmh: 0, delay_seconds: 0, incidents: [] },
  { camera_id: "central_bus_stand", road: "Central Bus Stand",   congestion_level: "unknown", vehicle_count: 0, avg_speed_kmh: 0, delay_seconds: 0, incidents: [] },
  { camera_id: "bogarves",          road: "Bogarves",            congestion_level: "unknown", vehicle_count: 0, avg_speed_kmh: 0, delay_seconds: 0, incidents: [] },
];

export default function TrafficDashboard() {
  const { user } = useAuthStore();
  const [segments, setSegments]     = useState(INITIAL_SEGMENTS);
  const [eta, setEta]               = useState(null);
  const [alertForm, setAlertForm]   = useState({ title: "", message: "", type: "heavy_traffic", severity: "warning" });
  const [sendingAlert, setSendingAlert] = useState(false);
  const [hourlyData]                = useState(MOCK_HOURLY);
  const [activeTab, setActiveTab]   = useState("map"); // "map" | "upload"
  const [lastUpdate, setLastUpdate] = useState(null);

  // Computed stats
  const incidents   = segments.filter((s) => s.incidents?.length > 0).length;
  const avgDelay    = Math.round(segments.reduce((a, s) => a + (s.delay_seconds || 0), 0) / segments.length);
  const heavyCount  = segments.filter((s) => ["heavy", "gridlock"].includes(s.congestion_level)).length;

  // ── Load initial route ETA ──
  useEffect(() => {
    api.get("/ai-traffic/route")
      .then((res) => {
        setEta(res.data.data);
        if (res.data.data.segments?.length) {
          mergeSegments(res.data.data.segments);
        }
      })
      .catch(() => {}); // silent fail — socket will populate
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket.IO — live updates ──
  useSocket("belagavi_traffic", {
    traffic_update: (update) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.camera_id === update.camera_id ? { ...s, ...update } : s
        )
      );
      setLastUpdate(new Date());
    },
    eta_update: (newEta) => {
      setEta(newEta);
    },
  });

  // Also join belagavi room
  const { emit } = useSocket(user?.region);
  useEffect(() => {
    emit("join_belagavi");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ETA recalculation poll every 30s ──
  useEffect(() => {
    const interval = setInterval(() => {
      api.get("/ai-traffic/route")
        .then((res) => setEta(res.data.data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  function mergeSegments(incoming) {
    setSegments((prev) =>
      prev.map((s) => {
        const match = incoming.find((i) => i.road === s.road);
        return match ? { ...s, ...match } : s;
      })
    );
  }

  const sendAlert = async (e) => {
    e.preventDefault();
    if (!alertForm.title || !alertForm.message) return toast.error("Fill in title and message.");
    setSendingAlert(true);
    try {
      await api.post("/alerts", { ...alertForm, region: user?.region });
      toast.success("Alert broadcast successfully!");
      setAlertForm({ title: "", message: "", type: "heavy_traffic", severity: "warning" });
    } catch {
      toast.error("Failed to send alert.");
    } finally {
      setSendingAlert(false);
    }
  };

  const handleVideoInsight = (insight) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.road.toLowerCase().includes(insight.road?.toLowerCase() || "")
          ? { ...s, ...insight, camera_id: s.camera_id }
          : s
      )
    );
    setLastUpdate(new Date());
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-xl p-3 border border-border">
        <p className="text-xs text-muted mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-xs font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 glass border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-white">Traffic Management · Belagavi</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse inline-block" />
                <p className="text-muted text-xs">AI monitoring active</p>
              </span>
              {lastUpdate && (
                <span className="text-xs text-muted">
                  Updated {lastUpdate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {eta && (
              <div className="text-right">
                <p className="text-white text-sm font-semibold">ETA {eta.eta_minutes} min</p>
                <p className="text-muted text-xs">{eta.distance_km} km · {eta.worst_congestion}</p>
              </div>
            )}
            <span className="text-xs text-muted">
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsWidget label="Route Segments"   value={segments.length}  icon="🛣️"  color="primary"  index={0} />
            <StatsWidget label="Active Incidents"  value={incidents}         icon="⚠️"  color="danger"   index={1} />
            <StatsWidget label="Avg Delay (sec)"   value={`${avgDelay}s`}    icon="⏱️"  color="warning"  index={2} />
            <StatsWidget label="Congested Roads"   value={heavyCount}        icon="🚨"  color="success"  index={3} />
          </div>

          {/* ETA Banner — show when alternate is suggested */}
          {eta?.alternate_suggested && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 border border-warning/30 flex items-start gap-3"
            >
              <span className="text-2xl">🔄</span>
              <div className="flex-1">
                <p className="text-warning font-semibold text-sm">Alternate route suggested</p>
                <p className="text-muted text-xs mt-0.5">
                  {eta.alternate_route?.reason} · Via {eta.alternate_route?.via} saves ~{
                    eta.eta_minutes - (eta.alternate_route?.eta_minutes || eta.eta_minutes)
                  } min
                </p>
              </div>
              <p className="text-warning font-bold">{eta.alternate_route?.eta_minutes} min</p>
            </motion.div>
          )}

          {/* Map + Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live map — 2/3 width */}
            <div className="lg:col-span-2 glass rounded-2xl overflow-hidden" style={{ height: "420px" }}>
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <h2 className="font-semibold text-white flex-1">
                  <span className="w-2 h-2 bg-danger rounded-full animate-pulse inline-block mr-2" />
                  Live Route: Channamma Circle → Bogarves
                </h2>
                <div className="flex gap-1">
                  {["map", "upload"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                        activeTab === tab
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted hover:text-white"
                      }`}
                    >
                      {tab === "map" ? "🗺 Map" : "📹 Upload"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: "calc(100% - 57px)" }}>
                {activeTab === "map" ? (
                  <BelagaviMap segments={segments} eta={eta} />
                ) : (
                  <div className="p-4 overflow-y-auto h-full">
                    <VideoUpload onInsightReceived={handleVideoInsight} />
                  </div>
                )}
              </div>
            </div>

            {/* Alert broadcast + route status */}
            <div className="space-y-4">
              {/* Route status cards */}
              <div className="glass rounded-2xl p-4">
                <h2 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse inline-block" />
                  Checkpoint Status
                </h2>
                <div className="space-y-2">
                  {segments.map((seg, i) => (
                    <div key={seg.camera_id} className="flex items-center gap-3 p-2.5 bg-surface rounded-xl">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
                        style={{ background: CONGESTION_COLOR[seg.congestion_level] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium truncate">{seg.road}</p>
                        <p className="text-xs text-muted capitalize">{seg.congestion_level}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-white font-semibold">{seg.avg_speed_kmh} km/h</p>
                        {seg.delay_seconds > 0 && (
                          <p className="text-xs text-warning">+{seg.delay_seconds}s</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alert form — traffic_admin only */}
              {["traffic_admin", "super_admin"].includes(user?.role) && (
                <div className="glass rounded-2xl p-4">
                  <h2 className="font-semibold text-white mb-3 text-sm">📢 Broadcast Alert</h2>
                  <form onSubmit={sendAlert} className="space-y-2.5">
                    <select
                      value={alertForm.type}
                      onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
                      className="input-field text-sm"
                    >
                      <option value="heavy_traffic">Heavy Traffic</option>
                      <option value="signal_delay">Signal Delay</option>
                      <option value="accident">Accident</option>
                      <option value="road_maintenance">Road Maintenance</option>
                      <option value="unsafe_road">Unsafe Road</option>
                    </select>
                    <select
                      value={alertForm.severity}
                      onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
                      className="input-field text-sm"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input
                      value={alertForm.title}
                      onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                      placeholder="Alert title..."
                      className="input-field text-sm"
                    />
                    <textarea
                      value={alertForm.message}
                      onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                      placeholder="Describe the situation..."
                      rows={2}
                      className="input-field text-sm resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingAlert}
                      className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                    >
                      {sendingAlert ? (
                        <><div className="w-3 h-3 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />Sending...</>
                      ) : "🔔 Broadcast Now"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-4">24h Congestion Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
                  <XAxis dataKey="hour" tick={{ fill: "#6b6b8a", fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="congestion" stroke="#00d4ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-4">Vehicle Count by Hour</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
                  <XAxis dataKey="hour" tick={{ fill: "#6b6b8a", fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="vehicles" fill="#30d158" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
