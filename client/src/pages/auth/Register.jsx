import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return toast.error("Passwords do not match.");
    }
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      toast.success("Account created! Welcome aboard.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-dark grid-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 mb-3">
            <span className="text-xl">🛣️</span>
            <h1 className="font-display text-xl text-white tracking-wider">
              Road<span className="text-primary">Sense</span> AI
            </h1>
          </Link>
          <p className="text-muted text-sm">Create your citizen account</p>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Get Started</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { name: "name",    label: "Full Name",       type: "text",     placeholder: "John Doe" },
              { name: "email",   label: "Email Address",   type: "email",    placeholder: "you@example.com" },
              { name: "phone",   label: "Phone (Optional)", type: "tel",     placeholder: "+91 98765 43210" },
              { name: "password",label: "Password",        type: "password", placeholder: "Min 6 characters" },
              { name: "confirm", label: "Confirm Password",type: "password", placeholder: "Repeat password" },
            ].map((field) => (
              <div key={field.name}>
                <label className="text-xs text-muted block mb-1.5 uppercase tracking-wider">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={form[field.name]}
                  onChange={onChange}
                  className="input-field"
                  placeholder={field.placeholder}
                  required={field.name !== "phone"}
                />
              </div>
            ))}

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />Creating...</>
              ) : "Create Account →"}
            </motion.button>
          </form>

          <p className="text-center text-muted text-sm mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
