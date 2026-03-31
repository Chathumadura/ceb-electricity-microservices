const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const protect = require("../middleware/auth");

/**
 * @swagger
 * /api/customers/me:
 *   get:
 *     summary: Get my profile (logged in customer)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer profile
 */
router.get("/me", protect(), async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.id).select("-password");
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all customers
 */
router.get("/", protect(), async (req, res, next) => {
  try {
    const customers = await Customer.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
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
 *       404:
 *         description: Customer not found
 */
router.get("/:id", protect(), async (req, res, next) => {
  try {
    // MongoDB _id හෝ customerId (CUST-001) දෙකෙන්ම search කරනවා
    const customer = await Customer.findOne({
      $or: [
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        { customerId: req.params.id },
      ],
    }).select("-password");

    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/customers/me:
 *   put:
 *     summary: Update my profile
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:    { type: string }
 *               phone:   { type: string }
 *               address: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put("/me", protect(), async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.user.id,
      { name, phone, address },
      { new: true }
    ).select("-password");
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/customers/{id}/credit:
 *   patch:
 *     summary: Adjust customer credit balance
 *     tags: [Customers]
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
 *             required: [delta]
 *             properties:
 *               delta: { type: number, example: 100.5 }
 *     responses:
 *       200:
 *         description: Credit updated
 */
router.patch("/:id/credit", protect(), async (req, res, next) => {
  try {
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: "delta must be a non-zero number" });
    }

    const customer = await Customer.findOne({
      $or: [
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        { customerId: req.params.id },
      ],
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (req.user.role !== "admin" && req.user.customerId !== customer.customerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const nextCredit = Number((customer.creditBalance + delta).toFixed(2));
    if (nextCredit < 0) {
      return res.status(400).json({ success: false, message: "Insufficient credit balance" });
    }

    customer.creditBalance = nextCredit;
    await customer.save();

    res.json({
      success: true,
      customerId: customer.customerId,
      creditBalance: customer.creditBalance,
      delta,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
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
 *         description: Customer deleted
 */
router.delete("/:id", protect(), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;