/**
 * Application Server Entrypoint
 * Handles HTTP server binding, database connectivity check on boot, and graceful shutdown.
 */

const app = require('./app');
const config = require('./config/env');
const { testConnection, closePool } = require('./config/database');
const logger = require('./utils/logger');

let server;

async function startServer() {
  try {
    // Test database connection on boot
    logger.info('Connecting to PostgreSQL database...', {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
    });

    const dbHealth = await testConnection();
    if (dbHealth.isHealthy) {
      logger.info('Database connection established successfully.', {
        latencyMs: dbHealth.latencyMs,
        dbTime: dbHealth.dbTime,
      });
    } else {
      logger.warn('Database connection could not be established on boot.', {
        error: dbHealth.error,
        tip: 'Ensure PostgreSQL container or service is running with matching credentials.',
      });
    }

    // Start HTTP listener
    server = app.listen(config.server.port, () => {
      logger.info(`Server successfully started in [${config.env}] mode.`);
      logger.info(`Listening on port ${config.server.port} (URL: http://localhost:${config.server.port})`);
      logger.info(`Health check available at: http://localhost:${config.server.port}/health`);
      logger.info(`API Base route: http://localhost:${config.server.port}${config.server.apiPrefix}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Graceful shutdown lifecycle management
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await closePool();
        logger.info('Process cleanly terminated.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during database pool cleanup:', { error: err.message });
        process.exit(1);
      }
    });

    // Force close after 10 seconds if hanging
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcefully killing process.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : null,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

// Boot server
startServer();
