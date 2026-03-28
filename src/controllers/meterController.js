const Meter = require("../models/Meter");

// @desc    Create a new meter
// @route   POST /api/meters
exports.createMeter = async (req, res) => {
  try {
    const { meterId, customerId, meterType, location, installedDate } = req.body;

    // Check if meter already exists
    const existing = await Meter.findOne({ meterId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Meter with ID '${meterId}' already exists`,
      });
    }

    const meter = new Meter({
      meterId,
      customerId,
      meterType,
      location,
      installedDate,
    });

    await meter.save();

    res.status(201).json({
      success: true,
      message: "Meter registered successfully",
      data: meter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all meters
// @route   GET /api/meters
exports.getAllMeters = async (req, res) => {
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
};

// @desc    Get meter by meterId
// @route   GET /api/meters/:meterId
exports.getMeterById = async (req, res) => {
  try {
    const meter = await Meter.findOne({ meterId: req.params.meterId });

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: `Meter '${req.params.meterId}' not found`,
      });
    }

    res.status(200).json({ success: true, data: meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get meters by customerId
// @route   GET /api/meters/customer/:customerId
exports.getMetersByCustomer = async (req, res) => {
  try {
    const meters = await Meter.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: meters.length,
      data: meters,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update meter
// @route   PUT /api/meters/:meterId
exports.updateMeter = async (req, res) => {
  try {
    const allowedUpdates = ["status", "meterType", "location", "lastReadingDate", "lastReadingValue", "totalUnitsConsumed"];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const meter = await Meter.findOneAndUpdate(
      { meterId: req.params.meterId },
      updates,
      { new: true, runValidators: true }
    );

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: `Meter '${req.params.meterId}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Meter updated successfully",
      data: meter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete meter
// @route   DELETE /api/meters/:meterId
exports.deleteMeter = async (req, res) => {
  try {
    const meter = await Meter.findOneAndDelete({ meterId: req.params.meterId });

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: `Meter '${req.params.meterId}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Meter deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};