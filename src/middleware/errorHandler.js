/**
 * Centralized Error Handling Middleware
 * Intercepts operational errors, validation failures, database errors, and uncaught exceptions.
 */

const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');
const config = require('../config/env');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  // Handle JSON parsing syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = ApiError.badRequest('Malformed JSON in request body');
  }

  // Handle PostgreSQL specific errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        error = new ApiError(409, 'A resource with this identifier already exists', [
          { detail: err.detail || 'Unique constraint violation' },
        ]);
        break;
      case '23503': // foreign_key_violation
        error = new ApiError(400, 'Referenced resource does not exist', [
          { detail: err.detail || 'Foreign key violation' },
        ]);
        break;
      case '23514': // check_violation
        error = new ApiError(400, 'Validation constraint failed on database', [
          { detail: err.detail || 'Check constraint violation' },
        ]);
        break;
      case '22P02': // invalid_text_representation (e.g., bad UUID)
        error = new ApiError(400, 'Invalid data format or UUID provided');
        break;
      default:
        if (!error.statusCode) {
          logger.error('Unhandled Database Error', { code: err.code, message: err.message, stack: err.stack });
          error = ApiError.internal('Database operation failed');
        }
    }
  }

  // Fallback for non-ApiError instances
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, [], false, err.stack);
  }

  // Log non-operational (server bugs) or 500s with stack trace
  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${error.message}`, {
      statusCode: error.statusCode,
      stack: error.stack,
      ip: req.ip,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${error.message}`, {
      statusCode: error.statusCode,
      errors: error.errors,
    });
  }

  const responsePayload = {
    success: false,
    message: error.message,
    ...(error.errors && error.errors.length > 0 ? { errors: error.errors } : {}),
    timestamp: new Date().toISOString(),
    ...(config.isDevelopment ? { stack: error.stack } : {}),
  };

  return res.status(error.statusCode).json(responsePayload);
}

module.exports = errorHandler;
