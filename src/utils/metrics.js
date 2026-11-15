/**
 * Prometheus Metrics Collection Utility
 * Defines standard metrics for request count, latency, response status, and system uptime.
 */

const client = require('prom-client');

// Initialize a dedicated Prometheus Registry
const register = new client.Registry();

// Collect default Node.js system and process metrics (CPU, Memory, Event Loop, GC)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
});

// 1. Total HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed by the application',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// 2. HTTP Request Duration Histogram (Latency)
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// 3. Application Uptime Gauge
const appUptimeGauge = new client.Gauge({
  name: 'app_uptime_seconds',
  help: 'Application uptime in seconds',
  registers: [register],
  collect() {
    this.set(process.uptime());
  },
});

// 4. Active Database Connections Gauge
const dbPoolTotalGauge = new client.Gauge({
  name: 'db_pool_total_connections',
  help: 'Total PostgreSQL pool connections',
  registers: [register],
});

const dbPoolIdleGauge = new client.Gauge({
  name: 'db_pool_idle_connections',
  help: 'Idle PostgreSQL pool connections',
  registers: [register],
});

const dbPoolWaitingGauge = new client.Gauge({
  name: 'db_pool_waiting_clients',
  help: 'Clients waiting for a PostgreSQL pool connection',
  registers: [register],
});

module.exports = {
  register,
  httpRequestCounter,
  httpRequestDuration,
  appUptimeGauge,
  dbPoolTotalGauge,
  dbPoolIdleGauge,
  dbPoolWaitingGauge,
};
