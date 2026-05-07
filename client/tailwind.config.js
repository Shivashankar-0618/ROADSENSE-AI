/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: "#00d4ff",       // Electric Blue
        danger:  "#ff2d55",       // Neon Red
        warning: "#ffd60a",       // Neon Yellow
        success: "#30d158",       // Neon Green
        // Backgrounds
        dark:    "#0a0a0f",
        surface: "#12121a",
        card:    "#1a1a28",
        border:  "#2a2a40",
        // Text
        muted:   "#6b6b8a",
      },
      fontFamily: {
        sans: ["'Exo 2'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Orbitron'", "sans-serif"],
      },
      boxShadow: {
        glow:        "0 0 20px rgba(0, 212, 255, 0.3)",
        "glow-red":  "0 0 20px rgba(255, 45, 85, 0.3)",
        "glow-green":"0 0 20px rgba(48, 209, 88, 0.3)",
        "glow-yellow":"0 0 20px rgba(255, 214, 10, 0.3)",
        glass:       "0 8px 32px rgba(0, 0, 0, 0.4)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px)",
      },
      animation: {
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow":    "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "scan":         "scan 2s linear infinite",
        "slide-in":     "slideIn 0.3s ease-out",
        "fade-up":      "fadeUp 0.5s ease-out",
        "glow-pulse":   "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%":   { transform: "translateY(0%)" },
          "100%": { transform: "translateY(100%)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(100%)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(0,212,255,0.3)" },
          "50%":      { boxShadow: "0 0 30px rgba(0,212,255,0.7)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
