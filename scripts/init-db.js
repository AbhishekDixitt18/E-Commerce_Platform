/**
 * Database Initialization Script
 * Executes database/schema.sql to build tables, constraints, and indexes.
 */

const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  logger.info(`Reading schema definition from ${schemaPath}...`);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('Executing database schema initialization...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    logger.info('Database schema successfully initialized.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database schema initialization failed:', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
