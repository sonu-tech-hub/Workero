/**
 * ============================================================
 * DATABASE CONFIG - Advanced Worker Finder v3.0.0
 * MySQL pool with connection retry & query helpers
 * ============================================================
 */

const mysql = require('mysql2');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'worker_finder_db',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000,
  charset: 'utf8mb4'
});

const promisePool = pool.promise();

// ─── Test Connection ─────────────────────────────────────────
const testConnection = async () => {
  let connection;
  try {
    connection = await promisePool.getConnection();
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    return false;
  } finally {
    if (connection) connection.release();
  }
};

// ─── Close Pool ───────────────────────────────────────────────
const closeConnection = async () => {
  try {
    await promisePool.end();
    logger.info('✅ Database pool closed');
  } catch (error) {
    logger.error('❌ Error closing database pool', { error: error.message });
  }
};

// ─── Execute with Error Handling ─────────────────────────────
const executeQuery = async (sql, params = []) => {
  try {
    const [rows] = await promisePool.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error('Query execution failed', {
      sql: sql.substring(0, 100),
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

module.exports = { promisePool, testConnection, closeConnection, executeQuery };

