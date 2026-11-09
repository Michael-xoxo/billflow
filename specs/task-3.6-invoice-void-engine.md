# SPEC: Task 3.6 - Invoice Void & Cancellation Engine

## GOAL
Implement an accounting-compliant invoice voiding workflow: backend status transition with immutability guards, frontend void action with safety confirmation prompts, and an adversarial test harness probing race conditions and metric consistency.

## ACCEPTANCE CRITERIA
1. Backend Core (`/server`):
   - Endpoint: `PATCH /api/invoices/:id/void`
   - Protected by `authGuard` and `requireScope('invoices:write')`.
   - Tenant isolation: verified against `req.user._id`.
   - Business Logic:
     - If `invoice.status === 'paid'`, reject immediately with HTTP 400 (`{ error: "Cannot void an invoice that is already paid" }`).
     - If `invoice.status === 'void'`, return HTTP 200 idempotently or HTTP 400 (`{ error: "Invoice is already voided" }`).
     - If `status` is `'draft'` or `'pending'`, set `status = 'void'`, set `voidedAt = new Date()`, and return HTTP 200 with the updated invoice.
   - Analytics Invariant: Voided invoices must contribute 0 to `outstandingCents`, `totalRevenueCents`, and `mrrCents`.
2. Frontend UI (`/client`):
   - In `client/src/components/InvoiceManager.jsx`:
     - Render a "Void" button in the table actions only for invoices with status `'pending'` or `'draft'`.
     - Clicking "Void" triggers a window confirmation or modal dialog: "Are you sure you want to void this invoice? This cannot be undone."
     - On confirmation, call `PATCH /api/invoices/:id/void` using `authFetch`.
     - On success: refresh invoice list and trigger `refreshMetrics()` on `AnalyticsCards`.
     - On error: display an accessible inline alert banner.
3. Adversarial QA (`/scratch` or `/tests`):
   - Standalone test script verifying:
     - Voiding a `paid` invoice returns HTTP 400.
     - Voiding a `pending` invoice drops `outstandingCents` in `GET /api/analytics/summary` by the exact invoice amount.
     - Cross-tenant void attempt (User B targeting User A's invoice) returns HTTP 404.
     - 5 concurrent requests attempting to void the same invoice resolve cleanly without unhandled rejections or crashes.

## CONSTRAINTS
- Agent Alpha modifies ONLY `/server` files (controllers, routes).
- Agent Beta modifies ONLY `/client` files (components).
- Agent Gamma creates ONLY test scripts in `/scratch` or `/tests`.
- Adhere to `AGENTS.md` Rules 1–7.