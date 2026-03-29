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
 *                 example: Monthly reading - January
 *               readingDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-01-31T10:00:00.000Z
 *     responses:
 *       201:
 *         description: Reading submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Meter reading submitted successfully
 *                 data:
 *                   $ref: '#/components/schemas/MeterReading'
 *       400:
 *         description: Validation error or meter not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Meter not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Reading already exists for this month
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
        meterId, customerId, previousReading, currentReading, unitsConsumed,
        readingDate: date, readBy: readBy || "field-officer", notes,
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

/**
 * @swagger
 * /api/readings:
 *   get:
 *     summary: Get all readings
 *     tags: [Readings]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, billed, disputed]
 *         description: Filter by reading status
 *       - in: query
 *         name: readingMonth
 *         schema:
 *           type: string
 *           example: 2025-01
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
 *         description: List of readings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 10
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 pages:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MeterReading'
 */
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

/**
 * @swagger
 * /api/readings/meter/{meterId}/latest:
 *   get:
 *     summary: Get the latest reading for a meter
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
 *         description: Latest meter reading
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MeterReading'
 *       404:
 *         description: No readings found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
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
 *         description: List of readings for the meter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MeterReading'
 */
router.get("/meter/:meterId", async (req, res) => {
  try {
    const readings = await MeterReading.find({ meterId: req.params.meterId }).sort({ readingDate: -1 });
    res.status(200).json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/readings/customer/{customerId}:
 *   get:
 *     summary: Get all readings for a customer
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
 *           example: 2025-01
 *         description: Filter by month (YYYY-MM)
 *     responses:
 *       200:
 *         description: List of readings for the customer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MeterReading'
 */
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

/**
 * @swagger
 * /api/readings/{id}:
 *   get:
 *     summary: Get a reading by ID
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc1234567890abcdef123
 *     responses:
 *       200:
 *         description: Reading details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MeterReading'
 *       404:
 *         description: Reading not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/readings/{id}/status:
 *   put:
 *     summary: Update reading status
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc1234567890abcdef123
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Reading status updated to 'billed'
 *                 data:
 *                   $ref: '#/components/schemas/MeterReading'
 *       404:
 *         description: Reading not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/readings/{id}:
 *   delete:
 *     summary: Delete a reading
 *     tags: [Readings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64abc1234567890abcdef123
 *     responses:
 *       200:
 *         description: Reading deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Reading not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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