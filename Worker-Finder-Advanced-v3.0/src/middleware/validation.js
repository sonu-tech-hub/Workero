/**
 * ============================================================
 * ADVANCED VALIDATION MIDDLEWARE - Worker Finder v3.0.0
 * Input validation for all routes
 * ============================================================
 */

const { body, query, param, validationResult } = require('express-validator');

// ─── Handle Errors ────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({
        field: e.path || e.param,
        message: e.msg
      }))
    });
  }
  next();
};

// ─── Auth Validators ─────────────────────────────────────────
const validateRegistration = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('user_type').optional()
    .isIn(['worker', 'seeker']).withMessage('user_type must be worker or seeker'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('mobile').optional().isMobilePhone().withMessage('Invalid mobile number'),
  body('full_name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  handleValidationErrors
];

const validateLogin = [
  body('identifier').notEmpty().withMessage('Email or mobile is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateOTP = [
  body('identifier').notEmpty().withMessage('Identifier (email/mobile) is required'),
  body('otp').notEmpty().isLength({ min: 4, max: 8 }).withMessage('OTP must be 4-8 characters'),
  handleValidationErrors
];

const validateChangePassword = [
  body('current_password').notEmpty().withMessage('Current password required'),
  body('new_password')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain uppercase, lowercase, and a number'),
  handleValidationErrors
];

// ─── Worker Profile Validators ────────────────────────────────
const validateWorkerProfile = [
  body('full_name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('bio').optional().trim().isLength({ max: 2000 }).withMessage('Bio too long (max 2000 chars)'),
  body('profession').optional().trim().isLength({ max: 100 }).withMessage('Profession too long'),
  body('experience_years').optional().isInt({ min: 0, max: 50 }).withMessage('Experience must be 0-50 years'),
  body('hourly_rate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('city').optional().trim().isLength({ max: 100 }).withMessage('City too long'),
  body('service_radius').optional().isInt({ min: 1, max: 200 }).withMessage('Service radius must be 1-200 km'),
  handleValidationErrors
];

// ─── Seeker Profile Validators ────────────────────────────────
const validateSeekerProfile = [
  body('full_name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('bio').optional().trim().isLength({ max: 2000 }).withMessage('Bio too long'),
  body('city').optional().trim().isLength({ max: 100 }).withMessage('City too long'),
  handleValidationErrors
];

// ─── Job Validators ───────────────────────────────────────────
const validateCreateJob = [
  body('title').notEmpty().trim().isLength({ min: 5, max: 255 })
    .withMessage('Job title must be 5-255 characters'),
  body('description').optional().trim().isLength({ max: 5000 })
    .withMessage('Description too long'),
  body('budget').optional().isFloat({ min: 1 }).withMessage('Budget must be greater than 0'),
  body('category_id').optional().isInt({ min: 1 }).withMessage('Invalid category'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  handleValidationErrors
];

const validateJobStatus = [
  body('status').notEmpty()
    .isIn(['assigned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

// ─── Review Validators ────────────────────────────────────────
const validateReview = [
  body('job_id').notEmpty().isInt({ min: 1 }).withMessage('Valid job_id required'),
  body('reviewee_id').notEmpty().isInt({ min: 1 }).withMessage('Valid reviewee_id required'),
  body('rating').notEmpty().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('review_text').optional().trim().isLength({ max: 1000 }).withMessage('Review too long'),
  body('punctuality_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Must be 1-5'),
  body('quality_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Must be 1-5'),
  body('communication_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Must be 1-5'),
  handleValidationErrors
];

// ─── Message Validators ───────────────────────────────────────
const validateMessage = [
  body('receiver_id').notEmpty().isInt({ min: 1 }).withMessage('Valid receiver_id required'),
  body('message').notEmpty().trim().isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters'),
  handleValidationErrors
];

// ─── Dispute Validators ───────────────────────────────────────
const validateDispute = [
  body('job_id').notEmpty().isInt({ min: 1 }).withMessage('Valid job_id required'),
  body('against_user').notEmpty().isInt({ min: 1 }).withMessage('Valid against_user required'),
  body('reason').notEmpty().trim().isLength({ min: 10, max: 500 })
    .withMessage('Reason must be 10-500 characters'),
  body('description').optional().trim().isLength({ max: 2000 })
    .withMessage('Description too long'),
  handleValidationErrors
];

// ─── Worker Search Validators ─────────────────────────────────
const validateWorkerSearch = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('radius').optional().isFloat({ min: 1, max: 500 }).withMessage('Radius must be 1-500'),
  handleValidationErrors
];

// ─── Payment Validators ───────────────────────────────────────
const validateCreateOrder = [
  body('job_id').notEmpty().isInt({ min: 1 }).withMessage('Valid job_id required'),
  body('amount').notEmpty().isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  handleValidationErrors
];

const validateVerifyPayment = [
  body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id required'),
  body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id required'),
  body('razorpay_signature').notEmpty().withMessage('razorpay_signature required'),
  handleValidationErrors
];

// ─── Param Validators ─────────────────────────────────────────
const validateIdParam = (paramName = 'id') => [
  param(paramName)
    .customSanitizer(value => (typeof value === 'string' ? value.replace(/^:/, '') : value))
    .isInt({ min: 1 })
    .withMessage(`Invalid ${paramName}. Must be a positive integer.`),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
];

module.exports = {
  handleValidationErrors,
  validateRegistration,
  validateLogin,
  validateOTP,
  validateChangePassword,
  validateWorkerProfile,
  validateSeekerProfile,
  validateCreateJob,
  validateJobStatus,
  validateReview,
  validateMessage,
  validateDispute,
  validateWorkerSearch,
  validateCreateOrder,
  validateVerifyPayment,
  validateIdParam,
};
