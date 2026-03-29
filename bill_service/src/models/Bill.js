const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    // ── Customer data (snapshot fetched from Customer Service) ─────────────
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
    },
    customerEmail: {
      type: String,
      default: "",
    },
    customerAddress: {
      type: String,
      default: "",
    },

    // ── Meter data (snapshot fetched from Meter Service) ───────────────────
    meterId: {
      type: String,
      required: [true, "Meter ID is required"],
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
    readingDate: {
      type: Date,
      default: Date.now,
    },

    // ── Bill calculation (auto-calculated in pre-save hook) ────────────────
    billingMonth: {
      type: String, // Format: "YYYY-MM"  e.g. "2024-03"
      required: [true, "Billing month is required"],
    },
    unitsConsumed: {
      type: Number,
    },
    ratePerUnit: {
      type: Number,
      default: 30, // LKR 30 per unit
    },
    fixedCharge: {
      type: Number,
      default: 500, // LKR 500 fixed charge
    },
    totalAmount: {
      type: Number,
    },

    // ── Bill status ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["PENDING", "PAID", "OVERDUE"],
      default: "PENDING",
    },
    dueDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate unitsConsumed and totalAmount before every save
billSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  this.totalAmount = this.unitsConsumed * this.ratePerUnit + this.fixedCharge;
  next();
});

module.exports = mongoose.model("Bill", billSchema);