// ─────────────────────────────────────────────────────────────
//  server.js  —  Express + MongoDB Atlas entry point
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// ── Route imports ───────────────────────────────────────────
import hospitalRoutes from "./routes/hospital.js";
import aiRoutes from "./routes/ai.js";
import uploadRoutes from "./routes/upload.js";
import authRoutes from "./routes/auth.js";

// ── Config ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not defined in .env");
  process.exit(1);
}

// ── Express App ─────────────────────────────────────────────
const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "medicore-eg7u87sqw-yugp6488-4479s-projects.vercel.app",
    /https:\/\/medicore-.*\.vercel\.app$/,
  ],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health-check route ──────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Mount routes ────────────────────────────────────────────
app.use("/api/hospital", hospitalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", aiRoutes);
app.use("/api", uploadRoutes);

// ── MongoDB Connection & Server Start ──────────────────────
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅  Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`🚀  Server running on http://localhost:${PORT}`);
      console.log("📋  Routes:");
      console.log("   GET  /api/health");
      console.log("   GET  /api/hospital/departments");
      console.log("   POST /api/hospital/patients");
      console.log("   GET  /api/hospital/patients/:id");
      console.log("   PATCH /api/hospital/patients/:id");
      console.log("   GET  /api/hospital/patients/:id/queue");
      console.log("   GET  /api/hospital/doctor-dashboard");
      console.log("   PATCH /api/hospital/doctors/:id");
      console.log("   GET  /api/hospital/visit-history");
      console.log("   POST /api/hospital/visit-history");
      console.log("   GET  /api/hospital/patient-history");
      console.log("   GET  /api/hospital/admin/daily-records");
      console.log("   GET  /api/hospital/admin/doctor-availability");
      console.log("   GET  /api/hospital/admin/db-logs");
      console.log("   POST /api/triage-analysis");
      console.log("   POST /api/analyze-report");
      console.log("   POST /api/upload");
    });
  } catch (err) {
    console.error("❌  MongoDB connection error:", err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.disconnect();
  console.log("\n🛑  MongoDB disconnected — server shutting down");
  process.exit(0);
});

start();
