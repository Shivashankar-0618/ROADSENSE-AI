import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore";

const ROLES = [
  { id: "user",          label: "Citizen",           icon: "👤", desc: "Report & track road issues" },
  { id: "gram_admin",    label: "Gram Panchayat",    icon: "🏛️", desc: "Manage local complaints" },
  { id: "traffic_admin", label: "Traffic Control",   icon: "🚦", desc: "Monitor live traffic" },
  { id: "super_admin",   label: "Super Admin",       icon: "⚡", desc: "Full platform control" },
];

const DASHBOARD_MAP = {
  user:          "/dashboard",
  gram_admin:    "/gram-admin",
  traffic_admin: "/traffic-admin",
  super_admin:   "/super-admin",
};

export default function Login() {
  const [selectedRole, setSelectedRole] = useState("user");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(DASHBOARD_MAP[user.role] || "/dashboard");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-dark grid-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-danger/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/20 border border-primary/40 rounded-xl flex items-center justify-center text-xl">
              🛣️
            </div>
            <h1 className="font-display text-2xl text-white tracking-wider">
              Road<span className="text-primary">Sense</span> AI
            </h1>
          </div>
          <p className="text-muted text-sm">Smart City Road Management Platform</p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {ROLES.map((role) => (
            <motion.button
              key={role.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedRole(role.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                selectedRole === role.id
                  ? "bg-primary/10 border-primary/50 shadow-glow"
                  : "bg-surface border-border hover:border-primary/30"
              }`}
            >
              <div className="text-lg mb-1">{role.icon}</div>
              <div className={`text-xs font-semibold ${selectedRole === role.id ? "text-primary" : "text-white"}`}>
                {role.label}
              </div>
              <div className="text-xs text-muted mt-0.5 leading-tight">{role.desc}</div>
            </motion.button>
          ))}
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Sign In</h2>
          <p className="text-muted text-sm mb-6">
            Logging in as <span className="text-primary">{ROLES.find(r => r.id === selectedRole)?.label}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In →"
              )}
            </motion.button>
          </form>

          <p className="text-center text-muted text-sm mt-6">
            New user?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Create account
            </Link>
          </p>
        </div>

        <p className="text-center text-muted text-xs mt-6">
          © 2025 RoadSense AI · Smart City Infrastructure
        </p>
      </motion.div>
    </div>
  );
}
