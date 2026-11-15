/**
 * Structured Request Logger & Metrics Tracking Middleware
 * Emits JSON-formatted access logs and records Prometheus request count and duration metrics.
 */

const logger = require('../utils/logger');
const { httpRequestCounter, httpRequestDuration } = require('../utils/metrics');

// Patterns for sensitive fields to redact from logs
const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|api[_-]?key|credit[_-]?card|cvv|ssn/i;

/**
 * Deeply sanitizes an object by masking sensitive keys
 */
function sanitize(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Extracts normalized route path to prevent high metric cardinality (e.g., replaces UUIDs)
 */
function getNormalizedRoute(req) {
  let path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  if (!path) path = req.originalUrl ? req.originalUrl.split('?')[0] : '/';

  // Replace standard UUIDs with :id parameter token
  path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  return path || '/';
}

function requestLogger(req, res, next) {
  const startTime = process.hrtime();
  const startTimestamp = Date.now();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const durationMs = Math.round(durationSeconds * 1000 * 100) / 100;

    const route = getNormalizedRoute(req);
    const statusCode = res.statusCode;
    const method = req.method;

    // Record Prometheus Metrics
    try {
      httpRequestCounter.inc({
        method,
        route,
        status_code: statusCode,
      });

      httpRequestDuration.observe(
        {
          method,
          route,
          status_code: statusCode,
        },
        durationSeconds
      );
    } catch {
      // Metric recording should never crash request handling
    }

    // Determine Structured Log Level
    let level = 'info';
    if (statusCode >= 500) {
      level = 'error';
    } else if (statusCode >= 400) {
      level = 'warn';
    }

    // Build Structured JSON Log Entry
    const logEntry = {
      timestamp: new Date(startTimestamp).toISOString(),
      level: level.toUpperCase(),
      service: 'ecommerce-api',
      type: 'http_access',
      method,
      route,
      url: req.originalUrl,
      statusCode,
      durationMs,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      ...(req.query && Object.keys(req.query).length ? { query: sanitize(req.query) } : {}),
    };

    if (level === 'error') {
      logger.error(`[${method}] ${route} -> ${statusCode} (${durationMs}ms)`, logEntry);
    } else if (level === 'warn') {
      logger.warn(`[${method}] ${route} -> ${statusCode} (${durationMs}ms)`, logEntry);
    } else {
      logger.info(`[${method}] ${route} -> ${statusCode} (${durationMs}ms)`, logEntry);
    }
  });

  next();
}

module.exports = {
  requestLogger,
  sanitize,
  getNormalizedRoute,
};
