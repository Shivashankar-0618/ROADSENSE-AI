const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const { initFirebase } = require("./config/firebase");

// Routes
const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaints");
const trafficRoutes = require("./routes/traffic");
const alertRoutes = require("./routes/alerts");
const analyticsRoutes = require("./routes/analytics");
const userRoutes = require("./routes/users");
const aiTrafficRoutes = require("./routes/aiTraffic");

// Init
const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────
// Socket.IO Setup
// ─────────────────────────────────────────
const CLIENT_ORIGINS = [
  process.env.CLIENT_URL || "http://localhost:5174",
  "http://localhost:5173",
  "http://localhost:5174",
];

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Attach io to app so routes can access it
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on("join_region", (region) => {
    socket.join(region);
    console.log(`[Socket.IO] ${socket.id} joined region: ${region}`);
  });
  socket.on("join_belagavi", () => {
   socket.join("belagavi_traffic");
    console.log(`[Socket.IO] ${socket.id} joined belagavi_traffic`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────
app.use(helmet());
app.use(morgan("dev"));
app.use(
  cors({
    origin: CLIENT_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:20000,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api/", limiter);

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ai-traffic", aiTrafficRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "RoadSense AI Server is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Error]", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  initFirebase();

  server.listen(PORT, () => {
    console.log(`\n🚀 RoadSense AI Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}\n`);
  });
};

startServer();

module.exports = { app, io };

