const express = require('express');
const router = express.Router();
const { getAnalyticsSummary } = require('../controllers/analyticsController');
const { authGuard } = require('../middleware/authGuard');
const rateLimiter = require('../middleware/rateLimiter');

router.use(authGuard, rateLimiter);

router.get('/summary', getAnalyticsSummary);

module.exports = router;
