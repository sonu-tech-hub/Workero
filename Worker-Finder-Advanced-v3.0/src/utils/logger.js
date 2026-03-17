const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure the log directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const isDevelopment = process.env.NODE_ENV === 'development';

// Define the formats for file and console logging
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define the transports (destinations) for the logs
const transports = [
  // Log errors to a dedicated error file
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  // Log all messages to a combined file
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
  }),
];

// In development, also log to the console with a more readable format
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

const logger = winston.createLogger({
  level: 'info', // The minimum level of messages to log.
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false, // Do not exit on handled exceptions
});

// Create a stream object that can be used by morgan to pipe HTTP request logs to winston
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;