const { promisePool } = require('../config/database');
const { paginate, paginationMeta, generateReferralCode } = require('../utils/helpers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const REFERRAL_REFERRER_CANDIDATES = ['referrer_id', 'referrer_user_id', 'referrer', 'user_id'];
const REFERRAL_REFERRED_CANDIDATES = ['referred_user_id', 'referred_id', 'referred_user', 'new_user_id'];
const REFERRAL_CREATED_AT_CANDIDATES = ['created_at', 'createdAt'];

const pickFirstExistingColumn = (columns, candidates) => candidates.find((c) => columns.includes(c)) || null;

const getReferralSchemaColumns = async () => {
  const [rows] = await promisePool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referrals'`
  );

  const cols = rows.map((r) => r.COLUMN_NAME);
  return {
    referrerCol: pickFirstExistingColumn(cols, REFERRAL_REFERRER_CANDIDATES),
    referredCol: pickFirstExistingColumn(cols, REFERRAL_REFERRED_CANDIDATES),
    createdAtCol: pickFirstExistingColumn(cols, REFERRAL_CREATED_AT_CANDIDATES),
    hasStatus: cols.includes('status'),
    hasBonusAmount: cols.includes('bonus_amount')
  };
};

// Get user's referral code and stats
const getReferralInfo = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.user_type;

  // Get referral code
  const tableName = userType === 'worker' ? 'worker_profiles' : 'seeker_profiles';
  const [profiles] = await promisePool.execute(
    `SELECT referral_code FROM ${tableName} WHERE user_id = ?`,
    [userId]
  );

  let referralCode = profiles[0]?.referral_code;

  // If profile exists but code is missing, or profile doesn't exist, generate and save one.
  if (!referralCode) {
    referralCode = generateReferralCode(userId);
    // This query will create a profile if it doesn't exist, or update the
    // existing one if the referral_code is NULL.
    await promisePool.execute(
      `INSERT INTO ${tableName} (user_id, referral_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE referral_code = VALUES(referral_code)`,
      [userId, referralCode]
    );
  }

  const referralSchema = await getReferralSchemaColumns();
  const { referrerCol, referredCol, createdAtCol, hasStatus, hasBonusAmount } = referralSchema;

  const defaultStats = {
    total_referrals: 0,
    completed_referrals: 0,
    total_earnings: '0.00',
    bonus_per_referral: parseFloat(process.env.REFERRAL_BONUS || 100)
  };

  let stats = [{ total_referrals: 0, completed_referrals: 0, total_earnings: 0 }];
  let referrals = [];

  if (referrerCol) {
    const completedExpr = hasStatus
      ? `SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`
      : `0`;
    const earningsExpr = hasStatus && hasBonusAmount
      ? `SUM(CASE WHEN status = 'completed' THEN bonus_amount ELSE 0 END)`
      : `0`;

    [stats] = await promisePool.execute(
      `SELECT 
        COUNT(*) as total_referrals,
        ${completedExpr} as completed_referrals,
        ${earningsExpr} as total_earnings
      FROM referrals
      WHERE ${referrerCol} = ?`,
      [userId]
    );

    if (referredCol) {
      const referredDateExpr = createdAtCol ? `r.${createdAtCol}` : 'NULL';
      [referrals] = await promisePool.execute(
        `SELECT 
          r.*,
          u.email as referred_user_email,
          ${referredDateExpr} as referred_date,
          u.user_type as referred_user_type,
          COALESCE(wp.full_name, sp.full_name, 'User') as referred_user_name
        FROM referrals r
        JOIN users u ON r.${referredCol} = u.id
        LEFT JOIN worker_profiles wp ON wp.user_id = u.id
        LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
        WHERE r.${referrerCol} = ?
        ORDER BY ${createdAtCol ? `r.${createdAtCol}` : 'r.id'} DESC
        LIMIT 10`,
        [userId]
      );
    }
  }

  res.json({
    success: true,
    data: {
      referral_code: referralCode,
      stats: {
        ...defaultStats,
        total_referrals: stats[0]?.total_referrals || 0,
        completed_referrals: stats[0]?.completed_referrals || 0,
        total_earnings: parseFloat(stats[0]?.total_earnings || 0).toFixed(2)
      },
      recent_referrals: referrals
    }
  });
});

// Get all referrals
const getAllReferrals = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  const { limit: limitNum, offset } = paginate(page, limit);
  const referralSchema = await getReferralSchemaColumns();
  const { referrerCol, referredCol, createdAtCol, hasStatus } = referralSchema;

  if (!referrerCol) {
    return res.json({
      success: true,
      data: {
        referrals: [],
        pagination: paginationMeta(0, parseInt(page, 10), limitNum)
      }
    });
  }

  let where = `WHERE r.${referrerCol} = ?`;
  const params = [userId];

  if (status && hasStatus) {
    where += ` AND r.status = ?`;
    params.push(status);
  }

  let referrals = [];
  if (referredCol) {
    const referredDateExpr = createdAtCol ? `r.${createdAtCol}` : 'NULL';
    [referrals] = await promisePool.execute(
      `SELECT 
        r.*,
        u.email as referred_user_email,
        u.user_type as referred_user_type,
        ${referredDateExpr} as referred_date,
        COALESCE(wp.full_name, sp.full_name, 'User') as referred_user_name
      FROM referrals r
      JOIN users u ON r.${referredCol} = u.id
      LEFT JOIN worker_profiles wp ON wp.user_id = u.id
      LEFT JOIN seeker_profiles sp ON sp.user_id = u.id
      ${where}
      ORDER BY ${createdAtCol ? `r.${createdAtCol}` : 'r.id'} DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
  }

  // Get total count
  const [[{ total }]] = await promisePool.execute(
    `SELECT COUNT(*) as total FROM referrals r ${where}`,
    params
  );

  res.json({
    success: true,
    data: {
      referrals,
      pagination: paginationMeta(total, parseInt(page), limitNum)
    }
  });
});

// Validate referral code
const validateReferralCode = asyncHandler(async (req, res) => {
  const { referral_code } = req.params;
  if (!referral_code) {
    throw new ApiError(400, 'Referral code is required.');
  }

  // Check in worker profiles
  const [workerProfiles] = await promisePool.execute(
      `SELECT wp.*, u.email, u.is_active 
       FROM worker_profiles wp
       JOIN users u ON wp.user_id = u.id
       WHERE wp.referral_code = ? AND u.is_active = TRUE`,
      [referral_code]
  );

  // Check in seeker profiles
  const [seekerProfiles] = await promisePool.execute(
      `SELECT sp.*, u.email, u.is_active 
       FROM seeker_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.referral_code = ? AND u.is_active = TRUE`,
      [referral_code]
  );

  const profile = workerProfiles[0] || seekerProfiles[0];

  if (!profile) {
    throw new ApiError(404, 'Invalid or inactive referral code.');
  }

  res.json({
    success: true,
    message: 'Valid referral code',
    data: {
      referrer_name: profile.full_name,
      bonus_amount: parseFloat(process.env.REFERRAL_BONUS || 100)
    }
  });
});

module.exports = {
  getReferralInfo,
  getAllReferrals,
  validateReferralCode
};
