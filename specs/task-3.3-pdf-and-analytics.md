# SPEC: Task 3.3 - Server-Side Dynamic PDF Engine & Financial Reporting

## GOAL
Implement an in-memory streaming PDF generator for invoices using PDFKit, and construct high-performance MongoDB aggregation endpoints for business analytics (MRR, outstanding debt, and collected revenue).

## ACCEPTANCE CRITERIA
1. PDF Generation Service (`services/pdfService.js`):
   - Accepts populated `invoice` object (with referenced `customer` and `user` details).
   - Generates professional document layout:
     - Header: Company name, invoice number, date, and due date.
     - Addresses: Seller/Contractor info and Bill-To Customer details.
     - Tabular Line Items: Description, Quantity, Unit Price (converted to dollars/cents), and Total.
     - Summary Block: Subtotal, Tax (percentage & dollar value), and Total Due.
     - Status Watermark / Stamp: "PAID" with payment timestamp if status === 'paid'.
   - Returns a readable stream piped directly to Express `res` with headers:
     - `Content-Type: application/pdf`
     - `Content-Disposition: inline; filename="invoice-<number>.pdf"`
2. PDF Download Route (`controllers/invoiceController.js` & `routes/invoiceRoutes.js`):
   - `GET /api/invoices/:id/pdf`: Protected by `authGuard` and `requireScope('invoices:read')`.
   - Populates `customer` reference.
   - Streams PDF binary with HTTP 200.
3. Financial Analytics Engine (`controllers/analyticsController.js` & `routes/analyticsRoutes.js`):
   - `GET /api/analytics/summary`: Protected by `authGuard`.
   - Uses MongoDB aggregation pipeline filtered by `user: req.user._id`:
     - `totalRevenueCents`: Sum of `totalCents` for all `status: 'paid'` invoices.
     - `outstandingCents`: Sum of `totalCents` for all `status: 'pending'` invoices.
     - `draftCents`: Sum of `totalCents` for all `status: 'draft'` invoices.
     - `paidCount`, `pendingCount`, `draftCount`: Itemized document counts.
     - `mrrCents`: Sum of `totalCents` for invoices marked `paid` within the last 30 rolling days.
4. Mount `analyticsRoutes` in `server.js` at `/api/analytics`.
5. Maintain Rule 4 (Integer Invariant): All analytics calculations remain in whole integer cents. Formatting to decimals occurs only at the PDF render boundary.

## CONSTRAINTS
- Strict file scope: Create `services/pdfService.js`, `controllers/analyticsController.js`, `routes/analyticsRoutes.js`. Modify `controllers/invoiceController.js`, `routes/invoiceRoutes.js`, and `server.js`.
- PDFs must stream directly to response memory without writing temporary files to the local file system.
- Follow `AGENTS.md` Rules 1–7.

## STOPPING CONDITIONS
- Stop if PDF generation blocks the Node event loop or leaks file descriptors.
- Stop if MongoDB aggregation returns floating-point values or fails to isolate tenant data.

## BLAST RADIUS
LOW to MEDIUM (Adds new streaming media responses and read aggregation endpoints).

## ADVERSARIAL VERIFICATION STEPS
1. Populate database with diverse invoices for User A:
   - 1x Paid invoice ($200.00 = 20,000 cents, paid today).
   - 1x Paid invoice ($100.00 = 10,000 cents, paid 45 days ago).
   - 1x Pending invoice ($150.00 = 15,000 cents).
   - 1x Draft invoice ($50.00 = 5,000 cents).
2. Query `GET /api/analytics/summary` for User A:
   - Verify `totalRevenueCents === 30000`.
   - Verify `outstandingCents === 15000`.
   - Verify `mrrCents === 20000` (strictly excluding the 45-day-old invoice).
3. Attempt to fetch User A's analytics as User B -> verify User B receives zero counts (complete isolation).
4. Request `GET /api/invoices/:id/pdf` for the paid invoice:
   - Verify HTTP status 200.
   - Verify response headers match `application/pdf`.
   - Verify first 5 bytes of binary response match the standard PDF magic header `%PDF-`.