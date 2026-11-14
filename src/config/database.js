/**
 * PostgreSQL Connection Pool Manager
 * Manages connection pooling, lifecycle hooks, queries, and health verification.
 */

const { Pool } = require('pg');
const config = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

// Event listener: new client acquired
pool.on('connect', () => {
  logger.debug('New client connected to PostgreSQL pool');
});

// Event listener: unexpected idle client error
pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
});

// Event listener: client removed
pool.on('remove', () => {
  logger.debug('Client removed from PostgreSQL pool');
});

/**
 * Execute a parameterized query using the pool
 * @param {string} text - SQL query string
 * @param {Array} [params] - Parameterized values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, durationMs: duration, rows: res.rowCount });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query failed', { text, durationMs: duration, error: error.message });
    throw error;
  }
}

/**
 * Acquire a dedicated client for transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Test connectivity and measure query latency
 * @returns {Promise<{ isHealthy: boolean, latencyMs: number, timestamp: string }>}
 */
async function testConnection() {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT 1 AS health_check, NOW() AS db_time');
    const latencyMs = Date.now() - start;
    return {
      isHealthy: true,
      latencyMs,
      dbTime: res.rows[0].db_time,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    return {
      isHealthy: false,
      latencyMs,
      error: error.message,
    };
  }
}

/**
 * Gracefully close the connection pool
 */
async function closePool() {
  logger.info('Closing PostgreSQL pool connections...');
  await pool.end();
  logger.info('PostgreSQL pool has been closed.');
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
};
