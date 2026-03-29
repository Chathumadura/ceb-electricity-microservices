const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

// Central validation handler
const sendValidation = (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    res.status(422).json({ errors: errs.array() });
    return true;
  }
  return false;
};

// JWT generator
const generateToken = (customer) =>
  jwt.sign(
    { id: customer._id, email: customer.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// REGISTER
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}$/)
      .withMessage('Password must have uppercase, number, special char'),
    body('phone').notEmpty().withMessage('Phone is required').matches(/^[0-9]{10,15}$/).withMessage('Phone must be 10-15 digits'),
    body('address').notEmpty().withMessage('Address is required').isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  ],
  async (req, res) => {
    if (sendValidation(req, res)) return;

    try {
      const { name, email, phone, address, password } = req.body;

      if (await Customer.findOne({ email })) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      const customer = await Customer.create({ name, email, phone, address, password });
      const safeCustomer = customer.toObject();
      delete safeCustomer.password;

      res.status(201).json({
        message: 'Registered successfully',
        token: generateToken(customer),
        customer: safeCustomer,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// LOGIN
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    if (sendValidation(req, res)) return;

    try {
      const { email, password } = req.body;
      const customer = await Customer.findOne({ email }).select('+password');

      if (!customer || !(await customer.matchPassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken(customer);
      const safeCustomer = customer.toObject();
      delete safeCustomer.password;

      res.json({ token, customer: safeCustomer });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;

/**
 * @swagger
 * /api/customers/register:
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registered successfully
 */

/**
 * @swagger
 * /api/customers/login:
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
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */