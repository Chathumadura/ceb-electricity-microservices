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

/**
 * @swagger
 * tags:
 *   name: Readings
 *   description: Meter reading management
 *
 * /api/readings:
 *   post:
 *     summary: Submit a new meter reading
 *     tags: [Readings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meterId, customerId, previousReading, currentReading]
 *             properties:
 *               meterId:
 *                 type: string
 *                 example: MTR-001
 *               customerId:
 *                 type: string
 *                 example: CUST-001
 *               previousReading:
 *                 type: number
 *                 example: 100
 *               currentReading:
 *                 type: number
 *                 example: 250
 *               readBy:
 *                 type: string
 *                 example: field-officer
 *               notes:
 *                 type: string
 *                 example: Monthly reading March 2025
 *               readingDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-15"
 *     responses:
 *       201:
 *         description: Reading submitted successfully
 *       400:
 *         description: Meter not active or invalid reading
 *       404:
 *         description: Meter not found
 *       409:
 *         description: Reading already exists for this month
 *
 *   get:
 *     summary: Get all readings
 *     tags: [Readings]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, billed, disputed]
 *         description: Filter by status
 *       - in: query
 *         name: readingMonth
 *         schema:
 *           type: string
 *           example: "2025-03"
 *         description: Filter by month (YYYY-MM)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: List of all readings
 *
 * /api/readings/meter/{meterId}/latest:
 *   get:
 *     summary: Get the latest reading for a meter (used by Bill Service)
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     responses:
 *       200:
 *         description: Latest reading found
 *       404:
 *         description: No readings found for this meter
 *
 * /api/readings/meter/{meterId}:
 *   get:
 *     summary: Get all readings for a meter
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     responses:
 *       200:
 *         description: Readings found
 *
 * /api/readings/customer/{customerId}:
 *   get:
 *     summary: Get readings by customer ID (used by Bill Service to generate bill)
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         example: CUST-001
 *       - in: query
 *         name: readingMonth
 *         schema:
 *           type: string
 *           example: "2025-03"
 *         description: Filter by specific month
 *     responses:
 *       200:
 *         description: Readings found for customer
 *
 * /api/readings/{id}:
 *   get:
 *     summary: Get a single reading by MongoDB ID
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc123def456789
 *     responses:
 *       200:
 *         description: Reading found
 *       404:
 *         description: Reading not found
 *
 *   delete:
 *     summary: Delete a reading
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc123def456789
 *     responses:
 *       200:
 *         description: Reading deleted
 *       404:
 *         description: Reading not found
 *
 * /api/readings/{id}/status:
 *   put:
 *     summary: Update reading status (Bill Service calls this after billing)
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc123def456789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, billed, disputed]
 *                 example: billed
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Reading not found
 */

// ─────────────────────────────────────────────────────────────────
// POST /api/readings — Submit a new meter reading
// After saving, Bill Service calls GET /api/readings/customer/:id
// to get unitsConsumed and generate bill
// ─────────────────────────────────────────────────────────────────
router.post(
  "/",
  [
    body("meterId").notEmpty().withMessage("Meter ID is required"),
    body("customerId").notEmpty().withMessage("Customer ID is required"),
    body("currentReading")
      .isFloat({ min: 0 })
      .withMessage("Current reading must be a positive number"),
    body("previousReading")
      .isFloat({ min: 0 })
      .withMessage("Previous reading must be a positive number"),
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

      // Current must be greater than previous
      if (currentReading < previousReading)
        return res.status(400).json({ success: false, message: "Current reading cannot be less than previous reading" });

      // Prevent duplicate reading for same month
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
// GET /api/readings — Get all readings
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
    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: readings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/readings/meter/:meterId/latest
// Called by: Bill Service — gets latest reading before billing
// IMPORTANT: must stay ABOVE /meter/:meterId and /:id routes
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
// GET /api/readings/meter/:meterId — All readings for a meter
// Called by: Bill Service / Admin
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
// Called by: Bill Service — gets unitsConsumed + readingMonth
//            to calculate and generate the bill
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
// GET /api/readings/:id — Get reading by MongoDB _id
// Called by: Bill Service to get one specific reading
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
// Called by: Bill Service — marks reading as "billed" after billing
//            prevents the same reading from being billed twice
// ─────────────────────────────────────────────────────────────────
router.put(
  "/:id/status",
  [
    param("id").notEmpty(),
    body("status")
      .isIn(["pending", "billed", "disputed"])
      .withMessage("Invalid status value"),
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

      res.status(200).json({
        success: true,
        message: `Reading status updated to '${req.body.status}'`,
        data: reading,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// DELETE /api/readings/:id — Delete a reading
// ─────────────────────────────────────────────────────────────────
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