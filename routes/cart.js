const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// helper: ensure user has a cart
async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });
  return cart;
}

// GET cart
router.get('/', auth, async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  res.json(cart);
});

// Add item: { productId, sku, quantity }
router.post('/items', auth, async (req, res) => {
  const { productId, sku, quantity = 1 } = req.body;
  const prod = await Product.findById(productId);
  if (!prod) return res.status(404).json({ message: 'Product not found' });

  const variant = prod.variants.find(v => v.sku === sku);
  if (!variant) return res.status(400).json({ message: 'Invalid SKU' });
  if (variant.stock < quantity) return res.status(400).json({ message: 'Insufficient stock' });

  const cart = await getOrCreateCart(req.user.id);
  const existing = cart.items.find(i => i.sku === sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      product: prod._id,
      sku,
      quantity,
      price: variant.price
    });
  }
  cart.updatedAt = new Date();
  await cart.save();

  res.status(201).json(cart);
});

// Update quantity: { quantity }
router.put('/items/:itemId', auth, async (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) return res.status(400).json({ message: 'Quantity must be >= 1' });
  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  // validate stock
  const prod = await Product.findById(item.product);
  const variant = prod?.variants.find(v => v.sku === item.sku);
  if (!variant) return res.status(400).json({ message: 'Invalid SKU' });
  if (variant.stock < quantity) return res.status(400).json({ message: 'Insufficient stock' });

  item.quantity = quantity;
  cart.updatedAt = new Date();
  await cart.save();
  res.json(cart);
});

// Remove item
router.delete('/items/:itemId', auth, async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });
  item.remove();
  cart.updatedAt = new Date();
  await cart.save();
  res.json(cart);
});

// Clear cart
router.delete('/', auth, async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  cart.items = [];
  cart.updatedAt = new Date();
  await cart.save();
  res.json(cart);
});

module.exports = router;
