/**
 * Client-side integer cents conversion & presentation utilities.
 * Enforces Rule 4: All API payloads and internal calculations use whole integer cents.
 */

export function dollarsToIntegerCents(dollarValue) {
  const parsed = Number(dollarValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  const cents = Math.round(parsed * 100);
  return Number.isInteger(cents) ? cents : 0;
}

export function formatCents(cents) {
  const safeCents = typeof cents === 'number' && Number.isFinite(cents) ? Math.round(cents) : 0;
  const isNegative = safeCents < 0;
  const absCents = Math.abs(safeCents);
  const wholeDollars = Math.trunc(absCents / 100);
  const remainderCents = absCents % 100;
  const formattedDollars = wholeDollars.toLocaleString('en-US');
  const formattedCents = String(remainderCents).padStart(2, '0');
  return `${isNegative ? '-' : ''}$${formattedDollars}.${formattedCents}`;
}

export function computeInvoicePreview(lineItems, taxPercent = 0) {
  let subtotalCents = 0;
  const normalizedItems = (Array.isArray(lineItems) ? lineItems : []).map((item) => {
    const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const unitPriceCents = dollarsToIntegerCents(item.unitPriceDollars);
    const totalCents = qty * unitPriceCents;
    subtotalCents += totalCents;
    return {
      description: String(item.description || '').trim(),
      quantity: qty,
      unitPriceCents,
      totalCents
    };
  });

  const safeTaxPercent = Number.isFinite(Number(taxPercent)) && Number(taxPercent) >= 0
    ? Number(taxPercent)
    : 0;
  const taxCents = Math.round((subtotalCents * safeTaxPercent) / 100);
  const totalCents = subtotalCents + taxCents;

  return {
    normalizedItems,
    subtotalCents,
    taxPercent: safeTaxPercent,
    taxCents,
    totalCents
  };
}
