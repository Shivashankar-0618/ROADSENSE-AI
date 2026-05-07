import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import StatsWidget from "../../components/StatsWidget";
import api from "../../lib/api";
import toast from "react-hot-toast";

const PIE_COLORS = ["#ff2d55", "#ff6b00", "#ffd60a", "#30d158"];

const MOCK_TREND = Array.from({ length: 30 }, (_, i) => ({
  day:        `Day ${i + 1}`,
  complaints: Math.floor(5  + Math.random() * 20),
  resolved:   Math.floor(2  + Math.random() * 15),
  users:      Math.floor(10 + Math.random() * 50),
}));

const MOCK_REGIONS = [
  { region: "Hubli-Dharwad", complaints: 48, completed: 32 },
  { region: "Gadag",         complaints: 21, completed: 14 },
  { region: "Belagavi",      complaints: 35, completed: 18 },
  { region: "Dharwad",       complaints: 27, completed: 20 },
  { region: "Bidar",         complaints: 15, completed:  9 },
];

export default function SuperDashboard() {
  const [overview, setOverview]   = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers]         = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [userPage, setUserPage]   = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  const fetchOverview = useCallback(async () => {
    try {
      const { data } = await api.get("/analytics/overview");
      setOverview(data.data);
    } catch {} finally { setLoadingOverview(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await api.get("/analytics/complaints?days=30");
      setAnalytics(data.data);
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get(`/users?page=${userPage}&limit=10`);
      setUsers(data.data);
      setUserTotal(data.pagination.total);
    } catch {}
  }, [userPage]);

  useEffect(() => { fetchOverview(); fetchAnalytics(); }, []);
  useEffect(() => { if (activeTab === "users") fetchUsers(); }, [activeTab, fetchUsers]);

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isActive: !u.isActive } : u));
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
    } catch { toast.error("Failed to update user."); }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-xl p-3 border border-border">
        <p className="text-xs text-muted mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-xs" style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  const severityPieData = analytics?.bySeverity?.map((s, i) => ({
    name:  s._id,
    value: s.count,
  })) || [];

  const tabs = [
    { id: "overview",  label: "Overview",  icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "users",     label: "Users",     icon: "👥" },
    { id: "system",    label: "System",    icon: "⚙️" },
  ];

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 glass border-b border-border px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl text-white">Super Admin Console</h1>
              <p className="text-muted text-xs mt-0.5">Full platform control & analytics</p>
            </div>
            <button onClick={() => { fetchOverview(); fetchAnalytics(); }} className="btn-ghost text-sm">
              🔄 Refresh
            </button>
          </div>

          {/* Tab nav */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-sm px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <>
              {loadingOverview ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <div key={i} className="glass rounded-2xl h-28 shimmer" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsWidget label="Total Users"      value={overview?.totalUsers}      icon="👥" color="primary" index={0} />
                    <StatsWidget label="Total Complaints" value={overview?.totalComplaints}  icon="📋" color="warning" index={1} />
                    <StatsWidget label="Critical Issues"  value={overview?.criticalComplaints} icon="🚨" color="danger"  index={2} />
                    <StatsWidget label="Active Alerts"    value={overview?.activeAlerts}    icon="🔔" color="success" index={3} />
                    <StatsWidget label="Pending Review"   value={overview?.pendingComplaints} icon="⏳" color="warning" index={4} />
                    <StatsWidget label="Resolved"         value={overview?.completedComplaints} icon="✅" color="success" index={5} />
                    <StatsWidget label="Completion Rate"  value={overview?.completionRate}  icon="📊" color="primary" index={6} />
                    <StatsWidget label="Avg Repair Time"  value={overview?.avgRepairTimeHours ? `${overview.avgRepairTimeHours}h` : "N/A"} icon="⏱️" color="primary" index={7} />
                  </div>

                  {/* Trend chart */}
                  <div className="glass rounded-2xl p-5">
                    <h2 className="font-semibold text-white mb-4">30-Day Activity Trend</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={MOCK_TREND}>
                        <defs>
                          <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#30d158" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
                        <XAxis dataKey="day" tick={{ fill: "#6b6b8a", fontSize: 10 }} interval={4} />
                        <YAxis tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="complaints" stroke="#00d4ff" fill="url(#gc)" strokeWidth={2} name="Complaints" />
                        <Area type="monotone" dataKey="resolved"   stroke="#30d158" fill="url(#gr)" strokeWidth={2} name="Resolved" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Region table */}
                  <div className="glass rounded-2xl p-5">
                    <h2 className="font-semibold text-white mb-4">Top Affected Regions</h2>
                    <div className="space-y-3">
                      {MOCK_REGIONS.map((r, i) => {
                        const pct = Math.round((r.completed / r.complaints) * 100);
                        return (
                          <div key={r.region} className="flex items-center gap-4">
                            <span className="text-muted text-xs w-5">{i + 1}</span>
                            <span className="text-sm text-white w-36 flex-shrink-0">{r.region}</span>
                            <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.1 }}
                                className={`h-full rounded-full ${pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-danger"}`}
                              />
                            </div>
                            <span className="text-xs text-muted w-24 text-right flex-shrink-0">
                              {r.completed}/{r.complaints} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Severity pie */}
                <div className="glass rounded-2xl p-5">
                  <h2 className="font-semibold text-white mb-4">Complaints by Severity</h2>
                  {severityPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={severityPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {severityPieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-52 flex items-center justify-center text-muted text-sm">No data yet</div>
                  )}
                </div>

                {/* Status bar chart */}
                <div className="glass rounded-2xl p-5">
                  <h2 className="font-semibold text-white mb-4">Complaints by Status</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics?.byStatus?.map((s) => ({ name: s._id.replace("_", " "), count: s.count })) || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
                      <XAxis dataKey="name" tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily trend */}
              <div className="glass rounded-2xl p-5">
                <h2 className="font-semibold text-white mb-4">Daily Complaint Trend (30 days)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics?.trend?.map((t) => ({ day: t._id, complaints: t.count })) || MOCK_TREND.slice(0, 15)}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffd60a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffd60a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
                    <XAxis dataKey="day" tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b6b8a", fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="complaints" stroke="#ffd60a" fill="url(#trendGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── USERS TAB ── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">User Management</h2>
                <p className="text-muted text-sm">Total: {userTotal} users</p>
              </div>

              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Name", "Email", "Role", "Region", "Reports", "Status", "Actions"].map((h) => (
                        <th key={h} className="text-xs text-muted text-left px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <motion.tr
                        key={u._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/50 hover:bg-white/2 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-white text-sm">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            u.role === "super_admin"    ? "bg-danger/10  text-danger  border-danger/30" :
                            u.role === "gram_admin"     ? "bg-primary/10 text-primary border-primary/30" :
                            u.role === "traffic_admin"  ? "bg-warning/10 text-warning border-warning/30" :
                                                         "bg-surface text-muted border-border"
                          }`}>
                            {u.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">{u.region || "—"}</td>
                        <td className="px-4 py-3 text-white text-center">{u.totalReports || 0}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "text-success bg-success/10" : "text-muted bg-surface"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleUserStatus(u._id, u.isActive)}
                            className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                              u.isActive
                                ? "border-danger/30 text-danger hover:bg-danger/10"
                                : "border-success/30 text-success hover:bg-success/10"
                            }`}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {users.length === 0 && (
                  <div className="p-12 text-center text-muted text-sm">No users found.</div>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage === 1} className="btn-ghost text-sm disabled:opacity-40">← Prev</button>
                <span className="text-muted text-sm self-center">Page {userPage}</span>
                <button onClick={() => setUserPage((p) => p + 1)} disabled={users.length < 10} className="btn-ghost text-sm disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}

          {/* ── SYSTEM TAB ── */}
          {activeTab === "system" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "API Server",      status: "Online",  uptime: "99.9%", icon: "🖥️",  color: "success" },
                  { label: "MongoDB",         status: "Online",  uptime: "99.8%", icon: "🗄️",  color: "success" },
                  { label: "Firebase",        status: "Online",  uptime: "100%",  icon: "🔥",  color: "success" },
                  { label: "Socket.IO",       status: "Online",  uptime: "99.7%", icon: "⚡",  color: "success" },
                  { label: "AI Engine",       status: "Online",  uptime: "98.2%", icon: "🤖",  color: "success" },
                  { label: "Cloudinary CDN",  status: "Online",  uptime: "100%",  icon: "☁️",  color: "success" },
                ].map((svc, i) => (
                  <motion.div
                    key={svc.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass rounded-2xl p-5 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 bg-success/10 border border-success/20 rounded-xl flex items-center justify-center text-xl">
                      {svc.icon}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{svc.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse inline-block" />
                        <span className="text-success text-xs">{svc.status}</span>
                      </div>
                      <p className="text-muted text-xs mt-0.5">Uptime: {svc.uptime}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="glass rounded-2xl p-6">
                <h2 className="font-semibold text-white mb-4">Platform Information</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    ["Version",     "1.0.0"],
                    ["Environment", "Production"],
                    ["Node.js",     "v20 LTS"],
                    ["React",       "v18.3"],
                    ["MongoDB",     "v8.x"],
                    ["AI Model",    "v1.0 (YOLOv8)"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-surface rounded-xl p-3">
                      <p className="text-muted text-xs">{k}</p>
                      <p className="text-white font-medium mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
