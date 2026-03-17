/**
 * PAYMENT ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  createOrder, verifyPayment, handleWebhook, createRefund,
  getPaymentHistory, getPaymentDetails, getFeePreview
} = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validateCreateOrder, validateVerifyPayment } = require('../middleware/validation');

// Public
router.get('/fee-preview', getFeePreview);

// Razorpay Webhook (raw body needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected
router.use(verifyToken);

router.post('/create-order', paymentLimiter, validateCreateOrder, createOrder);
router.post('/verify', validateVerifyPayment, verifyPayment);
router.post('/refund', createRefund);
router.get('/history', getPaymentHistory);
router.get('/:id', getPaymentDetails);

module.exports = router;
