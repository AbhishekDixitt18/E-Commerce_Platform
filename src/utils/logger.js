/**
 * Application Logger Utility
 * Provides structured log outputs with log level filtering and timestamping.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentPriority = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.info;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(meta && Object.keys(meta).length ? { meta } : {}),
    });
  }

  const metaString = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
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
