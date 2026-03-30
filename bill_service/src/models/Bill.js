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
    // ratePerUnit removed — CEB slab pricing applied automatically
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

// CEB Tariff slab calculation (Sri Lanka)
const calculateCEBBill = (units) => {
  let total = 0;
  if      (units <= 30)  total = units * 2.50;
  else if (units <= 60)  total = (30 * 2.50) + ((units - 30)  * 4.85);
  else if (units <= 90)  total = (30 * 2.50) + (30 * 4.85)   + ((units - 60)  * 7.85);
  else if (units <= 120) total = (30 * 2.50) + (30 * 4.85)   + (30 * 7.85)   + ((units - 90)  * 10.00);
  else if (units <= 180) total = (30 * 2.50) + (30 * 4.85)   + (30 * 7.85)   + (30 * 10.00)  + ((units - 120) * 27.75);
  else if (units <= 300) total = (30 * 2.50) + (30 * 4.85)   + (30 * 7.85)   + (30 * 10.00)  + (60 * 27.75)  + ((units - 180) * 32.00);
  else                   total = (30 * 2.50) + (30 * 4.85)   + (30 * 7.85)   + (30 * 10.00)  + (60 * 27.75)  + (120 * 32.00) + ((units - 300) * 45.00);
  return Math.round(total * 100) / 100;
};

// Auto-calculate unitsConsumed and totalAmount before every save
billSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  this.totalAmount = calculateCEBBill(this.unitsConsumed) + (this.fixedCharge || 0);
  next();
});

module.exports = mongoose.model("Bill", billSchema);