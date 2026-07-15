/**
 * taxEngine.js — Client-side tax calculation
 *
 * Port of app/Services/TaxService.php
 * Pure functions, no side effects.
 */

/**
 * Calculate tax for a single line item.
 *
 * @param {number} lineTotal — gross line total (in rupiah, integer)
 * @param {string} taxType — 'exclusive' | 'inclusive'
 * @param {number} taxRate — percentage (e.g. 11 for PPN 11%)
 * @returns {{ tax_amount: number, tax_rate: number, line_total_before_tax: number, line_total_after_tax: number }}
 */
export function calculateLineItem(lineTotal, taxType = 'exclusive', taxRate = 0) {
    if (taxRate <= 0) {
        return {
            tax_amount: 0,
            tax_rate: taxRate,
            line_total_before_tax: lineTotal,
            line_total_after_tax: lineTotal,
        };
    }

    if (taxType === 'inclusive') {
        const taxAmount = Math.round(lineTotal - lineTotal / (1 + taxRate / 100));
        const beforeTax = lineTotal - taxAmount;
        return {
            tax_amount: taxAmount,
            tax_rate: taxRate,
            line_total_before_tax: beforeTax,
            line_total_after_tax: beforeTax + taxAmount,
        };
    }

    // exclusive (default)
    const taxAmount = Math.round(lineTotal * taxRate / 100);
    return {
        tax_amount: taxAmount,
        tax_rate: taxRate,
        line_total_before_tax: lineTotal,
        line_total_after_tax: lineTotal + taxAmount,
    };
}

/**
 * Calculate tax for the entire cart/transaction.
 *
 * @param {Array} items — array of { line_total, tax_type?, tax_rate? }
 * @param {number} defaultRate — default tax rate if item doesn't specify
 * @returns {{ tax_total: number, tax_rate: number, items: Array }}
 */
export function calculateTransactionTax(items, defaultRate = 11) {
    let taxTotal = 0;
    let rate = defaultRate;
    const result = [];

    for (const item of items) {
        const lineTotal = item.line_total ?? item.price ?? 0;
        const itemTaxType = item.tax_type ?? 'exclusive';
        const itemTaxRate = item.tax_rate ?? defaultRate;

        const taxResult = calculateLineItem(lineTotal, itemTaxType, itemTaxRate);

        taxTotal += taxResult.tax_amount;
        result.push({ ...item, ...taxResult });

        if (itemTaxRate > 0) {
            rate = itemTaxRate;
        }
    }

    return {
        tax_total: taxTotal,
        tax_rate: rate,
        items: result,
    };
}
