const express = require('express');
const router = express.Router();
const {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

// All routes in this file are protected
router.use(verifyToken);

// GET /api/notifications
router.route('/').get(getNotificationsForUser);

// POST /api/notifications/read-all
router.route('/read-all').post(markAllNotificationsAsRead);

// PATCH /api/notifications/:id/read
router.route('/:id/read').patch(markNotificationAsRead);

module.exports = router;
