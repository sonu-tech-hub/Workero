/**
 * ============================================================
 * AI CONTROLLER - Advanced Worker Finder v3.0.0
 * Smart matching, pricing, fraud analysis, insights
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const aiService = require('../services/aiService');
const cacheService = require('../services/cacheService');
const { paginate, parseJSON } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── AI Worker Matching ───────────────────────────────────────
const getAIMatchedWorkers = asyncHandler(async (req, res) => {
  const {
    category_id, latitude, longitude, budget, job_description,
    page = 1, limit = 10
  } = req.query;

  const { offset, limit: l } = paginate(page, limit);

  const cacheKey = `ai:match:${category_id}:${latitude}:${longitude}:${budget}:${page}`;
  const cached = cacheService.getShort(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  let sql = `
    SELECT wp.*, u.email, u.mobile,
      (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = u.id) as review_count
    FROM worker_profiles wp
    JOIN users u ON u.id = wp.user_id
    WHERE wp.is_available = TRUE AND u.is_active = TRUE AND u.is_verified = TRUE
  `;
  const params = [];

  if (category_id) {
    // Filter by profession if category provided
    const [cat] = await promisePool.execute(
      `SELECT name FROM categories WHERE id = ?`, [category_id]
    );
    if (cat.length > 0) {
      sql += ` AND (wp.profession LIKE ? OR JSON_SEARCH(wp.skills, 'one', ?) IS NOT NULL)`;
      params.push(`%${cat[0].name}%`, cat[0].name);
    }
  }

  if (latitude && longitude) {
    sql += ` AND wp.latitude IS NOT NULL AND wp.longitude IS NOT NULL`;
  }

  sql += ` LIMIT ? OFFSET ?`;
  params.push(l, offset);

  const [workers] = await promisePool.execute(sql, params);

  // Parse JSON fields
  const processedWorkers = workers.map(w => ({
    ...w,
    skills: parseJSON(w.skills, []),
    certifications: parseJSON(w.certifications, []),
    languages: parseJSON(w.languages, []),
    distance: latitude && longitude && w.latitude && w.longitude
      ? require('../utils/helpers').calculateDistance(
          parseFloat(latitude), parseFloat(longitude),
          parseFloat(w.latitude), parseFloat(w.longitude)
        )
      : null
  }));

  // AI Ranking
  const jobReq = { budget, description: job_description, category_id };
  const rankedWorkers = aiService.rankWorkersForJob(jobReq, processedWorkers);

  // Classify search intent if description provided
  let searchInsight = null;
  if (job_description) {
    searchInsight = aiService.classifySearchIntent(job_description);
  }

  const result = {
    workers: rankedWorkers.slice(0, l),
    total: rankedWorkers.length,
    ai_insights: searchInsight,
    ai_ranking_enabled: true,
    page: parseInt(page),
    limit: l
  };

  cacheService.setShort(cacheKey, result, 90);

  logger.info('AI worker matching', { category_id, workersFound: rankedWorkers.length });

  res.json({ success: true, data: result });
});

// ─── AI Price Suggestion ─────────────────────────────────────
const getAIPriceSuggestion = asyncHandler(async (req, res) => {
  const { category, location, experience, urgency, description } = req.query;

  const cacheKey = cacheService.keys.aiPricing(category || 'general', location || 'india');
  const cached = cacheService.getLong(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const pricing = aiService.suggestJobPricing({
    category: category || '',
    location: location || '',
    experience: parseInt(experience) || 0,
    urgency: urgency || 'normal'
  });

  let descriptionAnalysis = null;
  if (description) {
    descriptionAnalysis = aiService.enhanceJobDescription(description);
  }

  const result = {
    ...pricing,
    description_analysis: descriptionAnalysis,
    ai_powered: true,
    disclaimer: 'Prices are AI estimates based on market data. Actual rates may vary.'
  };

  cacheService.setLong(cacheKey, result, 3600);

  res.json({ success: true, data: result });
});

// ─── AI Job Description Enhancer ─────────────────────────────
const enhanceJobDescription = asyncHandler(async (req, res) => {
  const { description } = req.body;
  if (!description) throw new ApiError(400, 'Description is required');

  const enhanced = aiService.enhanceJobDescription(description);

  res.json({
    success: true,
    data: {
      ...enhanced,
      ai_powered: true
    }
  });
});

// ─── Worker Performance Analysis ─────────────────────────────
const getWorkerPerformanceAnalysis = asyncHandler(async (req, res) => {
  const workerId = req.params.workerId || req.user.id;

  const [stats] = await promisePool.execute(
    `SELECT wp.*, 
     COUNT(DISTINCT j.id) as total_jobs_actual,
     SUM(CASE WHEN j.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs_actual
     FROM worker_profiles wp
     LEFT JOIN jobs j ON j.worker_id = wp.user_id
     WHERE wp.user_id = ?
     GROUP BY wp.id`,
    [workerId]
  );

  if (stats.length === 0) throw new ApiError(404, 'Worker not found');

  const workerStats = {
    ...stats[0],
    total_jobs: stats[0].total_jobs_actual || stats[0].total_jobs || 0,
    completed_jobs: stats[0].completed_jobs_actual || stats[0].completed_jobs || 0
  };

  const analysis = aiService.analyzeWorkerPerformance(workerStats);

  res.json({
    success: true,
    data: {
      worker_id: parseInt(workerId),
      ...analysis,
      ai_powered: true
    }
  });
});

// ─── Search Intent Classification ────────────────────────────
const classifySearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) throw new ApiError(400, 'Query (q) parameter required');

  const cacheKey = cacheService.keys.searchIntent(q.toLowerCase().trim());
  const cached = cacheService.getShort(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const intent = aiService.classifySearchIntent(q);
  cacheService.setShort(cacheKey, intent, 300);

  res.json({ success: true, data: intent });
});

// ─── Fraud Risk Assessment ────────────────────────────────────
const assessFraudRisk = asyncHandler(async (req, res) => {
  // Admin only
  if (req.user.user_type !== 'admin') throw new ApiError(403, 'Admin access required');

  const { action, metadata = {} } = req.body;
  if (!action) throw new ApiError(400, 'action is required');

  const assessment = aiService.detectFraud({
    action,
    metadata,
    ipAddress: req.ip
  });

  res.json({ success: true, data: assessment });
});

// ─── AI Notifications Preview ─────────────────────────────────
const getNotificationPreview = asyncHandler(async (req, res) => {
  const { type, data } = req.body;
  if (!type) throw new ApiError(400, 'Notification type required');

  const notification = aiService.generateNotification(type, data || {});

  res.json({ success: true, data: notification });
});

// ─── Dashboard AI Insights ────────────────────────────────────
const getDashboardInsights = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.user_type;

  if (userType === 'worker') {
    const [stats] = await promisePool.execute(
      `SELECT wp.*, 
       COUNT(DISTINCT j.id) as total_jobs,
       SUM(CASE WHEN j.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs
       FROM worker_profiles wp
       LEFT JOIN jobs j ON j.worker_id = wp.user_id
       WHERE wp.user_id = ?
       GROUP BY wp.id`,
      [userId]
    );

    if (stats.length === 0) return res.json({ success: true, data: { insights: [] } });

    const perf = aiService.analyzeWorkerPerformance({
      ...stats[0],
      total_jobs: stats[0].total_jobs || 0,
      completed_jobs: stats[0].completed_jobs || 0
    });

    return res.json({
      success: true,
      data: {
        performance: perf,
        tips: [
          'Complete your profile to get 3x more job matches',
          'Respond to messages quickly to improve your ranking',
          'Collect more 5-star reviews to reach Gold tier'
        ],
        ai_powered: true
      }
    });
  }

  // Seeker insights
  const [jobStats] = await promisePool.execute(
    `SELECT COUNT(*) as total_jobs,
     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
     SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_jobs,
     AVG(final_amount) as avg_spend
     FROM jobs WHERE seeker_id = ?`,
    [userId]
  );

  res.json({
    success: true,
    data: {
      stats: jobStats[0],
      tips: [
        'Add detailed job descriptions to attract better workers',
        'Complete payments promptly to build your reputation',
        'Use AI price suggestion to set competitive budgets'
      ],
      ai_powered: true
    }
  });
});

module.exports = {
  getAIMatchedWorkers, getAIPriceSuggestion, enhanceJobDescription,
  getWorkerPerformanceAnalysis, classifySearch, assessFraudRisk,
  getNotificationPreview, getDashboardInsights
};
