/**
 * loyaltyEngine.js — Client-side loyalty & checkout calculation
 *
 * Port of app/Services/LoyaltyService.php (previewCheckout, voucher, tier logic)
 * Pure functions — given pricing summary + customer + options, returns checkout preview.
 */

import { calculateTransactionTax } from './taxEngine';

// ── Constants ─────────────────────────────────────────────────

const TIER_REGULAR = 'regular';
const TIER_SILVER = 'silver';
const TIER_GOLD = 'gold';
const TIER_PLATINUM = 'platinum';

const VOUCHER_TYPE_PERCENTAGE = 'percentage';
const VOUCHER_TYPE_FIXED_AMOUNT = 'fixed_amount';

// ── Helper: get loyalty settings ──────────────────────────────

function getSettings(cachedSettings = {}) {
    return {
        enable_earn: cachedSettings.loyalty_enable_earn !== '0',
        enable_redeem: cachedSettings.loyalty_enable_redeem !== '0',
        earn_rate_amount: Math.max(1, Number(cachedSettings.loyalty_earn_rate_amount || 10000)),
        redeem_point_value: Math.max(1, Number(cachedSettings.loyalty_redeem_point_value || 100)),
        tiers: {
            [TIER_REGULAR]: {
                label: 'Regular',
                minimum_total_spent: Number(cachedSettings.loyalty_tier_regular_threshold || 0),
            },
            [TIER_SILVER]: {
                label: 'Silver',
                minimum_total_spent: Number(cachedSettings.loyalty_tier_silver_threshold || 500000),
            },
            [TIER_GOLD]: {
                label: 'Gold',
                minimum_total_spent: Number(cachedSettings.loyalty_tier_gold_threshold || 1500000),
            },
            [TIER_PLATINUM]: {
                label: 'Platinum',
                minimum_total_spent: Number(cachedSettings.loyalty_tier_platinum_threshold || 3000000),
            },
        },
    };
}

// ── Helper: validate voucher ──────────────────────────────────

function validateVoucher(customer, voucher, subtotalAfterPromo, at = new Date()) {
    if (!customer || !voucher) return null;
    if (Number(voucher.customer_id) !== Number(customer.id)) return null;
    if (!voucher.is_active || voucher.is_used) return null;
    if (voucher.starts_at && new Date(voucher.starts_at) > at) return null;
    if (voucher.expires_at && new Date(voucher.expires_at) < at) return null;
    if (subtotalAfterPromo < Number(voucher.minimum_order)) return null;
    return voucher;
}

// ── Helper: calculate voucher discount ────────────────────────

function calculateVoucherDiscount(voucher, subtotalAfterPromo) {
    let discount = 0;

    switch (voucher.discount_type) {
        case VOUCHER_TYPE_PERCENTAGE:
            discount = Math.round(subtotalAfterPromo * (Number(voucher.discount_value) / 100));
            break;
        case VOUCHER_TYPE_FIXED_AMOUNT:
            discount = Math.round(Number(voucher.discount_value));
            break;
        default:
            discount = 0;
    }

    return Math.min(subtotalAfterPromo, Math.max(0, discount));
}

// ── Helper: calculate earn points ─────────────────────────────

function calculateEarnPoints(customer, eligibleSpend, settings) {
    if (!customer?.is_loyalty_member || !settings.enable_earn) return 0;
    return Math.floor(eligibleSpend / Math.max(1, settings.earn_rate_amount));
}

// ── Helper: eligible vouchers for customer ────────────────────

export function getEligibleVouchers(customer, vouchers = [], subtotalAfterPromo = 0, at = new Date()) {
    if (!customer) return [];

    return (vouchers || [])
        .filter((v) => Number(v.customer_id) === Number(customer.id))
        .filter((v) => v.is_active && !v.is_used)
        .filter((v) => !v.starts_at || new Date(v.starts_at) <= at)
        .filter((v) => !v.expires_at || new Date(v.expires_at) >= at)
        .filter((v) => subtotalAfterPromo >= Number(v.minimum_order))
        .sort((a, b) => {
            const aExp = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
            const bExp = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
            return aExp - bExp;
        });
}

