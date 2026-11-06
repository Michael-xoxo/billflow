const PDFDocument = require('pdfkit');

/**
 * Formats integer cents to a localized currency string SOLELY at the PDF presentation boundary.
 * All internal storage and calculations remain integer cents per Rule 4.
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
function formatCentsForDisplay(cents, currency = 'usd') {
  const safeCents = Number.isInteger(cents) ? cents : 0;
  const wholeDollars = Math.trunc(safeCents / 100);
  const remainderCents = Math.abs(safeCents % 100);
  const symbol = String(currency).toLowerCase() === 'usd' ? '$' : `${String(currency).toUpperCase()} `;
  return `${symbol}${wholeDollars}.${String(remainderCents).padStart(2, '0')}`;
}

function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toISOString().split('T')[0];
}

/**
 * Generates an in-memory readable PDF stream for a populated Invoice document.
 * @param {Object} invoice - Populated Invoice document (with customer and user)
 * @param {import('express').Response} [res] - Optional Express response to pipe into
 * @returns {PDFKit.PDFDocument} Readable PDF stream
 */
function streamInvoicePDF(invoice, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  if (res) {
    const invoiceNum = invoice.invoiceNumber || String(invoice._id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceNum}.pdf"`);
    doc.pipe(res);
  }

  const currency = invoice.currency || 'usd';
  const sellerName = (invoice.user && invoice.user.name) || 'BillFlow Merchant';
  const sellerEmail = (invoice.user && invoice.user.email) || 'billing@billflow.io';
  const customerName = (invoice.customer && invoice.customer.name) || 'Valued Customer';
  const customerCompany = (invoice.customer && invoice.customer.company) || '';
  const customerEmail = (invoice.customer && invoice.customer.email) || '';

  // 1. Header: Company Name, Invoice Number, Issue Date, Due Date
  doc
    .fillColor('#0f172a')
    .fontSize(22)
    .text('BILLFLOW', 50, 50, { continued: false })
    .fontSize(10)
    .fillColor('#475569')
    .text('Commercial Financial & Invoicing Engine', 50, 76);

  doc
    .fillColor('#0f172a')
    .fontSize(16)
    .text(`INVOICE #${invoice.invoiceNumber}`, 320, 50, { align: 'right' })
    .fontSize(10)
    .fillColor('#475569')
    .text(`Issue Date: ${formatDate(invoice.createdAt || new Date())}`, 320, 72, { align: 'right' })
    .text(`Due Date: ${formatDate(invoice.dueDate)}`, 320, 86, { align: 'right' })
    .text(`Status: ${String(invoice.status || 'draft').toUpperCase()}`, 320, 100, { align: 'right' });

  doc
    .moveTo(50, 125)
    .lineTo(545, 125)
    .strokeColor('#cbd5e1')
    .stroke();

  // 2. Addresses: Seller/Contractor Info & Bill-To Customer Details
  doc
    .fontSize(10)
    .fillColor('#64748b')
    .text('FROM (CONTRACTOR / SELLER)', 50, 140)
    .fillColor('#0f172a')
    .fontSize(11)
    .text(sellerName, 50, 156)
    .fontSize(10)
    .fillColor('#475569')
    .text(sellerEmail, 50, 172);

  doc
    .fontSize(10)
    .fillColor('#64748b')
    .text('BILL TO (CUSTOMER)', 320, 140)
    .fillColor('#0f172a')
    .fontSize(11)
    .text(customerName, 320, 156);

  let custY = 172;
  if (customerCompany) {
    doc.fontSize(10).fillColor('#334155').text(customerCompany, 320, custY);
    custY += 15;
  }
  if (customerEmail) {
    doc.fontSize(10).fillColor('#475569').text(customerEmail, 320, custY);
  }

  // 3. Tabular Line Items: Description, Quantity, Unit Price, Total
  const tableTop = 225;
  doc
    .rect(50, tableTop, 495, 24)
    .fill('#f1f5f9');

  doc
    .fillColor('#0f172a')
    .fontSize(10)
    .text('Description', 60, tableTop + 7, { width: 240 })
    .text('Qty', 305, tableTop + 7, { width: 50, align: 'right' })
    .text('Unit Price', 365, tableTop + 7, { width: 80, align: 'right' })
    .text('Total', 455, tableTop + 7, { width: 80, align: 'right' });

  let rowY = tableTop + 32;
  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    doc
      .fillColor('#1e293b')
      .fontSize(10)
      .text(item.description || 'Item', 60, rowY, { width: 240 })
      .text(String(item.quantity), 305, rowY, { width: 50, align: 'right' })
      .text(formatCentsForDisplay(item.unitPriceCents, currency), 365, rowY, { width: 80, align: 'right' })
      .text(formatCentsForDisplay(item.totalCents, currency), 455, rowY, { width: 80, align: 'right' });

    rowY += 24;
    doc
      .moveTo(50, rowY - 6)
      .lineTo(545, rowY - 6)
      .strokeColor('#e2e8f0')
      .stroke();
  }

  // 4. Summary Block: Subtotal, Tax (percentage & dollar value), Total Due
  const summaryTop = rowY + 15;
  const taxRate = invoice.taxPercent !== undefined && invoice.taxPercent !== null ? invoice.taxPercent : 0;

  doc
    .fontSize(10)
    .fillColor('#475569')
    .text('Subtotal:', 350, summaryTop, { width: 100, align: 'right' })
    .fillColor('#0f172a')
    .text(formatCentsForDisplay(invoice.subtotalCents, currency), 455, summaryTop, { width: 80, align: 'right' });

  doc
    .fillColor('#475569')
    .text(`Tax (${taxRate}%):`, 350, summaryTop + 20, { width: 100, align: 'right' })
    .fillColor('#0f172a')
    .text(formatCentsForDisplay(invoice.taxCents, currency), 455, summaryTop + 20, { width: 80, align: 'right' });

  doc
    .moveTo(350, summaryTop + 40)
    .lineTo(545, summaryTop + 40)
    .strokeColor('#94a3b8')
    .stroke();

  doc
    .fontSize(12)
    .fillColor('#0f172a')
    .text('Total Due:', 350, summaryTop + 48, { width: 100, align: 'right' })
    .text(formatCentsForDisplay(invoice.totalCents, currency), 455, summaryTop + 48, { width: 80, align: 'right' });

  // 5. Status Watermark / Stamp: "PAID" with payment timestamp if status === 'paid'
  if (invoice.status === 'paid') {
    const paidTimestamp = invoice.paidAt
      ? new Date(invoice.paidAt).toISOString()
      : new Date().toISOString();

    doc
      .save()
      .rect(50, summaryTop + 10, 250, 56)
      .lineWidth(2)
      .strokeColor('#16a34a')
      .stroke();

    doc
      .fillColor('#16a34a')
      .fontSize(18)
      .text('PAID', 64, summaryTop + 18)
      .fontSize(9)
      .fillColor('#15803d')
      .text(`Paid At: ${paidTimestamp}`, 64, summaryTop + 42)
      .restore();
  }

  doc.end();
  return doc;
}

module.exports = {
  streamInvoicePDF,
  generateInvoicePDF: streamInvoicePDF,
  formatCentsForDisplay
};
