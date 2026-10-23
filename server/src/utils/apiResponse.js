/**
 * Send a standardised success response
 */
const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a standardised error response
 */
const error = (res, message = 'An error occurred', statusCode = 500, code = null) => {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(statusCode).json(body);
};

module.exports = { success, error };
