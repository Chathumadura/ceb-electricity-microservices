const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const Meter = require("../models/Meter");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

/**
 * @swagger
 * /api/meters:
 *   post:
 *     summary: Register a new meter
 *     tags: [Meters]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meterId, customerId, location]
 *             properties:
 *               meterId:
 *                 type: string
 *                 example: MTR-001
 *               customerId:
 *                 type: string
 *                 example: CUST-001
 *               meterType:
 *                 type: string
 *                 enum: [single-phase, three-phase, industrial]
 *                 example: single-phase
 *               location:
 *                 type: object
 *                 required: [address, city]
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: 123 Main Street
 *                   city:
 *                     type: string
 *                     example: Colombo
 *                   district:
 *                     type: string
 *                     example: Western
 *               installedDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-15T00:00:00.000Z
 *     responses:
 *       201:
 *         description: Meter registered successfully
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
 *                   example: Meter registered successfully
 *                 data:
 *                   $ref: '#/components/schemas/Meter'
 *       409:
 *         description: Meter already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Validation error
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
    body("location.address").notEmpty().withMessage("Address is required"),
    body("location.city").notEmpty().withMessage("City is required"),
    body("meterType")
      .optional()
      .isIn(["single-phase", "three-phase", "industrial"])
      .withMessage("Invalid meter type"),
  ],
  validate,
  async (req, res) => {
    try {
      const { meterId, customerId, meterType, location, installedDate } = req.body;

      const existing = await Meter.findOne({ meterId });
      if (existing)
        return res.status(409).json({ success: false, message: `Meter '${meterId}' already exists` });

      const meter = new Meter({ meterId, customerId, meterType, location, installedDate });
      await meter.save();

      res.status(201).json({ success: true, message: "Meter registered successfully", data: meter });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * @swagger
 * /api/meters:
 *   get:
 *     summary: Get all meters
 *     tags: [Meters]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, faulty, replaced]
 *         description: Filter by meter status
 *       - in: query
 *         name: meterType
 *         schema:
 *           type: string
 *           enum: [single-phase, three-phase, industrial]
 *         description: Filter by meter type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of meters
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
 *                   example: 5
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 pages:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meter'
 */
router.get("/", async (req, res) => {
  try {
    const { status, meterType, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (meterType) filter.meterType = meterType;

    const meters = await Meter.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Meter.countDocuments(filter);

    res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/meters/customer/{customerId}:
 *   get:
 *     summary: Get all meters for a customer
 *     tags: [Meters]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         example: CUST-001
 *     responses:
 *       200:
 *         description: List of meters for the customer
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
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meter'
 */
router.get("/customer/:customerId", async (req, res) => {
  try {
    const meters = await Meter.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: meters.length, data: meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/meters/{meterId}:
 *   get:
 *     summary: Get a meter by meter ID
 *     tags: [Meters]
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     responses:
 *       200:
 *         description: Meter details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Meter'
 *       404:
 *         description: Meter not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:meterId", async (req, res) => {
  try {
    const meter = await Meter.findOne({ meterId: req.params.meterId });
    if (!meter)
      return res.status(404).json({ success: false, message: `Meter '${req.params.meterId}' not found` });

    res.status(200).json({ success: true, data: meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/meters/{meterId}:
 *   put:
 *     summary: Update meter details
 *     tags: [Meters]
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, faulty, replaced]
 *                 example: inactive
 *               meterType:
 *                 type: string
 *                 enum: [single-phase, three-phase, industrial]
 *                 example: three-phase
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: 456 New Street
 *                   city:
 *                     type: string
 *                     example: Kandy
 *                   district:
 *                     type: string
 *                     example: Central
 *     responses:
 *       200:
 *         description: Meter updated successfully
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
 *                   example: Meter updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Meter'
 *       404:
 *         description: Meter not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  "/:meterId",
  [
    param("meterId").notEmpty(),
    body("status")
      .optional()
      .isIn(["active", "inactive", "faulty", "replaced"])
      .withMessage("Invalid status"),
  ],
  validate,
  async (req, res) => {
    try {
      const allowedUpdates = ["status", "meterType", "location", "lastReadingDate", "lastReadingValue", "totalUnitsConsumed"];
      const updates = {};
      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const meter = await Meter.findOneAndUpdate({ meterId: req.params.meterId }, updates, { new: true, runValidators: true });
      if (!meter)
        return res.status(404).json({ success: false, message: `Meter '${req.params.meterId}' not found` });

      res.status(200).json({ success: true, message: "Meter updated successfully", data: meter });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * @swagger
 * /api/meters/{meterId}:
 *   delete:
 *     summary: Delete a meter
 *     tags: [Meters]
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     responses:
 *       200:
 *         description: Meter deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Meter not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:meterId", async (req, res) => {
  try {
    const meter = await Meter.findOneAndDelete({ meterId: req.params.meterId });
    if (!meter)
      return res.status(404).json({ success: false, message: `Meter '${req.params.meterId}' not found` });

    res.status(200).json({ success: true, message: "Meter deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;