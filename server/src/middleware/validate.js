const { validationResult } = require('express-validator');
const { error } = require('../utils/apiResponse');

/**
 * Run express-validator checks and return 400 if any fail
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join('. ');
    return error(res, messages, 400, 'VALIDATION_ERROR');
  }
  next();
};

module.exports = { validate };
