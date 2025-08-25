const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');

// User orders list
router.get('/', auth, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
});

// Order by id (user)
router.get('/:id', auth, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json(order);
});

// Checkout: body = { shippingAddress, paymentMethod }
router.post('/checkout', auth, async (req, res) => {
  const { shippingAddress, paymentMethod = 'cod' } = req.body;
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Cart is empty' });

  // compute totals (simple)
  const subtotal = cart.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shipping = subtotal > 100 ? 0 : 10;
  const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10%
  const grandTotal = Math.round((subtotal + shipping + tax) * 100) / 100;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Re-check stock & decrement atomically per variant
      for (const item of cart.items) {
        const updated = await Product.updateOne(
          { _id: item.product, 'variants.sku': item.sku, 'variants.stock': { $gte: item.quantity } },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session }
        );
        if (updated.modifiedCount === 0) {
          throw new Error(`Insufficient stock for SKU ${item.sku}`);
        }
      }

      // Build order items enriched with variant info
      const productsMap = {};
      const productDocs = await Product.find({ _id: { $in: cart.items.map(i => i.product) } }).session(session);
      for (const p of productDocs) productsMap[p._id.toString()] = p;

      const orderItems = cart.items.map(it => {
        const p = productsMap[it.product.toString()];
        const v = p.variants.find(v => v.sku === it.sku);
        return {
          product: p._id,
          sku: it.sku,
          name: p.name,
          size: v?.size,
          color: v?.color,
          price: it.price,
          quantity: it.quantity
        };
      });

      const order = await Order.create([{
        userId: req.user.id,
        items: orderItems,
        totals: { subtotal, shipping, tax, grandTotal },
        shippingAddress,
        payment: { method: paymentMethod, status: paymentMethod === 'cod' ? 'pending' : 'pending' },
        status: 'pending'
      }], { session });

      // Clear cart
      cart.items = [];
      cart.updatedAt = new Date();
      await cart.save({ session });

      res.status(201).json(order[0]);
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  } finally {
    session.endSession();
  }
});

// ----- Admin -----

// All orders
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// Update order status
router.put('/admin/:id/status', auth, isAdmin, async (req, res) => {
  const { status, paymentStatus } = req.body;
  const upd = {};
  if (status) upd.status = status;
  if (paymentStatus) upd['payment.status'] = paymentStatus;
  const order = await Order.findByIdAndUpdate(req.params.id, { $set: upd }, { new: true });
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json(order);
});

module.exports = router;
