/**
 * ============================================================
 * ADMIN CONTROLLER - Advanced Worker Finder v3.0.0
 * Full admin dashboard, user mgmt, analytics, reports
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const cacheService = require('../services/cacheService');
const notificationService = require('../services/notificationService');
const { paginate, paginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Dashboard Stats ──────────────────────────────────────────
const getDashboardStats = asyncHandler(async (req, res) => {
  const cacheKey = cacheService.keys.adminStats();
  const cached = cacheService.getShort(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [[userStats]] = await promisePool.execute(`
    SELECT 
      COUNT(*) as total_users,
      SUM(CASE WHEN user_type = 'worker' THEN 1 ELSE 0 END) as total_workers,
      SUM(CASE WHEN user_type = 'seeker' THEN 1 ELSE 0 END) as total_seekers,
      SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified_users,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as new_this_week
    FROM users WHERE user_type != 'admin'
  `);

  const [[jobStats]] = await promisePool.execute(`
    SELECT
      COUNT(*) as total_jobs,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_jobs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
      SUM(CASE WHEN status = 'disputed' THEN 1 ELSE 0 END) as disputed_jobs,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as jobs_today,
      AVG(final_amount) as avg_job_value
    FROM jobs
  `);

  let revenueStats;
  try {
    [[revenueStats]] = await promisePool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'captured' THEN platform_fee ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'captured' AND MONTH(created_at) = MONTH(CURDATE())
                     AND YEAR(created_at) = YEAR(CURDATE()) THEN platform_fee ELSE 0 END), 0) as monthly_revenue,
        COALESCE(SUM(CASE WHEN status = 'captured' AND DATE(created_at) = CURDATE()
                     THEN platform_fee ELSE 0 END), 0) as today_revenue,
        COUNT(CASE WHEN status = 'captured' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
      FROM payments
    `);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('platform_fee')) {
      logger.warn('Admin dashboard revenue query failed, likely due to old schema. Falling back to safe query.', { error: err.message });
      // Fallback for older schemas that don't have platform_fee column
      [[revenueStats]] = await promisePool.execute(`
        SELECT
          0 as total_revenue,
          0 as monthly_revenue,
          0 as today_revenue,
          COUNT(CASE WHEN status = 'captured' THEN 1 END) as successful_payments,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
        FROM payments
      `);
    } else {
      throw err;
    }
  }

  const [[disputeStats]] = await promisePool.execute(`
    SELECT
      COUNT(*) as total_disputes,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_disputes,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_disputes
    FROM disputes
  `);

  // Recent activity
  const [recentJobs] = await promisePool.execute(`
    SELECT j.id, j.title, j.status, j.created_at,
    sp.full_name as seeker_name, wp.full_name as worker_name
    FROM jobs j
    LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
    ORDER BY j.created_at DESC LIMIT 5
  `);

  const [recentUsers] = await promisePool.execute(`
    SELECT u.id, u.email, u.mobile, u.user_type, u.created_at,
    COALESCE(wp.full_name, sp.full_name) as full_name
    FROM users u
    LEFT JOIN worker_profiles wp ON wp.user_id = u.id
    LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
    WHERE u.user_type != 'admin'
    ORDER BY u.created_at DESC LIMIT 5
  `);

  const data = {
    users: userStats,
    jobs: jobStats,
    revenue: revenueStats,
    disputes: disputeStats,
    recent_jobs: recentJobs,
    recent_users: recentUsers,
    cache_stats: cacheService.getStats(),
    timestamp: new Date().toISOString()
  };

  cacheService.setShort(cacheKey, data, 60);

  res.json({ success: true, data });
});

// ─── Get All Users ────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, user_type, is_verified, search, sort = 'created_at', order = 'DESC' } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = `WHERE u.user_type != 'admin'`;
  const params = [];

  if (user_type) { where += ` AND u.user_type = ?`; params.push(user_type); }
  if (is_verified !== undefined) { where += ` AND u.is_verified = ?`; params.push(is_verified === 'true'); }
  if (search) {
    where += ` AND (u.email LIKE ? OR u.mobile LIKE ? OR COALESCE(wp.full_name, sp.full_name) LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const validSorts = ['created_at', 'last_login', 'email'];
  const sortCol = validSorts.includes(sort) ? `u.${sort}` : 'u.created_at';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

  let users;
  try {
    [users] = await promisePool.execute(
      `SELECT u.id, u.email, u.mobile, u.user_type, u.is_verified, u.is_active,
       u.created_at, u.last_login,
       COALESCE(wp.full_name, sp.full_name) as full_name,
       COALESCE(wp.average_rating, 0) as rating,
       COALESCE(wp.total_jobs, sp.total_jobs_posted, 0) as total_jobs,
       COALESCE(wp.ai_performance_tier, 'N/A') as tier
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
       ${where}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, l, offset]
    );
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && (err.message.includes('total_jobs') || err.message.includes('ai_performance_tier'))) {
      logger.warn('getAllUsers query failed due to old schema, falling back to safe query.', { error: err.message });
      [users] = await promisePool.execute(
        `SELECT u.id, u.email, u.mobile, u.user_type, u.is_verified, u.is_active,
         u.created_at, u.last_login,
         COALESCE(wp.full_name, sp.full_name) as full_name,
         COALESCE(wp.average_rating, 0) as rating,
         0 as total_jobs,
         'N/A' as tier
         FROM users u
         LEFT JOIN worker_profiles wp ON wp.user_id = u.id
         LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
         ${where}
         ORDER BY ${sortCol} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );
    } else { throw err; }
  }

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM users u
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
     ${where}`,
    params
  );

  res.json({
    success: true,
    data: { users, pagination: paginationMeta(total, parseInt(page), l) }
  });
});

// ─── Toggle User Active ───────────────────────────────────────
const toggleUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { is_active, reason } = req.body;

  if (is_active === undefined) {
    throw new ApiError(400, 'The "is_active" field (true or false) is required.');
  }

  const [users] = await promisePool.execute(
    `SELECT * FROM users WHERE id = ?`, [userId]
  );
  if (users.length === 0) throw new ApiError(404, 'User not found');
  if (users[0].user_type === 'admin') throw new ApiError(403, 'Cannot modify admin account');

  await promisePool.execute(
    `UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
    [Boolean(is_active), userId]
  );

  // Log the action
  await promisePool.execute(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [req.user.id, is_active ? 'user_activated' : 'user_deactivated', userId,
     JSON.stringify({ is_active, reason }), req.ip]
  );

  logger.info('Admin toggled user status', { adminId: req.user.id, targetUserId: userId, is_active });

  res.json({
    success: true,
    message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
  });
});

// ─── Get Analytics ────────────────────────────────────────────
const getAnalytics = asyncHandler(async (req, res) => {
  const { period = '30' } = req.query;
  const days = Math.min(365, Math.max(1, parseInt(period)));

  let dailyJobs = [];
  try {
    [dailyJobs] = await promisePool.execute(`
      SELECT DATE(created_at) as date, COUNT(*) as jobs_created,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as jobs_completed,
      AVG(final_amount) as avg_value
      FROM jobs
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      logger.warn('Analytics dailyJobs query failed, likely due to old schema.', { error: err.message });
    } else { throw err; }
  }

  let dailyRevenue = [];
  try {
    [dailyRevenue] = await promisePool.execute(`
      SELECT DATE(created_at) as date, SUM(platform_fee) as revenue, COUNT(*) as transactions
      FROM payments
      WHERE status = 'captured' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      logger.warn('Analytics dailyRevenue query failed, likely due to old schema.', { error: err.message });
    } else { throw err; }
  }

  const [dailySignups] = await promisePool.execute(`
    SELECT DATE(created_at) as date,
    SUM(CASE WHEN user_type = 'worker' THEN 1 ELSE 0 END) as workers,
    SUM(CASE WHEN user_type = 'seeker' THEN 1 ELSE 0 END) as seekers
    FROM users
    WHERE user_type != 'admin' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [days]);

  let topCategories = [];
  try {
    [topCategories] = await promisePool.execute(`
      SELECT c.name, COUNT(j.id) as job_count,
      AVG(j.final_amount) as avg_amount
      FROM jobs j
      LEFT JOIN categories c ON c.id = j.category_id
      WHERE j.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY c.id, c.name
      ORDER BY job_count DESC
      LIMIT 10
    `, [days]);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      logger.warn('Analytics topCategories query failed, likely due to old schema.', { error: err.message });
    } else { throw err; }
  }

  let topWorkers = [];
  try {
    [topWorkers] = await promisePool.execute(`
      SELECT wp.full_name, wp.average_rating, wp.total_earnings,
      COUNT(j.id) as completed_jobs, wp.city
      FROM worker_profiles wp
      LEFT JOIN jobs j ON j.worker_id = wp.user_id AND j.status = 'completed' AND j.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY wp.id, wp.full_name, wp.average_rating, wp.total_earnings, wp.city
      ORDER BY completed_jobs DESC, wp.average_rating DESC
      LIMIT 10
    `, [days]);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      logger.warn('Analytics topWorkers query failed, likely due to old schema.', { error: err.message });
    } else { throw err; }
  }

  res.json({
    success: true,
    data: {
      period_days: days,
      daily_jobs: dailyJobs,
      daily_revenue: dailyRevenue,
      daily_signups: dailySignups,
      top_categories: topCategories,
      top_workers: topWorkers,
      generated_at: new Date().toISOString()
    }
  });
});

// ─── Get All Disputes ─────────────────────────────────────────
const getAllDisputes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND d.status = ?'; params.push(status); }

  const [disputes] = await promisePool.execute(
    `SELECT d.*, j.title as job_title,
     u1.email as raised_by_email, COALESCE(wp1.full_name, sp1.full_name) as raised_by_name,
     u2.email as against_email, COALESCE(wp2.full_name, sp2.full_name) as against_name
     FROM disputes d
     LEFT JOIN jobs j ON j.id = d.job_id
     LEFT JOIN users u1 ON u1.id = d.raised_by
     LEFT JOIN worker_profiles wp1 ON wp1.user_id = d.raised_by
     LEFT JOIN seeker_profiles sp1 ON sp1.user_id = d.raised_by
     LEFT JOIN users u2 ON u2.id = d.against_user
     LEFT JOIN worker_profiles wp2 ON wp2.user_id = d.against_user
     LEFT JOIN seeker_profiles sp2 ON sp2.user_id = d.against_user
     ${where}
     ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM disputes d ${where}`, params
  );

  res.json({
    success: true,
    data: { disputes, pagination: paginationMeta(total, parseInt(page), l) }
  });
});

// ─── Resolve Dispute ─────────────────────────────────────────
const resolveDispute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes, refund_amount } = req.body;

  if (!['resolved', 'closed'].includes(status)) {
    throw new ApiError(400, 'Status must be resolved or closed');
  }

  const [disputes] = await promisePool.execute(
    `SELECT d.*, j.title as job_title
     FROM disputes d
     JOIN jobs j ON j.id = d.job_id
     WHERE d.id = ?`,
    [id]
  );
  if (disputes.length === 0) throw new ApiError(404, 'Dispute not found');
  const dispute = disputes[0];

  await promisePool.execute(
    `UPDATE disputes SET status = ?, resolution_notes = ?, refund_amount = ?,
     resolved_by = ?, resolved_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [status, resolution_notes || '', refund_amount || null, req.user.id, id]
  );

  // Notify both parties
  const message = `The dispute for job "${dispute.job_title}" has been ${status}. Notes: ${resolution_notes || 'N/A'}`;
  await notificationService.saveNotification(promisePool, dispute.raised_by, 'dispute_resolved', {
    jobId: dispute.job_id, message
  });
  await notificationService.saveNotification(promisePool, dispute.against_user, 'dispute_resolved', {
    jobId: dispute.job_id, message
  });

  // Log the action
  await promisePool.execute(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address)
     VALUES (?, 'dispute_resolved', 'dispute', ?, ?, ?)`,
    [req.user.id, id, JSON.stringify({ status, resolution_notes, refund_amount }), req.ip]
  );

  res.json({ success: true, message: `Dispute ${status} successfully` });
});

// ─── Send Mass Notification ───────────────────────────────────
const sendMassNotification = asyncHandler(async (req, res) => {
  const { title, body, user_type, priority = 'medium' } = req.body;
  if (!title || !body) throw new ApiError(400, 'Title and body required');

  let where = 'WHERE is_active = TRUE';
  const params = [];
  if (user_type) { where += ' AND user_type = ?'; params.push(user_type); }

  const [users] = await promisePool.execute(
    `SELECT id FROM users ${where}`, params
  );

  const BATCH_SIZE = 500; // Process 500 users at a time to avoid large queries
  let totalSent = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;

    try {
      // Try modern schema first (body, data, priority)
      const notifications = batch.map(u => [
        u.id, 'admin_broadcast', title, body, JSON.stringify({}), priority
      ]);
      const placeholders = notifications.map(() => '(?,?,?,?,?,?)').join(',');
      await promisePool.execute(
        `INSERT INTO notifications (user_id, type, title, body, data, priority) VALUES ${placeholders}`,
        notifications.flat()
      );
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && (err.message.includes("'body'") || err.message.includes("'data'"))) {
        // Fallback to legacy schema (message, reference_id)
        logger.warn('Mass notification failed on modern schema, retrying with legacy schema.', { error: err.message });
        const legacyNotifications = batch.map(u => [
          u.id, 'admin_broadcast', title, body, null // for reference_id
        ]);
        const placeholders = legacyNotifications.map(() => '(?,?,?,?,?)').join(',');
        await promisePool.execute(
          `INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES ${placeholders}`,
          legacyNotifications.flat()
        );
      } else {
        throw err;
      }
    }
    totalSent += batch.length;
  }

  logger.info('Mass notification sent', { adminId: req.user.id, count: totalSent, user_type });

  res.json({
    success: true,
    message: `Notification sent to ${totalSent} users`,
    data: { sent_count: totalSent }
  });
});

// ─── Get Platform Revenue ─────────────────────────────────────
const getPlatformRevenue = asyncHandler(async (req, res) => {
  let totals;
  try {
    [[totals]] = await promisePool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'captured' THEN amount ELSE 0 END), 0) as total_payment_volume,
        COALESCE(SUM(CASE WHEN status = 'captured' THEN platform_fee ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'captured' THEN gst_amount ELSE 0 END), 0) as total_gst,
        COALESCE(SUM(CASE WHEN status = 'captured' THEN worker_payout ELSE 0 END), 0) as total_worker_payouts,
        COUNT(CASE WHEN status = 'captured' THEN 1 END) as successful_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
      FROM payments
    `);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      logger.warn('Platform revenue query failed, likely due to old schema. Falling back to zeros for missing fields.', { error: err.message });
      [[totals]] = await promisePool.execute(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'captured' THEN amount ELSE 0 END), 0) as total_payment_volume,
          0 as total_revenue, 0 as total_gst, 0 as total_worker_payouts,
          COUNT(CASE WHEN status = 'captured' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
        FROM payments
      `);
    } else {
      throw err;
    }
  }

  res.json({ success: true, data: totals });
});

// ─── Cache Management ─────────────────────────────────────────
const manageCaches = asyncHandler(async (req, res) => {
  const { action } = req.body;

  if (action === 'flush') {
    cacheService.flushAll();
    return res.json({ success: true, message: 'All caches flushed' });
  }

  if (action === 'stats') {
    return res.json({ success: true, data: cacheService.getStats() });
  }

  res.json({ success: false, message: 'Unknown action. Use flush or stats.' });
});

// ─── Get Audit Logs ───────────────────────────────────────────
const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, user_id } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = 'WHERE 1=1';
  const params = [];

  if (action) { where += ` AND a.action = ?`; params.push(action); }
  if (user_id) { where += ` AND a.user_id = ?`; params.push(user_id); }

  const [logs] = await promisePool.execute(
    `SELECT a.*, u.email as admin_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM audit_logs a ${where}`, params
  );

  res.json({
    success: true,
    data: { logs, pagination: paginationMeta(total, parseInt(page), l) }
  });
});

// ─── Get All Payments ─────────────────────────────────────────
const getAllPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (search) {
    where += ` AND (p.razorpay_payment_id LIKE ? OR u_payer.email LIKE ? OR u_payee.email LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [payments] = await promisePool.execute(
    `SELECT p.*, j.title as job_title,
     u_payer.email as payer_email,
     u_payee.email as payee_email
     FROM payments p
     LEFT JOIN jobs j ON j.id = p.job_id
     LEFT JOIN users u_payer ON u_payer.id = p.payer_id
     LEFT JOIN users u_payee ON u_payee.id = p.payee_id
     ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM payments p
     LEFT JOIN users u_payer ON u_payer.id = p.payer_id
     LEFT JOIN users u_payee ON u_payee.id = p.payee_id
     ${where}`,
    params
  );

  res.json({
    success: true,
    data: { payments, pagination: paginationMeta(total, parseInt(page), l) }
  });
});

// ─── Get All Subscriptions ────────────────────────────────────
const getAllSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, plan } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (plan) { where += ' AND s.plan = ?'; params.push(plan); }

  const [subscriptions] = await promisePool.execute(
    `SELECT s.*, u.email as user_email
     FROM subscriptions s
     LEFT JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY s.expires_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM subscriptions s ${where}`, params
  );

  res.json({
    success: true,
    data: { subscriptions, pagination: paginationMeta(total, parseInt(page), l) }
  });
});

// ─── Get Sent Notifications History ───────────────────────────
const getSentNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  const [notifications] = await promisePool.execute(
    `SELECT * FROM notifications WHERE type = 'admin_broadcast' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [l, offset]
  );

  const [[{ total }]] = await promisePool.execute(`SELECT COUNT(*) as total FROM notifications WHERE type = 'admin_broadcast'`);

  res.json({ success: true, data: { notifications, pagination: paginationMeta(total, parseInt(page), l) } });
});

module.exports = {
  getDashboardStats, getAllUsers, toggleUserStatus, getAnalytics,
  getAllDisputes, resolveDispute, sendMassNotification,
  getPlatformRevenue, manageCaches, getAuditLogs, getAllPayments,
  getAllSubscriptions, getSentNotifications
};
