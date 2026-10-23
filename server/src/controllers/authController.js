const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/prisma');
const { success, error } = require('../utils/apiResponse');

const signToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const formatUser = (user) => {
  if (!user) return null;
  const userObj = { ...user };
  delete userObj.password;
  userObj._id = user.id; // backward compatibility with client
  if (userObj.municipalCorporation) {
    userObj.municipalCorporation._id = userObj.municipalCorporation.id;
  }
  return userObj;
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!email || !password || !name) {
      return error(res, 'Name, email, and password are required.', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return error(res, 'An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        password: hashedPassword,
        role: 'citizen',
      },
    });

    const token = signToken(user.id, user.role);
    const formattedUser = formatUser(user);

    return success(
      res,
      { token, user: formattedUser },
      'Registration successful. Welcome!',
      201
    );
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Registration failed. Please try again.', 500);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password are required.', 400, 'INVALID_CREDENTIALS');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return error(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return error(res, 'Your account has been deactivated.', 403, 'ACCOUNT_INACTIVE');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return error(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken(user.id, user.role);
    const userObj = formatUser(user);

    return success(res, { token, user: userObj }, 'Login successful.');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed. Please try again.', 500);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        municipalCorporation: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!user) return error(res, 'User not found.', 404);
    return success(res, { user: formatUser(user) }, 'User profile retrieved.');
  } catch (err) {
    console.error('GetMe error:', err);
    return error(res, 'Failed to retrieve profile.', 500);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  return success(res, {}, 'Logged out successfully.');
};

module.exports = { register, login, getMe, logout };
