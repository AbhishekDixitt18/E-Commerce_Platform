/**
 * Standardized API Response Utilities
 * Enforces a consistent envelope for all successful and error responses.
 */

function successResponse(res, { statusCode = 200, message = 'Success', data = null, meta = null }) {
  const payload = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(payload);
}

function errorResponse(res, { statusCode = 500, message = 'Internal Server Error', errors = [] }) {
  const payload = {
    success: false,
    message,
    ...(errors && errors.length ? { errors } : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(payload);
}

module.exports = {
  successResponse,
  errorResponse,
};
