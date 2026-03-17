/**
 * AI ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  getAIMatchedWorkers, getAIPriceSuggestion, enhanceJobDescription,
  getWorkerPerformanceAnalysis, classifySearch, assessFraudRisk,
  getNotificationPreview, getDashboardInsights
} = require('../controllers/aiController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public AI endpoints
router.get('/match-workers', getAIMatchedWorkers);
router.get('/price-suggestion', getAIPriceSuggestion);
router.get('/classify-search', classifySearch);

// Protected
router.use(verifyToken);

router.post('/enhance-description', enhanceJobDescription);
router.get('/worker-performance/:workerId?', getWorkerPerformanceAnalysis);
router.get('/dashboard-insights', getDashboardInsights);
router.post('/notification-preview', getNotificationPreview);

// Admin only
router.post('/fraud-check', isAdmin, assessFraudRisk);

module.exports = router;
