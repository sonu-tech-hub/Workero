/**
 * ============================================================
 * ADVANCED AUTH MIDDLEWARE - Worker Finder v3.0.0
 * JWT verification, role checks, rate limiting per user
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// ─── Verify JWT Token ─────────────────────────────────────────
const verifyToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Access token is required. Format: Authorization: Bearer <token>');
  }

  const token = authHeader.split(' ')[1];
  if (!token) throw new ApiError(401, 'Token is missing');

  let decoded;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret_dev_only'
    );
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired. Please refresh your token.');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token. Please login again.');
    }
    throw new ApiError(401, 'Token verification failed');
  }

  // Fetch fresh user from DB
  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE id = ? AND is_active = TRUE`,
    [decoded.userId]
  );

  if (users.length === 0) {
    throw new ApiError(401, 'User not found or account deactivated');
  }

  req.user = users[0];
  req.userId = users[0].id;

  // Update last active
  promisePool.execute(
    `UPDATE users SET last_active = NOW() WHERE id = ?`, [users[0].id]
  ).catch(() => {});

  next();
});

// ─── Optional Token (doesn't fail if no token) ───────────────
const optionalToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_dev_only');
    const [users] = await promisePool.execute(
      `SELECT * FROM users WHERE id = ? AND is_active = TRUE`, [decoded.userId]
    );
    req.user = users[0] || null;
  } catch {
    req.user = null;
  }
  next();
});

// ─── Role Checks ──────────────────────────────────────────────
const isWorker = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (req.user.user_type !== 'worker') {
    throw new ApiError(403, 'This action is only available for workers');
  }
  next();
};

const isSeeker = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (req.user.user_type !== 'seeker') {
    throw new ApiError(403, 'This action is only available for seekers');
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (req.user.user_type !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  next();
};

const isVerified = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (!req.user.is_verified) {
    throw new ApiError(403, 'Please verify your account first');
  }
  next();
};

// ─── Authorize Multiple Roles ─────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  if (!roles.includes(req.user.user_type)) {
    throw new ApiError(403, `Access restricted. Required roles: ${roles.join(', ')}`);
  }
  next();
};

// ─── Resource Ownership Check ─────────────────────────────────
const isOwner = (resourceIdParam, userIdField = 'user_id', table) => {
  return asyncHandler(async (req, res, next) => {
    const resourceId = req.params[resourceIdParam];
    if (!resourceId) throw new ApiError(400, 'Resource ID required');

    const [rows] = await promisePool.execute(
      `SELECT ${userIdField} FROM ${table} WHERE id = ?`, [resourceId]
    );

    if (rows.length === 0) throw new ApiError(404, 'Resource not found');
    if (rows[0][userIdField] !== req.user.id && req.user.user_type !== 'admin') {
      throw new ApiError(403, 'You do not have permission to access this resource');
    }
    next();
  });
};

module.exports = {
  verifyToken,
  optionalToken,
  isWorker,
  isSeeker,
  isAdmin,
  isVerified,
  authorize,
  isOwner
};
