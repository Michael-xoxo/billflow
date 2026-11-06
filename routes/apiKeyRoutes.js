const express = require('express');
const router = express.Router();
const {
  createApiKey,
  getApiKeys,
  revokeApiKey
} = require('../controllers/apiKeyController');
const { authGuard } = require('../middleware/authGuard');
const rateLimiter = require('../middleware/rateLimiter');

router.use(authGuard, rateLimiter);

router.route('/').post(createApiKey).get(getApiKeys);
router.route('/:id').delete(revokeApiKey);

module.exports = router;
