/**
 * 404 Not Found Middleware
 * Catches all unmatched routes and forwards an ApiError.
 */

const ApiError = require('../utils/apiError');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
