const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, unique: true },
    name: { type: String, required: [true, "Name is required"] },
    email: { type: String, required: [true, "Email is required"], unique: true },
    password: { type: String, required: [true, "Password is required"], minlength: 6 },
    phone: { type: String, required: [true, "Phone is required"] },
    address: { type: String, required: [true, "Address is required"] },
    accountNumber: { type: String, unique: true },
    creditBalance: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
  },
  { timestamps: true }
);

// Auto generate customerId and accountNumber
customerSchema.pre("save", async function (next) {
  if (!this.customerId) {
    const count = await mongoose.model("Customer").countDocuments();
    this.customerId = `CUST-${String(count + 1).padStart(3, "0")}`;
    this.accountNumber = `ACC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
  }
  // Hash password
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password method
customerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Customer", customerSchema);