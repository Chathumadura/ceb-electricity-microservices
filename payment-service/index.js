const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("node:path");
require("dotenv").config();

const connectDB = require("./src/config/db");
const paymentRoutes = require("./src/routes/paymentRoutes");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// ── Swagger ────────────────────────────────────────────────────
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Payment Service API",
            version: "1.0.0",
            description: "CEB Payment Processing Microservice - IT4020 Assignment 2",
        },
        servers: [{ url: "http://localhost:3004" }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: [path.join(__dirname, "routes", "*.js")],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health Check ───────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "payment-service", port: 3004 });
});

// ── Routes ─────────────────────────────────────────────────────
app.use("/api/payments", paymentRoutes);

// ── Error Handler ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3004;
const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 Payment Service running on port ${PORT}`);
        console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs`);
    });
};

startServer();