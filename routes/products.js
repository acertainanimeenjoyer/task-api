const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// list with search/filter/pagination
router.get('/', async (req, res) => {
  const {
    q,
    category, // category id
    color,
    size,
    minPrice,
    maxPrice,
    page = 1,
    limit = 12
  } = req.query;

  const filter = { active: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (color) filter['variants.color'] = color;
  if (size) filter['variants.size'] = size;
  if (minPrice || maxPrice) {
    filter['variants.price'] = {};
    if (minPrice) filter['variants.price'].$gte = Number(minPrice);
    if (maxPrice) filter['variants.price'].$lte = Number(maxPrice);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter)
  ]);

  res.json({
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    total,
    items
  });
});

// get single
router.get('/:id', async (req, res) => {
  const prod = await Product.findById(req.params.id).populate('category', 'name slug');
  if (!prod) return res.status(404).json({ message: 'Product not found' });
  res.json(prod);
});

// admin create/update/delete
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const prod = await Product.create(req.body);
    res.status(201).json(prod);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const prod = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!prod) return res.status(404).json({ message: 'Not found' });
    res.json(prod);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/:id', auth, isAdmin, async (req, res) => {
  const del = await Product.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
