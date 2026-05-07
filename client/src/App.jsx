import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import useAuthStore from "./store/authStore";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

// User Pages
import UserDashboard from "./pages/user/Dashboard";
import ReportPothole from "./pages/user/ReportPothole";
import LiveMap from "./pages/user/LiveMap";
import SmartRoute from "./pages/user/SmartRoute";

// Gram Admin
import GramDashboard from "./pages/gramAdmin/GramDashboard";

// Traffic Admin
import TrafficDashboard from "./pages/trafficAdmin/TrafficDashboard";

// Super Admin
import SuperDashboard from "./pages/superAdmin/SuperDashboard";

// ─────────────────────────────────────────
// Route Guards
// ─────────────────────────────────────────

const PrivateRoute = () => {
  const { user } = useAuthStore();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const RoleRoute = ({ allowedRoles }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
};

const PublicOnlyRoute = () => {
  const { user } = useAuthStore();
  return !user ? <Outlet /> : <Navigate to={getDashboardPath(user.role)} replace />;
};

const getDashboardPath = (role) => {
  switch (role) {
    case "super_admin":    return "/super-admin";
    case "gram_admin":     return "/gram-admin";
    case "traffic_admin":  return "/traffic-admin";
    default:               return "/dashboard";
  }
};

// ─────────────────────────────────────────
// App
// ─────────────────────────────────────────

export default function App() {
  const { user, fetchMe } = useAuthStore();

  useEffect(() => {
    if (user) fetchMe();

    // Listen for forced logout (401 from axios interceptor)
    const handleLogout = () => useAuthStore.getState().logout();
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1a28",
            color: "#e0e0f0",
            border: "1px solid #2a2a40",
            borderRadius: "12px",
            fontFamily: "'Exo 2', sans-serif",
          },
          success: { iconTheme: { primary: "#30d158", secondary: "#1a1a28" } },
          error:   { iconTheme: { primary: "#ff2d55", secondary: "#1a1a28" } },
        }}
      />

      <Routes>
        {/* Root redirect */}
        <Route
          path="/"
          element={
            user ? <Navigate to={getDashboardPath(user.role)} replace /> : <Navigate to="/login" replace />
          }
        />

        {/* Public-only routes */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* User routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard"   element={<UserDashboard />} />
          <Route path="/report"      element={<ReportPothole />} />
          <Route path="/map"         element={<LiveMap />} />
          <Route path="/route"       element={<SmartRoute />} />
        </Route>

        {/* Gram Admin routes */}
        <Route element={<RoleRoute allowedRoles={["gram_admin", "super_admin"]} />}>
          <Route path="/gram-admin" element={<GramDashboard />} />
        </Route>

        {/* Traffic Admin routes */}
        <Route element={<RoleRoute allowedRoles={["traffic_admin", "super_admin"]} />}>
          <Route path="/traffic-admin" element={<TrafficDashboard />} />
        </Route>

        {/* Super Admin routes */}
        <Route element={<RoleRoute allowedRoles={["super_admin"]} />}>
          <Route path="/super-admin" element={<SuperDashboard />} />
        </Route>

        {/* Fallback */}
        <Route
          path="/unauthorized"
          element={
            <div className="min-h-screen flex items-center justify-center bg-dark text-white">
              <div className="text-center">
                <h1 className="font-display text-4xl text-danger mb-4">403</h1>
                <p className="text-muted">You don't have permission to access this page.</p>
                <button onClick={() => window.history.back()} className="btn-ghost mt-6">Go Back</button>
              </div>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-dark text-white">
              <div className="text-center">
                <h1 className="font-display text-4xl text-primary mb-4">404</h1>
                <p className="text-muted">Page not found.</p>
                <button onClick={() => window.history.back()} className="btn-ghost mt-6">Go Back</button>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
