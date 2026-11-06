/**
 * Zero-Float Financial Math Utility
 * Enforces Rule 4 (Integer-Only Currency Invariant).
 * All monetary inputs and outputs are strictly whole integers representing cents.
 */

function assertIntegerCents(value, fieldName = 'amountCents') {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`Invalid ${fieldName}: must be a whole integer in cents (received ${value})`);
  }
  if (value < 0) {
    throw new Error(`Invalid ${fieldName}: cannot be negative (received ${value})`);
  }
}

function assertIntegerQuantity(quantity, fieldName = 'quantity') {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    throw new Error(`Invalid ${fieldName}: must be a whole integer (received ${quantity})`);
  }
  if (quantity <= 0) {
    throw new Error(`Invalid ${fieldName}: must be greater than zero (received ${quantity})`);
  }
}

/**
 * Calculates total cents for a single line item.
 * @param {number} quantity - Integer quantity (> 0)
 * @param {number} unitPriceCents - Integer unit price in cents (>= 0)
 * @returns {number} Integer total in cents
 */
function calculateLineTotal(quantity, unitPriceCents) {
  assertIntegerQuantity(quantity, 'quantity');
  assertIntegerCents(unitPriceCents, 'unitPriceCents');
  const total = quantity * unitPriceCents;
  assertIntegerCents(total, 'lineTotalCents');
  return total;
}

/**
 * Calculates the subtotal in cents across an array of line items.
 * @param {Array<{quantity: number, unitPriceCents: number}>} lineItems
 * @returns {number} Integer subtotal in cents
 */
function calculateSubtotal(lineItems) {
  if (!Array.isArray(lineItems)) {
    throw new Error('Invalid lineItems: must be an array');
  }
  let subtotalCents = 0;
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid lineItem at index ${i}`);
    }
    const lineTotal = calculateLineTotal(item.quantity, item.unitPriceCents);
    subtotalCents += lineTotal;
  }
  assertIntegerCents(subtotalCents, 'subtotalCents');
  return subtotalCents;
}

/**
 * Calculates tax in cents from integer subtotalCents and taxPercent.
 * Uses Math.round to produce an exact integer cent value with zero floating-point drift.
 * @param {number} subtotalCents - Integer subtotal in cents
 * @param {number} taxPercent - Tax percentage (e.g., 8.25 or 33.333)
 * @returns {number} Integer tax in cents
 */
function calculateTax(subtotalCents, taxPercent = 0) {
  assertIntegerCents(subtotalCents, 'subtotalCents');
  if (typeof taxPercent !== 'number' || !Number.isFinite(taxPercent) || taxPercent < 0) {
    throw new Error(`Invalid taxPercent: must be a non-negative finite number (received ${taxPercent})`);
  }
  const taxCents = Math.round((subtotalCents * taxPercent) / 100);
  assertIntegerCents(taxCents, 'taxCents');
  return taxCents === 0 ? 0 : taxCents;
}

/**
 * Calculates full invoice totals in integer cents.
 * @param {Array<{quantity: number, unitPriceCents: number}>} lineItems
 * @param {number} taxPercent
 * @returns {{ subtotalCents: number, taxCents: number, totalCents: number }}
 */
function calculateInvoiceTotals(lineItems, taxPercent = 0) {
  const subtotalCents = calculateSubtotal(lineItems);
  const taxCents = calculateTax(subtotalCents, taxPercent);
  const totalCents = subtotalCents + taxCents;
  assertIntegerCents(totalCents, 'totalCents');
  return {
    subtotalCents,
    taxCents,
    totalCents
  };
}

module.exports = {
  assertIntegerCents,
  assertIntegerQuantity,
  calculateLineTotal,
  calculateSubtotal,
  calculateTax,
  calculateInvoiceTotals
};
