const jwt = require('jsonwebtoken');

module.exports = (socket, next) => {
  try {
    // Prefer Socket.io auth payload; fallback to Authorization header
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

    if (!token) return next(new Error('Unauthorized: No token'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach minimal user info for socket handlers
    socket.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    next(new Error('Unauthorized: Invalid token'));
  }
};
