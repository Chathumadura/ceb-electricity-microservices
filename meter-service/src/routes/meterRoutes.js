const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Meter = require("../models/Meter");
const Reading = require("../models/Reading");
const protect = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   - name: Meters
 *     description: CEB Meter Management
 *   - name: Readings
 *     description: Meter Reading Management
 */

// ── METERS ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/meters:
 *   get:
 *     summary: Get all meters
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all meters
 */
router.get("/", protect(), async (req, res, next) => {
  try {
    const meters = await Meter.find().sort({ createdAt: -1 });
    res.json({ success: true, count: meters.length, data: meters });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/customer/{customerId}:
 *   get:
 *     summary: Get meter by customer ID
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meter found
 */
router.get("/customer/:customerId", protect(), async (req, res, next) => {
  try {
    const meter = await Meter.findOne({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    if (!meter) return res.status(404).json({ success: false, message: "No meter found" });
    res.json({ success: true, data: meter });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/{id}:
 *   get:
 *     summary: Get meter by ID
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meter found
 */
router.get("/:id", protect(), async (req, res, next) => {
  try {
    const meter = await Meter.findById(req.params.id);
    if (!meter) return res.status(404).json({ success: false, message: "Meter not found" });
    res.json({ success: true, data: meter });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters:
 *   post:
 *     summary: Register a new meter (auto-associates with logged-in customer)
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meterNumber, location]
 *             properties:
 *               meterNumber: { type: string, example: "MT-10234" }
 *               location:    { type: string, example: "Colombo 03" }
 *               meterType:   { type: string, example: "Single Phase" }
 *     responses:
 *       201:
 *         description: Meter registered
 */
router.post("/", protect(), async (req, res, next) => {
  try {
    const { meterNumber, location, meterType } = req.body;
    const customerId = req.customer.customerId;

    if (!meterNumber || !location) {
      return res.status(400).json({ success: false, message: "meterNumber and location are required" });
    }

    const meter = new Meter({ customerId, meterNumber, location, meterType });
    const savedMeter = await meter.save();

    // Ensure a new meter always has an initial baseline reading.
    const initialReading = new Reading({
      meterId: savedMeter._id,
      customerId,
      previousReading: 0,
      currentReading: 0,
      readingMonth: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
      recordedBy: "System",
    });
    await initialReading.save();

    res.status(201).json({ success: true, data: savedMeter, initialReading });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/{id}:
 *   put:
 *     summary: Update meter details
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meterNumber: { type: string, example: "MT-10234" }
 *               location:    { type: string, example: "Colombo 03" }
 *               meterType:   { type: string, example: "Three Phase" }
 *               status:      { type: string, example: "active" }
 *     responses:
 *       200:
 *         description: Meter updated
 */
router.put("/:id", protect(), async (req, res, next) => {
  try {
    const { meterNumber, location, meterType, status } = req.body;
    const updateData = {};

    if (meterNumber !== undefined) updateData.meterNumber = meterNumber;
    if (location !== undefined) updateData.location = location;
    if (meterType !== undefined) updateData.meterType = meterType;
    if (status !== undefined) updateData.status = status;

    const meter = await Meter.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!meter) return res.status(404).json({ success: false, message: "Meter not found" });
    res.json({ success: true, data: meter });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/{id}:
 *   delete:
 *     summary: Delete meter
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meter deleted
 */
router.delete("/:id", protect(), async (req, res, next) => {
  try {
    const meter = await Meter.findByIdAndDelete(req.params.id);
    if (!meter) return res.status(404).json({ success: false, message: "Meter not found" });
    res.json({ success: true, message: "Meter deleted" });
  } catch (err) { next(err); }
});

// ── READINGS ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/meters/readings/all:
 *   get:
 *     summary: Get all readings
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All readings
 */
router.get("/readings/all", protect(), async (req, res, next) => {
  try {
    const readings = await Reading.find().populate("meterId").sort({ createdAt: -1 });
    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/readings/{meterId}:
 *   get:
 *     summary: Get readings by meter ID
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Readings found
 */
router.get("/readings/:meterId", protect(), async (req, res, next) => {
  try {
    const readings = await Reading.find({ meterId: req.params.meterId }).sort({ createdAt: 1 });
    if (!readings.length) return res.status(404).json({ success: false, message: "No readings found" });
    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/readings:
 *   post:
 *     summary: Add a new meter reading
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meterId, currentReading, readingMonth, recordedBy]
 *             properties:
 *               meterId:         { type: string }
 *               currentReading:  { type: number, example: 1350 }
 *               readingMonth:    { type: string, example: "March 2026" }
 *               recordedBy:      { type: string, example: "Inspector-01" }
 *     responses:
 *       201:
 *         description: Reading added
 */
router.post("/readings", protect(), async (req, res, next) => {
  try {
    const { meterId, currentReading, readingMonth, recordedBy } = req.body;

    if (!meterId || currentReading === undefined || !readingMonth || !recordedBy) {
      return res.status(400).json({
        success: false,
        message: "meterId, currentReading, readingMonth, and recordedBy are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(meterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meterId format. Use a valid meter _id from /api/meters or /api/meters/customer/{customerId}",
      });
    }

    const meter = await Meter.findById(meterId);
    if (!meter) {
      return res.status(404).json({ success: false, message: "Meter not found" });
    }

    const previousReading = Number(meter.lastReadingValue || 0);
    const reading = new Reading({
      meterId,
      customerId: meter.customerId,
      previousReading,
      currentReading,
      readingMonth,
      recordedBy,
    });

    await reading.save();

    meter.lastReadingValue = Number(currentReading);
    meter.lastReadingDate = new Date();
    await meter.save();

    res.status(201).json({ success: true, data: reading });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/readings/{id}:
 *   put:
 *     summary: Update an existing reading
 *     tags: [Readings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentReading: { type: number, example: 1400 }
 *               readingMonth:   { type: string, example: "April 2026" }
 *               recordedBy:     { type: string, example: "Inspector-02" }
 *     responses:
 *       200:
 *         description: Reading updated
 */
router.put("/readings/:id", protect(), async (req, res, next) => {
  try {
    const reading = await Reading.findById(req.params.id);
    if (!reading) return res.status(404).json({ success: false, message: "Reading not found" });

    const { currentReading, readingMonth, recordedBy } = req.body;

    if (currentReading !== undefined) reading.currentReading = Number(currentReading);
    if (readingMonth !== undefined) reading.readingMonth = readingMonth;
    if (recordedBy !== undefined) reading.recordedBy = recordedBy;

    await reading.save();

    const latestReading = await Reading.findOne({ meterId: reading.meterId }).sort({ createdAt: -1 });
    await Meter.findByIdAndUpdate(reading.meterId, {
      lastReadingValue: latestReading ? Number(latestReading.currentReading) : 0,
      lastReadingDate: latestReading ? latestReading.createdAt : null,
    });

    res.json({ success: true, data: reading });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/meters/readings/{id}:
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
 *     responses:
 *       200:
 *         description: Reading deleted
 */
router.delete("/readings/:id", protect(), async (req, res, next) => {
  try {
    const reading = await Reading.findByIdAndDelete(req.params.id);
    if (!reading) return res.status(404).json({ success: false, message: "Reading not found" });

    const latestReading = await Reading.findOne({ meterId: reading.meterId }).sort({ createdAt: -1 });
    await Meter.findByIdAndUpdate(reading.meterId, {
      lastReadingValue: latestReading ? Number(latestReading.currentReading) : 0,
      lastReadingDate: latestReading ? latestReading.createdAt : null,
    });

    res.json({ success: true, message: "Reading deleted" });
  } catch (err) { next(err); }
});

module.exports = router;