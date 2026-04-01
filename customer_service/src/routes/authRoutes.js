const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

const generateToken = (customer) => {
  return jwt.sign(
    {
      id: customer._id,
      customerId: customer.customerId,
      email: customer.email,
      role: customer.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new customer
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, phone, address]
 *             properties:
 *               name:     { type: string, example: "Kamal Perera" }
 *               email:    { type: string, example: "kamal@gmail.com" }
 *               password: { type: string, example: "test1234" }
 *               phone:    { type: string, example: "0771234567" }
 *               address:  { type: string, example: "Colombo 03" }
 *     responses:
 *       201:
 *         description: Customer registered
 */
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;

    const existing = await Customer.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: "Email already registered" });

    const customer = new Customer({ name, email, password, phone, address });
    await customer.save();

    const token = generateToken(customer);

    res.status(201).json({
      success: true,
      token,
      data: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        accountNumber: customer.accountNumber,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login customer
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: "kamal@gmail.com" }
 *               password: { type: string, example: "test1234" }
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer)
      return res.status(401).json({ success: false, message: "Invalid email or password" });

    const isMatch = await customer.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Invalid email or password" });

    const token = generateToken(customer);

    res.json({
      success: true,
      token,
      data: {
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        accountNumber: customer.accountNumber,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;