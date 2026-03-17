/**
 * ============================================================
 * ADVANCED JOB CONTROLLER - Worker Finder v3.0.0
 * With AI pricing, caching, full lifecycle
 * ============================================================
 */

const { promisePool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { calculateCommission, calculateDistance, paginate, paginationMeta, parseJSON } = require('../utils/helpers');
const notificationService = require('../services/notificationService');
const socketService = require('../services/socketService');
const cacheService = require('../services/cacheService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// ─── Create Job ───────────────────────────────────────────────
const createJob = asyncHandler(async (req, res) => {
  const seekerId = req.user.id;
  const {
    title, description, budget, category_id, worker_id,
    location, latitude, longitude, deadline, priority = 'normal', notes
  } = req.body;

  if (!title) throw new ApiError(400, 'Job title is required');

  // Validate category
  let categoryId = null;
  if (category_id) {
    const [cats] = await promisePool.execute(
      `SELECT id FROM categories WHERE id = ? AND is_active = TRUE`, [category_id]
    );
    if (cats.length === 0) throw new ApiError(400, 'Invalid category');
    categoryId = category_id;
  }

  // Validate worker (if specified)
  let workerId = null;
  if (worker_id) {
    const [workers] = await promisePool.execute(
      `SELECT user_id FROM worker_profiles WHERE user_id = ?`, [worker_id]
    );
    if (workers.length === 0) throw new ApiError(400, 'Worker not found');
    workerId = worker_id;
  }

  // AI: Price suggestion and description quality
  const [catDetails] = categoryId
    ? await promisePool.execute(`SELECT name FROM categories WHERE id = ?`, [categoryId])
    : [[]];
  const aiPricing = aiService.suggestJobPricing({
    category: catDetails[0]?.name || '',
    location: location || '',
    experience: 3,
    urgency: priority === 'urgent' ? 'urgent' : 'normal'
  });
  const descQuality = aiService.enhanceJobDescription(description || title);

  // Commission calc
  const fees = budget ? calculateCommission(parseFloat(budget)) : null;

  const [result] = await promisePool.execute(
    `INSERT INTO jobs (seeker_id, worker_id, category_id, title, description, budget,
     location, latitude, longitude, deadline, priority, notes,
     platform_commission, trust_safety_fee, worker_payout,
     ai_price_suggestion, ai_description_quality, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW())`,
    [
      seekerId, workerId, categoryId, title, description || null,
      budget ? parseFloat(budget) : null, location || null,
      latitude || null, longitude || null,
      deadline || null, priority, notes || null,
      fees?.platform_commission || 0, fees?.trust_safety_fee || 0, fees?.worker_payout || 0,
      JSON.stringify(aiPricing), descQuality.quality_score
    ]
  );

  const jobId = result.insertId;

  // Update seeker stats
  await promisePool.execute(
    `UPDATE seeker_profiles SET total_jobs_posted = total_jobs_posted + 1 WHERE user_id = ?`,
    [seekerId]
  );

  // Notify assigned worker
  if (workerId) {
    await notificationService.saveNotification(promisePool, workerId, 'job_assigned', {
      jobTitle: title, jobId
    });
    socketService.emitToUser(workerId, 'job:assigned', { jobId, title });
  }

  cacheService.invalidateJob(jobId);
  logger.info('Job created', { jobId, seekerId, title });

  res.status(201).json({
    success: true,
    message: 'Job created successfully',
    data: {
      job_id: jobId,
      title,
      budget: budget || null,
      status: 'open',
      ai_price_suggestion: aiPricing,
      description_quality: descQuality,
      fees
    }
  });
});

// ─── Get All Jobs (with filters) ─────────────────────────────
const getAllJobs = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10, status, category_id, min_budget, max_budget,
    latitude, longitude, radius = 50, priority, sort = 'created_at'
  } = req.query;

  const { offset, limit: l } = paginate(page, limit);

  let selectFields = `j.*, c.name as category_name, c.icon as category_icon,
    sp.full_name as seeker_name, sp.profile_photo_url as seeker_photo,
    wp.full_name as worker_name, wp.average_rating as worker_rating`;

  let fromClause = `
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
  `;
  let whereClause = ` WHERE 1=1 `;
  const whereParams = [];
  const selectParams = [];

  if (status) { whereClause += ` AND j.status = ?`; whereParams.push(status); }
  if (category_id) { whereClause += ` AND j.category_id = ?`; whereParams.push(category_id); }
  if (min_budget) { whereClause += ` AND j.budget >= ?`; whereParams.push(parseFloat(min_budget)); }
  if (max_budget) { whereClause += ` AND j.budget <= ?`; whereParams.push(parseFloat(max_budget)); }
  if (priority) { whereClause += ` AND j.priority = ?`; whereParams.push(priority); }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (!isNaN(lat) && !isNaN(lon)) {
    const distanceFormula = `(
      6371 * ACOS(
        LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(j.latitude)) *
        COS(RADIANS(j.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(j.latitude)))
      )
    )`;
    selectFields += `, ${distanceFormula} as distance`;
    selectParams.push(lat, lon, lat);

    whereClause += ` AND j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND ${distanceFormula} <= ?`;
    whereParams.push(lat, lon, lat, parseFloat(radius));
  }

  const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [[{ total }]] = await promisePool.execute(countSql, whereParams);

  const validSorts = {
    created_at: 'j.created_at DESC',
    budget_high: 'j.budget DESC',
    budget_low: 'j.budget ASC',
    distance: (!isNaN(lat) && !isNaN(lon)) ? 'distance ASC' : 'j.created_at DESC'
  };
  const orderBy = `ORDER BY ${validSorts[sort] || 'j.created_at DESC'}`;
  const limitClause = `LIMIT ? OFFSET ?`;
  const finalParams = [...selectParams, ...whereParams, l, offset];

  const mainSql = `
    SELECT ${selectFields}
    ${fromClause} ${whereClause} ${orderBy} ${limitClause}
  `;
  const [jobs] = await promisePool.execute(mainSql, finalParams);

  const processedJobs = jobs.map(j => ({
    ...j,
    ai_price_suggestion: parseJSON(j.ai_price_suggestion, null)
  }));

  res.json({
    success: true,
    data: {
      jobs: processedJobs,
      pagination: paginationMeta(total, parseInt(page), l)
    }
  });
});

