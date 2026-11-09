import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  formatCents,
  dollarsToIntegerCents,
  computeInvoicePreview
} from '../utils/currency';

export default function InvoiceManager({
  invoices = [],
  customers = [],
  onDataMutated,
  refreshMetrics
}) {
  const { authFetch } = useAuth();

  const [localInvoices, setLocalInvoices] = useState(invoices);
  const [voidError, setVoidError] = useState('');
  const [voidSuccess, setVoidSuccess] = useState('');
  const [voidingId, setVoidingId] = useState(null);

  useEffect(() => {
    setLocalInvoices(invoices);
  }, [invoices]);

  // Inline Customer Creation State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');

  // Invoice Builder State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState('pending');
  const [taxPercent, setTaxPercent] = useState(10);
  const [lineItems, setLineItems] = useState([
    { description: 'API Infrastructure Setup', quantity: 2, unitPriceDollars: '150.00' }
  ]);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuccess, setInvoiceSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pdfDownloadStatus, setPdfDownloadStatus] = useState('');

  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0]._id);
    }
  }, [customers, selectedCustomerId]);

  const preview = computeInvoicePreview(lineItems, taxPercent);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setCustomerStatus('');
    try {
      const res = await authFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerName.trim(),
          email: customerEmail.trim() || `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.io`,
          company: customerCompany.trim() || customerName.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create customer');
      }
      setCustomerName('');
      setCustomerEmail('');
      setCustomerCompany('');
      setSelectedCustomerId(data._id);
      setCustomerStatus(`Customer "${data.name}" created.`);
      if (onDataMutated) {
        await onDataMutated();
      }
    } catch (err) {
      setCustomerStatus(`Error: ${err.message}`);
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPriceDollars: '0.00' }
    ]);
  };

  const handleRemoveLineItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setInvoiceError('');
    setInvoiceSuccess('');

    if (!selectedCustomerId) {
      setInvoiceError('Please select or create a customer first.');
      return;
    }

    const strictIntegerLineItems = lineItems.map((item) => {
      const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      const unitPriceCents = dollarsToIntegerCents(item.unitPriceDollars);
      if (!Number.isInteger(quantity) || !Number.isInteger(unitPriceCents)) {
        throw new Error('Line item quantities and unit prices must resolve to whole integers.');
      }
      return {
        description: String(item.description || 'Service Item').trim(),
        quantity,
        unitPriceCents
      };
    });

    setSubmitting(true);
    try {
      const payload = {
        customer: selectedCustomerId,
        invoiceNumber: invoiceNumber.trim(),
        status,
        dueDate,
        taxPercent: Number(taxPercent) || 0,
        lineItems: strictIntegerLineItems
      };

      const res = await authFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create invoice');
      }

      setInvoiceSuccess(
        `Invoice ${data.invoiceNumber} created (${formatCents(data.totalCents)} — ${data.status}).`
      );
      setInvoiceNumber(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
      if (onDataMutated) {
        await onDataMutated();
      }
    } catch (err) {
      setInvoiceError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = useCallback(
    async (invoice) => {
      setPdfDownloadStatus('');
      try {
        const res = await authFetch(`/api/invoices/${invoice._id}/pdf`);
        if (!res.ok) {
          throw new Error(`PDF download failed with HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setPdfDownloadStatus(
          `Opened PDF for ${invoice.invoiceNumber} (HTTP ${res.status}, ${blob.size} bytes)`
        );
      } catch (err) {
        setPdfDownloadStatus(`Error: ${err.message}`);
      }
    },
    [authFetch]
  );

  const handleVoidInvoice = useCallback(
    async (invoice) => {
      setVoidError('');
      setVoidSuccess('');

      const confirmed = window.confirm(
        'Are you sure you want to void this invoice? This cannot be undone.'
      );
      if (!confirmed) {
        return;
      }

      setVoidingId(invoice._id);
      try {
        const res = await authFetch(`/api/invoices/${invoice._id}/void`, {
          method: 'PATCH'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error || data.message || `Failed to void invoice (HTTP ${res.status})`
          );
        }

        setLocalInvoices((prev) =>
          prev.map((inv) =>
            inv._id === invoice._id
              ? { ...inv, ...data, status: 'void', customer: inv.customer || data.customer }
              : inv
          )
        );
        setVoidSuccess(`Invoice ${invoice.invoiceNumber} has been voided.`);

        if (onDataMutated) {
          await onDataMutated();
        }
        if (refreshMetrics) {
          await refreshMetrics();
        }
      } catch (err) {
        setVoidError(err.message || 'Failed to void invoice');
      } finally {
        setVoidingId(null);
      }
    },
    [authFetch, onDataMutated, refreshMetrics]
  );

  return (
    <div className="invoice-manager-grid">
      {/* Left Column: Customer + Invoice Builder */}
      <section className="panel invoice-builder-panel" aria-label="Invoice Builder">
        <h3>1. Client Directory & Inline Creation</h3>
        <form onSubmit={handleCreateCustomer} className="inline-customer-form" data-testid="customer-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="Customer Name (e.g. Beta Technologies)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              data-testid="customer-name-input"
            />
            <input
              type="email"
              placeholder="billing@company.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              data-testid="customer-email-input"
            />
            <button type="submit" className="btn btn-secondary" data-testid="create-customer-btn">
              + Add Customer
            </button>
          </div>
          {customerStatus && (
            <p className="status-note" data-testid="customer-status">
              {customerStatus}
            </p>
          )}
        </form>

        <hr className="divider" />

        <h3>2. Create Invoice</h3>
        {invoiceError && <div className="alert alert-error">{invoiceError}</div>}
        {invoiceSuccess && (
          <div className="alert alert-success" data-testid="invoice-created-banner">
            {invoiceSuccess}
          </div>
        )}

        <form onSubmit={handleCreateInvoice} data-testid="invoice-form">
          <div className="form-grid-2">
            <label>
              <span>Customer</span>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                data-testid="invoice-customer-select"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Invoice Number</span>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                data-testid="invoice-number-input"
              />
            </label>

            <label>
              <span>Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                data-testid="invoice-due-date-input"
              />
            </label>

            <div className="form-row-split">
              <label>
                <span>Initial Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  data-testid="invoice-status-select"
                >
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <label>
                <span>Tax (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  data-testid="invoice-tax-input"
                />
              </label>
            </div>
          </div>

          <div className="line-items-header">
            <h4>Dynamic Line Items</h4>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddLineItem}
              data-testid="add-line-item-btn"
            >
              + Add Row
            </button>
          </div>

          <div className="line-items-list">
            {lineItems.map((item, idx) => {
              const rowCents =
                Math.max(1, Math.trunc(Number(item.quantity) || 1)) *
                dollarsToIntegerCents(item.unitPriceDollars);
              return (
                <div className="line-item-row" key={idx} data-testid={`line-item-row-${idx}`}>
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                    required
                    data-testid={`line-desc-${idx}`}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                    required
                    data-testid={`line-qty-${idx}`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit Price ($)"
                    value={item.unitPriceDollars}
                    onChange={(e) => handleLineItemChange(idx, 'unitPriceDollars', e.target.value)}
                    required
                    data-testid={`line-price-${idx}`}
                  />
                  <span className="line-row-total">{formatCents(rowCents)}</span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveLineItem(idx)}
                      aria-label="Remove Row"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="invoice-preview-totals" data-testid="invoice-preview-totals">
            <div>
              <span>Subtotal:</span>
              <strong data-testid="preview-subtotal">{formatCents(preview.subtotalCents)}</strong>
            </div>
            <div>
              <span>Tax ({preview.taxPercent}%):</span>
              <strong data-testid="preview-tax">{formatCents(preview.taxCents)}</strong>
            </div>
            <div className="preview-grand-total">
              <span>Total:</span>
              <strong data-testid="preview-total">{formatCents(preview.totalCents)}</strong>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
            data-testid="submit-invoice-btn"
          >
            {submitting ? 'Creating Invoice...' : `Create Invoice (${formatCents(preview.totalCents)})`}
          </button>
        </form>
      </section>

      {/* Right Column: Invoices Table */}
      <section className="panel invoice-table-panel" aria-label="Invoice Ledger">
        <h3>Issued Invoices ({localInvoices.length})</h3>
        {voidError && (
          <div className="alert alert-error" role="alert" data-testid="void-error-banner">
            {voidError}
          </div>
        )}
        {voidSuccess && (
          <div className="alert alert-success" role="status" data-testid="void-success-banner">
            {voidSuccess}
          </div>
        )}
        {pdfDownloadStatus && (
          <div className="alert alert-info" data-testid="pdf-download-status">
            {pdfDownloadStatus}
          </div>
        )}

        <div className="table-responsive">
          <table className="invoices-table" data-testid="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {localInvoices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No invoices found. Create your first invoice on the left.
                  </td>
                </tr>
              ) : (
                localInvoices.map((inv) => (
                  <tr key={inv._id} data-testid={`invoice-row-${inv.invoiceNumber}`}>
                    <td className="mono">{inv.invoiceNumber}</td>
                    <td>{inv.customer?.name || 'Customer'}</td>
                    <td>
                      <span
                        className={`status-badge status-${inv.status}`}
                        data-testid={`invoice-status-${inv.invoiceNumber}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="mono font-bold" data-testid={`invoice-total-${inv.invoiceNumber}`}>
                      {formatCents(inv.totalCents)}
                    </td>
                    <td>
                      <div className="input-with-btn">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownloadPdf(inv)}
                          data-testid={`download-pdf-${inv.invoiceNumber}`}
                        >
                          Download PDF
                        </button>
                        {(inv.status === 'pending' || inv.status === 'draft') && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleVoidInvoice(inv)}
                            disabled={voidingId === inv._id}
                            data-testid={`void-invoice-${inv.invoiceNumber}`}
                          >
                            {voidingId === inv._id ? 'Voiding...' : 'Void'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
