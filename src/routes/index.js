/**
 * Master API Router
 * Aggregates all modular route handlers under the versioned API prefix.
 */

const express = require('express');
const healthRoutes = require('./health.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

// Mount Health Check under /api/v1/health
router.use('/health', healthRoutes);

// Mount Products under /api/v1/products
router.use('/products', productRoutes);

// Mount Orders under /api/v1/orders
router.use('/orders', orderRoutes);

// Mount Admin under /api/v1/admin
router.use('/admin', adminRoutes);

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
