# Session Notes — BillFlow (Project 3)

## Task 3.1 & Task 3.2 — Backend Financial Engine, Dual-Auth & Rate Limiting

- **Architectural Decision Made**: Implemented a unified Dual-Auth pipeline in `middleware/authGuard.js` that inspects the `Bearer` credential prefix to route `sec_live_` tokens through SHA-256 hash lookup (`ApiKey` collection with explicit `select: false` on `keyHash`) and standard tokens through stateless JWT verification, normalizing downstream authorization via `req.apiKeyScopes` (`['*']` for JWTs, explicit scope array for API keys) and per-identity fixed-window rate limiting (`req.apiKeyHash` or `req.user._id`).
- **Friction Point / Bug Encountered**: In Mongoose 9 (`^9.12.0`), schema `pre('save')` and `pre('validate')` hooks no longer pass a `next()` callback to async/synchronous hook functions by default, and setting `select: false` on `ApiKey.keyHash` requires explicitly chaining `.select('+keyHash')` inside the authentication guard query while keeping `GET /api/keys` guaranteed free of hash leakage.

## Task 3.3 — Server-Side Dynamic PDF Engine & Financial Reporting

- **Architectural Decision Made**: Built `services/pdfService.js` to pipe `PDFDocument` chunks directly into the Express `res` writable stream (`Content-Type: application/pdf`, `Content-Disposition: inline; filename="invoice-<number>.pdf"`) with zero temporary disk I/O, formatting integer cents to human-readable currency strings strictly at the PDF rendering boundary (`formatCentsForDisplay`) while keeping the MongoDB `$group` analytics aggregation (`controllers/analyticsController.js`) strictly in whole integer cents.
- **Friction Point / Bug Encountered**: MongoDB `$match` inside an `.aggregate()` pipeline does not automatically cast string user IDs to `ObjectId` like `Model.find()` does, so `req.user._id` is explicitly wrapped with `new mongoose.Types.ObjectId(String(req.user._id))` and empty-tenant aggregation results fall back to a zeroed integer object to guarantee tenant isolation and zero `null`/floating-point outputs.

## Task 3.4 — Decoupled Frontend Financial Cockpit & Webhook Simulator

- **Architectural Decision Made**: Isolated all dollar-to-cents input conversion and cents-to-currency string presentation in `client/src/utils/currency.js` (`dollarsToIntegerCents`, `formatCents`, `computeInvoicePreview`), ensuring `InvoiceManager.jsx` submits strictly whole integer cents (`unitPriceCents`) to `POST /api/invoices` while `WebhookSimulator.jsx` retains the selected invoice and `eventId` across dispatches so operators can immediately test duplicate event idempotency (`Processed (Paid)` vs `Ignored (Duplicate Event)`).
- **Friction Point / Bug Encountered**: Because `GET /api/invoices/:id/pdf` is protected by `authGuard` expecting an `Authorization: Bearer <token>` header, a plain `<a href target="_blank">` browser navigation would omit the JWT header and fail with HTTP 401; resolved by fetching the PDF stream via `authFetch`, materializing a `Blob` (`application/pdf`), and opening `URL.createObjectURL(blob)` in a new tab.

## Task 3.5 — Production Hardening, Database Seeding & Autonomous Sub-Agent Rules

- **Architectural Decision Made**: Mounted Express static asset serving (`express.static(path.join(__dirname, 'client/dist'))`) and the Express 5 wildcard SPA fallback (`app.get('/{*splat}', ...)`) strictly after all `/api/*` routers in `server.js` with an explicit `/api/` 404 guard, ensuring SPA client-side navigation works under `NODE_ENV=production` without ever shadowing API routes.
- **Friction Point / Bug Encountered**: Express 5 (`^5.3.0`) uses `path-to-regexp` v8 syntax where bare `app.get('*', ...)` throws a `PathError` at boot; using the named splat parameter `app.get('/{*splat}', ...)` satisfies Express 5 route parsing cleanly.

## Task 3.6 — Invoice Void & Cancellation Engine (Agent Alpha — Backend Core)

- **Architectural Decision Made**: Implemented `voidInvoice` (`PATCH /api/invoices/:id/void`) using an atomic conditional `Invoice.findOneAndUpdate({ _id, user: req.user._id, status: { $in: ['draft', 'pending'] } }, { $set: { status: 'void', voidedAt: new Date() } }, { returnDocument: 'after' })` before falling back to a diagnostic `findOne` lookup to distinguish `404` (missing/cross-tenant), `400` (`status === 'paid'`), and `400` (`status === 'void'`), guaranteeing race-condition-free state transitions under concurrent void bursts and excluding `status: 'void'` at the `$match` stage of `getAnalyticsSummary`.
- **Friction Point / Bug Encountered**: `models/Invoice.js` originally lacked a `voidedAt` field in `invoiceSchema`, which would cause Mongoose strict schema mode to silently strip `voidedAt` during persistence; resolved after Rule 3 Red Zone clearance by explicitly adding `voidedAt: { type: Date, default: null }` to `invoiceSchema`.

## Task 3.6 — Invoice Void & Cancellation Engine (Agent Beta — Frontend UI)

- **Architectural Decision Made**: Synchronized `InvoiceManager.jsx` with a local `localInvoices` state mirror of the `invoices` prop so that confirming `window.confirm("Are you sure you want to void this invoice? This cannot be undone.")` and receiving HTTP 200 from `PATCH /api/invoices/:id/void` immediately updates the row's status to `'void'` (hiding the "Void" button) while invoking `onDataMutated()` / `refreshMetrics()` to re-fetch workspace data and refresh `AnalyticsCards`.
- **Friction Point / Bug Encountered**: `PATCH /api/invoices/:id/void` returns an updated invoice whose `customer` field may be populated or an ID depending on backend path, so merging `{ ...inv, ...data, status: 'void', customer: inv.customer || data.customer }` preserves existing customer display metadata immediately before the full workspace refresh completes.

## Task 3.6 — Invoice Void & Cancellation Engine (Agent Gamma — QA/Security Automator)

- **Architectural Decision Made**: Built `tests/adversarial-void-engine.test.js` as a self-contained runner that boots an ephemeral HTTP server (`server.listen(0)`), provisions isolated test tenants (`Tenant A` and `Tenant B`) via `POST /api/auth/register`, and executes live HTTP assertions for `paid` immutability (`400`), exact `20000`-cent `outstandingCents` reconciliation on `GET /api/analytics/summary`, cross-tenant `404` isolation, and a 5-way `Promise.all` concurrent void burst before cleaning up all test artifacts in `finally`.
- **Friction Point / Bug Encountered**: Under a 5-way concurrent `PATCH /api/invoices/:id/void` burst, a naive read-then-save pattern would allow multiple requests to read `status === 'pending'` simultaneously; verifying `successResponses.length === 1` and `alreadyVoidedResponses.length === 4` proved that the atomic conditional `findOneAndUpdate({ status: { $in: ['draft', 'pending'] } })` eliminates race conditions and unhandled rejections.
