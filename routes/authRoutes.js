const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authGuard } = require('../middleware/authGuard');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authGuard, getMe);

module.exports = router;
