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

// ─────────────────────────────────────────────────────────────────
// POST /api/meters
// Called by: Customer Service (after registering a customer,
//            it calls this to register their meter)
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// GET /api/meters
// Called by: Admin / API Gateway
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// GET /api/meters/customer/:customerId
// Called by: Bill Service — to get the meter linked to a customer
//            before generating a bill
// ─────────────────────────────────────────────────────────────────
router.get("/customer/:customerId", async (req, res) => {
  try {
    const meters = await Meter.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: meters.length, data: meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/meters/:meterId
// Called by: Bill Service / Payment Service — to verify meter exists
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// PUT /api/meters/:meterId
// Called by: Internal admin or other services to update meter status
// ─────────────────────────────────────────────────────────────────
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

// DELETE /api/meters/:meterId
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