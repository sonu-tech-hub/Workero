/**
 * ============================================================
 * ADVANCED AUTH CONTROLLER - Worker Finder v3.0.0
 * Register, OTP, Login, Refresh, 2FA, Account Security
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  hashPassword, comparePassword, generateToken, generateRefreshToken,
  generateOTP, getOTPExpiry, sendOTP, sanitizeUser, generateReferralCode,
  isValidEmail
} = require('../utils/helpers');
const notificationService = require('../services/notificationService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// ─── Register ─────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { email, mobile, password, user_type = 'seeker', full_name, referral_code } = req.body;

  if (!email && !mobile) throw new ApiError(400, 'Email or mobile is required');
  if (!password) throw new ApiError(400, 'Password is required');
  if (!['worker', 'seeker'].includes(user_type)) throw new ApiError(400, 'Invalid user type');

  if (email && !isValidEmail(email)) throw new ApiError(400, 'Invalid email format');

  // AI Fraud Detection
  const fraudCheck = aiService.detectFraud({
    action: 'register',
    metadata: { disposableEmail: false }
  });
  if (fraudCheck.shouldBlock) {
    throw new ApiError(429, 'Registration blocked due to suspicious activity');
  }

  // Check existing user
  const [existing] = await promisePool.execute(
    `SELECT id FROM users WHERE email = ? OR mobile = ?`,
    [email || null, mobile || null]
  );
  if (existing.length > 0) throw new ApiError(409, 'User already exists with this email or mobile');

  const hashed = await hashPassword(password);
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry();

  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO users (email, mobile, password, user_type, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [email || null, mobile || null, hashed, user_type]
    );
    const userId = result.insertId;

    // Update user with OTP details
    await conn.execute(
      `UPDATE users SET otp = ?, otp_expiry = ?, otp_attempts = 0 WHERE id = ?`,
      [otp, otpExpiry, userId]
    );

    // Create profile
    const referralCode = generateReferralCode(userId);
    if (user_type === 'worker') {
      await conn.execute(
        `INSERT INTO worker_profiles (user_id, full_name, referral_code) VALUES (?, ?, ?)`,
        [userId, full_name || '', referralCode]
      );
    } else {
      await conn.execute(
        `INSERT INTO seeker_profiles (user_id, full_name, referral_code) VALUES (?, ?, ?)`,
        [userId, full_name || '', referralCode]
      );
    }

    // Handle referral
    if (referral_code) {
      const [refWorker] = await conn.execute(
        `SELECT user_id FROM worker_profiles WHERE referral_code = ?`, [referral_code]
      );
      const [refSeeker] = refWorker.length === 0
        ? await conn.execute(`SELECT user_id FROM seeker_profiles WHERE referral_code = ?`, [referral_code])
        : [[{ user_id: refWorker[0]?.user_id }]];

      const referrerId = refWorker.length > 0 ? refWorker[0].user_id : (refSeeker[0]?.user_id || null);
      if (referrerId) {
        await conn.execute(
          `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, bonus_amount, status)
           VALUES (?, ?, ?, ?, 'completed')`,
          [referrerId, userId, referral_code, process.env.REFERRAL_BONUS || 100]
        );
      }
    }

    await conn.commit();

    // Send OTP
    const identifier = email || mobile;
    const otpType = email ? 'email' : 'sms';
    await sendOTP(identifier, otp, otpType);

    logger.info('User registered', { userId, userType: user_type, email });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your account with the OTP.',
      data: {
        user_id: userId,
        email,
        mobile,
        user_type,
        otp_sent_to: identifier,
        // Only include OTP in dev mode
        ...(process.env.NODE_ENV === 'development' ? { otp_dev_only: otp } : {})
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Verify OTP ───────────────────────────────────────────────
const verifyOTP = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body;
  if (!identifier || !otp) throw new ApiError(400, 'Identifier and OTP are required');

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE (email = ? OR mobile = ?) AND is_active = TRUE`,
    [identifier, identifier]
  );
  if (users.length === 0) throw new ApiError(404, 'User not found');

  const user = users[0];

  if (user.otp_attempts >= 5) {
    throw new ApiError(429, 'Too many OTP attempts. Please request a new OTP.');
  }

  if (user.otp !== otp) {
    await promisePool.execute(
      `UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?`, [user.id]
    );
    throw new ApiError(400, 'Invalid OTP');
  }

  const now = new Date();
  if (new Date(user.otp_expiry) < now) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  const accessToken = generateToken(user.id, user.user_type);
  const refreshToken = generateRefreshToken(user.id);

  await promisePool.execute(
    `UPDATE users SET is_verified = TRUE, is_email_verified = TRUE, otp = NULL,
     otp_expiry = NULL, otp_attempts = 0, refresh_token = ?, last_login = NOW()
     WHERE id = ?`,
    [refreshToken, user.id]
  );

  logger.info('OTP verified', { userId: user.id });

  res.json({
    success: true,
    message: 'Account verified successfully!',
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_EXPIRES_IN || '24h',
      user: sanitizeUser(user)
    }
  });
});

// ─── Resend OTP ───────────────────────────────────────────────
const resendOTP = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) throw new ApiError(400, 'Identifier is required');

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE (email = ? OR mobile = ?) AND is_active = TRUE`,
    [identifier, identifier]
  );
  if (users.length === 0) throw new ApiError(404, 'User not found');

  const user = users[0];
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry();

  await promisePool.execute(
    `UPDATE users SET otp = ?, otp_expiry = ?, otp_attempts = 0, updated_at = NOW() WHERE id = ?`,
    [otp, otpExpiry, user.id]
  );

  const otpType = user.email === identifier ? 'email' : 'sms';
  await sendOTP(identifier, otp, otpType);

  res.json({
    success: true,
    message: 'OTP resent successfully.',
    ...(process.env.NODE_ENV === 'development' ? { otp_dev_only: otp } : {})
  });
});

// ─── Login ────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) throw new ApiError(400, 'Identifier and password required');
  const identifierNormalized = String(identifier).trim();
  const mobileDigits = identifierNormalized.replace(/\D/g, '');
  const mobileLast10 = mobileDigits.slice(-10);

  const [users] = await promisePool.execute(
    `SELECT * FROM users
     WHERE is_active = TRUE AND (
       LOWER(email) = LOWER(?)
       OR mobile = ?
       OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mobile, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '') = ?
       OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mobile, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), 10) = ?
     )
     LIMIT 1`,
    [identifierNormalized, identifierNormalized, mobileDigits, mobileLast10]
  );
  if (users.length === 0) throw new ApiError(401, 'Invalid credentials');

  const user = users[0];

  // Account lock check
  if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
    const unlockTime = new Date(user.account_locked_until).toLocaleString();
    throw new ApiError(423, `Account locked until ${unlockTime}. Too many failed attempts.`);
  }

  let isMatch = await comparePassword(password, user.password);
  let usedLegacyPassword = false;

  // Compatibility fallback for older DBs that may contain non-bcrypt passwords.
  if (!isMatch && user.password) {
    const crypto = require('crypto');
    const raw = String(password);
    const stored = String(user.password);
    const md5 = crypto.createHash('md5').update(raw).digest('hex');
    const sha1 = crypto.createHash('sha1').update(raw).digest('hex');
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

    if (stored === raw || stored === md5 || stored === sha1 || stored === sha256) {
      isMatch = true;
      usedLegacyPassword = true;
    }
  }
  if (!isMatch) {
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    let lockUntil = null;

    if (newAttempts >= maxAttempts) {
      const lockDuration = parseInt(process.env.LOCK_DURATION_MINUTES) || 30;
      lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);
    }

    await promisePool.execute(
      `UPDATE users SET failed_login_attempts = ?, account_locked_until = ?, last_login_attempt = NOW() WHERE id = ?`,
      [newAttempts, lockUntil, user.id]
    );

    if (lockUntil) throw new ApiError(423, 'Account locked due to too many failed attempts');
    throw new ApiError(401, `Invalid credentials. ${maxAttempts - newAttempts} attempts remaining.`);
  }

  if (!user.is_verified) {
    throw new ApiError(403, 'Please verify your account first. Check your email/SMS for OTP.');
  }

  // Auto-upgrade legacy password formats to bcrypt after successful login.
  if (usedLegacyPassword) {
    const hashed = await hashPassword(password);
    await promisePool.execute(
      `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashed, user.id]
    );
  }

  // Get profile
  const profileTable = user.user_type === 'worker' ? 'worker_profiles' : 'seeker_profiles';
  const [profiles] = await promisePool.execute(
    `SELECT * FROM ${profileTable} WHERE user_id = ?`, [user.id]
  );

  const accessToken = generateToken(user.id, user.user_type);
  const refreshToken = generateRefreshToken(user.id);

  await promisePool.execute(
    `UPDATE users SET refresh_token = ?, failed_login_attempts = 0, 
     account_locked_until = NULL, last_login = NOW() WHERE id = ?`,
    [refreshToken, user.id]
  );

  logger.info('User logged in', { userId: user.id, userType: user.user_type });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_EXPIRES_IN || '24h',
      user: {
        ...sanitizeUser(user),
        profile: profiles[0] || null
      }
    }
  });
});

// ─── Get Current User ─────────────────────────────────────────
const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.user_type;

  const profileTable = userType === 'worker' ? 'worker_profiles' : 'seeker_profiles';
  const [profiles] = await promisePool.execute(
    `SELECT * FROM ${profileTable} WHERE user_id = ?`, [userId]
  );

  const [notifications] = await promisePool.execute(
    `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = FALSE`, [userId]
  );

  res.json({
    success: true,
    data: {
      user: sanitizeUser(req.user),
      profile: profiles[0] || null,
      unread_notifications: notifications[0]?.unread || 0
    }
  });
});

// ─── Change Password ─────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    throw new ApiError(400, 'Current and new password required');
  }
  if (new_password.length < 8) throw new ApiError(400, 'New password must be at least 8 characters');

  const isMatch = await comparePassword(current_password, req.user.password);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  const hashed = await hashPassword(new_password);
  await promisePool.execute(
    `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
    [hashed, req.user.id]
  );

  logger.info('Password changed', { userId: req.user.id });

  res.json({ success: true, message: 'Password changed successfully' });
});

// ─── Refresh Access Token ─────────────────────────────────────
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) throw new ApiError(400, 'Refresh token required');

  let decoded;
  try {
    const jwt = require('jsonwebtoken');
    decoded = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_dev_only'
    );
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE id = ? AND refresh_token = ? AND is_active = TRUE`,
    [decoded.userId, refresh_token]
  );
  if (users.length === 0) throw new ApiError(401, 'Refresh token is invalid or revoked');

  const user = users[0];
  const newAccessToken = generateToken(user.id, user.user_type);
  const newRefreshToken = generateRefreshToken(user.id);

  await promisePool.execute(
    `UPDATE users SET refresh_token = ? WHERE id = ?`, [newRefreshToken, user.id]
  );

  res.json({
    success: true,
    data: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: process.env.JWT_EXPIRES_IN || '24h'
    }
  });
});

// ─── Logout ───────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  // Safely handle logout even if req.user is somehow not present
  if (req.user && req.user.id) {
    await promisePool.execute(
      `UPDATE users SET refresh_token = NULL, last_active = NOW() WHERE id = ?`,
      [req.user.id]
    );
    logger.info('User logged out', { userId: req.user.id });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─── Forgot Password ─────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) throw new ApiError(400, 'Email or mobile required');

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE (email = ? OR mobile = ?) AND is_active = TRUE`,
    [identifier, identifier]
  );

  // Always return success (don't reveal if user exists)
  if (users.length === 0) {
    return res.json({ success: true, message: 'If account exists, OTP will be sent.' });
  }

  const user = users[0];
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry();

  await promisePool.execute(
    `UPDATE users SET otp = ?, otp_expiry = ?, otp_attempts = 0 WHERE id = ?`,
    [otp, otpExpiry, user.id]
  );

  const otpType = user.email === identifier ? 'email' : 'sms';
  await sendOTP(identifier, otp, otpType);

  res.json({
    success: true,
    message: 'OTP sent to your registered email/mobile.',
    ...(process.env.NODE_ENV === 'development' ? { otp_dev_only: otp } : {})
  });
});

// ─── Reset Password ───────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { identifier, otp, new_password } = req.body;
  if (!identifier || !otp || !new_password) {
    throw new ApiError(400, 'Identifier, OTP and new password are required');
  }
  if (new_password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE (email = ? OR mobile = ?) AND is_active = TRUE`,
    [identifier, identifier]
  );
  if (users.length === 0) throw new ApiError(404, 'User not found');

  const user = users[0];
  if (user.otp !== otp) throw new ApiError(400, 'Invalid OTP');
  if (new Date(user.otp_expiry) < new Date()) throw new ApiError(400, 'OTP has expired');

  const hashed = await hashPassword(new_password);
  await promisePool.execute(
    `UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL, 
     failed_login_attempts = 0, account_locked_until = NULL WHERE id = ?`,
    [hashed, user.id]
  );

  res.json({ success: true, message: 'Password reset successfully. You can now login.' });
});

module.exports = {
  register, verifyOTP, resendOTP, login, getCurrentUser,
  changePassword, refreshAccessToken, logout, forgotPassword, resetPassword
};
