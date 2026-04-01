const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("node:path");
require("dotenv").config();

const connectDB = require("./config/db");
const billRoutes = require("./routes/billRoutes");

const app = express();
app.use(express.json());
app.use(cors());

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Bill Service API", version: "1.0.0", description: "CEB Bill Management - IT4020 Assignment 2" },
    servers: [{ url: "http://localhost:3003" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: [path.join(__dirname, "routes", "*.js")],
};
const billSwaggerSpec = swaggerJsdoc(swaggerOptions);
app.get("/api-docs.json", (req, res) => res.json(billSwaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(billSwaggerSpec));
app.get("/health", (req, res) => res.json({ status: "healthy", service: "bill-service", port: 3003 }));
app.use("/api/bills", billRoutes);

const PORT = process.env.PORT || 3003;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Bill Service running on port ${PORT}`);
    console.log(`📖 Swagger: http://localhost:${PORT}/api-docs`);
  });
});