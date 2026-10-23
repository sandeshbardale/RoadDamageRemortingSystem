const { error } = require('../utils/apiResponse');

/**
 * Global error handler — must be registered last in Express app
 */
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return error(res, messages.join('. '), 400, 'VALIDATION_ERROR');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return error(res, `${field} already exists.`, 409, 'DUPLICATE_KEY');
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return error(res, `Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token.', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired.', 401, 'TOKEN_EXPIRED');
  }

  // Default
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return error(res, message, statusCode);
};

module.exports = { errorHandler };
