const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();

const connectDB = require("./config/db");
const billRoutes = require("./routes/bill");

const app = express();
const PORT = process.env.PORT || 3003;

// ── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Swagger Setup ────────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CEB Bill Service API",
      version: "1.0.0",
      description:
        "Fetches customer details from Customer Service and meter readings " +
        "from Meter Service, then calculates and stores electricity bills.",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Direct access (native) — port 3003",
      },
      {
        url: "http://localhost:5000/bill",
        description: "Via API Gateway — port 5000",
      },
    ],
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

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/bills", billRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    service: "Bill Service",
    status: "Running",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) =>
  res.status(500).json({ message: err.message })
);

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Bill Service running on http://localhost:${PORT}`);
  console.log(`📄  Swagger UI:          http://localhost:${PORT}/api-docs`);
  console.log(`💓  Health check:        http://localhost:${PORT}/health`);
});