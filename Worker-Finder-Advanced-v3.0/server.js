/**
 * ============================================================
 * SERVER.JS - Advanced Worker Finder v3.0.0
 * HTTP + Socket.io server startup
 * ============================================================
 */

require('dotenv').config({ debug: false, override: true });
const http = require('http');
const app = require('./src/app');
const { testConnection, closeConnection } = require('./src/config/database');
const logger = require('./src/utils/logger');
const socketService = require('./src/services/socketService');

const PORT = parseInt(process.env.PORT) || 5000;

async function startServer() {
  // Test DB connection
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('❌ Cannot connect to database. Check .env DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.io
  socketService.init(server);

  // Start listening
  server.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════╗
║     🔨 WORKER FINDER API v3.0.0                  ║
╠══════════════════════════════════════════════════╣
║  Status:      ✅ Running                          ║
║  Port:        ${PORT}                              ║
║  Mode:        ${(process.env.NODE_ENV || 'development').padEnd(12)}                 ║
║  Database:    ${(process.env.DB_NAME || 'N/A').padEnd(20)}           ║
║  Socket.io:   ✅ Real-time enabled                ║
║  AI Features: ✅ Active                           ║
║  Razorpay:    ${process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_your_key_id_here' ? '✅ Configured' : '⚠️  Mock mode'}    ║
╠══════════════════════════════════════════════════╣
║  API URL: http://localhost:${PORT}/api             ║
║  Health:  http://localhost:${PORT}/health          ║
╚══════════════════════════════════════════════════╝
    `);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────
  const gracefulShutdown = async (signal, err) => {
    if (err) logger.error(`Unhandled error before shutdown: ${err.message}`, { stack: err.stack });
    logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      await closeConnection();
      logger.info('✅ Graceful shutdown complete');
      process.exit(err ? 1 : 0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('unhandledRejection', (err) => gracefulShutdown('unhandledRejection', err));
  process.on('uncaughtException', (err) => gracefulShutdown('uncaughtException', err));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
