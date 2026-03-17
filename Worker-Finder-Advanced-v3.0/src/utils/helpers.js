/**
 * ============================================================
 * UTILITIES - Advanced Worker Finder v3.0.0
 * Helpers: hashing, JWT, OTP, email, distance, commission
 * ============================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('./logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// ─── Password Helpers ─────────────────────────────────────────
const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// ─── JWT Helpers ──────────────────────────────────────────────
const generateToken = (userId, userType, extraPayload = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_super_secure_jwt_secret_change_in_production_min_32_chars') {
    logger.warn('⚠️ Using default JWT_SECRET – change in production!');
  }
  return jwt.sign(
    { userId, userType, ...extraPayload },
    secret || 'fallback_secret_dev_only',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const generateRefreshToken = (userId) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  return jwt.sign(
    { userId, type: 'refresh' },
    secret || 'fallback_refresh_secret_dev_only',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

const verifyToken = (token, isRefresh = false) => {
  const secret = isRefresh
    ? (process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_dev_only')
    : (process.env.JWT_SECRET || 'fallback_secret_dev_only');
  return jwt.verify(token, secret);
};

// ─── OTP Helpers ──────────────────────────────────────────────
const generateOTP = () => {
  // Cryptographically secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  return otp;
};

const getOTPExpiry = () => {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
  return new Date(Date.now() + minutes * 60 * 1000);
};

// ─── Referral Code ────────────────────────────────────────────
const generateReferralCode = (userId) => {
  const prefix = 'WF';
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${userId || ''}${random}`;
};

// ─── Haversine Distance ───────────────────────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

// ─── Commission Calculation ───────────────────────────────────
const calculateCommission = (amount) => {
  const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION) || 0.10;
  const trustFeeRate = parseFloat(process.env.TRUST_SAFETY_FEE) || 0.02;
  const commission = amount * commissionRate;
  const trustFee = amount * trustFeeRate;
  const workerPayout = amount - commission - trustFee;
  const gst = (commission + trustFee) * 0.18;

  return {
    total_amount: Math.round(amount * 100) / 100,
    platform_commission: Math.round(commission * 100) / 100,
    trust_safety_fee: Math.round(trustFee * 100) / 100,
    gst_18: Math.round(gst * 100) / 100,
    worker_payout: Math.round(workerPayout * 100) / 100,
    total_fees: Math.round((commission + trustFee) * 100) / 100
  };
};

// ─── Pagination Helper ────────────────────────────────────────
const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return {
    page: p,
    limit: l,
    offset: (p - 1) * l
  };
};

const paginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

// ─── Date Formatting ─────────────────────────────────────────
const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// ─── Transaction ID ───────────────────────────────────────────
const generateTransactionId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TXN${timestamp}${random}`;
};

// ─── User Sanitizer ───────────────────────────────────────────
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, refresh_token, otp, otp_expiry, otp_attempts, ...safe } = user;
  return safe;
};

// ─── Email Sender ─────────────────────────────────────────────
let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return transporter;
};

const sendOTP = async (identifier, otp, type = 'email') => {
  const subject = `🔐 Your OTP: ${otp} - Worker Finder`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #667eea;">🔨 Worker Finder - Verification</h2>
      <p>Your One-Time Password (OTP) is:</p>
      <div style="background: #f0f4ff; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 6px;">${otp}</span>
      </div>
      <p>Valid for <strong>${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong>.</p>
      <p style="color: #e74c3c; font-size: 12px;">⚠️ Do not share this OTP. Worker Finder will NEVER ask for it.</p>
    </div>
  `;

  if (type === 'email') {
    try {
      const t = getTransporter();
      await t.sendMail({
        from: `"Worker Finder" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: identifier,
        subject,
        html
      });
      logger.info('OTP email sent', { to: identifier });
      return { success: true };
    } catch (err) {
      logger.error('OTP email failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  if (type === 'sms') {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Worker Finder OTP: ${otp}. Valid ${process.env.OTP_EXPIRY_MINUTES || 10} min. Do not share.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: identifier
      });
      return { success: true };
    } catch (err) {
      logger.warn('SMS send failed, using console', { error: err.message });
      console.log(`[SMS OTP for ${identifier}]: ${otp}`);
      return { success: true, fallback: 'console' };
    }
  }

  return { success: false, error: 'Unknown OTP type' };
};

// ─── Can Review Check ─────────────────────────────────────────
const canReview = async (pool, reviewerId, revieweeId, jobId) => {
  const [job] = await pool.execute(
    `SELECT id, seeker_id, worker_id, status FROM jobs 
     WHERE id = ? AND status = 'completed'`,
    [jobId]
  );
  if (!job || job.length === 0) return false;

  const j = job[0];
  const isParticipant = j.seeker_id === reviewerId || j.worker_id === reviewerId;
  if (!isParticipant) return false;

  const [existing] = await pool.execute(
    `SELECT id FROM reviews WHERE job_id = ? AND reviewer_id = ?`,
    [jobId, reviewerId]
  );
  return existing.length === 0;
};

// ─── Update Average Rating ────────────────────────────────────
const updateAverageRating = async (pool, userId, userType) => {
  const table = userType === 'worker' ? 'worker_profiles' : 'seeker_profiles';
  const [result] = await pool.execute(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews 
     FROM reviews WHERE reviewee_id = ?`,
    [userId]
  );
  const avg = result[0]?.avg_rating || 0;
  const count = result[0]?.total_reviews || 0;
  await pool.execute(
    `UPDATE ${table} SET average_rating = ?, total_reviews = ? WHERE user_id = ?`,
    [Math.round(avg * 100) / 100, count, userId]
  );
};

// ─── Parse JSON safely ────────────────────────────────────────
const parseJSON = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// ─── Validate Email Format ────────────────────────────────────
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ─── Validate Phone Format ────────────────────────────────────
const isValidPhone = (phone) => {
  return /^[+]?[\d\s\-()]{10,15}$/.test(phone);
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  generateOTP,
  getOTPExpiry,
  generateReferralCode,
  calculateDistance,
  calculateCommission,
  paginate,
  paginationMeta,
  formatDateTime,
  generateTransactionId,
  sanitizeUser,
  sendOTP,
  canReview,
  updateAverageRating,
  parseJSON,
  isValidEmail,
  isValidPhone
};
