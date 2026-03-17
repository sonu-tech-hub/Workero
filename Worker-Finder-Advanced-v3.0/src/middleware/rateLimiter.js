/**
 * ============================================================
 * ADVANCED RATE LIMITING - Worker Finder v3.0.0
 * Per-route, per-IP, per-user rate limiting
 * ============================================================
 */

const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

// ─── General API Limiter ─────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: isDevelopment ? 5000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // unread-count is polled by clients; avoid penalizing active sessions
    return req.path === '/messages/unread-count';
  },
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.',
    retry_after: '15 minutes'
  }
});

// ─── Auth Rate Limiter (Strict) ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 200 : (parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many auth requests. Please wait 15 minutes.',
    retry_after: '15 minutes'
  }
});

// ─── OTP Rate Limiter ─────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 1 hour.',
    retry_after: '1 hour'
  }
});

// ─── Payment Rate Limiter ────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests. Please wait 5 minutes.',
    retry_after: '5 minutes'
  }
});

// ─── Search Rate Limiter ──────────────────────────────────────
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests. Please slow down.',
    retry_after: '1 minute'
  }
});

// ─── Upload Rate Limiter ──────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many upload requests. Please wait.',
    retry_after: '1 hour'
  }
});

module.exports = {
  generalLimiter, authLimiter, otpLimiter,
  paymentLimiter, searchLimiter, uploadLimiter
};
