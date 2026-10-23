const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');

/**
 * Protect routes — verifies JWT and attaches req.user
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return error(res, 'Authentication required. Please log in.', 401, 'NO_TOKEN');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return error(res, 'User not found. Token may be invalid.', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return error(res, 'Your account has been deactivated.', 403, 'ACCOUNT_INACTIVE');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Session expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }
    return error(res, 'Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
  }
};

/**
 * Restrict route to admin role only
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return error(res, 'Access denied. Admin privileges required.', 403, 'FORBIDDEN');
};

/**
 * Restrict route to citizen role only
 */
const citizenOnly = (req, res, next) => {
  if (req.user && req.user.role === 'citizen') {
    return next();
  }
  return error(res, 'Access denied. Citizen access only.', 403, 'FORBIDDEN');
};

module.exports = { protect, adminOnly, citizenOnly };
