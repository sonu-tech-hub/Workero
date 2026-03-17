/**
 * ============================================================
 * ADVANCED WORKER CONTROLLER - Worker Finder v3.0.0
 * With AI matching, caching, full search
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { calculateDistance, paginate, paginationMeta, parseJSON } = require('../utils/helpers');
const cacheService = require('../services/cacheService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// ─── Update Worker Profile ────────────────────────────────────
const updateWorkerProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    full_name, bio, profession, experience_years, hourly_rate,
    city, state, address, latitude, longitude, is_available,
    service_radius, languages
  } = req.body;

  let { skills, certifications } = req.body;
  if (typeof skills === 'string') skills = parseJSON(skills, []);
  if (typeof certifications === 'string') certifications = parseJSON(certifications, []);

  await promisePool.execute(
    `UPDATE worker_profiles SET
      full_name = COALESCE(?, full_name),
      bio = COALESCE(?, bio),
      profession = COALESCE(?, profession),
      experience_years = COALESCE(?, experience_years),
      hourly_rate = COALESCE(?, hourly_rate),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      address = COALESCE(?, address),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      is_available = COALESCE(?, is_available),
      service_radius = COALESCE(?, service_radius),
      skills = COALESCE(?, skills),
      certifications = COALESCE(?, certifications),
      languages = COALESCE(?, languages),
      updated_at = NOW()
     WHERE user_id = ?`,
    [
      full_name || null, bio || null, profession || null,
      experience_years !== undefined ? parseInt(experience_years) : null,
      hourly_rate !== undefined ? parseFloat(hourly_rate) : null,
      city || null, state || null, address || null,
      latitude || null, longitude || null,
      is_available !== undefined ? (is_available ? 1 : 0) : null,
      service_radius || null,
      skills ? JSON.stringify(skills) : null,
      certifications ? JSON.stringify(certifications) : null,
      languages ? JSON.stringify(languages) : null,
      userId
    ]
  );

  cacheService.invalidateWorker(userId);

  const [updated] = await promisePool.execute(
    `SELECT * FROM worker_profiles WHERE user_id = ?`, [userId]
  );

  logger.info('Worker profile updated', { userId });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      ...updated[0],
      skills: parseJSON(updated[0]?.skills, []),
      certifications: parseJSON(updated[0]?.certifications, []),
      languages: parseJSON(updated[0]?.languages, [])
    }
  });
});

// ─── Upload Profile Photo ─────────────────────────────────────
const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided');

  const userId = req.user.id;
  const [existing] = await promisePool.execute(
    `SELECT profile_photo_public_id FROM worker_profiles WHERE user_id = ?`, [userId]
  );

  // Delete old photo
  if (existing[0]?.profile_photo_public_id) {
    await deleteFromCloudinary(existing[0].profile_photo_public_id).catch(() => {});
  }

  const result = await uploadToCloudinary(req.file.buffer, 'profiles', null);

  await promisePool.execute(
    `UPDATE worker_profiles SET profile_photo_url = ?, profile_photo_public_id = ?, updated_at = NOW()
     WHERE user_id = ?`,
    [result.secure_url, result.public_id, userId]
  );

  cacheService.invalidateWorker(userId);
  logger.info('Worker photo uploaded', { userId, url: result.secure_url });

  res.json({
    success: true,
    message: 'Profile photo uploaded successfully',
    data: { photo_url: result.secure_url, public_id: result.public_id }
  });
});

// ─── Upload Verification Proof ────────────────────────────────
const uploadVerificationProof = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No document file provided');

  const userId = req.user.id;
  const result = await uploadToCloudinary(req.file.buffer, 'verifications', null);

  await promisePool.execute(
    `UPDATE worker_profiles SET verification_proof_url = ?, is_verified = FALSE, updated_at = NOW()
     WHERE user_id = ?`,
    [result.secure_url, userId]
  );

  cacheService.invalidateWorker(userId);

  res.json({
    success: true,
    message: 'Verification document uploaded. Under review.',
    data: { proof_url: result.secure_url }
  });
});

// ─── Get Worker Profile (Public) ──────────────────────────────
const getWorkerProfile = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.workerId);

  const cacheKey = cacheService.keys.worker(id);
  const cached = cacheService.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [workers] = await promisePool.execute(
    `SELECT wp.*, u.email, u.mobile, u.user_type, u.created_at as member_since
     FROM worker_profiles wp
     JOIN users u ON u.id = wp.user_id
     WHERE wp.user_id = ? AND u.is_active = TRUE`,
    [id]
  );
  if (workers.length === 0) throw new ApiError(404, 'Worker not found');

  const worker = workers[0];

  // Get recent reviews
  const [reviews] = await promisePool.execute(
    `SELECT r.*, COALESCE(sp.full_name, wp2.full_name) as reviewer_name,
     COALESCE(sp.profile_photo_url, wp2.profile_photo_url) as reviewer_photo
     FROM reviews r
     LEFT JOIN seeker_profiles sp ON sp.user_id = r.reviewer_id
     LEFT JOIN worker_profiles wp2 ON wp2.user_id = r.reviewer_id
     WHERE r.reviewee_id = ? AND r.is_visible = TRUE
     ORDER BY r.created_at DESC LIMIT 5`,
    [id]
  );

  // AI performance analysis
  const performance = aiService.analyzeWorkerPerformance(worker);

  const data = {
    ...worker,
    skills: parseJSON(worker.skills, []),
    certifications: parseJSON(worker.certifications, []),
    languages: parseJSON(worker.languages, []),
    recent_reviews: reviews.map(r => ({ ...r, photos: parseJSON(r.photos, []) })),
    ai_performance: performance
  };

  cacheService.set(cacheKey, data, 300);

  res.json({ success: true, data });
});

// ─── Search Workers ───────────────────────────────────────────
const searchWorkers = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10, profession, category_id,
    latitude, longitude, radius = 50,
    min_experience, max_experience,
    min_rating = 0, city,
    availability, sort = 'rating', ai_match = false
  } = req.query;

  const { offset, limit: l } = paginate(page, limit);

  let fromClause = `
    FROM worker_profiles wp
    JOIN users u ON u.id = wp.user_id
  `;
  let whereClause = ` WHERE u.is_active = TRUE AND u.is_verified = TRUE `;
  const params = [];

  if (profession) {
    whereClause += ` AND wp.profession LIKE ?`;
    params.push(`%${profession}%`);
  }

  if (category_id) {
    const [cat] = await promisePool.execute(`SELECT name FROM categories WHERE id = ?`, [category_id]);
    if (cat.length > 0) {
      whereClause += ` AND (wp.profession LIKE ? OR JSON_SEARCH(wp.skills, 'one', ?) IS NOT NULL)`;
      params.push(`%${cat[0].name}%`, cat[0].name);
    }
  }

  if (city) { whereClause += ` AND wp.city LIKE ?`; params.push(`%${city}%`); }
  if (min_experience) { whereClause += ` AND wp.experience_years >= ?`; params.push(parseInt(min_experience)); }
  if (max_experience) { whereClause += ` AND wp.experience_years <= ?`; params.push(parseInt(max_experience)); }
  if (parseFloat(min_rating) > 0) { whereClause += ` AND wp.average_rating >= ?`; params.push(parseFloat(min_rating)); }
  if (availability === 'true') { whereClause += ` AND wp.is_available = TRUE`; }

  if (latitude && longitude) {
    whereClause += ` AND wp.latitude IS NOT NULL AND wp.longitude IS NOT NULL AND (
      6371 * ACOS(
        LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(wp.latitude)) *
        COS(RADIANS(wp.longitude) - RADIANS(?)) +
        SIN(RADIANS(?)) * SIN(RADIANS(wp.latitude)))
      )
    ) <= ?`;
    params.push(parseFloat(latitude), parseFloat(longitude), parseFloat(latitude), parseFloat(radius));
  }

  // Count query
  const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [[{ total }]] = await promisePool.execute(countSql, params);

  // Sorting
  const validSorts = { rating: 'wp.average_rating DESC', experience: 'wp.experience_years DESC', price: 'wp.hourly_rate ASC' };
  const orderBy = `ORDER BY ${validSorts[sort] || 'wp.average_rating DESC'}`;
  const limitClause = `LIMIT ? OFFSET ?`;
  const finalParams = [...params, l, offset];

  const mainSql = `
    SELECT wp.*, u.email,
    (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = wp.user_id) as review_count
    ${fromClause} ${whereClause} ${orderBy} ${limitClause}
  `;
  const [workers] = await promisePool.execute(mainSql, finalParams);

  let processed = workers.map(w => ({
    ...w,
    skills: parseJSON(w.skills, []),
    certifications: parseJSON(w.certifications, []),
    distance: latitude && longitude && w.latitude && w.longitude
      ? calculateDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(w.latitude), parseFloat(w.longitude))
      : null
  }));

  // AI ranking if requested
  if (ai_match === 'true') {
    processed = aiService.rankWorkersForJob({ budget: req.query.budget }, processed);
  }

  res.json({
    success: true,
    data: {
      workers: processed,
      pagination: paginationMeta(total, parseInt(page), l),
      filters_applied: { profession, city, min_rating, availability, ai_match }
    }
  });
});

// ─── Get Worker Stats (Dashboard) ────────────────────────────
const getWorkerStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = cacheService.keys.workerStats(userId);
  const cached = cacheService.getShort(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [profiles] = await promisePool.execute(
    `SELECT * FROM worker_profiles WHERE user_id = ?`, [userId]
  ); 
  if (profiles.length === 0) throw new ApiError(404, 'Worker profile not found');

  const [jobStats] = await promisePool.execute(`
    SELECT 
      COUNT(*) as total_jobs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active_jobs,
      SUM(CASE WHEN status = 'open' OR status = 'assigned' THEN 1 ELSE 0 END) as pending_jobs,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs 
    FROM jobs WHERE worker_id = ?`, [userId]);

  let monthlyEarnings;
  try {
    [monthlyEarnings] = await promisePool.execute(`
      SELECT MONTH(created_at) as month, YEAR(created_at) as year,
      SUM(worker_payout) as earnings
      FROM payments
      WHERE payee_id = ? AND status = 'captured'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY year DESC, month DESC`, [userId]);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && String(err.message || '').includes('worker_payout')) {
      // Backward compatibility for older DB schemas without payments.worker_payout
      [monthlyEarnings] = await promisePool.execute(`
        SELECT MONTH(created_at) as month, YEAR(created_at) as year,
        SUM(amount) as earnings
        FROM payments
        WHERE payee_id = ? AND status = 'captured'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY YEAR(created_at), MONTH(created_at)
        ORDER BY year DESC, month DESC`, [userId]);
    } else {
      throw err;
    }
  }

  const [recentReviews] = await promisePool.execute(`
    SELECT r.*, COALESCE(sp.full_name, wp2.full_name, 'User') as reviewer_name,
     COALESCE(sp.profile_photo_url, wp2.profile_photo_url) as reviewer_photo
    FROM reviews r
    LEFT JOIN seeker_profiles sp ON sp.user_id = r.reviewer_id
    LEFT JOIN worker_profiles wp2 ON wp2.user_id = r.reviewer_id
    WHERE r.reviewee_id = ? AND r.is_visible = TRUE
    ORDER BY r.created_at DESC LIMIT 5`, [userId]);

  const [unreadMessages] = await promisePool.execute(
    `SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE`, [userId]
  );

  const [unreadNotifications] = await promisePool.execute(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`, [userId]
  );

  const profile = profiles[0];
  const performance = aiService.analyzeWorkerPerformance({
    ...profile,
    total_jobs: jobStats[0]?.total_jobs || 0,
    completed_jobs: jobStats[0]?.completed_jobs || 0
  });

  const data = {
    profile: {
      ...profile,
      skills: parseJSON(profile.skills, []),
      certifications: parseJSON(profile.certifications, []),
      languages: parseJSON(profile.languages, [])
    },
    job_stats: jobStats[0],
    monthly_earnings: monthlyEarnings,
    recent_reviews: recentReviews,
    unread_messages: unreadMessages[0]?.count || 0,
    unread_notifications: unreadNotifications[0]?.count || 0,
    ai_performance: performance
  };

  cacheService.setShort(cacheKey, data, 60);
  res.json({ success: true, data });
});


// ─── Update Availability ──────────────────────────────────────
const updateAvailability = asyncHandler(async (req, res) => {
  const { is_available } = req.body;
  if (is_available === undefined) throw new ApiError(400, 'is_available is required');

  await promisePool.execute(
    `UPDATE worker_profiles SET is_available = ?, updated_at = NOW() WHERE user_id = ?`,
    [is_available ? 1 : 0, req.user.id]
  );

  cacheService.invalidateWorker(req.user.id);

  res.json({
    success: true,
    message: `You are now ${is_available ? 'available' : 'unavailable'} for work`,
    data: { is_available: !!is_available }
  });
});

module.exports = {
  updateWorkerProfile, uploadProfilePhoto, uploadVerificationProof,
  getWorkerProfile, searchWorkers, getWorkerStats, updateAvailability
};
