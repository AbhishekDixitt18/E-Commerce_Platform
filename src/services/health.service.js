/**
 * Health Check Service
 * Aggregates service status, uptime, system metrics, and database connectivity.
 */

const os = require('os');
const { testConnection, pool } = require('../config/database');
const config = require('../config/env');
const packageJson = require('../../package.json');

class HealthService {
  /**
   * Get fast liveness check data (CPU/memory/process status)
   */
  getLiveness() {
    return {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: packageJson.version,
    };
  }

  /**
   * Get detailed readiness status including database health and pool stats
   */
  async getReadiness() {
    const dbStatus = await testConnection();
    const liveness = this.getLiveness();

    const poolMetrics = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    const isSystemHealthy = dbStatus.isHealthy;

    return {
      status: isSystemHealthy ? 'UP' : 'DEGRADED',
      ...liveness,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: os.arch(),
        memoryUsageMB: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
      dependencies: {
        database: {
          type: 'PostgreSQL',
          status: dbStatus.isHealthy ? 'CONNECTED' : 'DISCONNECTED',
          latencyMs: dbStatus.latencyMs,
          ...(dbStatus.dbTime ? { serverTime: dbStatus.dbTime } : {}),
          ...(dbStatus.error ? { error: dbStatus.error } : {}),
          pool: poolMetrics,
        },
      },
    };
  }
}

module.exports = new HealthService();
