const express = require('express');
const router = express.Router();

const Bill = require('../models/Bill');
const auth = require('../middleware/auth');
const {
  getCustomerById,
  getMeterReadingByCustomerId,
} = require('../config/billservice');

/**
 * @swagger
 * tags:
 *   name: Bills
 *   description: CEB Bill generation and management
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Bill:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "661a2f3e4b5c6d7e8f901234"
 *         customerId:
 *           type: string
 *           example: "CUST001"
 *         customerName:
 *           type: string
 *           example: "Kamal Perera"
 *         customerEmail:
 *           type: string
 *           example: "kamal@email.com"
 *         customerAddress:
 *           type: string
 *           example: "No 12, Galle Road, Colombo"
 *         meterId:
 *           type: string
 *           example: "METER001"
 *         previousReading:
 *           type: number
 *           example: 1200
 *         currentReading:
 *           type: number
 *           example: 1350
 *         readingDate:
 *           type: string
 *           format: date-time
 *         billingMonth:
 *           type: string
 *           example: "2024-03"
 *         unitsConsumed:
 *           type: number
 *           example: 150
 *         ratePerUnit:
 *           type: number
 *           example: 30
 *         fixedCharge:
 *           type: number
 *           example: 500
 *         totalAmount:
 *           type: number
 *           example: 5000
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, OVERDUE]
 *           example: "PENDING"
 *         dueDate:
 *           type: string
 *           format: date
 *           example: "2024-04-15"
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// =============================================================================
// POST /api/bills/generate
// MAIN BILLING FLOW:
//   1. Validate request body
//   2. Check no duplicate bill
//   3. Call Customer Service → fetch customer details
//   4. Call Meter Service   → fetch latest meter reading
//   5. Map fields flexibly  → handles different field names from teammates
//   6. Calculate bill       → save to MongoDB
// =============================================================================
/**
 * @swagger
 * /api/bills/generate:
 *   post:
 *     summary: Generate a bill (fetches customer + meter data automatically)
 *     description: >
 *       Main billing endpoint. Calls Customer Service to get customer details,
 *       calls Meter Service to get the latest meter reading, then calculates
 *       and stores the bill in MongoDB.
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - billingMonth
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "CUST001"
 *               billingMonth:
 *                 type: string
 *                 example: "2024-03"
 *               ratePerUnit:
 *                 type: number
 *                 example: 30
 *               fixedCharge:
 *                 type: number
 *                 example: 500
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-04-15"
 *     responses:
 *       201:
 *         description: Bill generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bill generated successfully"
 *                 bill:
 *                   $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Missing fields or duplicate bill
 *       404:
 *         description: Customer or meter not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate', auth(), async (req, res) => {
  try {
    const { customerId, billingMonth, ratePerUnit, fixedCharge, dueDate } = req.body;

    // ── Step 1: Validate required fields ────────────────────────────────────
    if (!customerId || !billingMonth) {
      return res.status(400).json({
        message: 'customerId and billingMonth are required.',
      });
    }

    // ── Step 2: Check for duplicate bill ────────────────────────────────────
    const duplicate = await Bill.findOne({ customerId, billingMonth });
    if (duplicate) {
      return res.status(400).json({
        message: `A bill already exists for customer ${customerId} in ${billingMonth}.`,
      });
    }

    // ── Step 3: Fetch customer from Customer Service ─────────────────────────
    let customer;
    try {
      customer = await getCustomerById(customerId, req.token);
    } catch (err) {
      return res.status(404).json({
        message: `Failed to fetch customer: ${err.message}`,
      });
    }

    // ── Step 4: Fetch meter reading from Meter Service ───────────────────────
    let meter;
    try {
      meter = await getMeterReadingByCustomerId(customerId, req.token);
    } catch (err) {
      return res.status(404).json({
        message: `Failed to fetch meter reading: ${err.message}`,
      });
    }

    // ── Step 5: Flexible field mapping ───────────────────────────────────────
    // Handles different field names your teammates might use.
    // ⚠️  ADJUST field names here once you see their actual API response.
    //
    // Customer fields — tries multiple common names, falls back to empty string
    const customerName =
      customer.name ||
      customer.customerName ||
      customer.fullName ||
      customer.username ||
      '';

    const customerEmail =
      customer.email ||
      customer.customerEmail ||
      customer.emailAddress ||
      '';

    const customerAddress =
      customer.address ||
      customer.customerAddress ||
      customer.location ||
      '';

    // Meter fields — tries multiple common names
    const meterId =
      meter._id ||
      meter.meterId ||
      meter.meterNumber ||
      meter.id ||
      '';

    const previousReading =
      meter.previousReading ||
      meter.prevReading ||
      meter.lastReading ||
      0;

    const currentReading =
      meter.currentReading ||
      meter.currReading ||
      meter.reading ||
      0;

    const readingDate =
      meter.readingDate ||
      meter.updatedAt ||
      meter.createdAt ||
      new Date();

    // ── Step 6: Validate meter readings ─────────────────────────────────────
    if (currentReading < previousReading) {
      return res.status(400).json({
        message: 'Current reading cannot be less than previous reading.',
      });
    }

    if (currentReading === 0 && previousReading === 0) {
      return res.status(400).json({
        message: 'Meter readings not found. Please check the Meter Service.',
      });
    }

    // ── Step 7: Create and save the bill ────────────────────────────────────
    const bill = new Bill({
      // Customer snapshot
      customerId: customer._id || customer.customerId || customerId,
      customerName,
      customerEmail,
      customerAddress,

      // Meter snapshot
      meterId,
      previousReading,
      currentReading,
      readingDate,

      // Billing config
      billingMonth,
      ratePerUnit: ratePerUnit || 30,
      fixedCharge:  fixedCharge  || 500,
      dueDate: dueDate ? new Date(dueDate) : null,
      // unitsConsumed and totalAmount are auto-calculated in pre('save') hook
    });

    await bill.save();

    return res.status(201).json({
      message: 'Bill generated successfully',
      bill,
    });

  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============================================================================
// GET /api/bills
// Get all bills (newest first)
// =============================================================================
/**
 * @swagger
 * /api/bills:
 *   get:
 *     summary: Get all bills
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all bills
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bill'
 *       401:
 *         description: Unauthorized
 */
