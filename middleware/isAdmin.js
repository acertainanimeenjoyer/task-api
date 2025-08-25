const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('isAdmin');
    if (!me?.isAdmin) return res.status(403).json({ message: 'Admin only' });
    next();
  } catch (e) {
    res.status(500).json({ message: 'Admin check failed' });
  }
};
