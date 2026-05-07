import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import StatsWidget from "../../components/StatsWidget";
import ComplaintCard from "../../components/ComplaintCard";
import api from "../../lib/api";
import useAuthStore from "../../store/authStore";
import useSocket from "../../hooks/useSocket";

export default function UserDashboard() {
  const { user } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats]           = useState({ total: 0, pending: 0, completed: 0, inProgress: 0 });
  const [loading, setLoading]       = useState(true);
  const [liveAlert, setLiveAlert]   = useState(null);

  // Socket: listen for real-time alerts in user's region
  useSocket(user?.region, {
    new_alert: (alert) => setLiveAlert(alert),
    complaint_status_update: (update) => {
      setComplaints((prev) =>
        prev.map((c) => c._id === update.id ? { ...c, status: update.status } : c)
      );
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get("/complaints/my?limit=6");
        setComplaints(data.data);

        const all       = data.pagination.total;
        const pending   = data.data.filter((c) => c.status === "pending").length;
        const completed = data.data.filter((c) => c.status === "completed").length;
        const inProg    = data.data.filter((c) => c.status === "in_progress").length;

        setStats({ total: all, pending, completed, inProgress: inProg });
      } catch {
        // Handled globally by interceptor
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-white">
              Welcome, <span className="text-primary">{user?.name?.split(" ")[0]}</span>
            </h1>
            <p className="text-muted text-sm mt-0.5">Smart City Road Monitoring</p>
          </div>
          <Link to="/report" className="btn-primary flex items-center gap-2">
            <span>📸</span> Report Pothole
          </Link>
        </div>

        {/* Live alert banner */}
        {liveAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="animate-pulse text-lg">🚨</span>
              <div>
                <p className="text-sm font-semibold text-danger">{liveAlert.title}</p>
                <p className="text-xs text-muted">{liveAlert.message}</p>
              </div>
            </div>
            <button onClick={() => setLiveAlert(null)} className="text-muted hover:text-white text-xs">✕</button>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsWidget label="Total Reports"  value={stats.total}      icon="📋" color="primary" index={0} />
          <StatsWidget label="Pending"         value={stats.pending}    icon="⏳" color="warning" index={1} />
          <StatsWidget label="In Progress"     value={stats.inProgress} icon="🔧" color="primary" index={2} />
          <StatsWidget label="Completed"       value={stats.completed}  icon="✅" color="success" index={3} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { to: "/map",    icon: "🗺️", label: "Live Map",    desc: "View nearby potholes", color: "text-primary" },
            { to: "/route",  icon: "🧭", label: "Smart Route", desc: "AI-optimized routes",  color: "text-success" },
            { to: "/report", icon: "📸", label: "New Report",  desc: "AI pothole detection", color: "text-warning" },
          ].map((action, i) => (
            <motion.div
              key={action.to}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Link
                to={action.to}
                className="glass rounded-2xl p-5 flex flex-col items-center text-center hover:border-primary/30 border border-transparent transition-all duration-200 hover:shadow-glow block"
              >
                <span className="text-3xl mb-3">{action.icon}</span>
                <p className={`font-semibold text-sm ${action.color}`}>{action.label}</p>
                <p className="text-xs text-muted mt-1">{action.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Recent Complaints */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">My Recent Reports</h2>
            <Link to="/report" className="text-primary text-sm hover:underline">+ New Report</Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-2xl h-64 shimmer" />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">🛣️</div>
              <p className="text-white font-medium mb-2">No reports yet</p>
              <p className="text-muted text-sm mb-6">Help improve road safety in your area.</p>
              <Link to="/report" className="btn-primary inline-block">Report a Pothole</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {complaints.map((c, i) => (
                <ComplaintCard key={c._id} complaint={c} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
