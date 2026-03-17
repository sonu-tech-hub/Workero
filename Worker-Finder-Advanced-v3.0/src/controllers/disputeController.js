const { promisePool } = require('../config/database');
const { uploadToCloudinary } = require('../config/cloudinary');
const { paginate } = require('../utils/helpers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Create dispute
const createDispute = asyncHandler(async (req, res) => {
    const raisedBy = req.user.id;
    const { job_id, against_user, reason, description } = req.body;

    // Coerce and validate numeric inputs early to provide clear errors
    const jobIdNum = job_id === undefined || job_id === null ? NaN : parseInt(job_id, 10);
    const againstUserNum = against_user === undefined || against_user === null ? NaN : parseInt(against_user, 10);

    if (Number.isNaN(jobIdNum)) throw new ApiError(400, 'Invalid job_id: must be a numeric ID');
    if (Number.isNaN(againstUserNum)) throw new ApiError(400, 'Invalid against_user: must be a numeric user ID');
    
    // Check if job exists
    const [jobs] = await promisePool.query(
      'SELECT * FROM jobs WHERE id = ? AND (seeker_id = ? OR worker_id = ?)',
      [jobIdNum, raisedBy, raisedBy]
    );
    
    if (jobs.length === 0) throw new ApiError(404, 'Job not found or you are not part of this job');

    const job = jobs[0];
    const otherPartyId = job.seeker_id === raisedBy ? job.worker_id : job.seeker_id;

    if (againstUserNum !== otherPartyId) throw new ApiError(400, 'You can only raise a dispute against the other party involved in the job.');
    
    // Check if dispute already exists for this job
    const [existingDisputes] = await promisePool.query(
      'SELECT id FROM disputes WHERE job_id = ? AND status IN ("open", "under_review")',
      [jobIdNum]
    );
    
    if (existingDisputes.length > 0) throw new ApiError(400, 'A dispute already exists for this job');

    // Prevent users from raising disputes against themselves
    if (againstUserNum === raisedBy) throw new ApiError(400, 'You cannot raise a dispute against yourself');
    
    // Upload evidence photos if provided
    let evidenceUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'disputes');
        evidenceUrls.push(result.secure_url);
      }
    }
    
    // Create dispute
    const [result] = await promisePool.query(
      `INSERT INTO disputes (job_id, raised_by, against_user, reason, description, evidence_urls)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [jobIdNum, raisedBy, againstUserNum, reason, description, JSON.stringify(evidenceUrls)]
    );
    
    // Update job status
    await promisePool.query(
      'UPDATE jobs SET status = "disputed" WHERE id = ?',
      [job_id]
    );
    
    // Notify the other party (with schema fallback)
    try {
      await promisePool.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES (?, 'dispute_raised', ?, ?, ?)`,
        [againstUserNum, 'Dispute Raised', 'A dispute has been raised against you.', JSON.stringify({ disputeId: result.insertId, jobId: jobIdNum })]
      );
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && (err.message.includes("'body'") || err.message.includes("'data'"))) {
        // Fallback for older schema with 'message' and 'reference_id'
        await promisePool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id)
           VALUES (?, 'dispute_raised', ?, ?, ?)`,
          [againstUserNum, 'Dispute Raised', 'A dispute has been raised against you.', result.insertId]
        );
      } else { throw err; }
    }
    
    res.status(201).json({
      success: true,
      message: 'Dispute created successfully. Our team will review it shortly.',
      data: {
        dispute_id: result.insertId
      }
    });
});

// Get user disputes
const getUserDisputes = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const { limit: limitNum, offset } = paginate(page, limit);
    
    let query = `
      SELECT 
        d.*,
        j.title as job_title,
        u1.email as raised_by_email,
        u2.email as against_user_email,
        CASE 
          WHEN wp1.user_id IS NOT NULL THEN wp1.full_name
          WHEN sp1.user_id IS NOT NULL THEN sp1.full_name
          ELSE 'User'
        END as raised_by_name,
        CASE 
          WHEN wp2.user_id IS NOT NULL THEN wp2.full_name
          WHEN sp2.user_id IS NOT NULL THEN sp2.full_name
          ELSE 'User'
        END as against_user_name
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      JOIN users u1 ON d.raised_by = u1.id
      JOIN users u2 ON d.against_user = u2.id
      LEFT JOIN worker_profiles wp1 ON wp1.user_id = u1.id
      LEFT JOIN seeker_profiles sp1 ON sp1.user_id = u1.id
      LEFT JOIN worker_profiles wp2 ON wp2.user_id = u2.id
      LEFT JOIN seeker_profiles sp2 ON sp2.user_id = u2.id
      WHERE d.raised_by = ? OR d.against_user = ?
    `;
    
    const params = [userId, userId];
    
    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    
    const [disputes] = await promisePool.query(query, params);
    
    // Parse evidence photos
    disputes.forEach(dispute => {
      dispute.evidence_urls = dispute.evidence_urls ? JSON.parse(dispute.evidence_urls) : [];
    });
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM disputes 
      WHERE raised_by = ? OR against_user = ?
    `;
    const countParams = [userId, userId];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const [countResult] = await promisePool.query(countQuery, countParams);
    
    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total: countResult[0].total,
          total_pages: Math.ceil(countResult[0].total / limitNum)
        }
      }
    });
});

// Get dispute details
const getDisputeDetails = asyncHandler(async (req, res) => {
    const disputeId = parseInt(req.params.disputeId);
    const userId = req.user.id;

    const [disputes] = await promisePool.query(
      `SELECT 
        d.*,
        j.*,
        u1.email as raised_by_email,
        u2.email as against_user_email
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      JOIN users u1 ON d.raised_by = u1.id
      JOIN users u2 ON d.against_user = u2.id
      WHERE d.id = ? AND (d.raised_by = ? OR d.against_user = ?)`,
      [disputeId, userId, userId]
    );
    
    if (disputes.length === 0) throw new ApiError(404, 'Dispute not found');
    
    const dispute = disputes[0];
    dispute.evidence_urls = dispute.evidence_urls ? JSON.parse(dispute.evidence_urls) : [];
    
    res.json({
      success: true,
      data: dispute
    });
});

// Update dispute (admin only - simplified for now)
const updateDisputeStatus = asyncHandler(async (req, res) => {
    const disputeId = parseInt(req.params.disputeId);
    const userId = req.user.id;
    const userType = req.user.user_type;
    const { status, resolution_notes } = req.body || {};

    // Check if dispute exists
    const [disputes] = await promisePool.query(
      'SELECT * FROM disputes WHERE id = ?',
      [disputeId]
    );

    if (disputes.length === 0) throw new ApiError(404, 'Dispute not found.');

    const dispute = disputes[0];

    // Authorize: user must be part of the dispute OR an admin
    if (dispute.raised_by !== userId && dispute.against_user !== userId && userType !== 'admin') throw new ApiError(403, 'Access denied. You are not authorized to update this dispute.');

    await promisePool.query(
      `UPDATE disputes SET
        status = ?,
        resolution_notes = ?,
        resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN NOW() ELSE NULL END
       WHERE id = ?`,
      [status, resolution_notes, status, disputeId]
    );

    res.json({
      success: true,
      message: 'Dispute status updated successfully'
    });

});

module.exports = {
  createDispute,
  getUserDisputes,
  getDisputeDetails,
  updateDisputeStatus
};