// ─── Get Job by ID ────────────────────────────────────────────
const getJobById = asyncHandler(async (req, res) => {
  const jobId = parseInt(req.params.id);

  const cacheKey = cacheService.keys.job(jobId);
  const cached = cacheService.getShort(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const [jobs] = await promisePool.execute(`
    SELECT j.*, c.name as category_name, c.icon as category_icon,
    sp.full_name as seeker_name, sp.profile_photo_url as seeker_photo,
    wp.full_name as worker_name, wp.profile_photo_url as worker_photo,
    wp.average_rating as worker_rating, wp.profession as worker_profession
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
    WHERE j.id = ?`, [jobId]);

  if (jobs.length === 0) throw new ApiError(404, 'Job not found');

  const job = {
    ...jobs[0],
    ai_price_suggestion: parseJSON(jobs[0].ai_price_suggestion, null)
  };

  cacheService.setShort(cacheKey, job, 120);
  res.json({ success: true, data: job });
});

// ─── Apply for Job ────────────────────────────────────────────
const applyForJob = asyncHandler(async (req, res) => {
  const workerId = req.user.id;
  const jobId = parseInt(req.params.id);
  const { cover_message, proposed_amount } = req.body;

  const [jobs] = await promisePool.execute(
    `SELECT * FROM jobs WHERE id = ? AND status = 'open'`, [jobId]
  );
  if (jobs.length === 0) throw new ApiError(404, 'Job not found or not open');

  const job = jobs[0];
  if (job.seeker_id === workerId) throw new ApiError(400, 'You cannot apply to your own job');

  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute(
      `SELECT id FROM job_applications WHERE job_id = ? AND worker_id = ?`, [jobId, workerId]
    );
    if (existing.length > 0) throw new ApiError(409, 'You have already applied for this job');

    try {
      await conn.execute(
        `INSERT INTO job_applications (job_id, worker_id, cover_message, proposed_amount, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [jobId, workerId, cover_message || null, proposed_amount || null]
      );
    } catch (err) {
      if (!(err && err.code === 'ER_BAD_FIELD_ERROR')) throw err;

      const msg = String(err.message || '');

      // Older schemas may not have proposed_amount and/or cover_message.
      if (msg.includes("'proposed_amount'")) {
        try {
          await conn.execute(
            `INSERT INTO job_applications (job_id, worker_id, cover_message, status)
             VALUES (?, ?, ?, 'pending')`,
            [jobId, workerId, cover_message || null]
          );
        } catch (err2) {
          if (!(err2 && err2.code === 'ER_BAD_FIELD_ERROR')) throw err2;
          const msg2 = String(err2.message || '');
          if (msg2.includes("'cover_message'")) {
            await conn.execute(
              `INSERT INTO job_applications (job_id, worker_id, message, status)
               VALUES (?, ?, ?, 'pending')`,
              [jobId, workerId, cover_message || null]
            );
          } else {
            throw err2;
          }
        }
      } else if (msg.includes("'cover_message'")) {
        await conn.execute(
          `INSERT INTO job_applications (job_id, worker_id, message, proposed_amount, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [jobId, workerId, cover_message || null, proposed_amount || null]
        );
      } else {
        throw err;
      }
    }

    // Notify seeker
    const [workerProfile] = await conn.execute(
      `SELECT full_name FROM worker_profiles WHERE user_id = ?`,
      [workerId]
    );
    const workerName = workerProfile[0]?.full_name || 'A worker';
    await notificationService.saveNotification(
      promisePool,
      job.seeker_id,
      'job_application',
      {
        jobId: jobId,
        jobTitle: job.title,
        workerId: workerId,
        body: `${workerName} has applied for your job "${job.title}".`
      }
    );
    socketService.emitToUser(job.seeker_id, 'job:application', { jobId, workerId });

    await conn.commit();
    cacheService.invalidateJob(jobId);

    res.status(201).json({ success: true, message: 'Application submitted successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Accept Application ───────────────────────────────────────
const acceptApplication = asyncHandler(async (req, res) => {
  const seekerId = req.user.id;
  const { application_id } = req.body;
  if (!application_id) throw new ApiError(400, 'application_id required');

  const [apps] = await promisePool.execute(
    `SELECT ja.*, j.seeker_id, j.title FROM job_applications ja
     JOIN jobs j ON j.id = ja.job_id
     WHERE ja.id = ? AND j.seeker_id = ?`,
    [application_id, seekerId]
  );
  if (apps.length === 0) throw new ApiError(404, 'Application not found');

  const app = apps[0];
  if (app.status !== 'pending') throw new ApiError(400, 'Application is not pending');

  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();

    // Accept this application
    await conn.execute(
      `UPDATE job_applications SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
      [application_id]
    );

    // Reject all others
    await conn.execute(
      `UPDATE job_applications SET status = 'rejected', updated_at = NOW()
       WHERE job_id = ? AND id != ?`,
      [app.job_id, application_id]
    );

    // Update job
    await conn.execute(
      `UPDATE jobs SET worker_id = ?, status = 'assigned', updated_at = NOW() WHERE id = ?`,
      [app.worker_id, app.job_id]
    );

    await conn.commit();

    // Notify worker
    await notificationService.saveNotification(promisePool, app.worker_id, 'job_assigned', {
      jobTitle: app.title, jobId: app.job_id
    });
    socketService.emitToUser(app.worker_id, 'job:assigned', { jobId: app.job_id, title: app.title });

    cacheService.invalidateJob(app.job_id);
    res.json({ success: true, message: 'Application accepted. Worker assigned.', data: { job_id: app.job_id, worker_id: app.worker_id } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─── Update Job Status ────────────────────────────────────────
const updateJobStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const jobId = parseInt(req.params.id);
  const { status, cancellation_reason } = req.body;

  const [jobs] = await promisePool.execute(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (jobs.length === 0) throw new ApiError(404, 'Job not found');

  const job = jobs[0];

  // If the job is already in the target status, do nothing and return success.
  if (job.status === status) {
    return res.json({
      success: true,
      message: `Job is already in '${status}' status.`,
      data: { job_id: jobId, status }
    });
  }

  const isSeeker = job.seeker_id === userId;
  const isWorker = job.worker_id === userId;
  if (!isSeeker && !isWorker) throw new ApiError(403, 'Not authorized to update this job');

  // Validate transitions
  const validTransitions = {
    assigned: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    open: ['cancelled']
  };
  if (!validTransitions[job.status]?.includes(status)) {
    throw new ApiError(400, `Cannot change status from ${job.status} to ${status}`);
  }

  let updateQuery = `UPDATE jobs SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason), updated_at = NOW()`;
  const updateParams = [status, cancellation_reason || null];

  if (status === 'completed') {
    updateQuery += `, end_date = NOW()`;
    // Update stats
    try {
      await promisePool.execute(
        `UPDATE worker_profiles SET total_jobs = total_jobs + 1, completed_jobs = completed_jobs + 1 WHERE user_id = ?`,
        [job.worker_id]
      );
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('Failed to update worker stats on job completion (total_jobs/completed_jobs columns might be missing).', { error: err.message, userId: job.worker_id });
      } else { throw err; }
    }
    try {
      await promisePool.execute(
        `UPDATE seeker_profiles SET total_jobs_completed = total_jobs_completed + 1 WHERE user_id = ?`,
        [job.seeker_id]
      );
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('Failed to update seeker stats on job completion (total_jobs_completed column might be missing).', { error: err.message, userId: job.seeker_id });
      } else { throw err; }
    }
  }

  updateQuery += ` WHERE id = ?`;
  updateParams.push(jobId);
  await promisePool.execute(updateQuery, updateParams);

  // Notify other party
  const notifyId = isSeeker ? job.worker_id : job.seeker_id;
  if (notifyId) {
    let notifType = 'job_status_updated';
    let message = `The status of job "${job.title}" has been updated to ${status}.`;
    if (status === 'completed') { notifType = 'job_completed'; }
    if (status === 'cancelled') {
      notifType = 'job_cancelled';
      message = `The job "${job.title}" has been cancelled. Reason: ${cancellation_reason || 'Not specified'}`;
    }

    await notificationService.saveNotification(promisePool, notifyId, notifType, {
      jobTitle: job.title, jobId, body: message
    });
    socketService.emitToUser(notifyId, 'job:status_updated', { jobId, status });
  }

  cacheService.invalidateJob(jobId);
  logger.info('Job status updated', { jobId, status, userId });

  res.json({ success: true, message: `Job status updated to ${status}`, data: { job_id: jobId, status } });
});

// ─── Get My Jobs ──────────────────────────────────────────────
const getMyJobs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.user_type;
  const { page = 1, limit = 10, status } = req.query;
  const { offset, limit: l } = paginate(page, limit);
  const field = userType === 'seeker' ? 'j.seeker_id' : 'j.worker_id';

  let whereClause = `WHERE ${field} = ?`;
  const params = [userId];
  if (status) { whereClause += ` AND j.status = ?`; params.push(status); }

  const countSql = `SELECT COUNT(*) as total FROM jobs j ${whereClause}`;
  const [[{ total }]] = await promisePool.execute(countSql, params);

  const sql = `
    SELECT j.*, c.name as category_name, c.icon as category_icon,
    ${userType === 'seeker'
      ? 'wp.full_name as worker_name, wp.profile_photo_url as worker_photo, wp.average_rating as worker_rating'
      : 'sp.full_name as seeker_name, sp.profile_photo_url as seeker_photo'}
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN worker_profiles wp ON wp.user_id = j.worker_id
    LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
    ${whereClause}
    ORDER BY j.created_at DESC LIMIT ? OFFSET ?
  `;
  const finalParams = [...params, l, offset];

  const [jobs] = await promisePool.execute(sql, finalParams);

  res.json({
    success: true,
    data: {
      jobs: jobs.map(j => ({ ...j, ai_price_suggestion: parseJSON(j.ai_price_suggestion, null) })),
      pagination: paginationMeta(total, parseInt(page), l)
    }
  });
});

// ─── Get Job Applications ─────────────────────────────────────
const getJobApplications = asyncHandler(async (req, res) => {
  const jobId = parseInt(req.params.id);

  const [jobs] = await promisePool.execute(
    `SELECT seeker_id FROM jobs WHERE id = ?`, [jobId]
  );
  if (jobs.length === 0) throw new ApiError(404, 'Job not found');
  if (jobs[0].seeker_id !== req.user.id) throw new ApiError(403, 'Only the job poster can view applications');

  const [applications] = await promisePool.execute(`
    SELECT ja.*, wp.full_name, wp.average_rating, wp.experience_years,
    wp.profile_photo_url, wp.profession, wp.city,
    (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = ja.worker_id) as review_count
    FROM job_applications ja
    LEFT JOIN worker_profiles wp ON wp.user_id = ja.worker_id
    WHERE ja.job_id = ?
    ORDER BY wp.average_rating DESC, ja.created_at ASC`, [jobId]);

  // AI rank applications
  const ranked = aiService.rankWorkersForJob({}, applications);

  res.json({ success: true, data: { applications: ranked, total: ranked.length } });
});

// ─── Search Jobs (for Workers) ────────────────────────────────
const searchJobs = asyncHandler(async (req, res) => {
  const workerId = req.user.id;

  // 1. Get worker's profile for smart filtering
  const [profiles] = await promisePool.execute(
    `SELECT profession, city, latitude, longitude, service_radius
     FROM worker_profiles WHERE user_id = ?`,
    [workerId]
  );
  const workerProfile = profiles[0] || {};

  // 2. Get filters from query, with fallbacks to worker profile
  const {
    page = 1, limit = 10,
    q, // text search
    category_id,
    min_budget, max_budget,
    priority,
    sort = 'created_at',
    // Use worker's location if not provided in query
    latitude = workerProfile.latitude,
    longitude = workerProfile.longitude,
    radius = workerProfile.service_radius || 50,
  } = req.query;

  const { offset, limit: l } = paginate(page, limit);

  let selectFields = `j.*, c.name as category_name, c.icon as category_icon,
    sp.full_name as seeker_name, sp.profile_photo_url as seeker_photo`;
  let fromClause = `
    FROM jobs j
    LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN seeker_profiles sp ON sp.user_id = j.seeker_id
  `;
  // Only show 'open' jobs for workers to apply to.
  let whereClause = ` WHERE j.status = 'open' `;

  const selectParams = [];
  const whereParams = [];

  // Text search on title and description
  if (q) {
    whereClause += ` AND (j.title LIKE ? OR j.description LIKE ?)`;
    const searchTerm = `%${q}%`;
    whereParams.push(searchTerm, searchTerm);
  }

  if (category_id) { whereClause += ` AND j.category_id = ?`; whereParams.push(category_id); }
  if (min_budget) { whereClause += ` AND j.budget >= ?`; whereParams.push(parseFloat(min_budget)); }
  if (max_budget) { whereClause += ` AND j.budget <= ?`; whereParams.push(parseFloat(max_budget)); }
  if (priority) { whereClause += ` AND j.priority = ?`; whereParams.push(priority); }

  // Location filter
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const rad = parseFloat(radius);

  if (!isNaN(lat) && !isNaN(lon)) {
    const distanceFormula = `(
      6371 * ACOS(
        LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(j.latitude)) *
        COS(RADIANS(j.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(j.latitude)))
      )
    )`;
    selectFields += `, ${distanceFormula} as distance`;
    selectParams.push(lat, lon, lat);

    whereClause += ` AND j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND ${distanceFormula} <= ?`;
    whereParams.push(lat, lon, lat, rad);
  }

  // Count total matching jobs
  const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [[{ total }]] = await promisePool.execute(countSql, whereParams);

  // Sorting
  const validSorts = {
    created_at: 'j.created_at DESC',
    budget_high: 'j.budget DESC',
    budget_low: 'j.budget ASC',
    distance: (!isNaN(lat) && !isNaN(lon)) ? 'distance ASC' : 'j.created_at DESC'
  };
  const orderBy = `ORDER BY ${validSorts[sort] || 'j.created_at DESC'}`;
  const limitClause = `LIMIT ? OFFSET ?`;

  const finalParams = [...selectParams, ...whereParams, l, offset];

  const mainSql = `SELECT ${selectFields} ${fromClause} ${whereClause} ${orderBy} ${limitClause}`;
  const [jobs] = await promisePool.execute(mainSql, finalParams);

  const processedJobs = jobs.map(j => ({
    ...j,
    ai_price_suggestion: parseJSON(j.ai_price_suggestion, null)
  }));

  res.json({
    success: true,
    message: `Found ${total} matching jobs.`,
    data: {
      jobs: processedJobs,
      pagination: paginationMeta(total, parseInt(page), l)
    }
  });
});

module.exports = {
  createJob, getAllJobs, getJobById, applyForJob, acceptApplication,
  updateJobStatus, getMyJobs, getJobApplications, searchJobs
};
