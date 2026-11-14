/**
 * Database Seeding Script
 * Executes database/seed.sql to populate realistic sample catalog products.
 */

const fs = require('fs');
const path = require('path');
const { pool, closePool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function seedDatabase() {
  const seedPath = path.resolve(__dirname, '../database/seed.sql');
  logger.info(`Reading seed data from ${seedPath}...`);

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at: ${seedPath}`);
  }

  const seedSql = fs.readFileSync(seedPath, 'utf8');

  logger.info('Executing database seed script...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(seedSql);
    await client.query('COMMIT');
    logger.info('Database seeded successfully with sample catalog data.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database seeding failed:', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
