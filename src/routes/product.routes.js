/**
 * Product Routes
 * Public customer-facing product routes.
 */

const express = require('express');
const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate');
const productValidation = require('../validations/product.validation');

const router = express.Router();

// List products with search, filtering, and pagination
router.get('/', validate(productValidation.getProducts), productController.getProducts);

// Retrieve single product details by ID
router.get('/:id', validate(productValidation.getProductById), productController.getProductById);

module.exports = router;
