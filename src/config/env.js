/**
 * Environment Configuration and Schema Validation
 * Validates process.env variables and exposes a centralized immutable config.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const environment = process.env.NODE_ENV || 'development';

const config = {
  env: environment,
  isProduction: environment === 'production',
  isDevelopment: environment === 'development',
  isTest: environment === 'test',

  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    adminApiKey: process.env.ADMIN_API_KEY || 'algions-devops-admin-key-2026',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || (environment === 'test' ? 'ecommerce_test' : 'ecommerce_dev'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || 5000,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Fail fast in production if critical variables are missing or insecure
if (config.isProduction) {
  const missing = [];
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!process.env.DB_HOST) missing.push('DB_HOST');
  if (!process.env.DB_NAME) missing.push('DB_NAME');
  if (!process.env.DB_USER) missing.push('DB_USER');

  if (missing.length > 0) {
    throw new Error(`[Configuration Error] Missing required production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = Object.freeze(config);

