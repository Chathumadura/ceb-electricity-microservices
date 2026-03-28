const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const validate = require("../middleware/validate");
const meterController = require("../controllers/meterController");

// @route   POST /api/meters
// @desc    Register a new meter
router.post(
  "/",
  [
    body("meterId").notEmpty().withMessage("Meter ID is required"),
    body("customerId").notEmpty().withMessage("Customer ID is required"),
    body("location.address").notEmpty().withMessage("Address is required"),
    body("location.city").notEmpty().withMessage("City is required"),
    body("meterType")
      .optional()
      .isIn(["single-phase", "three-phase", "industrial"])
      .withMessage("Invalid meter type"),
  ],
  validate,
  meterController.createMeter
);

// @route   GET /api/meters
// @desc    Get all meters
router.get("/", meterController.getAllMeters);

// @route   GET /api/meters/:meterId
// @desc    Get meter by meterId
router.get("/:meterId", meterController.getMeterById);

// @route   GET /api/meters/customer/:customerId
// @desc    Get all meters for a customer
router.get("/customer/:customerId", meterController.getMetersByCustomer);

// @route   PUT /api/meters/:meterId
// @desc    Update meter details
router.put(
  "/:meterId",
  [
    param("meterId").notEmpty().withMessage("Meter ID is required"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "faulty", "replaced"])
      .withMessage("Invalid status"),
  ],
  validate,
  meterController.updateMeter
);

// @route   DELETE /api/meters/:meterId
// @desc    Delete a meter
router.delete("/:meterId", meterController.deleteMeter);

module.exports = router;