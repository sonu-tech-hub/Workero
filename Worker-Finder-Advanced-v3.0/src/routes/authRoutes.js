/**
 * AUTH ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, resendOTP, login, getCurrentUser,
  changePassword, refreshAccessToken, logout, forgotPassword, resetPassword
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const {
  validateRegistration, validateLogin, validateOTP, validateChangePassword
} = require('../middleware/validation');

// Public routes
router.post('/register', authLimiter, validateRegistration, register);
router.post('/verify-otp', otpLimiter, validateOTP, verifyOTP);
router.post('/resend-otp', otpLimiter, resendOTP);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh', refreshAccessToken);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', verifyToken, getCurrentUser);
router.put('/change-password', verifyToken, validateChangePassword, changePassword);
router.post('/logout', verifyToken, logout);

module.exports = router;
