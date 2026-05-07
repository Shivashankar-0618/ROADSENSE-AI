import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Sidebar from "../../components/Sidebar";
import ComplaintCard from "../../components/ComplaintCard";
import StatsWidget from "../../components/StatsWidget";
import api from "../../lib/api";
import toast from "react-hot-toast";
import useSocket from "../../hooks/useSocket";
import useAuthStore from "../../store/authStore";

const STATUSES  = ["all", "pending", "approved", "in_progress", "completed", "rejected"];
const SEVERITIES = ["all", "critical", "high", "medium", "low"];

export default function GramDashboard() {
  const { user } = useAuthStore();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter]     = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailOpen, setDetailOpen] = useState(null);

  useSocket(user?.region, {
    new_complaint: (c) => {
      setComplaints((prev) => [c, ...prev]);
      toast("New complaint reported!", { icon: "🕳️" });
    },
  });

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (statusFilter !== "all")   params.append("status", statusFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);

      const { data } = await api.get(`/complaints?${params}`);
      setComplaints(data.data);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, severityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get("/analytics/complaints");
      const bySev  = data.data.bySeverity;
      const byStat = data.data.byStatus;

      setStats({
        total:      byStat.reduce((a, b) => a + b.count, 0),
        critical:   bySev.find((s) => s._id === "critical")?.count || 0,
        pending:    byStat.find((s) => s._id === "pending")?.count || 0,
        completed:  byStat.find((s) => s._id === "completed")?.count || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchComplaints(); fetchStats(); }, [fetchComplaints, fetchStats]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/complaints/${id}/status`, { status });
      setComplaints((prev) => prev.map((c) => c._id === id ? { ...c, status } : c));
      toast.success(`Status updated to "${status}"`);
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 glass border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-white">Gram Panchayat Dashboard</h1>
            <p className="text-muted text-xs mt-0.5">
              Region: <span className="text-primary">{user?.region || "All Regions"}</span>
            </p>
          </div>
          <button onClick={fetchComplaints} className="btn-ghost text-sm flex items-center gap-2">
            🔄 Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsWidget label="Total Complaints" value={stats.total}    icon="📋" color="primary" index={0} />
            <StatsWidget label="Critical Issues"  value={stats.critical} icon="🚨" color="danger"  index={1} />
            <StatsWidget label="Pending Review"   value={stats.pending}  icon="⏳" color="warning" index={2} />
            <StatsWidget label="Resolved"         value={stats.completed}icon="✅" color="success" index={3} />
          </div>

          {/* Filters */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Filter by Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      statusFilter === s
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted hover:border-primary/30 hover:text-white"
                    }`}
                  >
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Filter by Severity</p>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSeverityFilter(s); setPage(1); }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      severityFilter === s
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted hover:border-primary/30 hover:text-white"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Complaints Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass rounded-2xl h-72 shimmer" />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-white font-semibold mb-2">No complaints found</p>
              <p className="text-muted text-sm">No complaints match the selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {complaints.map((c, i) => (
                <ComplaintCard
                  key={c._id}
                  complaint={c}
                  index={i}
                  showActions
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-muted text-sm">
                Page <span className="text-white">{page}</span> of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
