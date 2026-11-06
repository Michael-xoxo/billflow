import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AnalyticsCards from './components/AnalyticsCards';
import InvoiceManager from './components/InvoiceManager';
import WebhookSimulator from './components/WebhookSimulator';

function CockpitApp() {
  const {
    user,
    isAuthenticated,
    loading,
    authError,
    login,
    register,
    logout,
    authFetch
  } = useAuth();

  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('Executive CFO');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadWorkspaceData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [custRes, invRes] = await Promise.all([
        authFetch('/api/customers'),
        authFetch('/api/invoices')
      ]);
      if (custRes.ok) {
        setCustomers(await custRes.json());
      }
      if (invRes.ok) {
        setInvoices(await invRes.json());
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch {
      // handled by authFetch
    }
  }, [isAuthenticated, authFetch]);

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaceData();
    } else {
      setCustomers([]);
      setInvoices([]);
    }
  }, [isAuthenticated, loadWorkspaceData]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch {
      // authError displayed in UI
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-header">
            <span className="brand-badge">BF</span>
            <div>
              <h1>BillFlow Financial Cockpit</h1>
              <p>Zero-Float Invoicing & Idempotent Settlement Engine</p>
            </div>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`tab-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
              data-testid="tab-login"
            >
              Sign In
            </button>
            <button
              type="button"
              className={`tab-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
              data-testid="tab-register"
            >
              Create Account
            </button>
          </div>

          {authError && (
            <div className="alert alert-error" data-testid="auth-error">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="auth-form" data-testid="auth-form">
            {authMode === 'register' && (
              <label>
                <span>Account Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="auth-name-input"
                />
              </label>
            )}

            <label>
              <span>Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cfo@company.com"
                required
                data-testid="auth-email-input"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="auth-password-input"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              data-testid="auth-submit-btn"
            >
              {loading
                ? 'Authenticating...'
                : authMode === 'register'
                ? 'Register & Launch Cockpit'
                : 'Sign In to Cockpit'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="cockpit-layout">
      <header className="cockpit-topbar">
        <div className="brand-header">
          <span className="brand-badge">BF</span>
          <div>
            <h1>BillFlow Cockpit</h1>
            <span className="subtitle">Integer-Cents Commercial Billing Suite</span>
          </div>
        </div>

        <div className="user-bar">
          <span className="user-chip" data-testid="authenticated-user">
            {user?.name || user?.email} ({user?.email})
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={logout}
            data-testid="logout-btn"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="cockpit-main">
        <AnalyticsCards refreshTrigger={refreshTrigger} />
        <InvoiceManager
          invoices={invoices}
          customers={customers}
          onDataMutated={loadWorkspaceData}
        />
        <WebhookSimulator
          invoices={invoices}
          onWebhookProcessed={loadWorkspaceData}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CockpitApp />
    </AuthProvider>
  );
}
