const mongoose = require("mongoose");

const meterSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: [true, "Customer ID is required"] },
    meterNumber: { type: String, required: [true, "Meter number is required"], unique: true },
    location: { type: String, required: [true, "Location is required"] },
    meterType: { type: String, enum: ["Single Phase", "Three Phase"], default: "Single Phase" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    installedDate: { type: Date, default: Date.now },
    lastReadingValue: { type: Number, default: 0 },
    lastReadingDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meter", meterSchema);