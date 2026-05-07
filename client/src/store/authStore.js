import { create } from "zustand";
import api from "../lib/api";
import { requestNotificationPermission } from "../config/firebase";

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("rs_user")) || null,
  token: localStorage.getItem("rs_token") || null,
  loading: false,
  error: null,

  // ─────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("rs_token", data.token);
      localStorage.setItem("rs_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });

      // Register for push notifications
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        await api.patch("/auth/update-fcm-token", { fcmToken });
      }

      return data.user;
    } catch (err) {
      const msg = err.message || "Login failed.";
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  // ─────────────────────────────────────────
  // Register
  // ─────────────────────────────────────────
  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("rs_token", data.token);
      localStorage.setItem("rs_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return data.user;
    } catch (err) {
      const msg = err.message || "Registration failed.";
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  // ─────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────
  logout: async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("rs_token");
    localStorage.removeItem("rs_user");
    set({ user: null, token: null });
  },

  // ─────────────────────────────────────────
  // Fetch current user
  // ─────────────────────────────────────────
  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("rs_user", JSON.stringify(data.user));
      set({ user: data.user });
    } catch {
      get().logout();
    }
  },

  // ─────────────────────────────────────────
  // OTP
  // ─────────────────────────────────────────
  sendOTP: async () => {
    await api.post("/auth/send-otp");
  },

  verifyOTP: async (otp) => {
    const { data } = await api.post("/auth/verify-otp", { otp });
    if (data.success) {
      const updated = { ...get().user, isVerified: true };
      localStorage.setItem("rs_user", JSON.stringify(updated));
      set({ user: updated });
    }
    return data;
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
