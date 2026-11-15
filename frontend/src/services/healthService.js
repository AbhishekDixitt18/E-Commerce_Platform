import api from './api';

export const healthService = {
  /**
   * Fast application liveness probe
   */
  async getHealth() {
    const startTime = performance.now();
    const response = await api.get('/health');
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      status: response.data?.data?.status || 'UP',
      uptimeSeconds: response.data?.data?.uptimeSeconds || 0,
      timestamp: response.data?.data?.timestamp || new Date().toISOString(),
      environment: response.data?.data?.environment || 'production',
      version: response.data?.data?.version || '1.0.0',
      latencyMs,
    };
  },

  /**
   * Deep readiness probe including PostgreSQL connectivity and pool metrics
   */
  async getReadiness() {
    const startTime = performance.now();
    const response = await api.get('/ready');
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      ...response.data?.data,
      latencyMs,
    };
  },
};
