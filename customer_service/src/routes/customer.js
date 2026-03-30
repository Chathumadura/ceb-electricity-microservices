const router = require('express').Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/authMiddleware');

const sendValidation = (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    res.status(422).json({ errors: errs.array() });
    return true;
  }
  return false;
};

// GET profile
router.get('/profile', protect, async (req, res) => {
  res.json(req.customer);
});

// UPDATE profile
router.put(
  '/profile',
  protect,
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('phone').optional().matches(/^[0-9]{10,15}$/).withMessage('Phone must be 10-15 digits'),
    body('address').optional().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  ],
  async (req, res) => {
    if (sendValidation(req, res)) return;

    try {
      const { name, phone, address } = req.body;

      const updated = await Customer.findByIdAndUpdate(
        req.customer._id,
        { name, phone, address },
        { new: true, runValidators: true }
      ).select('-password');

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE own account
router.delete('/profile', protect, async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.customer._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET by ID
router.get('/:id', protect, async (req, res) => {
  try {
    let customer;

    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      // Lookup by MongoDB _id
      customer = await Customer.findById(req.params.id).select('-password');
    } else {
      // Lookup by customerId string e.g. "CUST-003"
      customer = await Customer.findOne({ customerId: req.params.id }).select('-password');
    }

    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE by ID
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    res.json({ message: `Customer ${customer.name} deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


/**
 * @swagger
 * /api/customers/profile:
 *   get:
 *     summary: Get logged-in customer profile
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer profile data
 */

/**
 * @swagger
 * /api/customers/profile:
 *   put:
 *     summary: Update customer profile
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */

/**
 * @swagger
 * /api/customers/profile:
 *   delete:
 *     summary: Delete own account
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer found
 */

