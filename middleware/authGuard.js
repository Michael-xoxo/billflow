const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'super_secret_billflow_dev_jwt_key',
    { expiresIn: '7d' }
  );
}

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function authGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, missing Bearer token' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, empty token' });
    }

    // Branch 1: Programmatic API Key (sec_live_...)
    if (token.startsWith('sec_live_')) {
      const keyHash = hashApiKey(token);
      const apiKeyDoc = await ApiKey.findOne({ keyHash })
        .select('+keyHash')
        .populate('user', '-password');
      if (!apiKeyDoc) {
        return res.status(401).json({ message: 'Not authorized, invalid or revoked API key' });
      }

      const user = apiKeyDoc.user;
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, key owner not found' });
      }

      // Update lastUsedAt asynchronously without blocking request latency
      ApiKey.updateOne({ _id: apiKeyDoc._id }, { $set: { lastUsedAt: new Date() } })
        .exec()
        .catch(() => {});

      req.user = user;
      req.apiKeyScopes = Array.isArray(apiKeyDoc.scopes) ? apiKeyDoc.scopes : [];
      req.apiKeyHash = keyHash;
      req.authType = 'apiKey';
      return next();
    }

    // Branch 2: Standard Stateless JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_billflow_dev_jwt_key'
    );

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    req.apiKeyScopes = ['*'];
    req.authType = 'jwt';
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
}

module.exports = {
  generateToken,
  hashApiKey,
  authGuard,
  authMiddleware: authGuard,
  protect: authGuard
};
