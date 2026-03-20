/**
 * ============================================================
 * NOTIFICATION CONTROLLER - Advanced Worker Finder v3.0.0
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, paginationMeta } = require('../utils/helpers');

/**
 * @desc    Get all notifications for the logged-in user
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotificationsForUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, type } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  console.log(`[notifications] Fetching for user ${userId} | Page: ${page}, Limit: ${l}, Type: ${type || 'all'}`);

  const whereClauses = ['user_id = ?'];
  const params = [userId];

  if (type) {
    whereClauses.push('type = ?');
    params.push(type);
  }

  const whereSql = whereClauses.join(' AND ');

  const [notifications] = await promisePool.execute(
    `SELECT * FROM notifications WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM notifications WHERE ${whereSql}`,
    params
  );

  res.json({
    success: true,
    data: {
      notifications,
      pagination: paginationMeta(total, parseInt(page), l),
    },
  });
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  const [result] = await promisePool.execute(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ success: false, message: 'Notification not found or you do not have permission to update it.' });
  }

  res.json({ success: true, message: 'Notification marked as read.' });
});

/**
 * @desc    Mark all notifications as read for the user
 * @route   POST /api/notifications/read-all
 * @access  Private
 */
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type } = req.body;

  const whereClauses = ['user_id = ?', 'is_read = FALSE'];
  const params = [userId];

  if (type) {
    whereClauses.push('type = ?');
    params.push(type);
  }

  const whereSql = whereClauses.join(' AND ');

  await promisePool.execute(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE ${whereSql}`,
    params
  );
  res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};