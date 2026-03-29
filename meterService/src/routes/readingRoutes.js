const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const MeterReading = require("../models/MeterReading");
const Meter = require("../models/Meter");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// ─────────────────────────────────────────────────────────────────
// POST /api/readings
// Called by: Field officer / Admin — submits monthly meter reading
// After this, Bill Service will call GET /api/readings/customer/:customerId
// to get unitsConsumed and generate the bill
// ─────────────────────────────────────────────────────────────────
router.post(
  "/",
  [
    body("meterId").notEmpty().withMessage("Meter ID is required"),
    body("customerId").notEmpty().withMessage("Customer ID is required"),
    body("currentReading").isFloat({ min: 0 }).withMessage("Current reading must be a positive number"),
    body("previousReading").isFloat({ min: 0 }).withMessage("Previous reading must be a positive number"),
  ],
  validate,
  async (req, res) => {
    try {
      const { meterId, customerId, currentReading, previousReading, readBy, notes, readingDate } = req.body;

      // Verify meter exists and is active
      const meter = await Meter.findOne({ meterId });
      if (!meter)
        return res.status(404).json({ success: false, message: `Meter '${meterId}' not found` });
      if (meter.status !== "active")
        return res.status(400).json({ success: false, message: `Meter '${meterId}' is not active (status: ${meter.status})` });

      if (currentReading < previousReading)
        return res.status(400).json({ success: false, message: "Current reading cannot be less than previous reading" });

      // Check duplicate for same month
      const date = readingDate ? new Date(readingDate) : new Date();
      const readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const duplicate = await MeterReading.findOne({ meterId, readingMonth });
      if (duplicate)
        return res.status(409).json({ success: false, message: `Reading for meter '${meterId}' already exists for ${readingMonth}` });

      const unitsConsumed = currentReading - previousReading;

      const reading = new MeterReading({
        meterId,
        customerId,
        previousReading,
        currentReading,
        unitsConsumed,
        readingDate: date,
        readBy: readBy || "field-officer",
        notes,
      });

      await reading.save();

      // Update meter's last reading info
      await Meter.findOneAndUpdate(
        { meterId },
        {
          lastReadingDate: date,
          lastReadingValue: currentReading,
          $inc: { totalUnitsConsumed: unitsConsumed },
        }
      );

      res.status(201).json({ success: true, message: "Meter reading submitted successfully", data: reading });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// GET /api/readings
// Called by: Admin / API Gateway
// ─────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, readingMonth, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (readingMonth) filter.readingMonth = readingMonth;

    const readings = await MeterReading.find(filter)
      .sort({ readingDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await MeterReading.countDocuments(filter);
    res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: readings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/readings/meter/:meterId/latest
// Called by: Bill Service — gets the latest reading before billing
// IMPORTANT: this route must stay ABOVE /meter/:meterId
// ─────────────────────────────────────────────────────────────────
router.get("/meter/:meterId/latest", async (req, res) => {
  try {
    const reading = await MeterReading.findOne({ meterId: req.params.meterId }).sort({ readingDate: -1 });
    if (!reading)
      return res.status(404).json({ success: false, message: `No readings found for meter '${req.params.meterId}'` });

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/readings/meter/:meterId
// Called by: Bill Service / Admin — get all readings for a meter
// ─────────────────────────────────────────────────────────────────
router.get("/meter/:meterId", async (req, res) => {
  try {
    const readings = await MeterReading.find({ meterId: req.params.meterId }).sort({ readingDate: -1 });
    res.status(200).json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/readings/customer/:customerId
// Called by: Bill Service — gets readings for a customer to calculate bill
// Key fields returned: unitsConsumed, readingMonth, status
// ─────────────────────────────────────────────────────────────────
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { readingMonth } = req.query;
    const filter = { customerId: req.params.customerId };
    if (readingMonth) filter.readingMonth = readingMonth;

    const readings = await MeterReading.find(filter).sort({ readingDate: -1 });
    res.status(200).json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/readings/:id
// Called by: Bill Service — get one reading by its MongoDB _id
// ─────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const reading = await MeterReading.findById(req.params.id);
    if (!reading)
      return res.status(404).json({ success: false, message: "Reading not found" });

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/readings/:id/status
// Called by: Bill Service — after generating a bill, it marks the
//            reading status as "billed"
// ─────────────────────────────────────────────────────────────────
router.put(
  "/:id/status",
  [
    param("id").notEmpty(),
    body("status").isIn(["pending", "billed", "disputed"]).withMessage("Invalid status value"),
  ],
  validate,
  async (req, res) => {
    try {
      const reading = await MeterReading.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true, runValidators: true }
      );
      if (!reading)
        return res.status(404).json({ success: false, message: "Reading not found" });

      res.status(200).json({ success: true, message: `Reading status updated to '${req.body.status}'`, data: reading });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// DELETE /api/readings/:id
router.delete("/:id", async (req, res) => {
  try {
    const reading = await MeterReading.findByIdAndDelete(req.params.id);
    if (!reading)
      return res.status(404).json({ success: false, message: "Reading not found" });

    res.status(200).json({ success: true, message: "Reading deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;