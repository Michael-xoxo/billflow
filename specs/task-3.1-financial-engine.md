# SPEC: Task 3.1 - Multi-Collection Financial Schema, Math Utility & Idempotent Webhook Core

## GOAL
Implement the User, Customer, Invoice, and WebhookEvent schemas with relational foreign keys, build a zero-float currency math engine, and construct an idempotent webhook intake controller.

## ACCEPTANCE CRITERIA
1. Models:
   - `models/User.js`: Multi-tenant account holder (email, password hash, role).
   - `models/Customer.js`: Client records referenced by `user`.
   - `models/Invoice.js`: Relational reference to `user` and `customer`. Validates integer cents for all money fields. Auto-computes `subtotalCents`, `taxCents`, and `totalCents` using integer math.
   - `models/WebhookEvent.js`: Idempotency ledger with unique index on `eventId`.
2. Financial Math Engine (`utils/financialMath.js`):
   - Pure utility functions:
     - `calculateLineTotal(quantity, unitPriceCents)` -> integer cents
     - `calculateSubtotal(lineItems)` -> integer cents
     - `calculateTax(subtotalCents, taxPercent)` -> integer cents (rounded via Math.round)
     - `calculateInvoiceTotals(lineItems, taxPercent)` -> `{ subtotalCents, taxCents, totalCents }`
   - Zero floating-point drift: rejects or sanitizes non-integer currency inputs.
3. Webhook Ingestion Engine (`controllers/webhookController.js` & `routes/webhookRoutes.js`):
   - `POST /api/webhooks`:
     - Accepts raw webhook JSON containing `{ eventId, eventType, data: { invoiceId, amountPaidCents } }`.
     - Validates presence of `eventId`.
     - Checks `WebhookEvent` ledger for existing `eventId`. If found, returns 200 with `{ status: "ignored", reason: "duplicate_event" }` without re-processing state.
     - If new, records event in ledger, updates corresponding invoice status to `'paid'`, sets `paidAt`, and returns 200 `{ status: "processed" }`.
4. Standard Auth & User Ingestion:
   - Carries forward stateless JWT generation and `authMiddleware` to protect user-scoped endpoints.

## CONSTRAINTS
- Strict file scope: Confined to backend `/server` structure (`models/`, `controllers/`, `routes/`, `utils/`, `server.js`).
- Absolute zero floating-point currency calculations.
- Idempotency must prevent double-processing.

## STOPPING CONDITIONS
- Stop if MongoDB unique index on `WebhookEvent.eventId` fails to reject collisions.
- Stop if financial calculations produce decimals.

## BLAST RADIUS
HIGH (Establishes the commercial financial core and data contracts for Project 3).

## ADVERSARIAL VERIFICATION STEPS
1. Run math utility unit assertions verifying exact integer rounding across boundary cases (e.g., 33.333% tax on $10.00).
2. Create User, Customer, and Draft Invoice with 2 line items via protected routes -> verify database stores pure integer cents.
3. Fire mock webhook `POST /api/webhooks` with eventId `evt_test_001` for the invoice -> verify status transitions to `paid` and `paidAt` is set.
4. Re-fire identical webhook `POST /api/webhooks` with `evt_test_001` -> verify response is `{ status: "ignored", reason: "duplicate_event" }` and invoice mutation count remains unchanged.