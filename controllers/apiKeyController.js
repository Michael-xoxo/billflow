const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const { hashApiKey } = require('../middleware/authGuard');

async function createApiKey(req, res) {
  try {
    const { name, scopes } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'API key name is required' });
    }

    const randomHex = crypto.randomBytes(32).toString('hex');
    const rawKey = `sec_live_${randomHex}`;
    const keyHash = hashApiKey(rawKey);
    const prefix = rawKey.slice(0, 8);

    const keyData = {
      user: req.user._id,
      name: String(name).trim(),
      keyHash,
      prefix
    };

    if (Array.isArray(scopes) && scopes.length > 0) {
      keyData.scopes = scopes;
    }

    const apiKeyDoc = await ApiKey.create(keyData);

    return res.status(201).json({
      _id: apiKeyDoc._id,
      name: apiKeyDoc.name,
      prefix: apiKeyDoc.prefix,
      rawKey,
      scopes: apiKeyDoc.scopes,
      createdAt: apiKeyDoc.createdAt
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getApiKeys(req, res) {
  try {
    const keys = await ApiKey.find({ user: req.user._id })
      .select('_id name prefix scopes lastUsedAt createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(keys);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function revokeApiKey(req, res) {
  try {
    const deleted = await ApiKey.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!deleted) {
      return res.status(404).json({ message: 'API key not found' });
    }

    return res.status(200).json({ message: 'API key revoked', _id: deleted._id });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createApiKey,
  getApiKeys,
  revokeApiKey
};
