const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
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
 *   name: Meters
 *   description: Meter management
 *
 * /api/meters:
 *   post:
 *     summary: Register a new meter
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
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
 *     responses:
 *       201:
 *         description: Meter registered successfully
 *       401:
 *         description: Not authorized
 *       409:
 *         description: Meter already exists
 *
 *   get:
 *     summary: Get all meters
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, faulty, replaced]
 *       - in: query
 *         name: meterType
 *         schema:
 *           type: string
 *           enum: [single-phase, three-phase, industrial]
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
 *         description: List of all meters
 *       401:
 *         description: Not authorized
 *
 * /api/meters/customer/{customerId}:
 *   get:
 *     summary: Get all meters for a customer
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         example: CUST-001
 *     responses:
 *       200:
 *         description: Meters found
 *       401:
 *         description: Not authorized
 *
 * /api/meters/{meterId}:
 *   get:
 *     summary: Get meter by meter ID
 *     tags: [Meters]
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
 *         description: Meter found
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Meter not found
 *
 *   put:
 *     summary: Update meter details
 *     tags: [Meters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: meterId
 *         required: true
 *         schema:
 *           type: string
 *         example: MTR-001
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, faulty, replaced]
 *               meterType:
 *                 type: string
 *                 enum: [single-phase, three-phase, industrial]
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   district:
 *                     type: string
 *     responses:
 *       200:
 *         description: Meter updated
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Meter not found
 *
 *   delete:
 *     summary: Delete a meter
 *     tags: [Meters]
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
 *         description: Meter deleted
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Meter not found
 */

// POST /api/meters — protected
router.post(
  "/",
  protect, // ← checks JWT token first
  [
    body("meterId").notEmpty().withMessage("Meter ID is required"),
    body("customerId").notEmpty().withMessage("Customer ID is required"),
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

// GET /api/meters — protected
router.get("/", protect, async (req, res) => {
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
    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: meters,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/meters/customer/:customerId — protected
// IMPORTANT: must stay ABOVE /:meterId
router.get("/customer/:customerId", protect, async (req, res) => {
  try {
    const meters = await Meter.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: meters.length, data: meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/meters/:meterId — protected
router.get("/:meterId", protect, async (req, res) => {
  try {
    const meter = await Meter.findOne({ meterId: req.params.meterId });
    if (!meter)
      return res.status(404).json({ success: false, message: `Meter '${req.params.meterId}' not found` });

    res.status(200).json({ success: true, data: meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/meters/:meterId — protected
router.put(
  "/:meterId",
  protect,
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
      const allowedUpdates = [
        "status", "meterType", "location",
        "lastReadingDate", "lastReadingValue", "totalUnitsConsumed",
      ];
      const updates = {};
      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const meter = await Meter.findOneAndUpdate(
        { meterId: req.params.meterId },
        updates,
        { new: true, runValidators: true }
      );
      if (!meter)
        return res.status(404).json({ success: false, message: `Meter '${req.params.meterId}' not found` });

      res.status(200).json({ success: true, message: "Meter updated successfully", data: meter });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// DELETE /api/meters/:meterId — protected
router.delete("/:meterId", protect, async (req, res) => {
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