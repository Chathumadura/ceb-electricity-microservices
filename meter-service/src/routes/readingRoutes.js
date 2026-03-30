const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const MeterReading = require("../models/MeterReading");
const Meter = require("../models/Meter");
const { protect } = require("../middleware/auth"); // ← import protect

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
 *     security:
 *       - bearerAuth: []
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
 *                 example: 350
 *               readBy:
 *                 type: string
 *                 example: field-officer
 *               notes:
 *                 type: string
 *                 example: March 2025 reading
 *               readingDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-15"
 *     responses:
 *       201:
 *         description: Reading submitted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Meter not found
 *       409:
 *         description: Reading already exists for this month
 *
 *   get:
 *     summary: Get all readings
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, billed, disputed]
 *       - in: query
 *         name: readingMonth
 *         schema:
 *           type: string
 *           example: "2025-03"
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
 *         description: List of readings
 *       401:
 *         description: Not authorized
 *
 * /api/readings/meter/{meterId}/latest:
 *   get:
 *     summary: Get latest reading for a meter
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     responses:
 *       200:
 *         description: Latest reading
 *       401:
 *         description: Not authorized
 *       404:
 *         description: No readings found
 *
 * /api/readings/meter/{meterId}:
 *   get:
 *     summary: Get all readings for a meter
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Not authorized
 *
 * /api/readings/customer/{customerId}:
 *   get:
 *     summary: Get readings by customer ID
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Readings found
 *       401:
 *         description: Not authorized
 *
 * /api/readings/{id}:
 *   get:
 *     summary: Get reading by ID
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Reading not found
 *
 *   delete:
 *     summary: Delete a reading
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Reading not found
 *
 * /api/readings/{id}/status:
 *   put:
 *     summary: Update reading status (called by Bill Service)
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
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
 *         description: Status updated
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Reading not found
 */

// POST /api/readings — protected
router.post(
  "/",
  protect,
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

      const meter = await Meter.findOne({ meterId });
      if (!meter)
        return res.status(404).json({ success: false, message: `Meter '${meterId}' not found` });
      if (meter.status !== "active")
        return res.status(400).json({ success: false, message: `Meter '${meterId}' is not active (status: ${meter.status})` });

      if (currentReading < previousReading)
        return res.status(400).json({ success: false, message: "Current reading cannot be less than previous reading" });

      const date = readingDate ? new Date(readingDate) : new Date();
      const readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const duplicate = await MeterReading.findOne({ meterId, readingMonth });
      if (duplicate)
        return res.status(409).json({ success: false, message: `Reading for meter '${meterId}' already exists for ${readingMonth}` });

      const unitsConsumed = currentReading - previousReading;

      const reading = new MeterReading({
        meterId, customerId, previousReading,
        currentReading, unitsConsumed,
        readingDate: date,
        readBy: readBy || "field-officer",
        notes,
      });

      await reading.save();

      await Meter.findOneAndUpdate(
        { meterId },
        { lastReadingDate: date, lastReadingValue: currentReading, $inc: { totalUnitsConsumed: unitsConsumed } }
      );

      res.status(201).json({ success: true, message: "Meter reading submitted successfully", data: reading });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/readings — protected
router.get("/", protect, async (req, res) => {
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

// GET /api/readings/meter/:meterId/latest — protected
// IMPORTANT: must stay ABOVE /meter/:meterId and /:id
router.get("/meter/:meterId/latest", protect, async (req, res) => {
  try {
    const reading = await MeterReading.findOne({ meterId: req.params.meterId }).sort({ readingDate: -1 });
    if (!reading)
      return res.status(404).json({ success: false, message: `No readings found for meter '${req.params.meterId}'` });

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/readings/meter/:meterId — protected
router.get("/meter/:meterId", protect, async (req, res) => {
  try {
    const readings = await MeterReading.find({ meterId: req.params.meterId }).sort({ readingDate: -1 });
    res.status(200).json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/readings/customer/:customerId — protected
router.get("/customer/:customerId", protect, async (req, res) => {
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

// GET /api/readings/:id — protected
router.get("/:id", protect, async (req, res) => {
  try {
    const reading = await MeterReading.findById(req.params.id);
    if (!reading)
      return res.status(404).json({ success: false, message: "Reading not found" });

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/readings/:id/status — protected
router.put(
  "/:id/status",
  protect,
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

// DELETE /api/readings/:id — protected
router.delete("/:id", protect, async (req, res) => {
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