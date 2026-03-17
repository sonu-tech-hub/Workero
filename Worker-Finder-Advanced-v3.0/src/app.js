/**
 * ============================================================
 * ADVANCED APP.JS - Worker Finder v3.0.0
 * Full middleware stack, all routes, Socket.io
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const xss = require('xss-clean');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const seekerRoutes = require('./routes/seekerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const referralRoutes = require('./routes/referralRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const jobRoutes = require('./routes/jobRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');

const cacheService = require('./services/cacheService');

const app = express();

// ─── Security Headers ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === 'development'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ─── Body Parsers ─────────────────────────────────────────────
// Note: payment webhook needs raw body, so we add that in the route
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next(); // Skip JSON parser for webhook
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── XSS Protection ───────────────────────────────────────────
app.use(xss());

// ─── Compression ─────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ──────────────────────────────────────────
app.use(morgan('combined', { stream: logger.stream }));

// ─── Trust Proxy (for rate limiting behind nginx) ─────────────
app.set('trust proxy', 1);

// ─── Global Rate Limiting ────────────────────────────────────
app.use('/api/', generalLimiter);

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    message: 'Worker Finder API v3.0.0 is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()) + 's',
    cache: cacheService.getStats()
  });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/seekers', seekerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);

// ─── Root Endpoint ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🔨 Worker Finder API v3.0.0 - AI-Powered Marketplace',
    version: '3.0.0',
    features: [
      '✅ AI Worker Matching',
      '✅ Razorpay Payment Gateway',
      '✅ Real-time Socket.io',
      '✅ Smart Pricing',
      '✅ Fraud Detection',
      '✅ Advanced Analytics',
      '✅ In-App Notifications',
      '✅ Performance Tiers'
    ],
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      workers: '/api/workers',
      seekers: '/api/seekers',
      jobs: '/api/jobs',
      payments: '/api/payments',
      ai: '/api/ai',
      reviews: '/api/reviews',
      messages: '/api/messages',
      disputes: '/api/disputes',
      referrals: '/api/referrals',
      categories: '/api/categories',
      admin: '/api/admin'
    }
  });
});

// ─── Not Found & Error Handlers ───────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
