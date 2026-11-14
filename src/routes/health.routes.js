/**
 * Health Check Routes
 */

const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

// Liveness probe
router.get('/', healthController.getHealth);

// Readiness / dependency probe
router.get('/ready', healthController.getReadiness);

module.exports = router;
