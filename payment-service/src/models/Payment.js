const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        billId: {
            type: String,
            required: [true, "Bill ID is required"],
        },
        customerId: {
            type: String,
            required: [true, "Customer ID is required"],
        },
        amountPaid: {
            type: Number,
            required: [true, "Amount is required"],
            min: [1, "Amount must be greater than 0"],
        },
        paymentMethod: {
            type: String,
            required: [true, "Payment method is required"],
            enum: {
                values: ["Online Banking", "Cash", "Card", "eZ Cash", "mCash"],
                message: "Invalid payment method",
            },
        },
        transactionRef: {
            type: String,
            unique: true,
        },
        status: {
            type: String,
            enum: ["success", "failed", "pending"],
            default: "success",
        },
    },
    { timestamps: true }
);

// Auto-generate transaction reference
paymentSchema.pre("save", async function (next) {
    if (!this.transactionRef) {
        const count = await mongoose.model("Payment").countDocuments();
        const year = new Date().getFullYear();
        this.transactionRef = `TXN-${year}-${String(count + 1).padStart(4, "0")}`;
    }
    next();
});

module.exports = mongoose.model("Payment", paymentSchema);