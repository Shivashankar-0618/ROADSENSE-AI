import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Reset link sent if account exists.");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 mb-3">
            <span className="text-xl">🛣️</span>
            <h1 className="font-display text-xl text-white tracking-wider">
              Road<span className="text-primary">Sense</span> AI
            </h1>
          </Link>
        </div>

        <div className="glass rounded-2xl p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-lg font-semibold text-white mb-2">Check Your Email</h2>
              <p className="text-muted text-sm mb-6">
                If an account with <span className="text-primary">{email}</span> exists, a password reset link has been sent.
              </p>
              <Link to="/login" className="btn-primary inline-block">Back to Login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Reset Password</h2>
              <p className="text-muted text-sm mb-6">Enter your email to receive a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />Sending...</>
                    : "Send Reset Link"
                  }
                </button>

                <Link to="/login" className="block text-center text-muted text-sm hover:text-white transition-colors mt-2">
                  ← Back to Login
                </Link>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
