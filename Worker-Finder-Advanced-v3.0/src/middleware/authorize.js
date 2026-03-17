const ApiError = require('../utils/ApiError');

/**
 * Middleware to check if a user's role is authorized to access a resource.
 * @param  {...String} roles - An array of allowed roles (e.g., 'admin', 'worker').
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // This should not happen if verifyToken runs first, but as a safeguard:
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }

    const userRole = req.user.user_type;

    if (!roles.includes(userRole)) {
      return next(new ApiError(403, `Access Denied: You do not have permission to access this resource.`));
    }

    next();
  };
};

module.exports = authorize;