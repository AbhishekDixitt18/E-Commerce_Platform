/**
 * Admin Authentication Middleware
 * Validates administrative requests via the ADMIN_API_KEY environment variable.
 * Note: Never logs API keys or credentials.
 */

const crypto = require('crypto');
const config = require('../config/env');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

function adminAuth(req, res, next) {
  // Check x-admin-api-key header or Authorization: Bearer <key>
  const headerKey = req.headers['x-admin-api-key'];
  let bearerKey;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const providedKey = headerKey || bearerKey;

  if (!providedKey) {
    logger.warn('Unauthorized admin request: Missing Admin API Key', {
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(ApiError.unauthorized('Missing Admin API Key'));
  }

  const expectedKey = config.server.adminApiKey;

  // Constant-time comparison to protect against timing attacks
  const isMatch =
    providedKey.length === expectedKey.length &&
    crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));

  if (!isMatch) {
    logger.warn('Unauthorized admin request: Invalid Admin API Key', {
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(ApiError.unauthorized('Invalid Admin API Key'));
  }

  // Authentication succeeded
  return next();
}

module.exports = adminAuth;
