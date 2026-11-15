/**
 * Express Application Configuration
 * Decoupled from server listening to facilitate integration testing with Supertest.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const { requestLogger } = require('./middleware/requestLogger');
const { register } = require('./utils/metrics');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/health.routes');
const healthController = require('./controllers/health.controller');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const adminRoutes = require('./routes/admin.routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(cors({ origin: config.server.corsOrigin }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Structured JSON Request Logging & Prometheus Metrics Collection
app.use(requestLogger);

// Top-level health endpoints (for Docker HEALTHCHECK, AWS ALB, Kubernetes probes)
app.use('/health', healthRoutes);
app.get('/ready', (req, res, next) => healthController.getReadiness(req, res, next));

// Prometheus Metrics Scrape Endpoint
app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

// Direct API route aliases (/api/products, /api/orders, /api/admin)
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Versioned API endpoints (/api/v1)
app.use(config.server.apiPrefix, apiRoutes);

// Root redirect / information endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'ecommerce-cloud-devops-api',
    status: 'ACTIVE',
    endpoints: {
      health: '/health',
      ready: '/health/ready',
      api: config.server.apiPrefix,
    },
    timestamp: new Date().toISOString(),
  });
});

// Handle 404 - Not Found
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;

