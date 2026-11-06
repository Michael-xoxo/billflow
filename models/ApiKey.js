const mongoose = require('mongoose');

const VALID_SCOPES = [
  'invoices:read',
  'invoices:write',
  'customers:read',
  'customers:write'
];

const apiKeySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true
    },
    keyHash: {
      type: String,
      required: [true, 'API key hash is required'],
      unique: true,
      index: true,
      select: false
    },
    prefix: {
      type: String,
      required: [true, 'API key prefix is required'],
      trim: true
    },
    scopes: {
      type: [String],
      enum: VALID_SCOPES,
      default: () => [...VALID_SCOPES]
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ApiKey', apiKeySchema);
module.exports.VALID_SCOPES = VALID_SCOPES;
