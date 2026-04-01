const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        billId: { type: String, required: [true, "Bill ID is required"] },
        customerId: { type: String, required: [true, "Customer ID is required"] },
        amountPaid: { type: Number, required: [true, "Amount is required"], min: [1, "Amount must be > 0"] },
        paymentMethod: {
            type: String,
            required: [true, "Payment method is required"],
            enum: { values: ["Online Banking", "Cash", "Card", "eZ Cash", "mCash"], message: "Invalid payment method" },
        },
        transactionRef: { type: String, unique: true },
        status: { type: String, enum: ["success", "partial", "failed", "pending"], default: "partial" },
        appliedToBill: { type: Number, default: 0 },
        creditAdded: { type: Number, default: 0 },
        remainingAmount: { type: Number, default: 0 },
        isPartial: { type: Boolean, default: false },
        billStatus: { type: String, enum: ["partial", "paid"], default: "partial" },
    },
    { timestamps: true }
);

paymentSchema.pre("save", async function (next) {
    if (!this.transactionRef) {
        const count = await mongoose.model("Payment").countDocuments();
        this.transactionRef = `TXN-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }
    next();
});

module.exports = mongoose.model("Payment", paymentSchema);