const express = require("express");
const axios = require("axios");
const Payment = require("../models/Payment");
const protect = require("../middleware/auth");

const router = express.Router();

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || "http://localhost:3001";
const BILL_SERVICE_URL = process.env.BILL_SERVICE_URL || "http://localhost:3003";

// ─────────────────────────────────────────────────────────────────
// GET /api/payments/methods  — PUBLIC
// ─────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: Get accepted payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of accepted payment methods
 */
router.get("/methods", (req, res) => {
    res.json({
        success: true,
        methods: ["Online Banking", "Cash", "Card", "eZ Cash", "mCash"],
    });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/payments  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// POST /api/payments  — PROTECTED (with cross-service validation)
// ─────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Make a bill payment (auto-fetches latest unpaid bill for customer)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountPaid, paymentMethod]
 *             properties:
 *               amountPaid:
 *                 type: number
 *                 example: 1852.50
 *               paymentMethod:
 *                 type: string
 *                 example: Online Banking
 *     responses:
 *       201:
 *         description: Payment successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/", protect(), async (req, res, next) => {
    try {
        const { amountPaid, paymentMethod } = req.body;
        const customerId = req.user.customerId;
        const token = req.headers.authorization;

        if (!amountPaid || !paymentMethod) {
            return res.status(400).json({ success: false, message: "amountPaid and paymentMethod are required" });
        }

        const amount = Number(amountPaid);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        // 1. Validate customer exists
        try {
            await axios.get(`${CUSTOMER_SERVICE_URL}/api/customers/${customerId}`, {
                headers: { Authorization: token },
            });
        } catch {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }

        // 2. Auto-fetch latest unpaid bill
        let bill;
        let billId;
        try {
            const billsRes = await axios.get(`${BILL_SERVICE_URL}/api/bills/customer/${customerId}`, {
                headers: { Authorization: token },
            });
            const bills = billsRes.data.data;

            // Find first unpaid bill
            bill = bills.find(b => b.status !== "paid");
            if (!bill) {
                return res.status(404).json({ success: false, message: "No unpaid bills found for customer" });
            }
            billId = bill._id;
        } catch {
            return res.status(404).json({ success: false, message: "Could not fetch customer bills" });
        }

        // 3. Validate and compute cumulative payment state
        const billAmount = Number(bill.billAmount || 0);
        const existingPayments = await Payment.find({ billId, status: { $in: ["partial", "success"] } });
        const alreadyPaid = existingPayments.reduce(
            (sum, p) => sum + Number(p.appliedToBill ?? p.amountPaid ?? 0),
            0
        );
        const payableRemaining = Math.max(0, billAmount - alreadyPaid);

        if (payableRemaining <= 0) {
            return res.status(400).json({ success: false, message: "Bill already fully paid" });
        }

        const appliedToBill = Math.min(amount, payableRemaining);
        const creditAdded = Number((amount - appliedToBill).toFixed(2));
        const totalPaid = alreadyPaid + appliedToBill;
        const remainingAmount = Math.max(0, Number((billAmount - totalPaid).toFixed(2)));
        const isPartial = remainingAmount > 0;
        const paymentStatus = isPartial ? "partial" : "success";
        const billStatus = isPartial ? "partial" : "paid";

        if (creditAdded > 0) {
            try {
                await axios.patch(
                    `${CUSTOMER_SERVICE_URL}/api/customers/${customerId}/credit`,
                    { delta: creditAdded },
                    { headers: { Authorization: token } }
                );
            } catch {
                return res.status(502).json({
                    success: false,
                    message: "Payment received but credit update failed. Please retry.",
                });
            }
        }

        // 4. Generate transaction reference
        const transactionRef = `TXN-${new Date().getFullYear()}-${String(Date.now()).slice(-4).padStart(4, '0')}`;

        // 5. Save payment
        const payment = await Payment.create({
            billId,
            customerId,
            amountPaid: amount,
            paymentMethod,
            transactionRef,
            status: paymentStatus,
            appliedToBill,
            creditAdded,
            remainingAmount,
            isPartial,
            billStatus,
        });

        // 6. Update bill status
        try {
            await axios.patch(
                `${BILL_SERVICE_URL}/api/bills/${billId}/status`,
                { status: billStatus },
                { headers: { Authorization: token } }
            );
        } catch {
            // Non-critical — payment saved, bill update failed
            console.warn("Could not update bill status");
        }

        const response = {
            success: true,
            transactionRef,
            amountPaid: amount,
            totalBillAmount: billAmount,
            payableAmount: Number(payableRemaining.toFixed(2)),
            appliedToBill,
            remainingAmount,
            billStatus,
            message: isPartial
                ? `Partial payment successful. Remaining: Rs. ${remainingAmount}`
                : "Payment successful",
            data: payment,
        };

        if (creditAdded > 0) {
            response.creditAdded = creditAdded;
            response.message = `Rs. ${creditAdded} credit saved for next bill`;
        }

        res.status(201).json(response);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/payments/summary/:customerId  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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
        const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
        res.json({ success: true, customerId: req.params.customerId, totalPaid, count: payments.length, payments });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/payments/customer/:customerId  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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
        const payments = await Payment.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
        if (!payments.length) {
            return res.status(404).json({ success: false, message: "No payments found for this customer" });
        }
        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/payments/:id  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
        res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/payments/:id  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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
 *     responses:
 *       200:
 *         description: Payment updated
 *       404:
 *         description: Payment not found
 */
router.put("/:id", protect(), async (req, res, next) => {
    try {
        const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
        res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/payments/:id  — PROTECTED
// ─────────────────────────────────────────────────────────────────
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
 *         description: Payment deleted
 *       404:
 *         description: Payment not found
 */
router.delete("/:id", protect(), async (req, res, next) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
        res.json({ success: true, message: "Payment deleted" });
    } catch (err) {
        next(err);
    }
});

module.exports = router;