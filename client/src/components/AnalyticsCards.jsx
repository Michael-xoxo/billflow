import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCents } from '../utils/currency';

export default function AnalyticsCards({ refreshTrigger = 0, onSummaryLoaded }) {
  const { authFetch } = useAuth();
  const [summary, setSummary] = useState({
    mrrCents: 0,
    totalRevenueCents: 0,
    outstandingCents: 0,
    draftCents: 0,
    paidCount: 0,
    pendingCount: 0,
    draftCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/analytics/summary');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load analytics summary');
      }
      setSummary(data);
      if (onSummaryLoaded) {
        onSummaryLoaded(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, onSummaryLoaded]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

  return (
    <section className="analytics-section" aria-label="Executive Financial Analytics">
      <div className="section-header">
        <h2>Financial Overview</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchSummary}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="analytics-grid">
        <article className="metric-card metric-card-mrr" data-testid="card-mrr">
          <span className="metric-label">Monthly Recurring Revenue (MRR)</span>
          <strong className="metric-value" data-testid="mrr-value">
            {formatCents(summary.mrrCents)}
          </strong>
          <span className="metric-subtext">Paid within rolling 30 days</span>
        </article>

        <article className="metric-card metric-card-revenue" data-testid="card-total-revenue">
          <span className="metric-label">Total Revenue</span>
          <strong className="metric-value" data-testid="total-revenue-value">
            {formatCents(summary.totalRevenueCents)}
          </strong>
          <span className="metric-subtext">All-time collected payments</span>
        </article>

        <article className="metric-card metric-card-outstanding" data-testid="card-outstanding">
          <span className="metric-label">Outstanding Balance</span>
          <strong className="metric-value" data-testid="outstanding-value">
            {formatCents(summary.outstandingCents)}
          </strong>
          <span className="metric-subtext">Awaiting settlement (Pending)</span>
        </article>

        <article className="metric-card metric-card-counts" data-testid="card-status-counts">
          <span className="metric-label">Status Counts</span>
          <div className="status-counts-row" data-testid="status-counts-value">
            <div className="count-pill count-draft">
              <span className="count-num">{summary.draftCount ?? 0}</span>
              <span className="count-tag">Draft</span>
            </div>
            <div className="count-pill count-pending">
              <span className="count-num">{summary.pendingCount ?? 0}</span>
              <span className="count-tag">Pending</span>
            </div>
            <div className="count-pill count-paid">
              <span className="count-num">{summary.paidCount ?? 0}</span>
              <span className="count-tag">Paid</span>
            </div>
          </div>
          <span className="metric-subtext">Draft: {formatCents(summary.draftCents)}</span>
        </article>
      </div>
    </section>
  );
}
