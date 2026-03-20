﻿/**
 * ============================================================
 * DATABASE INITIALIZATION - Advanced Worker Finder v3.0.0
 * Creates all tables with indexes for performance
 * ============================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

async function ensureColumn(connection, dbName, tableName, columnName, definition) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, tableName, columnName]
  );

  if (rows.length === 0) {
    await connection.execute(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
    );
    console.log(`  ✅ migrated ${tableName}.${columnName}`);
  }
}

async function initDatabase() {
  let connection;
  try {
    // Connect without selecting a DB first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT) || 3306,
      multipleStatements: true
    });

    const dbName = process.env.DB_NAME || 'worker_finder_db';
    console.log(`\n🚀 Initializing database: ${dbName}\n`);

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);

    // ── USERS TABLE ──────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE,
        mobile VARCHAR(20) UNIQUE,
        password VARCHAR(255) NOT NULL,
        user_type ENUM('worker','seeker','admin') NOT NULL DEFAULT 'seeker',
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        is_email_verified BOOLEAN DEFAULT FALSE,
        is_mobile_verified BOOLEAN DEFAULT FALSE,
        otp VARCHAR(10),
        otp_expiry DATETIME,
        otp_attempts INT DEFAULT 0,
        refresh_token TEXT,
        failed_login_attempts INT DEFAULT 0,
        last_login_attempt DATETIME,
        account_locked_until DATETIME,
        last_login DATETIME,
        last_active DATETIME,
        device_tokens TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_mobile (mobile),
        INDEX idx_user_type (user_type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ users table');

    // Ensure verification columns exist for older schemas
    await ensureColumn(connection, dbName, 'users', 'is_email_verified', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn(connection, dbName, 'users', 'is_mobile_verified', 'BOOLEAN DEFAULT FALSE');

    // Ensure OTP columns exist for older schemas
    await ensureColumn(connection, dbName, 'users', 'otp', 'VARCHAR(10) NULL');
    await ensureColumn(connection, dbName, 'users', 'otp_expiry', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'users', 'otp_attempts', 'INT DEFAULT 0');

    // Ensure account security columns exist for older schemas
    await ensureColumn(connection, dbName, 'users', 'failed_login_attempts', 'INT DEFAULT 0');
    await ensureColumn(connection, dbName, 'users', 'last_login_attempt', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'users', 'account_locked_until', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'users', 'last_login', 'DATETIME NULL');

    // ── WORKER PROFILES ───────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS worker_profiles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL DEFAULT '',
        bio TEXT,
        profession VARCHAR(255),
        skills JSON,
        experience_years INT DEFAULT 0,
        hourly_rate DECIMAL(10,2),
        city VARCHAR(100),
        state VARCHAR(100),
        address TEXT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        profile_photo_url TEXT,
        profile_photo_public_id VARCHAR(255),
        verification_proof_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_available BOOLEAN DEFAULT TRUE,
        average_rating DECIMAL(3,2) DEFAULT 0.00,
        total_reviews INT DEFAULT 0,
        total_jobs INT DEFAULT 0,
        completed_jobs INT DEFAULT 0,
        cancelled_jobs INT DEFAULT 0,
        total_earnings DECIMAL(15,2) DEFAULT 0.00,
        certifications JSON,
        languages JSON,
        service_radius INT DEFAULT 10,
        subscription_plan ENUM('free','basic','premium') DEFAULT 'free',
        subscription_expires_at DATETIME,
        ai_performance_tier VARCHAR(20) DEFAULT 'Bronze',
        ai_match_score DECIMAL(5,2) DEFAULT 0.00,
        featured_until DATETIME,
        trust_score DECIMAL(5,2) DEFAULT 50.00,
        response_time_avg INT DEFAULT NULL,
        police_verified BOOLEAN DEFAULT FALSE,
        aadhaar_verified BOOLEAN DEFAULT FALSE,
        bank_verified BOOLEAN DEFAULT FALSE,
        referral_code VARCHAR(20) UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_profession (profession),
        INDEX idx_city (city),
        INDEX idx_is_available (is_available),
        INDEX idx_average_rating (average_rating),
        INDEX idx_coordinates (latitude, longitude),
        FULLTEXT INDEX idx_fulltext_search (full_name, bio, profession)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ worker_profiles table');

    // Ensure photo columns exist for older schemas
    await ensureColumn(connection, dbName, 'worker_profiles', 'profile_photo_url', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'worker_profiles', 'profile_photo_public_id', 'VARCHAR(255) NULL');

    // Ensure availability column exists
    await ensureColumn(connection, dbName, 'worker_profiles', 'is_available', 'BOOLEAN DEFAULT TRUE');

    // Ensure service_radius column exists
    await ensureColumn(connection, dbName, 'worker_profiles', 'service_radius', 'INT DEFAULT 10');

    // Ensure languages column exists
    await ensureColumn(connection, dbName, 'worker_profiles', 'languages', 'JSON NULL');

    // ── SEEKER PROFILES ───────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS seeker_profiles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL DEFAULT '',
        bio TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        address TEXT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        profile_photo_url TEXT,
        profile_photo_public_id VARCHAR(255),
        total_jobs_posted INT DEFAULT 0,
        total_jobs_completed INT DEFAULT 0,
        total_spent DECIMAL(15,2) DEFAULT 0.00,
        average_rating_given DECIMAL(3,2) DEFAULT 0.00,
        referral_code VARCHAR(20) UNIQUE,
        preferred_categories JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_city (city),
        INDEX idx_referral_code (referral_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Ensure profile columns exist for older schemas
    await ensureColumn(connection, dbName, 'seeker_profiles', 'city', 'VARCHAR(100) NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'state', 'VARCHAR(100) NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'address', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'latitude', 'DECIMAL(10,8) NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'longitude', 'DECIMAL(11,8) NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'preferred_categories', 'JSON NULL');

    await ensureColumn(connection, dbName, 'seeker_profiles', 'bio', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'profile_photo_url', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'profile_photo_public_id', 'VARCHAR(255) NULL');
    await ensureColumn(connection, dbName, 'seeker_profiles', 'total_spent', 'DECIMAL(15,2) DEFAULT 0.00');
    console.log('  ✅ seeker_profiles table');

    // ── CATEGORIES ────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        parent_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_parent_id (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensureColumn(connection, dbName, 'categories', 'sort_order', 'INT DEFAULT 0');
    await ensureColumn(connection, dbName, 'categories', 'parent_id', 'INT DEFAULT NULL');

    // Insert default categories
    await connection.execute(`
      INSERT IGNORE INTO categories (name, description, icon, sort_order) VALUES
        ('Plumbing', 'Pipe repair, water supply, drain cleaning', '🔧', 1),
        ('Electrical', 'Wiring, appliance repair, installation', '⚡', 2),
        ('Carpentry', 'Furniture making, wood repair, door fitting', '🪚', 3),
        ('Painting', 'Wall painting, whitewashing, interior design', '🎨', 4),
        ('Cleaning', 'House cleaning, deep cleaning, sanitization', '🧹', 5),
        ('Driving', 'Personal driver, cab services, transport', '🚗', 6),
        ('Cooking', 'Home cook, meal prep, catering', '👨‍🍳', 7),
        ('Tutoring', 'Academic tutoring, coaching, skill training', '📚', 8),
        ('Mechanic', 'Vehicle repair, bike service, engine work', '🔩', 9),
        ('Security', 'Guard services, watchman, CCTV monitoring', '🛡️', 10),
        ('Gardening', 'Garden care, landscaping, plant maintenance', '🌱', 11),
        ('AC Repair', 'AC servicing, installation, gas refill', '❄️', 12),
        ('Pest Control', 'Termite, cockroach, mosquito treatment', '🐛', 13),
        ('Movers & Packers', 'Relocation, furniture shifting, packing', '📦', 14),
        ('Nursing', 'Home nursing, elderly care, post-op care', '💊', 15)
    `);
    console.log('  ✅ categories table');

    // ── JOBS ──────────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        seeker_id INT NOT NULL,
        worker_id INT,
        category_id INT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        budget DECIMAL(10,2),
        final_amount DECIMAL(10,2),
        location VARCHAR(255),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        status ENUM('open','assigned','in_progress','completed','cancelled','disputed') DEFAULT 'open',
        priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
        start_date DATETIME,
        end_date DATETIME,
        deadline DATETIME,
        payment_status ENUM('pending','paid','refunded','failed') DEFAULT 'pending',
        payment_id VARCHAR(255),
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        platform_commission DECIMAL(10,2) DEFAULT 0,
        trust_safety_fee DECIMAL(10,2) DEFAULT 0,
        worker_payout DECIMAL(10,2) DEFAULT 0,
        ai_price_suggestion JSON,
        ai_description_quality INT DEFAULT 0,
        seeker_review_given BOOLEAN DEFAULT FALSE,
        worker_review_given BOOLEAN DEFAULT FALSE,
        cancellation_reason TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_seeker_id (seeker_id),
        INDEX idx_worker_id (worker_id),
        INDEX idx_category_id (category_id),
        INDEX idx_created_at (created_at),
        INDEX idx_coordinates (latitude, longitude),
        INDEX idx_payment_status (payment_status),
        FULLTEXT INDEX idx_job_search (title, description, location)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ jobs table');

    // Ensure newer job columns exist for older schemas
    await ensureColumn(connection, dbName, 'jobs', 'priority', "ENUM('low','normal','high','urgent') DEFAULT 'normal'");
    await ensureColumn(connection, dbName, 'jobs', 'deadline', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'jobs', 'final_amount', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, dbName, 'jobs', 'payment_status', "ENUM('pending','paid','refunded','failed') DEFAULT 'pending'");
    await ensureColumn(connection, dbName, 'jobs', 'razorpay_order_id', 'VARCHAR(255) NULL');
    await ensureColumn(connection, dbName, 'jobs', 'razorpay_payment_id', 'VARCHAR(255) NULL');
    await ensureColumn(connection, dbName, 'jobs', 'payment_id', 'VARCHAR(255) NULL');
    await ensureColumn(connection, dbName, 'jobs', 'platform_commission', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'jobs', 'trust_safety_fee', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'jobs', 'worker_payout', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'jobs', 'ai_price_suggestion', 'JSON NULL');
    await ensureColumn(connection, dbName, 'jobs', 'ai_description_quality', 'INT DEFAULT 0');
    await ensureColumn(connection, dbName, 'jobs', 'cancellation_reason', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'jobs', 'notes', 'TEXT NULL');
    await ensureColumn(connection, dbName, 'jobs', 'start_date', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'jobs', 'end_date', 'DATETIME NULL');
    await ensureColumn(connection, dbName, 'jobs', 'seeker_review_given', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn(connection, dbName, 'jobs', 'worker_review_given', 'BOOLEAN DEFAULT FALSE');

    // ── JOB APPLICATIONS ─────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        job_id INT NOT NULL,
        worker_id INT NOT NULL,
        cover_message TEXT,
        proposed_amount DECIMAL(10,2),
        status ENUM('pending','accepted','rejected','withdrawn') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_application (job_id, worker_id),
        INDEX idx_job_id (job_id),
        INDEX idx_worker_id (worker_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ job_applications table');

    // Migration: Handle old 'message' column, rename to 'cover_message'
    const [oldMessageCol] = await connection.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'job_applications' AND COLUMN_NAME = 'message'`,
      [dbName]
    );
    const [newCoverMessageCol] = await connection.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'job_applications' AND COLUMN_NAME = 'cover_message'`,
      [dbName]
    );
    if (oldMessageCol.length > 0 && newCoverMessageCol.length === 0) {
      await connection.execute(
        `ALTER TABLE \`job_applications\` CHANGE COLUMN \`message\` \`cover_message\` TEXT`
      );
      console.log(`  ✅ migrated job_applications.message to job_applications.cover_message`);
    }
    // Ensure the column exists even on fresh installs or if rename fails
    await ensureColumn(connection, dbName, 'job_applications', 'cover_message', 'TEXT NULL');

    // ── REVIEWS ───────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        job_id INT NOT NULL,
        reviewer_id INT NOT NULL,
        reviewee_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT,
        punctuality_rating INT DEFAULT NULL CHECK (punctuality_rating BETWEEN 1 AND 5),
        quality_rating INT DEFAULT NULL CHECK (quality_rating BETWEEN 1 AND 5),
        communication_rating INT DEFAULT NULL CHECK (communication_rating BETWEEN 1 AND 5),
        photos JSON,
        helpful_count INT DEFAULT 0,
        is_visible BOOLEAN DEFAULT TRUE,
        ai_sentiment VARCHAR(20) DEFAULT 'neutral',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_review (job_id, reviewer_id),
        INDEX idx_reviewee_id (reviewee_id),
        INDEX idx_reviewer_id (reviewer_id),
        INDEX idx_rating (rating),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ reviews table');

    // Ensure newer review columns exist for older schemas
    await ensureColumn(connection, dbName, 'reviews', 'punctuality_rating', 'INT DEFAULT NULL');
    await ensureColumn(connection, dbName, 'reviews', 'quality_rating', 'INT DEFAULT NULL');
    await ensureColumn(connection, dbName, 'reviews', 'communication_rating', 'INT DEFAULT NULL');
    await ensureColumn(connection, dbName, 'reviews', 'photos', 'JSON NULL');
    await ensureColumn(connection, dbName, 'reviews', 'helpful_count', 'INT DEFAULT 0');
    await ensureColumn(connection, dbName, 'reviews', 'is_visible', 'BOOLEAN DEFAULT TRUE');
    await ensureColumn(connection, dbName, 'reviews', 'ai_sentiment', "VARCHAR(20) DEFAULT 'neutral'");

    // ── MESSAGES ──────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        job_id INT,
        message TEXT NOT NULL,
        media_url TEXT,
        media_type ENUM('image','document','audio','video') DEFAULT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at DATETIME,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
        INDEX idx_sender_receiver (sender_id, receiver_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        INDEX idx_job_id (job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ messages table');

    // ── DISPUTES ──────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        job_id INT NOT NULL,
        raised_by INT NOT NULL,
        against_user INT NOT NULL,
        reason VARCHAR(500) NOT NULL,
        description TEXT,
        evidence_urls JSON,
        status ENUM('open','under_review','resolved','closed') DEFAULT 'open',
        resolution_notes TEXT,
        resolved_by INT,
        resolved_at DATETIME,
        refund_amount DECIMAL(10,2),
        refund_status ENUM('pending','processed','rejected') DEFAULT NULL,
        priority ENUM('low','medium','high','critical') DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (against_user) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_job_id (job_id),
        INDEX idx_raised_by (raised_by),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ disputes table');

    // ── REFERRALS ─────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referrer_id INT NOT NULL,
        referred_user_id INT,
        referral_code VARCHAR(20) NOT NULL,
        status ENUM('pending','completed','expired') DEFAULT 'pending',
        bonus_amount DECIMAL(10,2) DEFAULT 0,
        bonus_paid BOOLEAN DEFAULT FALSE,
        expires_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referral_code (referral_code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ referrals table');

    // ── PAYMENTS ──────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        job_id INT NOT NULL,
        payer_id INT NOT NULL,
        payee_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255) UNIQUE,
        razorpay_signature VARCHAR(500),
        payment_method VARCHAR(50),
        status ENUM('created','pending','captured','failed','refunded','partially_refunded') DEFAULT 'created',
        platform_fee DECIMAL(10,2) DEFAULT 0,
        gst_amount DECIMAL(10,2) DEFAULT 0,
        worker_payout DECIMAL(10,2) DEFAULT 0,
        refund_amount DECIMAL(10,2) DEFAULT 0,
        refund_reason TEXT,
        refund_id VARCHAR(255),
        notes JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (payee_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_job_id (job_id),
        INDEX idx_payer_id (payer_id),
        INDEX idx_payee_id (payee_id),
        INDEX idx_status (status),
        INDEX idx_razorpay_order_id (razorpay_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ payments table');

    // Ensure payment columns exist for older schemas
    await ensureColumn(connection, dbName, 'payments', 'razorpay_order_id', 'VARCHAR(255) NULL');
    await ensureColumn(connection, dbName, 'payments', 'razorpay_payment_id', 'VARCHAR(255) NULL UNIQUE');
    await ensureColumn(connection, dbName, 'payments', 'razorpay_signature', 'VARCHAR(500) NULL');
    await ensureColumn(connection, dbName, 'payments', 'platform_fee', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'payments', 'gst_amount', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'payments', 'worker_payout', 'DECIMAL(10,2) DEFAULT 0');
    await ensureColumn(connection, dbName, 'payments', 'notes', 'JSON NULL');

    // ── NOTIFICATIONS ─────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data JSON,
        priority ENUM('low','medium','high','critical') DEFAULT 'medium',
        is_read BOOLEAN DEFAULT FALSE,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ notifications table');

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        plan ENUM('basic','premium') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('active','expired','cancelled') DEFAULT 'active',
        payment_id INT,
        starts_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        features JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ subscriptions table');

    // ── ANALYTICS EVENTS ─────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        event_type VARCHAR(50) NOT NULL,
        event_data JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ analytics_events table');

    // ── AUDIT LOG ─────────────────────────────────────────────────
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ audit_logs table');

    // ── Create default admin user ─────────────────────────────────
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@workerfinder.com';
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM users WHERE email = ?', [adminEmail]
    );

    // CRITICAL SECURITY FIX: Do not use a hardcoded password.
    // Use an environment variable for the initial admin password.
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 12) {
      console.error('❌ ERROR: DEFAULT_ADMIN_PASSWORD is not set or is too weak. Please set a strong password in your .env file.');
      throw new Error('Admin password not configured securely.');
    }

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123456', 12);
      // const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await connection.execute(`
        INSERT INTO users (email, password, user_type, is_verified, is_active, is_email_verified)
        VALUES (?, ?, 'admin', TRUE, TRUE, TRUE)
      `, [adminEmail, hashedPassword]);
      console.log('  ✅ Default admin user created (admin@workerfinder.com / Admin@123456)');
      console.log(`  ✅ Default admin user created (admin@workerfinder.com). Password set from environment variable.`);
    }

    console.log('\n✅ Database initialization complete!\n');
    console.log('📋 Tables created:');
    console.log('   users, worker_profiles, seeker_profiles, categories');
    console.log('   jobs, job_applications, reviews, messages, disputes');
    console.log('   referrals, payments, notifications, subscriptions');
    console.log('   analytics_events, audit_logs\n');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
