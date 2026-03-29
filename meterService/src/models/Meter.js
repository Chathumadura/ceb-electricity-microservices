const mongoose = require("mongoose");

const meterSchema = new mongoose.Schema(
  {
    meterId: {
      type: String,
      required: [true, "Meter ID is required"],
      unique: true,
      trim: true,
    },

    // ─── CONNECTS TO: Customer Service ───────────────────────────
    // customerId comes from Customer Service (port 3001)
    // When Bill Service needs to generate a bill, it uses this customerId
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      trim: true,
    },

    meterType: {
      type: String,
      enum: ["single-phase", "three-phase", "industrial"],
      default: "single-phase",
    },
    location: {
      address: { type: String, required: true },
      city:    { type: String, required: true },
      district:{ type: String },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "faulty", "replaced"],
      default: "active",
    },
    installedDate:      { type: Date, default: Date.now },
    lastReadingDate:    { type: Date },
    lastReadingValue:   { type: Number, default: 0 },
    totalUnitsConsumed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meter", meterSchema);