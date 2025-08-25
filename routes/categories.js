const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// public list
router.get('/', async (req, res) => {
  const cats = await Category.find().sort({ name: 1 });
  res.json(cats);
});

// admin create
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const cat = await Category.create(req.body); // {name, slug}
    res.status(201).json(cat);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
