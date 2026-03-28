const MeterReading = require("../models/MeterReading");
const Meter = require("../models/Meter");

// @desc    Submit a new meter reading
// @route   POST /api/readings
exports.submitReading = async (req, res) => {
  try {
    const { meterId, customerId, currentReading, previousReading, readBy, notes, readingDate } = req.body;

    // Verify meter exists and is active
    const meter = await Meter.findOne({ meterId });
    if (!meter) {
      return res.status(404).json({ success: false, message: `Meter '${meterId}' not found` });
    }
    if (meter.status !== "active") {
      return res.status(400).json({ success: false, message: `Meter '${meterId}' is not active (status: ${meter.status})` });
    }

    // Validate current reading is greater than previous
    if (currentReading < previousReading) {
      return res.status(400).json({
        success: false,
        message: "Current reading cannot be less than previous reading",
      });
    }

    // Check duplicate reading for same month
    const date = readingDate ? new Date(readingDate) : new Date();
    const readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const duplicate = await MeterReading.findOne({ meterId, readingMonth });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A reading for meter '${meterId}' already exists for ${readingMonth}`,
      });
    }

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

    // Update the meter's last reading info
    await Meter.findOneAndUpdate(
      { meterId },
      {
        lastReadingDate: date,
        lastReadingValue: currentReading,
        $inc: { totalUnitsConsumed: unitsConsumed },
      }
    );

    res.status(201).json({
      success: true,
      message: "Meter reading submitted successfully",
      data: reading,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all readings
// @route   GET /api/readings
exports.getAllReadings = async (req, res) => {
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
};

// @desc    Get reading by ID
// @route   GET /api/readings/:id
exports.getReadingById = async (req, res) => {
  try {
    const reading = await MeterReading.findById(req.params.id);

    if (!reading) {
      return res.status(404).json({ success: false, message: "Reading not found" });
    }

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get readings by meter ID
// @route   GET /api/readings/meter/:meterId
exports.getReadingsByMeter = async (req, res) => {
  try {
    const readings = await MeterReading.find({ meterId: req.params.meterId }).sort({ readingDate: -1 });

    res.status(200).json({
      success: true,
      count: readings.length,
      data: readings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get readings by customer ID
// @route   GET /api/readings/customer/:customerId
exports.getReadingsByCustomer = async (req, res) => {
  try {
    const { readingMonth } = req.query;
    const filter = { customerId: req.params.customerId };
    if (readingMonth) filter.readingMonth = readingMonth;

    const readings = await MeterReading.find(filter).sort({ readingDate: -1 });

    res.status(200).json({
      success: true,
      count: readings.length,
      data: readings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get latest reading for a meter
// @route   GET /api/readings/meter/:meterId/latest
exports.getLatestReading = async (req, res) => {
  try {
    const reading = await MeterReading.findOne({ meterId: req.params.meterId }).sort({ readingDate: -1 });

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: `No readings found for meter '${req.params.meterId}'`,
      });
    }

    res.status(200).json({ success: true, data: reading });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update reading status
// @route   PUT /api/readings/:id/status
exports.updateReadingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const reading = await MeterReading.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!reading) {
      return res.status(404).json({ success: false, message: "Reading not found" });
    }

    res.status(200).json({
      success: true,
      message: `Reading status updated to '${status}'`,
      data: reading,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete reading
// @route   DELETE /api/readings/:id
exports.deleteReading = async (req, res) => {
  try {
    const reading = await MeterReading.findByIdAndDelete(req.params.id);

    if (!reading) {
      return res.status(404).json({ success: false, message: "Reading not found" });
    }

    res.status(200).json({ success: true, message: "Reading deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};