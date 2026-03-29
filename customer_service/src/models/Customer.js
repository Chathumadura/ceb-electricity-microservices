const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Email must be valid'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      match: [/^[0-9]{10,15}$/, 'Phone must be 10-15 digits'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      minlength: [5, 'Address must be at least 5 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    accountNumber: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// ✅ UPDATED PRE-SAVE (NO NEW FILES USED)
customerSchema.pre('save', async function (next) {
  try {
    // 🔹 Generate customerId like CUST-001
    if (!this.customerId) {
      const count = await mongoose.model('Customer').countDocuments();
      this.customerId = `CUST-${String(count + 1).padStart(3, '0')}`;
    }

    // 🔹 Generate account number
    if (!this.accountNumber) {
      this.accountNumber = 'CEB' + Math.floor(100000 + Math.random() * 900000);
    }

    // 🔹 Hash password
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 10);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
customerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Customer', customerSchema);