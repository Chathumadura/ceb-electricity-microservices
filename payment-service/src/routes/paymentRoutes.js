const express = require("express");
const router = express.Router();
const Payment = require("../models/Payment");
const protect = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: CEB Payment Management
 */

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Get accepted payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of payment methods
 */
router.get("/methods", (req, res) => {
    res.json({
        success: true,
        accepted_methods: ["Online Banking", "Cash", "Card", "eZ Cash", "mCash"],
    });
});

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all payments
 */
router.get("/", protect(), async (req, res, next) => {
    try {
        const payments = await Payment.find().sort({ createdAt: -1 });
        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments/summary/{customerId}:
 *   get:
 *     summary: Get payment summary for a customer
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment summary
 *       404:
 *         description: No payments found
 */
router.get("/summary/:customerId", protect(), async (req, res, next) => {
    try {
        const payments = await Payment.find({ customerId: req.params.customerId });
        if (!payments.length) {
            return res.status(404).json({ success: false, message: "No payments found for this customer" });
        }
        const total = payments.reduce((sum, p) => sum + p.amountPaid, 0);
        res.json({
            success: true,
            customerId: req.params.customerId,
            totalPayments: payments.length,
            totalAmountPaidLKR: Math.round(total * 100) / 100,
            paymentHistory: payments,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments/customer/{customerId}:
 *   get:
 *     summary: Get payments by customer ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments found
 *       404:
 *         description: No payments found
 */
router.get("/customer/:customerId", protect(), async (req, res, next) => {
    try {
        const payments = await Payment.find({ customerId: req.params.customerId });
        if (!payments.length) {
            return res.status(404).json({ success: false, message: "No payments found for this customer" });
        }
        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
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
 *         description: Payment found
 *       404:
 *         description: Payment not found
 */
router.get("/:id", protect(), async (req, res, next) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }
        res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Make a bill payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [billId, customerId, amountPaid, paymentMethod]
 *             properties:
 *               billId:        { type: string, example: "BILL-001" }
 *               customerId:    { type: string, example: "CUST-001" }
 *               amountPaid:    { type: number, example: 1852.50 }
 *               paymentMethod: { type: string, example: "Online Banking" }
 *     responses:
 *       201:
 *         description: Payment successful
 *       400:
 *         description: Bad request
 */
router.post("/", protect(), async (req, res, next) => {
    try {
        const { billId } = req.body;

        // Check duplicate payment
        const existing = await Payment.findOne({ billId, status: "success" });
        if (existing) {
            return res.status(400).json({ success: false, message: "This bill has already been paid" });
        }

        const payment = new Payment(req.body);
        await payment.save();
        res.status(201).json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update payment by ID
 *     tags: [Payments]
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
 *             properties:
 *               amountPaid:    { type: number, example: 2000 }
 *               paymentMethod: { type: string, example: "Card" }
 *               status:        { type: string, example: "success" }
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       404:
 *         description: Payment not found
 */
router.put("/:id", protect(), async (req, res, next) => {
    try {
        const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment by ID
 *     tags: [Payments]
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
 *         description: Payment deleted successfully
 *       404:
 *         description: Payment not found
 */
router.delete("/:id", protect(), async (req, res, next) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.json({ success: true, message: "Payment deleted successfully" });
    } catch (err) {
        next(err);
    }
});

module.exports = router;