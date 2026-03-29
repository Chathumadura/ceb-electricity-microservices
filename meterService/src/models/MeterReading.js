const mongoose = require("mongoose");

const meterReadingSchema = new mongoose.Schema(
  {
    // ─── CONNECTS TO: Meter (your own model) ─────────────────────
    meterId: {
      type: String,
      required: [true, "Meter ID is required"],
      trim: true,
    },

    // ─── CONNECTS TO: Customer Service (port 3001) ───────────────
    // Bill Service will use customerId + unitsConsumed to generate a bill
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      trim: true,
    },

    previousReading: { type: Number, required: true, min: 0 },
    currentReading:  { type: Number, required: true, min: 0 },

    // ─── CONNECTS TO: Bill Service (port 3003) ───────────────────
    // Bill Service reads unitsConsumed to calculate the bill amount
    unitsConsumed: { type: Number },

    readingDate:  { type: Date, default: Date.now },
    readingMonth: { type: String }, // e.g. "2025-01"
    readBy:       { type: String, default: "system" },
    notes:        { type: String, trim: true },

    // ─── CONNECTS TO: Bill Service (port 3003) ───────────────────
    // Bill Service updates this to "billed" after generating a bill
    status: {
      type: String,
      enum: ["pending", "billed", "disputed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Auto-calculate units and readingMonth before saving
meterReadingSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  const date = new Date(this.readingDate);
  this.readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  next();
});

module.exports = mongoose.model("MeterReading", meterReadingSchema);