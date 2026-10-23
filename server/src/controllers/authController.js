const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { success, error } = require('../utils/apiResponse');

const signToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return error(res, 'An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    const user = await User.create({ name, email, phone, password, role: 'citizen' });
    const token = signToken(user._id, user.role);

    return success(
      res,
      { token, user },
      'Registration successful. Welcome!',
      201
    );
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return error(res, messages.join('. '), 400, 'VALIDATION_ERROR');
    }
    console.error('Register error:', err);
    return error(res, 'Registration failed. Please try again.', 500);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return error(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return error(res, 'Your account has been deactivated.', 403, 'ACCOUNT_INACTIVE');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return error(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken(user._id, user.role);
    const userObj = user.toJSON();

    return success(res, { token, user: userObj }, 'Login successful.');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed. Please try again.', 500);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('municipalCorporationId', 'name code city');
    if (!user) return error(res, 'User not found.', 404);
    return success(res, { user }, 'User profile retrieved.');
  } catch (err) {
    console.error('GetMe error:', err);
    return error(res, 'Failed to retrieve profile.', 500);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  // JWT is stateless — client must discard the token
  return success(res, {}, 'Logged out successfully.');
};

module.exports = { register, login, getMe, logout };
