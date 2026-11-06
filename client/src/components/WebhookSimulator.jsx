import React, { useState, useEffect } from 'react';
import { formatCents } from '../utils/currency';

export default function WebhookSimulator({ invoices = [], onWebhookProcessed }) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [eventId, setEventId] = useState(() => `evt_${Math.random().toString(36).slice(2, 10)}`);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');

  // Prefer pending invoices by default if nothing is currently selected
  useEffect(() => {
    if (!selectedInvoiceId && invoices.length > 0) {
      const pending = invoices.find((inv) => inv.status === 'pending') || invoices[0];
      if (pending) {
        setSelectedInvoiceId(pending._id);
      }
    }
  }, [invoices, selectedInvoiceId]);

  const selectedInvoice = invoices.find((inv) => inv._id === selectedInvoiceId) || null;

  const generateRandomEventId = () => {
    const rand = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setEventId(rand);
  };

  const handleFireWebhook = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedInvoice) {
      setError('Select a target invoice before firing webhook.');
      return;
    }
    if (!eventId.trim()) {
      setError('Enter an eventId before firing webhook.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        eventId: eventId.trim(),
        eventType: 'invoice.payment_succeeded',
        data: {
          invoiceId: selectedInvoice._id,
          amountPaidCents: selectedInvoice.totalCents
        }
      };

      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Webhook dispatch failed');
      }

      setLastResult({
        status: data.status,
        reason: data.reason || null,
        eventId: eventId.trim(),
        invoiceNumber: selectedInvoice.invoiceNumber
      });

      if (onWebhookProcessed) {
        await onWebhookProcessed();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel webhook-simulator-panel" aria-label="Interactive Webhook Simulator">
      <div className="section-header">
        <div>
          <h3>Interactive Webhook Event Simulator</h3>
          <p className="muted-text">
            Test idempotent payment settlement (`invoice.payment_succeeded`) against `/api/webhooks`.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleFireWebhook} className="webhook-form" data-testid="webhook-simulator-form">
        <div className="form-grid-3">
          <label>
            <span>Target Invoice</span>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              data-testid="webhook-invoice-select"
            >
              <option value="">-- Select Invoice --</option>
              {invoices.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber} — {formatCents(inv.totalCents)} [{inv.status.toUpperCase()}]
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Webhook Event ID (`eventId`)</span>
            <div className="input-with-btn">
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="evt_live_..."
                required
                data-testid="webhook-event-id-input"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={generateRandomEventId}
                data-testid="generate-event-id-btn"
              >
                Generate Random Event ID
              </button>
            </div>
          </label>

          <div className="webhook-submit-col">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !selectedInvoice}
              data-testid="fire-webhook-btn"
            >
              {sending ? 'Dispatching...' : 'Fire Webhook Event'}
            </button>
          </div>
        </div>
      </form>

      {lastResult && (
        <div
          className={`webhook-result-banner ${
            lastResult.status === 'processed' ? 'badge-processed' : 'badge-ignored'
          }`}
          data-testid="webhook-result-badge"
        >
          {lastResult.status === 'processed' ? (
            <strong>Processed (Paid)</strong>
          ) : (
            <strong>Ignored (Duplicate Event)</strong>
          )}
          <span>
            Event <code>{lastResult.eventId}</code> for <code>{lastResult.invoiceNumber}</code>
            {lastResult.reason ? ` — Reason: ${lastResult.reason}` : ''}
          </span>
        </div>
      )}
    </section>
  );
}
