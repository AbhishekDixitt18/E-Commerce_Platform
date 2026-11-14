/**
 * Health Controller
 * Endpoints for container healthchecks, Kubernetes liveness/readiness probes, and monitoring.
 */

const healthService = require('../services/health.service');
const { successResponse } = require('../utils/response');

class HealthController {
  /**
   * Basic liveness probe (GET /health)
   */
  async getHealth(req, res, next) {
    try {
      const data = healthService.getLiveness();
      return successResponse(res, {
        statusCode: 200,
        message: 'Service is healthy',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Deep readiness probe with database health (GET /health/ready or GET /api/v1/health)
   */
  async getReadiness(req, res, next) {
    try {
      const data = await healthService.getReadiness();
      const statusCode = data.status === 'UP' ? 200 : 503;
      return res.status(statusCode).json({
        success: data.status === 'UP',
        message: data.status === 'UP' ? 'All dependencies are healthy' : 'Service is degraded',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new HealthController();
