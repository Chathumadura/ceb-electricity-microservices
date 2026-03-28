const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const validate = require("../middleware/validate");
const readingController = require("../controllers/readingController");

// @route   POST /api/readings
// @desc    Submit a new meter reading
router.post(
  "/",
  [
    body("meterId").notEmpty().withMessage("Meter ID is required"),
    body("customerId").notEmpty().withMessage("Customer ID is required"),
    body("currentReading")
      .isNumeric()
      .withMessage("Current reading must be a number")
      .isFloat({ min: 0 })
      .withMessage("Reading cannot be negative"),
    body("previousReading")
      .isNumeric()
      .withMessage("Previous reading must be a number")
      .isFloat({ min: 0 })
      .withMessage("Reading cannot be negative"),
  ],
  validate,
  readingController.submitReading
);

// @route   GET /api/readings
// @desc    Get all readings (with optional filters)
router.get("/", readingController.getAllReadings);

// @route   GET /api/readings/:id
// @desc    Get a single reading by ID
router.get("/:id", readingController.getReadingById);

// @route   GET /api/readings/meter/:meterId
// @desc    Get all readings for a specific meter
router.get("/meter/:meterId", readingController.getReadingsByMeter);

// @route   GET /api/readings/customer/:customerId
// @desc    Get all readings for a specific customer
router.get("/customer/:customerId", readingController.getReadingsByCustomer);

// @route   GET /api/readings/meter/:meterId/latest
// @desc    Get the latest reading for a meter
router.get("/meter/:meterId/latest", readingController.getLatestReading);

// @route   PUT /api/readings/:id/status
// @desc    Update reading status (pending -> billed / disputed)
router.put(
  "/:id/status",
  [
    param("id").notEmpty(),
    body("status")
      .isIn(["pending", "billed", "disputed"])
      .withMessage("Invalid status value"),
  ],
  validate,
  readingController.updateReadingStatus
);

// @route   DELETE /api/readings/:id
// @desc    Delete a reading record
router.delete("/:id", readingController.deleteReading);

module.exports = router;