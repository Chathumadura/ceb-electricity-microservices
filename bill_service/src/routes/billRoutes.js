const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const protect = require("../middleware/auth");
const axios = require("axios");

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || "http://localhost:3001";
const METER_SERVICE_URL = process.env.METER_SERVICE_URL || "http://localhost:3002";

/**
 * @swagger
 * tags:
 *   name: Bills
 *   description: CEB Bill Management
 */

/**
 * @swagger
 * /api/bills/tariff:
 *   get:
 *     summary: Get CEB tariff rates
 *     tags: [Bills]
 *     responses:
 *       200:
 *         description: Tariff structure
 */
router.get("/tariff", (req, res) => {
  res.json({
    success: true,
    currency: "LKR",
    tariff_rates_per_unit: {
      "0-30 units": 2.50,
      "31-60 units": 4.85,
      "61-90 units": 7.85,
      "91-120 units": 10.00,
      "121-180 units": 27.75,
      "181-300 units": 32.00,
      "300+ units": 45.00,
    },
  });
});

/**
 * @swagger
 * /api/bills/calculate/{units}:
 *   get:
 *     summary: Preview bill amount
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: units
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Estimated amount
 */
router.get("/calculate/:units", (req, res) => {
  const units = parseFloat(req.params.units);
  if (units < 0) return res.status(400).json({ success: false, message: "Units cannot be negative" });
  res.json({ success: true, units_consumed: units, estimated_amount_lkr: Bill.calculateBill(units) });
});

/**
 * @swagger
 * /api/bills/customer/{customerId}:
 *   get:
 *     summary: Get all bills for a customer
 *     tags: [Bills]
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
 *         description: Bills found
 */
router.get("/customer/:customerId", protect(), async (req, res, next) => {
  try {
    const bills = await Bill.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    if (!bills.length) return res.status(404).json({ success: false, message: "No bills found" });
    res.json({ success: true, count: bills.length, data: bills });
  } catch (err) { next(err); }
});

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
 *         description: All bills
 */
router.get("/", protect(), async (req, res, next) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json({ success: true, count: bills.length, data: bills });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/bills/{id}:
 *   get:
 *     summary: Get bill by ID
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
 *         description: Bill found
 */
router.get("/:id", protect(), async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    res.json({ success: true, data: bill });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/bills/{id}:
 *   delete:
 *     summary: Delete bill by ID
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
 */
router.delete("/:id", protect(), async (req, res, next) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    res.json({ success: true, message: "Bill deleted successfully", data: bill });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/bills/generate:
 *   post:
 *     summary: Generate bill (auto-fetches meter, associates with logged-in customer)
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [month]
 *             properties:
 *               month:      { type: string, example: "March 2026" }
 *     responses:
 *       201:
 *         description: Bill generated
 */
router.post("/generate", protect(), async (req, res, next) => {
  try {
    const { month } = req.body;
    const customerId = req.user.customerId;
    const token = req.headers.authorization;
    let customer;

    if (!month) {
      return res.status(400).json({ success: false, message: "month is required" });
    }

    // ── Step 1: Customer validate ──
    try {
      const customerRes = await axios.get(`${CUSTOMER_SERVICE_URL}/api/customers/${customerId}`, {
        headers: { Authorization: token },
      });
      customer = customerRes.data?.data;
    } catch {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // ── Step 2: Auto-fetch meterId from customer ──
    let meterId;
    try {
      const meterRes = await axios.get(`${METER_SERVICE_URL}/api/meters/customer/${customerId}`, {
        headers: { Authorization: token },
      });
      meterId = meterRes.data.data._id;
    } catch {
      return res.status(404).json({ success: false, message: "No meter found for customer" });
    }

    // ── Step 3: Latest reading ගන්නවා ──
    let latestReading;
    try {
      const readingRes = await axios.get(`${METER_SERVICE_URL}/api/meters/readings/${meterId}`, {
        headers: { Authorization: token },
      });
      const readings = readingRes.data.data;
      latestReading = readings[readings.length - 1]; // latest
    } catch {
      return res.status(404).json({
        success: false,
        message: "No meter readings found for this meter. Add a reading via POST /api/meters/readings and try again.",
      });
    }

    // ── Step 4: Duplicate bill check ──
    const existing = await Bill.findOne({ customerId, month });
    if (existing) {
      return res.status(400).json({ success: false, message: `Bill already exists for ${month}` });
    }

    // ── Step 5: Apply available customer credit ──
    const calculatedAmount = Bill.calculateBill(latestReading.unitsConsumed);
    const availableCredit = Number(customer?.creditBalance || 0);
    const creditUsed = Math.min(availableCredit, calculatedAmount);
    const finalAmount = Number((calculatedAmount - creditUsed).toFixed(2));

    // ── Step 6: Bill generate ──
    const bill = new Bill({
      customerId,
      meterId,
      unitsConsumed: latestReading.unitsConsumed,
      originalBillAmount: calculatedAmount,
      creditUsed,
      billAmount: finalAmount,
      status: finalAmount === 0 ? "paid" : "unpaid",
      month,
    });
    await bill.save();

    if (creditUsed > 0) {
      try {
        await axios.patch(
          `${CUSTOMER_SERVICE_URL}/api/customers/${customerId}/credit`,
          { delta: -creditUsed },
          { headers: { Authorization: token } }
        );
      } catch {
        await Bill.findByIdAndDelete(bill._id);
        return res.status(502).json({
          success: false,
          message: "Bill generated but credit deduction failed. Please retry or contact support.",
        });
      }
    }

    res.status(201).json({
      success: true,
      originalAmount: calculatedAmount,
      creditUsed,
      finalAmount,
      message: creditUsed > 0
        ? `Rs. ${creditUsed} credit applied from previous payment`
        : "Bill generated",
      data: bill,
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/bills:
 *   post:
 *     summary: Manually create a bill
 *     tags: [Bills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, meterId, unitsConsumed, month]
 *             properties:
 *               customerId:    { type: string, example: "CUST-001" }
 *               meterId:       { type: string, example: "64f1a2b3c4d5e6f7a8b9c0d1" }
 *               unitsConsumed: { type: number, example: 150 }
 *               month:         { type: string, example: "March 2026" }
 *     responses:
 *       201:
 *         description: Bill created
 */
router.post("/", protect(), async (req, res, next) => {
  try {
    const bill = new Bill(req.body);
    await bill.save();
    res.status(201).json({ success: true, data: bill });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/bills/{id}/status:
 *   patch:
 *     summary: Update bill status
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
 *             properties:
 *               status: { type: string, example: "paid" }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch("/:id/status", protect(), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["paid", "partial", "unpaid", "overdue"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const bill = await Bill.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    res.json({ success: true, data: bill });
  } catch (err) { next(err); }
});

module.exports = router;