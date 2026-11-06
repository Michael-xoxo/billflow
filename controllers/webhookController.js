const WebhookEvent = require('../models/WebhookEvent');
const Invoice = require('../models/Invoice');
const { assertIntegerCents } = require('../utils/financialMath');

async function handleWebhook(req, res) {
  try {
    const payload = req.body || {};
    const { eventId, eventType, data } = payload;

    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return res.status(400).json({ message: 'Missing or invalid eventId' });
    }

    const normalizedEventId = eventId.trim();

    // Rule 5: Check idempotency ledger before executing any state mutation
    const existingEvent = await WebhookEvent.findOne({ eventId: normalizedEventId });
    if (existingEvent) {
      return res.status(200).json({
        status: 'ignored',
        reason: 'duplicate_event'
      });
    }

    if (data && data.amountPaidCents !== undefined) {
      assertIntegerCents(data.amountPaidCents, 'amountPaidCents');
    }

    // Record event in idempotency ledger first (unique index on eventId guards concurrent retries)
    try {
      await WebhookEvent.create({
        eventId: normalizedEventId,
        eventType: eventType || 'invoice.payment_succeeded',
        status: 'processed',
        payload,
        processedAt: new Date()
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(200).json({
          status: 'ignored',
          reason: 'duplicate_event'
        });
      }
      throw err;
    }

    // Mutate invoice state if invoiceId is present
    const invoiceId = data && data.invoiceId;
    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        await WebhookEvent.findOneAndUpdate(
          { eventId: normalizedEventId },
          { status: 'failed' }
        );
        return res.status(404).json({ message: 'Target invoice not found' });
      }

      invoice.status = 'paid';
      invoice.paidAt = new Date();
      await invoice.save();
    }

    return res.status(200).json({
      status: 'processed'
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getWebhookEvents(req, res) {
  try {
    const events = await WebhookEvent.find().sort({ processedAt: -1 });
    return res.status(200).json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  handleWebhook,
  getWebhookEvents
};
