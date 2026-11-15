/**
 * Database Migration Runner Script
 * Sequentially executes versioned SQL migrations in database/migrations/
 * Tracks applied migrations in the schema_migrations table.
 */

const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../database/migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.info('No database/migrations directory found. Skipping migrations.');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    logger.info('No migration files found in database/migrations.');
    return;
  }

  logger.info(`Found ${files.length} migration file(s). Initializing database connection...`);
  const client = await pool.connect();

  try {
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const file of files) {
      const version = path.basename(file, '.sql');
      const checkRes = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);

      if (checkRes.rowCount > 0) {
        logger.info(`Migration already applied: ${file} (Skipping)`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      logger.info(`Applying migration: ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      await client.query(sqlContent);
      logger.info(`Successfully applied migration: ${file}`);
    }

    logger.info('All database migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', { error: error.message, stack: error.stack });
    process.exitCode = 1;
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

if (require.main === module) {
  runMigrations().catch(() => {
    process.exit(1);
  });
}

module.exports = runMigrations;
