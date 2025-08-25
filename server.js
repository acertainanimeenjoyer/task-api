require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const taskRoutes = require('./routes/tasks');
const authRoutes = require('./routes/auth');
const messagesApi = require('./routes/messages');

const socketAuth = require('./middleware/socketAuth');
const Message = require('./models/Message');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const app = express();

// HTTP middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// REST routes
app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesApi);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
// Create HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', credentials: true }
});

// Online presence map: userId -> { username, count }
const presence = new Map();

// Rate limit helper per socket
const lastSendAt = new WeakMap(); // socket -> ms timestamp

io.use(socketAuth);

io.on('connection', (socket) => {
  const user = socket.user; // { id, username }

  // Update presence
  const current = presence.get(user.id) || { username: user.username, count: 0 };
  current.count += 1;
  presence.set(user.id, current);
  io.emit('presence:update', onlineUsers());

  // Join/leave rooms
  socket.on('joinRoom', (room) => {
    if (!room) return;
    socket.join(room);
    socket.emit('joined', { room });
  });

  socket.on('leaveRoom', (room) => {
    if (!room) return;
    socket.leave(room);
    socket.emit('left', { room });
  });

  // Typing indicator
  socket.on('typing', ({ room, isTyping }) => {
    if (!room) return;
    socket.to(room).emit('typing', { userId: user.id, username: user.username, isTyping: !!isTyping });
  });

  // Send message (with simple rate limit)
  socket.on('message:send', async ({ room, content }) => {
    if (!room || !content) return;
    const now = Date.now();
    const last = lastSendAt.get(socket) || 0;
    if (now - last < 500) return; // basic anti-spam
    lastSendAt.set(socket, now);

    try {
      const msg = await Message.create({
        content,
        sender: user.id,
        room,
        timestamp: new Date()
      });

      io.to(room).emit('message:new', {
        _id: msg._id,
        content: msg.content,
        room: msg.room,
        timestamp: msg.timestamp,
        sender: { id: user.id, username: user.username }
      });
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const cur = presence.get(user.id);
    if (cur) {
      cur.count -= 1;
      if (cur.count <= 0) presence.delete(user.id);
      else presence.set(user.id, cur);
    }
    io.emit('presence:update', onlineUsers());
  });
});

function onlineUsers() {
  return Array.from(presence.entries()).map(([userId, { username }]) => ({ userId, username }));
}

// DB + start
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => {
  console.log('MongoDB connected');
  server.listen(PORT, () => console.log(`Server + Socket.io on :${PORT}`));
})
.catch(err => console.error('Connection error:', err));
