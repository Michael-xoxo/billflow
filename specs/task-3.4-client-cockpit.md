# SPEC: Task 3.4 - Decoupled Frontend Financial Cockpit & Webhook Simulator

## GOAL
Scaffold a Vite React client in `/client`, build an executive financial dashboard displaying revenue analytics, construct an invoice builder with dynamic line items, and implement an interactive webhook event simulator.

## ACCEPTANCE CRITERIA
1. Client Infrastructure (`/client`):
   - Vite React app with dev proxy forwarding `/api` to `http://localhost:5000`.
   - `client/src/context/AuthContext.jsx`: Manages JWT session persistence and authenticated fetch calls.
2. Analytics Cockpit (`client/src/components/AnalyticsCards.jsx`):
   - Fetches `GET /api/analytics/summary`.
   - Displays 4 key metrics formatted into clean currency strings:
     - Monthly Recurring Revenue (MRR)
     - Total Revenue
     - Outstanding Balance
     - Status Counts (Draft, Pending, Paid)
3. Invoice Manager & Builder (`client/src/components/InvoiceManager.jsx`):
   - Ingestion Form:
     - Customer selection (dropdown fed by `GET /api/customers` or inline creation).
     - Invoice Number & Due Date.
     - Dynamic Line Items: Allows adding/removing rows (Description, Quantity, Unit Price in Dollars).
     - Real-time display of computed Subtotal, Tax, and Total.
     - Submits `POST /api/invoices` converting dollar inputs into strict integer cents.
   - Invoice Table:
     - Displays invoice number, customer, status badge, formatted total, and a "Download PDF" button that opens `GET /api/invoices/:id/pdf` directly in a new tab.
4. Interactive Webhook Simulator Widget (`client/src/components/WebhookSimulator.jsx`):
   - UI tool for testing asynchronous payment workflows.
   - Allows selecting a pending invoice and entering an `eventId` (or clicking "Generate Random Event ID").
   - Submits `POST /api/webhooks` with `{ eventId, eventType: "invoice.payment_succeeded", data: { invoiceId, amountPaidCents } }`.
   - Displays server response badge: "Processed (Paid)" on first run, "Ignored (Duplicate Event)" on subsequent runs.
   - Refreshes invoice list and analytics cards upon successful execution.

## CONSTRAINTS
- Strict file scope: All modifications confined to `/client` directory and root `.gitignore`.
- Zero changes to backend logic or schemas.
- Adhere to `AGENTS.md` Rules 1–7.

## STOPPING CONDITIONS
- Stop if currency formatting drops cents or produces NaN.
- Stop if client submits floating-point cents to `/api/invoices`.

## BLAST RADIUS
LOW (Confined entirely to frontend client presentation).

## VERIFICATION STEPS
1. Verify `npm run build` succeeds inside `/client`.
2. Browser / headless verification:
   - Authenticate as user.
   - Create customer "Beta Technologies".
   - Create invoice: 2x "API Infrastructure Setup" @ $150.00 each, 10% tax -> confirm total is $330.00 and invoice appears as `pending`.
   - Download PDF via button -> confirm HTTP 200 and binary response.
   - Fire Webhook Simulator for this invoice -> confirm status changes to `paid` and MRR/Total Revenue update immediately.
   - Re-fire Webhook Simulator with identical `eventId` -> confirm UI displays "ignored (duplicate)" warning and metrics do not duplicate.