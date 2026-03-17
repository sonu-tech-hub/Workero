/**
 * ============================================================
 * SEEKER CONTROLLER - Advanced Worker Finder v3.0.0
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { paginate, paginationMeta, parseJSON } = require('../utils/helpers');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

const updateSeekerProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { full_name, bio, city, state, address, latitude, longitude, preferred_categories } = req.body;

  await promisePool.execute(
    `UPDATE seeker_profiles SET
      full_name = COALESCE(?, full_name),
      bio = COALESCE(?, bio),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      address = COALESCE(?, address),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      preferred_categories = COALESCE(?, preferred_categories),
      updated_at = NOW()
     WHERE user_id = ?`,
    [
      full_name || null, bio || null, city || null, state || null, address || null,
      latitude || null, longitude || null,
      preferred_categories ? JSON.stringify(preferred_categories) : null,
      userId
    ]
  );

  const [updated] = await promisePool.execute(
    `SELECT * FROM seeker_profiles WHERE user_id = ?`, [userId]
  );

  cacheService.del(cacheService.keys.seeker(userId));

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      ...updated[0],
      preferred_categories: parseJSON(updated[0]?.preferred_categories, [])
    }
  });
});

const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided');

  const userId = req.user.id;
  const [existing] = await promisePool.execute(
    `SELECT profile_photo_public_id FROM seeker_profiles WHERE user_id = ?`, [userId]
  );

  if (existing[0]?.profile_photo_public_id) {
    await deleteFromCloudinary(existing[0].profile_photo_public_id).catch(() => {});
  }

  const result = await uploadToCloudinary(req.file.buffer, 'seeker-profiles', null);
  await promisePool.execute(
    `UPDATE seeker_profiles SET profile_photo_url = ?, profile_photo_public_id = ?, updated_at = NOW() WHERE user_id = ?`,
    [result.secure_url, result.public_id, userId]
  );

  cacheService.del(cacheService.keys.seeker(userId));

  res.json({
    success: true,
    message: 'Photo uploaded successfully',
    data: { photo_url: result.secure_url }
  });
});

const getSeekerProfile = asyncHandler(async (req, res) => {
  const seekerId = parseInt(req.params.seekerId);
  if (isNaN(seekerId)) throw new ApiError(400, 'Invalid seeker ID');

  const cacheKey = cacheService.keys.seeker(seekerId);
  const cached = cacheService.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [profiles] = await promisePool.execute(
    `SELECT sp.*, u.email, u.created_at as member_since
     FROM seeker_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.user_id = ? AND u.is_active = TRUE`,
    [seekerId]
  );
  if (profiles.length === 0) throw new ApiError(404, 'Seeker not found');

  const data = {
    ...profiles[0],
    preferred_categories: parseJSON(profiles[0].preferred_categories, [])
  };

  cacheService.set(cacheKey, data, 300);
  res.json({ success: true, data });
});

const getSeekerStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = cacheService.keys.seekerStats(userId);
  const cached = cacheService.getShort(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [profiles] = await promisePool.execute(
    `SELECT * FROM seeker_profiles WHERE user_id = ?`, [userId]
  );

  const [[jobStats]] = await promisePool.execute(`
    SELECT
      COUNT(*) as total_posted,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_jobs,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      AVG(final_amount) as avg_job_value,
      SUM(final_amount) as total_spent
    FROM jobs WHERE seeker_id = ?`, [userId]);

  const [monthlySpending] = await promisePool.execute(`
    SELECT MONTH(created_at) as month, YEAR(created_at) as year, SUM(amount) as amount
    FROM payments
    WHERE payer_id = ? AND status = 'captured'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY YEAR(created_at), MONTH(created_at)
    ORDER BY year DESC, month DESC`, [userId]);

  const [topWorkers] = await promisePool.execute(`
    SELECT wp.full_name, wp.profile_photo_url, wp.average_rating, wp.profession,
    COUNT(j.id) as jobs_together, u.id as worker_user_id
    FROM jobs j
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
    LEFT JOIN users u ON u.id = j.worker_id
    WHERE j.seeker_id = ? AND j.status = 'completed'
    GROUP BY j.worker_id
    ORDER BY jobs_together DESC
    LIMIT 5`, [userId]);

  const [notifications] = await promisePool.execute(
    `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = FALSE`, [userId]
  );

  const data = {
    profile: { ...profiles[0], preferred_categories: parseJSON(profiles[0]?.preferred_categories, []) },
    job_stats: jobStats,
    monthly_spending: monthlySpending,
    favorite_workers: topWorkers,
    unread_notifications: notifications[0]?.unread || 0
  };

  cacheService.setShort(cacheKey, data, 60);
  res.json({ success: true, data });
});

const getJobHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;
  const { offset, limit: l } = paginate(page, limit);

  let where = `WHERE j.seeker_id = ?`;
  const params = [userId];
  if (status) { where += ` AND j.status = ?`; params.push(status); }

  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM jobs j ${where}`, params
  );

  const [jobs] = await promisePool.execute(`
    SELECT j.*, c.name as category_name,
    wp.full_name as worker_name, wp.profile_photo_url as worker_photo, wp.average_rating
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
    ${where}
    ORDER BY j.created_at DESC
    LIMIT ? OFFSET ?`, [...params, l, offset]);

  res.json({
    success: true,
    data: {
      jobs: jobs.map(j => ({ ...j, ai_price_suggestion: parseJSON(j.ai_price_suggestion, null) })),
      pagination: paginationMeta(total, parseInt(page), l)
    }
  });
});

module.exports = { updateSeekerProfile, uploadProfilePhoto, getSeekerProfile, getSeekerStats, getJobHistory };