// ── Helper: serialize voucher ─────────────────────────────────

export function serializeVoucher(voucher) {
    return {
        id: voucher.id,
        code: voucher.code,
        name: voucher.name,
        discount_type: voucher.discount_type,
        discount_value: Number(voucher.discount_value),
        minimum_order: Number(voucher.minimum_order),
        expires_at: voucher.expires_at,
        starts_at: voucher.starts_at,
        used_at: voucher.used_at,
        status: voucher.is_used ? 'Used' : voucher.is_active ? 'Active' : 'Inactive',
    };
}

// ── Helper: determine tier ────────────────────────────────────

export function determineTier(totalSpent, cachedSettings = {}) {
    const settings = getSettings(cachedSettings);
    let tier = TIER_REGULAR;

    for (const [key, config] of Object.entries(settings.tiers)) {
        if (totalSpent >= config.minimum_total_spent) {
            tier = key;
        }
    }

    return tier;
}

// ── Helper: tier options ──────────────────────────────────────

export function getTierOptions(cachedSettings = {}) {
    const settings = getSettings(cachedSettings);
    return Object.entries(settings.tiers).map(([key, config]) => ({
        value: key,
        label: config.label,
    }));
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Preview the full checkout calculation.
 *
 * This is the main function that mirrors LoyaltyService::previewCheckout().
 *
 * @param {Object} pricingPreview — output from pricingEngine.buildCartPreview()
 * @param {Object|null} customer — customer data from IndexedDB
 * @param {Object} options — { manual_discount, shipping_cost, redeem_points, voucher }
 * @param {Object} cachedData — { loyaltySettings, taxSettings, allVouchers }
 * @param {Date} [at] — current time
 * @returns {Object} — full checkout preview (items, summary, customer, voucher, settings, etc.)
 */
export function previewCheckout(
    pricingPreview,
    customer = null,
    options = {},
    cachedData = {},
    at = new Date()
) {
    const { loyaltySettings = {}, taxSettings = {}, allVouchers = [] } = cachedData;
    const settings = getSettings(loyaltySettings);

    const subtotalAfterPromo = Math.max(
        0,
        Number(pricingPreview?.summary?.subtotal_after_promo ?? 0)
    );
    const manualDiscountRequested = Math.max(0, Number(options.manual_discount ?? 0));
    const shippingCost = Math.max(0, Number(options.shipping_cost ?? 0));
    const requestedRedeemPoints = Math.max(0, Number(options.redeem_points ?? 0));
    const voucher = options.voucher ?? null;

    const availablePoints = customer?.is_loyalty_member
        ? Number(customer.loyalty_points)
        : 0;

    // Voucher validation
    const validatedVoucher = validateVoucher(customer, voucher, subtotalAfterPromo, at);
    const voucherDiscount = validatedVoucher
        ? calculateVoucherDiscount(validatedVoucher, subtotalAfterPromo)
        : 0;

    // Loyalty points
    const afterVoucher = Math.max(0, subtotalAfterPromo - voucherDiscount);
    const redeemPointValue = settings.redeem_point_value;
    const maxRedeemPoints = settings.enable_redeem
        ? Math.floor(afterVoucher / Math.max(1, redeemPointValue))
        : 0;
    const appliedRedeemPoints = settings.enable_redeem
        ? Math.min(requestedRedeemPoints, availablePoints, maxRedeemPoints)
        : 0;
    const pointsDiscount = appliedRedeemPoints * redeemPointValue;

    // Manual discount
    const afterLoyalty = Math.max(0, afterVoucher - pointsDiscount);
    const manualDiscountApplied = Math.min(manualDiscountRequested, afterLoyalty);
    const baseGrandTotal = Math.max(
        0,
        afterLoyalty - manualDiscountApplied + shippingCost
    );

    // Tax calculation
    const items = pricingPreview?.items ?? [];
    const productTaxMap = {};
    for (const item of items) {
        productTaxMap[item.product_id] = {
            tax_rate: item.product?.tax_rate ?? Number(taxSettings.tax_default_rate ?? 11),
            tax_type: item.product?.tax_type ?? 'exclusive',
        };
    }

    let effectiveRate = 0;
    let taxTotal = 0;
    const taxableItems = [];

    for (const item of items) {
        const pid = item.product_id;
        const lineTotal = Number(item.line_total ?? 0);
        if (pid && lineTotal > 0) {
            const taxInfo = productTaxMap[pid] || {
                tax_rate: Number(taxSettings.tax_default_rate ?? 11),
                tax_type: 'exclusive',
            };
            const taxResult = calculateLineItemTax(
                lineTotal,
                taxInfo.tax_type,
                taxInfo.tax_rate
            );
            taxTotal += taxResult.tax_amount;
            if (taxInfo.tax_rate > 0) {
                effectiveRate = taxInfo.tax_rate;
            }
            taxableItems.push({
                product_id: pid,
                line_total: lineTotal,
                tax_amount: taxResult.tax_amount,
            });
        }
    }

    // Tax on shipping
    if (shippingCost > 0 && effectiveRate > 0) {
        const shippingTax = Math.round(shippingCost * effectiveRate / 100);
        taxTotal += shippingTax;
    }

    const grandTotal = baseGrandTotal + taxTotal;
    const pointsEarnedPreview = calculateEarnPoints(
        customer,
        Math.max(0, grandTotal - shippingCost),
        settings
    );

    // Eligible vouchers
    const eligibleVouchers = customer
        ? getEligibleVouchers(customer, allVouchers, subtotalAfterPromo, at)
        : [];

    return {
        items: pricingPreview?.items ?? [],
        applied_groups: pricingPreview?.applied_groups ?? [],
        consumed_quantities: pricingPreview?.consumed_quantities ?? {},
        unmatched_items: pricingPreview?.unmatched_items ?? {},
        summary: {
            base_subtotal: Number(pricingPreview?.summary?.base_subtotal ?? 0),
            promo_discount_total: Number(
                pricingPreview?.summary?.promo_discount_total ?? 0
            ),
            subtotal_after_promo: subtotalAfterPromo,
            voucher_discount_total: voucherDiscount,
            loyalty_discount_total: pointsDiscount,
            manual_discount_total: manualDiscountApplied,
            shipping_cost: shippingCost,
            tax_total: taxTotal,
            tax_rate: effectiveRate || null,
            grand_total: grandTotal,
            available_loyalty_points: availablePoints,
            requested_redeem_points: requestedRedeemPoints,
            applied_redeem_points: appliedRedeemPoints,
            points_value: redeemPointValue,
            points_earned_preview: pointsEarnedPreview,
        },
        customer: customer
            ? {
                  id: customer.id,
                  is_loyalty_member: Boolean(customer.is_loyalty_member),
                  member_code: customer.member_code,
                  loyalty_tier: customer.loyalty_tier,
                  loyalty_points: availablePoints,
              }
            : null,
        voucher: validatedVoucher ? serializeVoucher(validatedVoucher) : null,
        eligible_vouchers: eligibleVouchers.map(serializeVoucher),
        settings: {
            enable_earn: settings.enable_earn,
            enable_redeem: settings.enable_redeem,
            earn_rate_amount: settings.earn_rate_amount,
            redeem_point_value: settings.redeem_point_value,
            tiers: Object.entries(settings.tiers).map(([key, config]) => ({
                key,
                ...config,
            })),
        },
    };
}

// ── Internal: tax line item calculation ───────────────────────

function calculateLineItemTax(lineTotal, taxType = 'exclusive', taxRate = 0) {
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

    const taxAmount = Math.round(lineTotal * taxRate / 100);
    return {
        tax_amount: taxAmount,
        tax_rate: taxRate,
        line_total_before_tax: lineTotal,
        line_total_after_tax: lineTotal + taxAmount,
    };
}
