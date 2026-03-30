const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Meter Service API",
      version: "1.0.0",
      description: "CEB Electricity - Meter Service (Port 3002)",
    },
    servers: [
      { url: "http://localhost:3002", description: "Local Development" }
    ],
  },
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);