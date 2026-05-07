import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore";

const NAV_BY_ROLE = {
  user: [
    { to: "/dashboard", icon: "🏠", label: "Dashboard" },
    { to: "/map",       icon: "🗺️", label: "Live Map" },
    { to: "/report",    icon: "📸", label: "Report Pothole" },
    { to: "/route",     icon: "🧭", label: "Smart Route" },
  ],
  gram_admin: [
    { to: "/gram-admin", icon: "🏛️", label: "Complaints" },
    { to: "/map",        icon: "🗺️", label: "Live Map" },
  ],
  traffic_admin: [
    { to: "/traffic-admin", icon: "🚦", label: "Traffic Control" },
    { to: "/map",           icon: "🗺️", label: "Live Map" },
  ],
  super_admin: [
    { to: "/super-admin",   icon: "⚡", label: "Overview" },
    { to: "/gram-admin",    icon: "🏛️", label: "Complaints" },
    { to: "/traffic-admin", icon: "🚦", label: "Traffic" },
    { to: "/map",           icon: "🗺️", label: "Live Map" },
  ],
};

export default function Sidebar({ collapsed = false }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const nav = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.user;

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully.");
    navigate("/login");
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`h-screen flex flex-col glass border-r border-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 bg-primary/20 border border-primary/40 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
          🛣️
        </div>
        {!collapsed && (
          <span className="font-display text-sm text-white tracking-wider">
            Road<span className="text-primary">Sense</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <span className="text-base flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="text-sm">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-border">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-muted truncate">{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-danger hover:text-danger hover:bg-danger/10"
        >
          <span className="text-base flex-shrink-0">🚪</span>
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
