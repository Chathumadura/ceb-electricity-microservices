const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Meter Service API",
      version: "1.0.0",
      description: "CEB Electricity Microservices - Meter Service (Port 3002). Handles meter readings and unit tracking.",
    },
    servers: [
      {
        url: "http://localhost:3002",
        description: "Development Server",
      },
    ],
    tags: [
      { name: "Health", description: "Service health check" },
      { name: "Meters", description: "Meter registration and management" },
      { name: "Readings", description: "Meter readings and unit tracking" },
    ],
    components: {
      schemas: {
        Meter: {
          type: "object",
          required: ["meterId", "customerId", "location"],
          properties: {
            meterId: { type: "string", example: "MTR-001" },
            customerId: { type: "string", example: "CUST-001" },
            meterType: {
              type: "string",
              enum: ["single-phase", "three-phase", "industrial"],
              example: "single-phase",
            },
            location: {
              type: "object",
              required: ["address", "city"],
              properties: {
                address: { type: "string", example: "123 Main Street" },
                city: { type: "string", example: "Colombo" },
                district: { type: "string", example: "Western" },
              },
            },
            status: {
              type: "string",
              enum: ["active", "inactive", "faulty", "replaced"],
              example: "active",
            },
            installedDate: { type: "string", format: "date-time", example: "2024-01-15T00:00:00.000Z" },
            lastReadingDate: { type: "string", format: "date-time" },
            lastReadingValue: { type: "number", example: 250 },
            totalUnitsConsumed: { type: "number", example: 150 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        MeterReading: {
          type: "object",
          required: ["meterId", "customerId", "previousReading", "currentReading"],
          properties: {
            meterId: { type: "string", example: "MTR-001" },
            customerId: { type: "string", example: "CUST-001" },
            previousReading: { type: "number", example: 100 },
            currentReading: { type: "number", example: 250 },
            unitsConsumed: { type: "number", example: 150 },
            readingDate: { type: "string", format: "date-time" },
            readingMonth: { type: "string", example: "2025-01" },
            readBy: { type: "string", example: "field-officer" },
            notes: { type: "string", example: "Monthly reading" },
            status: {
              type: "string",
              enum: ["pending", "billed", "disputed"],
              example: "pending",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message here" },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;