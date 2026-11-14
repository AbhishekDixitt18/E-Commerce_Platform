/**
 * Admin Routes
 * Protected endpoints for administrative product catalog and inventory management.
 */

const express = require('express');
const productController = require('../controllers/product.controller');
const adminAuth = require('../middleware/adminAuth');
const validate = require('../middleware/validate');
const productValidation = require('../validations/product.validation');

const router = express.Router();

// Enforce admin authentication across all /api/admin routes
router.use(adminAuth);

// Create new product
router.post('/products', validate(productValidation.createProduct), productController.createProduct);

// Update product stock / inventory
router.patch('/products/:id/stock', validate(productValidation.updateStock), productController.updateStock);

module.exports = router;
