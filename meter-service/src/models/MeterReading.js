const mongoose = require("mongoose");

const meterReadingSchema = new mongoose.Schema(
  {
    // ─── YOUR OWN — links to Meter model ─────────────────────────
    // Format: MTR-001
    meterId: {
      type: String,
      required: [true, "Meter ID is required"],
      trim: true,
      match: [/^MTR-\d{3,}$/, "Meter ID must be in format MTR-001"],
    },

    // ─── FROM Customer Service ────────────────────────────────────
    // Format: CUST-001
    // Bill Service uses customerId to fetch customer details (name, email, address)
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      trim: true,
      match: [/^CUST-\d{3,}$/, "Customer ID must be in format CUST-001"],
    },

    // ─── USED BY Bill Service ─────────────────────────────────────
    // Bill model field: previousReading — comes from here
    previousReading: {
      type: Number,
      required: [true, "Previous reading is required"],
      min: 0,
    },

    // ─── USED BY Bill Service ─────────────────────────────────────
    // Bill model field: currentReading — comes from here
    currentReading: {
      type: Number,
      required: [true, "Current reading is required"],
      min: 0,
    },

    // ─── USED BY Bill Service ─────────────────────────────────────
    // Bill model field: unitsConsumed — Bill Service re-calculates this
    // using (currentReading - previousReading), same as below pre-save
    unitsConsumed: {
      type: Number,
    },

    // ─── USED BY Bill Service ─────────────────────────────────────
    // Bill model field: readingDate — comes from here
    readingDate: {
      type: Date,
      default: Date.now,
    },

    // ─── USED BY Bill Service ─────────────────────────────────────
    // Bill model field: billingMonth — Bill Service uses readingMonth
    // to set billingMonth (same format "YYYY-MM" e.g. "2025-01")
    readingMonth: {
      type: String, // Format: "YYYY-MM"  e.g. "2025-01"
    },

    readBy: { type: String, default: "field-officer" },
    notes:  { type: String, trim: true },

    // ─── UPDATED BY Bill Service ──────────────────────────────────
    // After Bill Service generates a bill, it calls:
    // PUT /api/readings/:id/status  →  { status: "billed" }
    // This prevents double-billing the same reading
    status: {
      type: String,
      enum: ["pending", "billed", "disputed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Auto-calculate unitsConsumed and readingMonth before saving
// Bill Service does the same calculation: currentReading - previousReading
meterReadingSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  const date = new Date(this.readingDate);
  this.readingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  next();
});

module.exports = mongoose.model("MeterReading", meterReadingSchema);