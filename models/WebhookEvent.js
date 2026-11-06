const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'eventId is required'],
      unique: true,
      trim: true,
      index: true
    },
    eventType: {
      type: String,
      required: [true, 'eventType is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['processed', 'failed'],
      default: 'processed'
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
