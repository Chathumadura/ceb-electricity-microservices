const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("node:path");
require("dotenv").config();

const connectDB = require("./src/config/db");
const meterRoutes = require("./src/routes/meterRoutes");

const app = express();
app.use(express.json());
app.use(cors());

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Meter Service API", version: "1.0.0", description: "CEB Meter Management - IT4020 Assignment 2" },
    servers: [{ url: "http://localhost:3002" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: [path.join(__dirname, "src", "routes", "*.js")],
};
const meterSwaggerSpec = swaggerJsdoc(swaggerOptions);
app.get("/api-docs.json", (req, res) => res.json(meterSwaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(meterSwaggerSpec));
app.get("/health", (req, res) => res.json({ status: "healthy", service: "meter-service", port: 3002 }));
app.use("/api/meters", meterRoutes);

const PORT = process.env.PORT || 3002;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Meter Service running on port ${PORT}`);
    console.log(`📖 Swagger: http://localhost:${PORT}/api-docs`);
  });
});
