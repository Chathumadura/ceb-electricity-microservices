const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const connectDB = require("./src/config/db");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ─── Meter Service Routes (YOUR PART) ───────────────────────────
app.use("/api/meters", require("./src/routes/meterRoutes"));
app.use("/api/readings", require("./src/routes/readingRoutes"));

// Health Check — other services call this to verify Meter Service is alive
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Meter Service",
    port: process.env.PORT || 3002,
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Meter Service running on port ${PORT}`);
});