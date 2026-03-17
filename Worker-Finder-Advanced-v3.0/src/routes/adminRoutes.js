/**
 * ADMIN ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAllUsers, toggleUserStatus, getAnalytics,
  getAllDisputes, resolveDispute, sendMassNotification,
  getPlatformRevenue, manageCaches, getAuditLogs, getAllPayments,
  getAllSubscriptions, getSentNotifications
} = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.use(verifyToken, isAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.patch('/users/:userId/status', toggleUserStatus);
router.get('/analytics', getAnalytics);
router.get('/disputes', getAllDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);
router.post('/notify-all', sendMassNotification);
router.get('/revenue', getPlatformRevenue);
router.post('/cache', manageCaches);
router.get('/audit-logs', getAuditLogs);
router.get('/payments', getAllPayments);
router.get('/subscriptions', getAllSubscriptions);
router.get('/notifications', getSentNotifications);

module.exports = router;
