/**
 * Custom Operational API Error
 * Distinguishes operational (expected) runtime errors from internal server bugs.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error description
   * @param {Array|Object} [errors=[]] - Optional details (e.g., validation issue list)
   * @param {boolean} [isOperational=true] - Indicates if the error is known/operational
   * @param {string} [stack=''] - Optional stack trace override
   */
  constructor(statusCode, message, errors = [], isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'Bad Request', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource conflict') {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal server error', errors = []) {
    return new ApiError(500, message, errors, false);
  }
}

module.exports = ApiError;
