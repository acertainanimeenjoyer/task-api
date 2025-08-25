const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');

router.get('/:room', auth, async (req, res) => {
  try {
    const { room } = req.params;
    const messages = await Message.find({ room })
      .sort({ timestamp: 1 })
      .limit(200)
      .populate('sender', 'username email');
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

module.exports = router;
