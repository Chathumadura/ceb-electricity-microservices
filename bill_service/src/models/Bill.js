const mongoose = require("mongoose");

// CEB Tariff Calculation (Sri Lanka)
const calculateBill = (units) => {
  let total = 0;
  if (units <= 30) total = units * 2.50;
  else if (units <= 60) total = (30 * 2.50) + ((units - 30) * 4.85);
  else if (units <= 90) total = (30 * 2.50) + (30 * 4.85) + ((units - 60) * 7.85);
  else if (units <= 120) total = (30 * 2.50) + (30 * 4.85) + (30 * 7.85) + ((units - 90) * 10.00);
  else if (units <= 180) total = (30 * 2.50) + (30 * 4.85) + (30 * 7.85) + (30 * 10.00) + ((units - 120) * 27.75);
  else if (units <= 300) total = (30 * 2.50) + (30 * 4.85) + (30 * 7.85) + (30 * 10.00) + (60 * 27.75) + ((units - 180) * 32.00);
  else total = (30 * 2.50) + (30 * 4.85) + (30 * 7.85) + (30 * 10.00) + (60 * 27.75) + (120 * 32.00) + ((units - 300) * 45.00);
  return Math.round(total * 100) / 100;
};

const billSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: [true, "Customer ID is required"] },
    meterId: { type: String, required: [true, "Meter ID is required"] },
    unitsConsumed: { type: Number, required: [true, "Units consumed is required"], min: 0 },
    originalBillAmount: { type: Number, default: 0 },
    creditUsed: { type: Number, default: 0 },
    billAmount: { type: Number },
    dueDate: { type: Date },
    status: { type: String, enum: ["unpaid", "partial", "paid", "overdue"], default: "unpaid" },
    month: { type: String, required: [true, "Month is required"] },
  },
  { timestamps: true }
);

// Auto calculate bill amount and due date
billSchema.pre("save", function (next) {
  const calculated = calculateBill(this.unitsConsumed);
  if (!this.originalBillAmount) this.originalBillAmount = calculated;
  if (this.billAmount === undefined || this.billAmount === null) this.billAmount = calculated;
  const due = new Date();
  due.setDate(due.getDate() + 25);
  this.dueDate = due;
  next();
});

const Bill = mongoose.model("Bill", billSchema);
Bill.calculateBill = calculateBill;
module.exports = Bill;