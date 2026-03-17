/**
 * ============================================================
 * PAYMENT SERVICE - Razorpay Integration v3.0.0
 * Orders, Verification, Webhooks, Refunds, Payouts
 * ============================================================
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.razorpay = null;
    this.initialized = false;
    this._init();
  }

  _init() {
    try {
      const Razorpay = require('razorpay');
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret ||
          keyId === 'rzp_test_your_key_id_here' ||
          keySecret === 'your_razorpay_key_secret_here') {
        logger.warn('⚠️ Razorpay credentials not configured – running in MOCK mode');
        this.initialized = false;
        return;
      }

      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      this.initialized = true;
      logger.info('✅ Razorpay initialized successfully');
    } catch (err) {
      logger.warn('Razorpay package not found or failed to init – mock mode active', { error: err.message });
      this.initialized = false;
    }
  }

  // ─── Create Order ─────────────────────────────────────────
  async createOrder(params) {
    const { amount, currency = 'INR', receipt, notes = {} } = params;

    if (!this.initialized) {
      // Mock response for development/testing
      return this._mockOrder(amount, currency, receipt, notes);
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes,
      payment_capture: 1
    };

    try {
      const order = await this.razorpay.orders.create(options);
      logger.info('Razorpay order created', { orderId: order.id, amount });
      return {
        success: true,
        order_id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        key_id: process.env.RAZORPAY_KEY_ID
      };
    } catch (err) {
      logger.error('Razorpay order creation failed', { error: err.message });
      throw new Error(`Payment order creation failed: ${err.message}`);
    }
  }

  // ─── Verify Payment ───────────────────────────────────────
  verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    if (!this.initialized) {
      // Mock verification for dev
      return { verified: true, mock: true };
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const verified = expectedSignature === razorpaySignature;
    logger.info('Payment verification', { orderId: razorpayOrderId, verified });
    return { verified, mock: false };
  }

  // ─── Verify Webhook ───────────────────────────────────────
  verifyWebhook(rawBody, signature) {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET ||
        process.env.RAZORPAY_WEBHOOK_SECRET === 'your_webhook_secret_here') {
      return true; // Skip in dev
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    return expectedSignature === signature;
  }

  // ─── Fetch Payment Details ───────────────────────────────
  async fetchPayment(paymentId) {
    if (!this.initialized) {
      return this._mockPaymentDetails(paymentId);
    }

    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment_id: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        created_at: new Date(payment.created_at * 1000).toISOString()
      };
    } catch (err) {
      logger.error('Failed to fetch payment', { paymentId, error: err.message });
      throw new Error(`Failed to fetch payment: ${err.message}`);
    }
  }

  // ─── Create Refund ────────────────────────────────────────
  async createRefund(paymentId, amount = null, notes = {}) {
    if (!this.initialized) {
      return this._mockRefund(paymentId, amount);
    }

    const options = { notes };
    if (amount) options.amount = Math.round(amount * 100);

    try {
      const refund = await this.razorpay.payments.refund(paymentId, options);
      logger.info('Refund created', { refundId: refund.id, paymentId, amount });
      return {
        success: true,
        refund_id: refund.id,
        payment_id: paymentId,
        amount: refund.amount / 100,
        status: refund.status,
        created_at: new Date(refund.created_at * 1000).toISOString()
      };
    } catch (err) {
      logger.error('Refund creation failed', { paymentId, error: err.message });
      throw new Error(`Refund failed: ${err.message}`);
    }
  }

  // ─── Commission & Fee Calculations ───────────────────────
  calculateFees(jobAmount) {
    const commission = parseFloat(process.env.PLATFORM_COMMISSION) || 0.10;
    const trustFee = parseFloat(process.env.TRUST_SAFETY_FEE) || 0.02;

    const commissionAmount = jobAmount * commission;
    const trustFeeAmount = jobAmount * trustFee;
    const workerPayout = jobAmount - commissionAmount - trustFeeAmount;

    return {
      job_amount: Math.round(jobAmount * 100) / 100,
      platform_commission: Math.round(commissionAmount * 100) / 100,
      trust_safety_fee: Math.round(trustFeeAmount * 100) / 100,
      worker_payout: Math.round(workerPayout * 100) / 100,
      gst_18_percent: Math.round((commissionAmount + trustFeeAmount) * 0.18 * 100) / 100,
      total_deductions: Math.round((commissionAmount + trustFeeAmount) * 100) / 100,
      commission_rate: `${commission * 100}%`,
      trust_fee_rate: `${trustFee * 100}%`
    };
  }

  // ─── Mock Helpers (Development) ─────────────────────────
  _mockOrder(amount, currency, receipt, notes) {
    const orderId = `order_MOCK${Date.now()}`;
    return {
      success: true,
      order_id: orderId,
      amount: amount,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      status: 'created',
      key_id: 'rzp_test_mock_key',
      mock: true,
      message: 'Mock order – configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live payments'
    };
  }

  _mockRefund(paymentId, amount) {
    return {
      success: true,
      refund_id: `rfnd_MOCK${Date.now()}`,
      payment_id: paymentId,
      amount: amount || 0,
      status: 'processed',
      mock: true
    };
  }

  _mockPaymentDetails(paymentId) {
    return {
      success: true,
      payment_id: paymentId,
      amount: 0,
      currency: 'INR',
      status: 'captured',
      method: 'mock',
      mock: true
    };
  }
}

module.exports = new PaymentService();
