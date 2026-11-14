/**
 * Master API Router
 * Aggregates all modular route handlers under the versioned API prefix.
 */

const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

// Mount Health Check under /api/v1/health
router.use('/health', healthRoutes);

// Welcome endpoint for root API check
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to E-Commerce Cloud DevOps REST API',
    version: '1.0.0',
    documentation: '/api/v1/health',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
