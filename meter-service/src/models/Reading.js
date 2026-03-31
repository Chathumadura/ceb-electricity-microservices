const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    meterId: { type: mongoose.Schema.Types.ObjectId, ref: "Meter", required: true },
    customerId: { type: String, required: true },
    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    unitsConsumed: { type: Number },
    readingMonth: { type: String, required: [true, "Reading month is required"] },
    recordedBy: { type: String, required: true },
  },
  { timestamps: true }
);

readingSchema.pre("save", function (next) {
  if (this.currentReading < this.previousReading)
    return next(new Error("Current reading cannot be less than previous reading"));
  this.unitsConsumed = this.currentReading - this.previousReading;
  next();
});

module.exports = mongoose.model("Reading", readingSchema);