router.get('/', auth(), async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    return res.status(200).json(bills);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============================================================================
// GET /api/bills/customer/:customerId
// Get all bills for a specific customer
// NOTE: This route must come BEFORE /:id to avoid conflict
// =============================================================================
/**
 * @swagger
 * /api/bills/customer/{customerId}:
 *   get:
 *     summary: Get all bills for a specific customer
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: List of bills for the customer
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bill'
 *       401:
 *         description: Unauthorized
 */
router.get('/customer/:customerId', auth(), async (req, res) => {
  try {
    const bills = await Bill.find({ customerId: req.params.customerId }).sort({
      billingMonth: -1,
    });
    return res.status(200).json(bills);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============================================================================
// GET /api/bills/:id
// Get a single bill by MongoDB ID
// =============================================================================
/**
 * @swagger
 * /api/bills/{id}:
 *   get:
 *     summary: Get a single bill by ID
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bill MongoDB ID
 *     responses:
 *       200:
 *         description: Bill found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bill'
 *       404:
 *         description: Bill not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', auth(), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }
    return res.status(200).json(bill);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============================================================================
// PATCH /api/bills/:id/status
// Update bill payment status: PENDING → PAID or OVERDUE
// =============================================================================
/**
 * @swagger
 * /api/bills/{id}/status:
 *   patch:
 *     summary: Update bill payment status
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, OVERDUE]
 *                 example: "PAID"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Bill not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/status', auth(), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PAID', 'OVERDUE'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    return res.status(200).json(bill);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============================================================================
// DELETE /api/bills/:id
// Delete a bill by ID
// =============================================================================
/**
 * @swagger
 * /api/bills/{id}:
 *   delete:
 *     summary: Delete a bill by ID
 *     tags: [Bills]
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
 *         description: Bill deleted successfully
 *       404:
 *         description: Bill not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', auth(), async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }
    return res.status(200).json({ message: 'Bill deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
