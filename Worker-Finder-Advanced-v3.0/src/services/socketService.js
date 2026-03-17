/**
 * ============================================================
 * SOCKET SERVICE - Advanced Worker Finder v3.0.0
 * Real-time messaging, notifications, live tracking
 * ============================================================
 */

const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.activeRooms = new Map();   // roomId -> Set of userIds
  }

  // ─── Initialize with HTTP Server ─────────────────────────
  init(httpServer) {
    const { Server } = require('socket.io');

    const allowedOrigins = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')
      : ['http://localhost:3000', 'http://localhost:5173'];

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? '*' : allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this._setupMiddleware();
    this._setupEventHandlers();

    logger.info('✅ Socket.io initialized');
    return this.io;
  }

  // ─── Auth Middleware ─────────────────────────────────────
  _setupMiddleware() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token ||
                      socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          // Allow unauthenticated connections for public rooms
          socket.userId = null;
          return next();
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userType = decoded.userType;
        next();
      } catch (err) {
        socket.userId = null;
        next(); // Allow connection, but mark as unauthenticated
      }
    });
  }

  // ─── Event Handlers ───────────────────────────────────────
  _setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      logger.debug(`Socket connected: ${socket.id}`, { userId });

      if (userId) {
        this.connectedUsers.set(userId.toString(), socket.id);
        socket.join(`user:${userId}`);
        socket.emit('connected', {
          socketId: socket.id,
          userId,
          timestamp: new Date().toISOString()
        });

        // Broadcast online status
        this.io.emit('user:online', { userId, timestamp: new Date().toISOString() });
      }

      // ── Join Room ────────────────────────────────────────
      socket.on('join:room', ({ roomId }) => {
        if (!roomId) return;
        socket.join(roomId);
        if (!this.activeRooms.has(roomId)) this.activeRooms.set(roomId, new Set());
        this.activeRooms.get(roomId).add(userId);
        logger.debug(`User ${userId} joined room ${roomId}`);
      });

      // ── Leave Room ───────────────────────────────────────
      socket.on('leave:room', ({ roomId }) => {
        socket.leave(roomId);
        if (this.activeRooms.has(roomId)) {
          this.activeRooms.get(roomId).delete(userId);
        }
      });

      // ── Send Message ─────────────────────────────────────
      socket.on('message:send', (data) => {
        const { receiverId, message, jobId } = data;
        if (!receiverId || !message) return;

        const roomId = [userId, receiverId].sort().join(':');
        this.io.to(`user:${receiverId}`).emit('message:received', {
          senderId: userId,
          receiverId,
          message,
          jobId,
          timestamp: new Date().toISOString(),
          roomId
        });
      });

      // ── Typing Indicators ─────────────────────────────────
      socket.on('typing:start', ({ receiverId }) => {
        this.io.to(`user:${receiverId}`).emit('typing:indicator', {
          userId,
          isTyping: true
        });
      });

      socket.on('typing:stop', ({ receiverId }) => {
        this.io.to(`user:${receiverId}`).emit('typing:indicator', {
          userId,
          isTyping: false
        });
      });

      // ── Location Update (Worker Tracking) ─────────────────
      socket.on('location:update', ({ jobId, latitude, longitude }) => {
        if (!jobId || !latitude || !longitude) return;
        this.io.to(`job:${jobId}`).emit('location:updated', {
          workerId: userId,
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        });
      });

      // ── Job Status Updates ────────────────────────────────
      socket.on('job:subscribe', ({ jobId }) => {
        socket.join(`job:${jobId}`);
      });

      // ── Disconnect ────────────────────────────────────────
      socket.on('disconnect', (reason) => {
        if (userId) {
          this.connectedUsers.delete(userId.toString());
          this.io.emit('user:offline', { userId, timestamp: new Date().toISOString() });
        }
        logger.debug(`Socket disconnected: ${socket.id}`, { userId, reason });
      });
    });
  }

  // ─── Emit to User ─────────────────────────────────────────
  emitToUser(userId, event, data) {
    if (!this.io || !userId) return;
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // ─── Emit to Room ─────────────────────────────────────────
  emitToRoom(roomId, event, data) {
    if (!this.io || !roomId) return;
    this.io.to(roomId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // ─── Broadcast ────────────────────────────────────────────
  broadcast(event, data) {
    if (!this.io) return;
    this.io.emit(event, { ...data, timestamp: new Date().toISOString() });
  }

  // ─── Send Notification via Socket ────────────────────────
  sendNotification(userId, notification) {
    this.emitToUser(userId, 'notification:new', notification);
  }

  // ─── Check if User Online ─────────────────────────────────
  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }

  // ─── Get Online Count ─────────────────────────────────────
  getOnlineCount() {
    return this.connectedUsers.size;
  }

  // ─── Get Stats ────────────────────────────────────────────
  getStats() {
    return {
      connected_users: this.connectedUsers.size,
      active_rooms: this.activeRooms.size,
      socket_ids: this.io ? this.io.engine.clientsCount : 0
    };
  }
}

module.exports = new SocketService();
