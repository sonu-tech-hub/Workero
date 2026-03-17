const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Middleware to handle requests for routes that are not found.
 * It creates a 404 ApiError and passes it to the next middleware.
 */
const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Global error handling middleware.
 * It catches all errors passed via next() and sends a formatted JSON response.
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message = 'Internal Server Error' } = err;

  // Log the error. This will be captured by winston and sent to the appropriate transports.
  logger.error(err.message, {
    statusCode: statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    isApiError: err instanceof ApiError, // Flag to distinguish expected vs. unexpected errors
  });

  const response = {
    success: false,
    message,
    statusCode,
  };

  // Only include the error stack in the response during development for easier debugging.
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};