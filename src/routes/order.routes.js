/**
 * Order Routes
 */

const express = require('express');
const orderController = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const orderValidation = require('../validations/order.validation');

const router = express.Router();

// Place a new order (with Idempotency-Key support)
router.post('/', validate(orderValidation.createOrder), orderController.createOrder);

// Retrieve order details by ID
router.get('/:id', validate(orderValidation.getOrderById), orderController.getOrderById);

module.exports = router;
