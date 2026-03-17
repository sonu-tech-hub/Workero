/**
 * ============================================================
 * PAYMENT CONTROLLER - Razorpay Integration v3.0.0
 * Create orders, verify payments, refunds, history
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');
const socketService = require('../services/socketService');
const { calculateCommission, generateTransactionId } = require('../utils/helpers');
const logger = require('../utils/logger');
let paymentSchemaCache = null;

const getPaymentSchema = async () => {
  if (paymentSchemaCache) return paymentSchemaCache;
  const [rows] = await promisePool.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'`
  );
  const cols = rows.map((r) => r.COLUMN_NAME);
  const statusType = rows.find((r) => r.COLUMN_NAME === 'status')?.COLUMN_TYPE || '';
  paymentSchemaCache = { cols: new Set(cols), statusType };
  return paymentSchemaCache;
};

const hasCol = (schema, col) => schema.cols.has(col);
const pickStatus = (schema, preferred, fallback) =>
  schema.statusType.includes(`'${preferred}'`) ? preferred : fallback;

// ─── Create Payment Order ─────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { job_id, amount } = req.body;

  if (!job_id || !amount) throw new ApiError(400, 'job_id and amount are required');
  if (amount <= 0) throw new ApiError(400, 'Amount must be greater than 0');

  const [jobs] = await promisePool.execute(
    `SELECT j.*, sp.full_name as seeker_name, u.email as seeker_email
     FROM jobs j
     LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
     LEFT JOIN users u ON u.id = j.seeker_id
     WHERE j.id = ?`,
    [job_id]
  );
  if (jobs.length === 0) throw new ApiError(404, 'Job not found');

  const job = jobs[0];
  if (job.seeker_id !== req.user.id) throw new ApiError(403, 'You can only pay for your own jobs');
  if (job.payment_status === 'paid') throw new ApiError(400, 'Job is already paid');
  if (!['assigned', 'in_progress', 'completed'].includes(job.status)) {
    throw new ApiError(400, 'Job must be assigned or completed to make payment');
  }

  const fees = calculateCommission(parseFloat(amount));
  const receipt = `job_${job_id}_${Date.now()}`;
  const notes = {
    job_id: job_id.toString(),
    seeker_id: req.user.id.toString(),
    worker_id: job.worker_id?.toString() || '',
    job_title: job.title
  };

  const order = await paymentService.createOrder({
    amount: parseFloat(amount),
    currency: 'INR',
    receipt,
    notes
  });

  const schema = await getPaymentSchema();
  const createdStatus = pickStatus(schema, 'created', 'pending');

  // Save order to payments table (supports current + legacy schemas)
  if (hasCol(schema, 'razorpay_order_id')) {
    await promisePool.execute(
      `INSERT INTO payments (job_id, payer_id, payee_id, amount, razorpay_order_id, status, platform_fee, worker_payout, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_id, req.user.id, job.worker_id || req.user.id,
        amount, order.order_id, createdStatus,
        fees.platform_commission + fees.trust_safety_fee,
        fees.worker_payout,
        JSON.stringify(notes)
      ]
    );
  } else {
    await promisePool.execute(
      `INSERT INTO payments (job_id, payer_id, payee_id, amount, commission_amount, trust_fee, net_amount, status, transaction_id, payment_gateway_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_id, req.user.id, job.worker_id || req.user.id,
        amount,
        fees.platform_commission,
        fees.trust_safety_fee,
        fees.worker_payout,
        createdStatus,
        order.order_id,
        JSON.stringify({ order_id: order.order_id, notes })
      ]
    );
  }

  // Update job with order ID
  try {
    await promisePool.execute(
      `UPDATE jobs SET razorpay_order_id = ? WHERE id = ?`,
      [order.order_id, job_id]
    );
  } catch (err) {
    if (!(err && err.code === 'ER_BAD_FIELD_ERROR')) throw err;
    await promisePool.execute(
      `UPDATE jobs SET payment_id = ? WHERE id = ?`,
      [order.order_id, job_id]
    );
  }

  logger.info('Payment order created', { jobId: job_id, amount, orderId: order.order_id });

  res.status(201).json({
    success: true,
    message: 'Payment order created successfully',
    data: {
      ...order,
      fees,
      job_title: job.title
    }
  });
});

// ─── Verify Payment ───────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature, job_id
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, 'razorpay_order_id, razorpay_payment_id, razorpay_signature required');
  }

  // Verify signature
  const { verified } = paymentService.verifyPayment(
    razorpay_order_id, razorpay_payment_id, razorpay_signature
  );

  if (!verified) throw new ApiError(400, 'Payment verification failed – invalid signature');

  const schema = await getPaymentSchema();
  const paidStatus = pickStatus(schema, 'captured', 'completed');

  // Fetch payment record
  let payments;
  if (hasCol(schema, 'razorpay_order_id')) {
    [payments] = await promisePool.execute(
      `SELECT * FROM payments WHERE razorpay_order_id = ?`,
      [razorpay_order_id]
    );
  } else {
    [payments] = await promisePool.execute(
      `SELECT * FROM payments WHERE transaction_id = ?`,
      [razorpay_order_id]
    );
  }
  if (payments.length === 0) throw new ApiError(404, 'Payment record not found');

  const payment = payments[0];
  const fees = calculateCommission(parseFloat(payment.amount));
  const gstAmount = fees.gst_18;

  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();

    // Update payment record (supports current + legacy schemas)
    if (hasCol(schema, 'razorpay_order_id')) {
      await conn.execute(
        `UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?,
         status = ?, gst_amount = ?, updated_at = NOW()
         WHERE razorpay_order_id = ?`,
        [razorpay_payment_id, razorpay_signature, paidStatus, gstAmount, razorpay_order_id]
      );
    } else {
      await conn.execute(
        `UPDATE payments SET status = ?, transaction_id = ?, payment_gateway_response = ?, updated_at = NOW()
         WHERE transaction_id = ?`,
        [
          paidStatus,
          razorpay_payment_id,
          JSON.stringify({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature
          }),
          razorpay_order_id
        ]
      );
    }

    // Update job payment status
    const targetJobId = job_id || payment.job_id;

    await conn.execute(
      `UPDATE jobs SET payment_status = 'paid', razorpay_payment_id = ?,
       final_amount = ?, platform_commission = ?, trust_safety_fee = ?,
       worker_payout = ?, updated_at = NOW() WHERE id = ?`,
      [
        razorpay_payment_id, payment.amount,
        fees.platform_commission, fees.trust_safety_fee,
        fees.worker_payout, targetJobId
      ]
    );

    // Update worker earnings
    if (payment.payee_id) {
      await conn.execute(
        `UPDATE worker_profiles SET total_earnings = total_earnings + ? WHERE user_id = ?`,
        [fees.worker_payout, payment.payee_id]
      );
    }

    // Update seeker spending
    await conn.execute(
      `UPDATE seeker_profiles SET total_spent = total_spent + ? WHERE user_id = ?`,
      [payment.amount, payment.payer_id]
    );

    await conn.commit();

    // Notifications
    if (payment.payee_id) {
      await notificationService.saveNotification(promisePool, payment.payee_id, 'payment_received', {
        amount: fees.worker_payout, jobTitle: 'Your job'
      });
      socketService.emitToUser(payment.payee_id, 'payment:received', {
        amount: fees.worker_payout,
        payment_id: razorpay_payment_id
      });
    }

    logger.info('Payment verified', { jobId: targetJobId, paymentId: razorpay_payment_id });

    res.json({
      success: true,
      message: 'Payment verified and processed successfully!',
      data: {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: payment.amount,
        fees,
        status: paidStatus,
        transaction_id: generateTransactionId()
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Razorpay Webhook ─────────────────────────────────────────
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = JSON.stringify(req.body);

  const isValid = paymentService.verifyWebhook(rawBody, signature);
  if (!isValid) {
    logger.warn('Invalid webhook signature');
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const { event, payload } = req.body;
  logger.info('Razorpay webhook received', { event });

  try {
    switch (event) {
      case 'payment.captured':
        {
          const payment = payload?.payment?.entity;
          if (payment) {
            await promisePool.execute(
              `UPDATE payments SET status = 'captured', updated_at = NOW()
               WHERE razorpay_payment_id = ?`,
              [payment.id]
            );
          }
        }
        break;

      case 'payment.failed':
        {
          const payment = payload?.payment?.entity;
          if (payment) {
            await promisePool.execute(
              `UPDATE payments SET status = 'failed', updated_at = NOW()
               WHERE razorpay_order_id = ?`,
              [payment.order_id]
            );
            // Notify user
            const [pmt] = await promisePool.execute(
              `SELECT payer_id, amount FROM payments WHERE razorpay_order_id = ?`,
              [payment.order_id]
            );
            if (pmt.length > 0) {
              await notificationService.saveNotification(
                promisePool, pmt[0].payer_id, 'payment_failed',
                { amount: pmt[0].amount }
              );
            }
          }
        }
        break;

      case 'refund.processed':
        {
          const refund = payload?.refund?.entity;
          if (refund) {
            await promisePool.execute(
              `UPDATE payments SET status = 'refunded', refund_amount = ?,
               refund_id = ?, updated_at = NOW()
               WHERE razorpay_payment_id = ?`,
              [refund.amount / 100, refund.id, refund.payment_id]
            );
          }
        }
        break;
    }
  } catch (err) {
    logger.error('Webhook processing error', { event, error: err.message });
  }

  res.json({ success: true, message: 'Webhook processed' });
});

// ─── Create Refund ────────────────────────────────────────────
const createRefund = asyncHandler(async (req, res) => {
  const { payment_id, reason, amount } = req.body;
  if (!payment_id) throw new ApiError(400, 'payment_id required');

  const [payments] = await promisePool.execute(
    `SELECT p.*, j.seeker_id, j.worker_id, j.title
     FROM payments p
     JOIN jobs j ON j.id = p.job_id
     WHERE p.id = ?`,
    [payment_id]
  );
  if (payments.length === 0) throw new ApiError(404, 'Payment not found');

  const payment = payments[0];
  if (payment.payer_id !== req.user.id && req.user.user_type !== 'admin') {
    throw new ApiError(403, 'Not authorized to refund this payment');
  }
  if (payment.status === 'refunded') throw new ApiError(400, 'Payment already refunded');
  if (!payment.razorpay_payment_id) throw new ApiError(400, 'No Razorpay payment ID found');

  const refund = await paymentService.createRefund(
    payment.razorpay_payment_id, amount, { reason: reason || 'Customer request' }
  );

  await promisePool.execute(
    `UPDATE payments SET status = 'refunded', refund_amount = ?,
     refund_id = ?, refund_reason = ?, updated_at = NOW() WHERE id = ?`,
    [refund.amount, refund.refund_id, reason || 'Customer request', payment_id]
  );

  await promisePool.execute(
    `UPDATE jobs SET payment_status = 'refunded' WHERE id = ?`, [payment.job_id]
  );

  logger.info('Refund processed', { paymentId: payment_id, refundId: refund.refund_id });

  res.json({
    success: true,
    message: 'Refund processed successfully',
    data: refund
  });
});

// ─── Payment History ─────────────────────────────────────────
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user.id;

  let whereClause = `WHERE (p.payer_id = ? OR p.payee_id = ?)`;
  const params = [userId, userId];

  if (status) {
    whereClause += ` AND p.status = ?`;
    params.push(status);
  }

  const [payments] = await promisePool.execute(
    `SELECT p.*, j.title as job_title, j.status as job_status,
     sp.full_name as seeker_name, wp.full_name as worker_name
     FROM payments p
     LEFT JOIN jobs j ON j.id = p.job_id
     LEFT JOIN seeker_profiles sp ON sp.user_id = p.payer_id
     LEFT JOIN worker_profiles wp ON wp.user_id = p.payee_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
    params
  );

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        total, page: parseInt(page), limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

// ─── Get Payment Details ──────────────────────────────────────
const getPaymentDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [payments] = await promisePool.execute(
    `SELECT p.*, j.title as job_title, j.status as job_status,
     sp.full_name as seeker_name, wp.full_name as worker_name
     FROM payments p
     LEFT JOIN jobs j ON j.id = p.job_id
     LEFT JOIN seeker_profiles sp ON sp.user_id = p.payer_id
     LEFT JOIN worker_profiles wp ON wp.user_id = p.payee_id
     WHERE p.id = ? AND (p.payer_id = ? OR p.payee_id = ? OR ? = 'admin')`,
    [id, req.user.id, req.user.id, req.user.user_type]
  );
  if (payments.length === 0) throw new ApiError(404, 'Payment not found');

  res.json({ success: true, data: payments[0] });
});

// ─── Get Fee Preview ─────────────────────────────────────────
const getFeePreview = asyncHandler(async (req, res) => {
  const { amount } = req.query;
  if (!amount || isNaN(amount)) throw new ApiError(400, 'Valid amount is required');

  const fees = calculateCommission(parseFloat(amount));

  res.json({
    success: true,
    data: {
      ...fees,
      breakdown: {
        'Job Amount': `₹${fees.total_amount}`,
        'Platform Commission (10%)': `₹${fees.platform_commission}`,
        'Trust & Safety Fee (2%)': `₹${fees.trust_safety_fee}`,
        'GST on Fees (18%)': `₹${fees.gst_18}`,
        'Worker Receives': `₹${fees.worker_payout}`
      }
    }
  });
});

module.exports = {
  createOrder, verifyPayment, handleWebhook, createRefund,
  getPaymentHistory, getPaymentDetails, getFeePreview
};

