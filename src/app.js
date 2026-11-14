/**
 * Express Application Configuration
 * Decoupled from server listening to facilitate integration testing with Supertest.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/health.routes');
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

// HTTP Request logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else if (config.isProduction) {
  app.use(morgan('combined'));
}

// Top-level health endpoints (for Docker HEALTHCHECK, AWS ALB, Kubernetes probes)
app.use('/health', healthRoutes);

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
