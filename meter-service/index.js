const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const connectDB = require("./src/config/db");

dotenv.config();

const app = express();

// ─── Connect to MongoDB ───────────────────────────────────────────
connectDB();

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ─── Swagger Config ───────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Meter Service API",
      version: "1.0.0",
      description: "CEB Electricity System — Meter Service (Port 3002). Handles meter readings and unit tracking.",
    },
    servers: [
      {
        url: "http://localhost:3002",
        description: "Local Development Server",
      },
    ],
    // ── This adds the Authorize button in Swagger UI ───────────────
    // Paste your JWT token there to test protected routes
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Meter Service Routes ─────────────────────────────────────────
app.use("/api/meters", require("./src/routes/meterRoutes"));
app.use("/api/readings", require("./src/routes/readingRoutes"));

// ─── Health Check ─────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Meter Service",
    port: process.env.PORT || 3002,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Meter Service running on port ${PORT}`);
  console.log(`📋 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
});