/**
 * Application Logger Utility
 * Emits structured JSON logs with log level filtering, timestamping, and sensitive data protection.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentPriority = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.info;

// Sensitive keys regex pattern to prevent logging passwords, API keys or sensitive data
const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|api[_-]?key|credit[_-]?card|cvv|ssn/i;

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

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const isJsonFormat = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  if (isJsonFormat) {
    const entry = {
      timestamp,
      level: level.toUpperCase(),
      message,
    };
    if (meta && typeof meta === 'object') {
      const sanitizedMeta = sanitize(meta);
      Object.assign(entry, sanitizedMeta);
    }
    return JSON.stringify(entry);
  }

  const metaString = meta && Object.keys(meta).length ? ` ${JSON.stringify(sanitize(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

const logger = {
  error: (message, meta) => {
    if (currentPriority >= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
  warn: (message, meta) => {
    if (currentPriority >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  info: (message, meta) => {
    if (currentPriority >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  debug: (message, meta) => {
    if (currentPriority >= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;
