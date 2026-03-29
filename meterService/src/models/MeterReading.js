const mongoose = require("mongoose");

const meterReadingSchema = new mongoose.Schema(
  {
    meterId: {
      type: String,
      required: [true, "Meter ID is required"],
      trim: true,
    },
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      trim: true,
    },
    previousReading: {
      type: Number,
      required: [true, "Previous reading is required"],
      min: 0,
    },
    currentReading: {
      type: Number,
      required: [true, "Current reading is required"],
      min: 0,
    },
    unitsConsumed: {
      type: Number,
    },
    readingDate: {
      type: Date,
      default: Date.now,
    },
    readingMonth: {
      type: String, // e.g., "2025-01"
    },
    readBy: {
      type: String,
      default: "system",
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "billed", "disputed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate units consumed before saving
meterReadingSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;

  const date = new Date(this.readingDate);
  this.readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  next();
});

module.exports = mongoose.model("MeterReading", meterReadingSchema);