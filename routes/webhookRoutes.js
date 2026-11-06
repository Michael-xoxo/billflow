const express = require('express');
const router = express.Router();
const { handleWebhook, getWebhookEvents } = require('../controllers/webhookController');

router.post('/', handleWebhook);
router.get('/', getWebhookEvents);

module.exports = router;
