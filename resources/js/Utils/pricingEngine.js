/**
 * pricingEngine.js — Client-side pricing calculation
 *
 * Port of app/Services/PricingService.php
 * Pure functions — given cart items + rules + customer, returns pricing preview.
 *
 * Expected data shapes (from IndexedDB):
 *   product:    { id, title, sell_price, buy_price, category_id, stock, tax_type, tax_rate }
 *   cartItem:   { id, product_id, qty, unit_id?, conversion_factor?, product: {...} }
 *   rule:       { id, name, kind, priority, target_type, product_id?, category_id?,
 *                 customer_scope, eligible_loyalty_tiers, discount_type, discount_value,
 *                 starts_at?, ends_at?, preview_quantity_multiplier,
 *                 qtyBreaks: [...], bundleItems: [...], buyGetItems: [...] }
 *   customer:   { id, is_loyalty_member, loyalty_tier, loyalty_points }
 */

// ── Constants (mirror PricingRule model) ───────────────────────

const KIND_STANDARD_DISCOUNT = 'standard_discount';
const KIND_QTY_BREAK = 'qty_break';
const KIND_BUNDLE_PRICE = 'bundle_price';
const KIND_BUY_X_GET_Y = 'buy_x_get_y';

const SCOPE_ALL = 'all';
const SCOPE_WALK_IN = 'walk_in';
const SCOPE_REGISTERED = 'registered';
const SCOPE_MEMBER = 'member';

const TARGET_ALL = 'all';
const TARGET_PRODUCT = 'product';
const TARGET_CATEGORY = 'category';

const TYPE_PERCENTAGE = 'percentage';
const TYPE_FIXED_AMOUNT = 'fixed_amount';
const TYPE_FIXED_PRICE = 'fixed_price';

const ROLE_BUY = 'buy';
const ROLE_GET = 'get';

// ── Helper: resolve line discount ─────────────────────────────

function resolveLineDiscount(discountType, discountValue, baseUnitPrice, quantity) {
    const lineBaseTotal = baseUnitPrice * quantity;

    let discount = 0;
    switch (discountType) {
        case TYPE_PERCENTAGE:
            discount = Math.round(lineBaseTotal * (discountValue / 100));
            break;
        case TYPE_FIXED_AMOUNT:
            discount = Math.round(discountValue) * quantity;
            break;
        case TYPE_FIXED_PRICE:
            discount = Math.max(0, lineBaseTotal - Math.round(discountValue) * quantity);
            break;
        default:
            discount = 0;
    }

    return Math.min(lineBaseTotal, Math.max(0, discount));
}

// ── Helper: customer scope matching ───────────────────────────

function matchesCustomerScope(rule, customer) {
    switch (rule.customer_scope) {
        case SCOPE_ALL:
            return true;
        case SCOPE_WALK_IN:
            return customer === null || customer === undefined;
        case SCOPE_REGISTERED:
            return customer !== null && customer !== undefined;
        case SCOPE_MEMBER:
            return matchesMemberRule(rule, customer);
        default:
            return false;
    }
}

function matchesMemberRule(rule, customer) {
    if (!customer || !customer.is_loyalty_member) return false;
    const eligibleTiers = (rule.eligible_loyalty_tiers || []).filter(Boolean);
    if (eligibleTiers.length === 0) return true;
    return eligibleTiers.includes(customer.loyalty_tier);
}

// ── Helper: target matching ───────────────────────────────────

function matchesTarget(rule, product) {
    switch (rule.target_type) {
        case TARGET_ALL:
            return true;
        case TARGET_PRODUCT:
            return Number(rule.product_id) === Number(product.id);
        case TARGET_CATEGORY:
            return Number(rule.category_id) === Number(product.category_id);
        default:
            return false;
    }
}

// ── Helper: rule touches product (for buildPreview) ───────────

function ruleTouchesProduct(rule, product) {
    if (matchesTarget(rule, product)) return true;
    if (rule.kind === KIND_BUNDLE_PRICE) {
        return (rule.bundleItems || []).some(
            (item) => Number(item.product_id) === Number(product.id)
        );
    }
    if (rule.kind === KIND_BUY_X_GET_Y) {
        return (rule.buyGetItems || []).some(
            (item) => Number(item.product_id) === Number(product.id)
        );
    }
    return false;
}

// ── Helper: serialize rule for output ─────────────────────────

function serializeRule(rule, includePriceContext = true) {
    return {
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        label: ruleLabel(rule),
        priority: Number(rule.priority),
        target_type: rule.target_type,
        customer_scope: rule.customer_scope,
        eligible_loyalty_tiers: rule.eligible_loyalty_tiers,
        price_context: includePriceContext,
    };
}

// ── Helper: rule label ────────────────────────────────────────

function standardDiscountLabel(rule) {
    switch (rule.discount_type) {
        case TYPE_PERCENTAGE:
            return `${String(rule.discount_value).replace(/\.?0+$/, '')}% OFF`;
        case TYPE_FIXED_AMOUNT:
            return `Hemat Rp ${Number(rule.discount_value).toLocaleString('id-ID')}`;
        case TYPE_FIXED_PRICE:
            return `Harga Rp ${Number(rule.discount_value).toLocaleString('id-ID')}`;
        default:
            return rule.name;
    }
}

function ruleLabel(rule) {
    switch (rule.kind) {
        case KIND_QTY_BREAK:
            return `Grosir ${standardDiscountLabel(rule)}`;
        case KIND_BUNDLE_PRICE:
            return `Bundle Rp ${Number(rule.discount_value).toLocaleString('id-ID')}`;
        case KIND_BUY_X_GET_Y:
            return 'Buy X Get Y';
        default:
            return standardDiscountLabel(rule);
    }
}

// ── Helper: calculate line candidate for direct rules ─────────

function calculateLineCandidate(rule, product, quantity, qtyBreaks) {
    if (!matchesTarget(rule, product)) return null;

    const baseUnitPrice = Number(product.sell_price);
    const lineBaseTotal = baseUnitPrice * quantity;

    if (rule.kind === KIND_QTY_BREAK) {
        const breaks = (qtyBreaks || [])
            .filter((brk) => quantity >= Number(brk.min_qty))
            .sort((a, b) => {
                if (Number(b.min_qty) !== Number(a.min_qty))
                    return Number(b.min_qty) - Number(a.min_qty);
                if (Number(a.sort_order) !== Number(b.sort_order))
                    return Number(a.sort_order) - Number(b.sort_order);
                return Number(a.id) - Number(b.id);
            });

        const bestBreak = breaks[0];
        if (!bestBreak) return null;

        const discount = resolveLineDiscount(
            bestBreak.discount_type,
            Number(bestBreak.discount_value),
            baseUnitPrice,
            quantity
        );

        return {
            rule,
            quantity,
            base_unit_price: baseUnitPrice,
            line_base_total: lineBaseTotal,
            line_total: Math.max(0, lineBaseTotal - discount),
            line_discount: discount,
        };
    }

    // standard_discount
    const discount = resolveLineDiscount(
        rule.discount_type,
        Number(rule.discount_value),
        baseUnitPrice,
        quantity
    );

    return {
        rule,
        quantity,
        base_unit_price: baseUnitPrice,
        line_base_total: lineBaseTotal,
        line_total: Math.max(0, lineBaseTotal - discount),
        line_discount: discount,
    };
}

// ── Helper: consume matching items ────────────────────────────

function consumeMatchingItems(items, remainingQuantities, matcher, requiredQuantity) {
    let required = Math.max(1, requiredQuantity);
    const matches = [];

    for (const item of items) {
        if (required <= 0) break;
        if (!matcher(item)) continue;

        const availableQty = remainingQuantities[item.cart_id] ?? 0;
        if (availableQty <= 0) continue;

        const take = Math.min(availableQty, required);
        matches.push({
            cart_id: Number(item.cart_id),
            product_id: Number(item.product_id),
            product_title: item.product_title,
            quantity: take,
            base_total: Number(item.base_unit_price) * take,
        });
        required -= take;
    }

    return required === 0 ? matches : null;
}

// ── Helper: allocate discount proportionally ──────────────────

function allocateDiscount(participants, discountTotal) {
    const baseTotal = Math.max(
        1,
        participants.reduce((sum, p) => sum + Number(p.base_total), 0)
    );
    const allocated = [];
    let running = 0;

    participants.forEach((participant, index) => {
        const share =
            index === participants.length - 1
                ? discountTotal - running
                : Math.floor(
                      discountTotal * (Number(participant.base_total) / baseTotal)
                  );
        const clampedShare = Math.max(
            0,
            Math.min(Number(participant.base_total), share)
        );
        running += clampedShare;
        allocated.push({ ...participant, discount_total: clampedShare });
    });

    return allocated;
}

// ── Helper: build bundle candidate ────────────────────────────

function buildBundleCandidate(rule, items, remainingQuantities, pricingBundles) {
    const bundleItems = (pricingBundles || []).filter(
        (b) => Number(b.pricing_rule_id) === Number(rule.id)
    );
    if (bundleItems.length === 0) return null;

    const participants = [];
    const tempRemaining = { ...remainingQuantities };

    for (const bundleItem of bundleItems) {
        const matched = consumeMatchingItems(
            items,
            tempRemaining,
            (item) => Number(item.product_id) === Number(bundleItem.product_id),
            Number(bundleItem.quantity)
        );
        if (!matched) return null;

        for (const m of matched) {
            tempRemaining[m.cart_id] = Math.max(
                0,
                (tempRemaining[m.cart_id] ?? 0) - m.quantity
            );
        }
        participants.push(...matched);
    }

    const baseTotal = participants.reduce(
        (sum, p) => sum + Number(p.base_total),
        0
    );
    const bundlePrice = Math.round(Number(rule.discount_value));
    if (bundlePrice >= baseTotal) return null;

    const allocations = allocateDiscount(participants, baseTotal - bundlePrice);

    return {
        rule,
        rule_id: Number(rule.id),
        priority: Number(rule.priority),
        group_key: `bundle-${rule.id}-${crypto.randomUUID()}`,
        group_label: rule.name,
        discount_total: baseTotal - bundlePrice,
        participants: allocations,
    };
}

// ── Helper: build buy-x-get-y candidate ───────────────────────

function buildBuyGetCandidate(rule, items, remainingQuantities, pricingBuyGet) {
    const buyGetItems = (pricingBuyGet || []).filter(
        (bg) => Number(bg.pricing_rule_id) === Number(rule.id)
    );

    const buyItems = buyGetItems.filter((bg) => bg.role === ROLE_BUY);
    const getItems = buyGetItems.filter((bg) => bg.role === ROLE_GET);

    if (buyItems.length === 0 || getItems.length === 0) return null;

    const participants = [];
    const tempRemaining = { ...remainingQuantities };

    // Check buy items
    for (const buyItem of buyItems) {
        const matched = consumeMatchingItems(
            items,
            tempRemaining,
            (item) => Number(item.product_id) === Number(buyItem.product_id),
            Number(buyItem.quantity)
        );
        if (!matched) return null;

        for (const m of matched) {
            tempRemaining[m.cart_id] = Math.max(
                0,
                (tempRemaining[m.cart_id] ?? 0) - m.quantity
            );
            m.discount_total = 0;
            participants.push(m);
        }
    }

    // Check get items (rewards)
    const rewardParticipants = [];
    for (const getItem of getItems) {
        const matched = consumeMatchingItems(
            items,
            tempRemaining,
            (item) => Number(item.product_id) === Number(getItem.product_id),
            Number(getItem.quantity)
        );
        if (!matched) return null;

        for (const m of matched) {
            tempRemaining[m.cart_id] = Math.max(
                0,
                (tempRemaining[m.cart_id] ?? 0) - m.quantity
            );
            m.discount_total = Number(m.base_total); // free!
            rewardParticipants.push(m);
            participants.push(m);
        }
    }

    const discountTotal = rewardParticipants.reduce(
        (sum, p) => sum + Number(p.discount_total),
        0
    );
    if (discountTotal <= 0) return null;

    return {
        rule,
        rule_id: Number(rule.id),
        priority: Number(rule.priority),
        group_key: `bxgy-${rule.id}-${crypto.randomUUID()}`,
        group_label: rule.name,
        discount_total: discountTotal,
        participants,
    };
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Get active pricing rules from cached data.
 *
 * @param {Array} allRules — all pricing rules from IndexedDB
 * @param {Date} [at] — current time (defaults to now)
 * @returns {Array} — filtered & sorted active rules
 */
export function getActiveRules(allRules, at = new Date()) {
    return (allRules || [])
        .filter((rule) => {
            if (!rule.is_active) return false;
            if (rule.starts_at && new Date(rule.starts_at) > at) return false;
            if (rule.ends_at && new Date(rule.ends_at) < at) return false;
            return true;
        })
        .sort((a, b) => {
            if (Number(b.priority) !== Number(a.priority))
                return Number(b.priority) - Number(a.priority);
            return Number(a.id) - Number(b.id);
        });
}

/**
 * Calculate price for a single product (with promo rules).
 *
 * @param {Object} product — product data
 * @param {number} qty — quantity
 * @param {Object|null} customer — customer data (null for walk-in)
 * @param {Array} rules — active pricing rules
 * @param {Array} qtyBreaks — all qty break records
 * @returns {Object} — pricing result
 */
export function calculateProductPrice(product, qty = 1, customer = null, rules = [], qtyBreaks = []) {
    const quantity = Math.max(1, qty);
    const matchingRules = rules
        .filter((rule) => matchesCustomerScope(rule, customer))
        .filter((rule) => ruleTouchesProduct(rule, product));

    // Direct rules (standard_discount, qty_break)
    const directCandidates = matchingRules
        .filter((rule) =>
            [KIND_STANDARD_DISCOUNT, KIND_QTY_BREAK].includes(rule.kind)
        )
        .map((rule) => {
            const previewQuantity =
                rule.kind === KIND_QTY_BREAK
                    ? Math.max(
                          quantity,
                          Number(rule.preview_quantity_multiplier || 0) ||
                              Math.max(
                                  0,
                                  ...((qtyBreaks || [])
                                      .filter(
                                          (b) =>
                                              Number(b.pricing_rule_id) ===
                                              Number(rule.id)
                                      )
                                      .map((b) => Number(b.min_qty)))
                              ) ||
                              1
                      )
                    : quantity;

            const ruleBreaks = (qtyBreaks || []).filter(
                (b) => Number(b.pricing_rule_id) === Number(rule.id)
            );
            return calculateLineCandidate(rule, product, previewQuantity, ruleBreaks);
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (Number(b.rule.priority) !== Number(a.rule.priority))
                return Number(b.rule.priority) - Number(a.rule.priority);
            if (Number(b.line_discount) !== Number(a.line_discount))
                return Number(b.line_discount) - Number(a.line_discount);
            return Number(a.rule.id) - Number(b.rule.id);
        });

    const bestDirect = directCandidates[0];
    if (bestDirect) {
        const baseUnitPrice = Number(bestDirect.base_unit_price);
        const effectiveUnitPrice = Math.round(
            bestDirect.line_total / Math.max(1, Number(bestDirect.quantity))
        );

        return {
            base_unit_price: baseUnitPrice,
            effective_unit_price: effectiveUnitPrice,
            quantity: Number(bestDirect.quantity),
            line_base_total: Number(bestDirect.line_base_total),
            line_total: Number(bestDirect.line_total),
            line_discount_total: Number(bestDirect.line_discount),
            pricing_rule: serializeRule(bestDirect.rule),
        };
    }

    // Complex rules (bundle, buy_x_get_y) — just for badge display
    const complexRule = matchingRules
        .filter((rule) =>
            [KIND_BUNDLE_PRICE, KIND_BUY_X_GET_Y].includes(rule.kind)
        )
        .sort((a, b) => {
            if (Number(b.priority) !== Number(a.priority))
                return Number(b.priority) - Number(a.priority);
            return Number(a.id) - Number(b.id);
        })[0];

    return {
        base_unit_price: Number(product.sell_price),
        effective_unit_price: Number(product.sell_price),
        quantity,
        line_base_total: Number(product.sell_price) * quantity,
        line_total: Number(product.sell_price) * quantity,
        line_discount_total: 0,
        pricing_rule: complexRule ? serializeRule(complexRule, false) : null,
    };
}

/**
 * Build full cart pricing preview (the main pricing function).
 *
 * @param {Array} cartItems — array of { cart_id, product_id, qty, product: {...} }
 * @param {Object|null} customer — customer data
 * @param {Object} cachedData — { rules, qtyBreaks, bundles, buyGet }
 * @returns {Object} — { items, applied_groups, consumed_quantities, unmatched_items, summary }
 */
export function buildCartPreview(cartItems, customer = null, cachedData = {}) {
    const { rules: allRules = [], qtyBreaks = [], bundles: pricingBundles = [], buyGet: pricingBuyGet = [] } = cachedData;
    const activeRules = getActiveRules(allRules);

    // Initialize items
    const items = {};
    const remainingQuantities = {};

    for (const cart of cartItems) {
        if (!cart.product) continue;
        const baseUnitPrice = Number(cart.product.sell_price);
        items[cart.cart_id] = {
            cart_id: cart.cart_id,
            product_id: cart.product_id,
            product_title: cart.product?.title,
            qty: Number(cart.qty),
            base_unit_price: baseUnitPrice,
            effective_unit_price: baseUnitPrice,
            line_base_total: baseUnitPrice * Number(cart.qty),
            line_total: baseUnitPrice * Number(cart.qty),
            line_discount_total: 0,
            pricing_rule: null,
            pricing_group_key: null,
            pricing_group_label: null,
            applied_rules: [],
        };
        remainingQuantities[cart.cart_id] = Number(cart.qty);
    }

    // Filter eligible rules
    const eligibleRules = activeRules.filter((rule) =>
        matchesCustomerScope(rule, customer)
    );

    const appliedGroups = [];

    // Stage 1: Bundle rules
    const bundleRules = eligibleRules.filter(
        (rule) => rule.kind === KIND_BUNDLE_PRICE
    );
    const bundleGroups = applyComplexStage(
        bundleRules,
        items,
        remainingQuantities,
        'bundle',
        pricingBundles,
        pricingBuyGet
    );
    appliedGroups.push(...bundleGroups);

    // Stage 2: Buy-X-Get-Y rules
    const buyGetRules = eligibleRules.filter(
        (rule) => rule.kind === KIND_BUY_X_GET_Y
    );
    const buyGetGroups = applyComplexStage(
        buyGetRules,
        items,
        remainingQuantities,
        'buy_get',
        pricingBundles,
        pricingBuyGet
    );
    appliedGroups.push(...buyGetGroups);

    // Stage 3: Direct rules (standard_discount, qty_break)
    for (const cartId in items) {
        const remainingQty = Math.max(0, remainingQuantities[cartId] ?? 0);
        if (remainingQty === 0) continue;

        const cartProduct = cartItems.find(
            (c) => Number(c.cart_id) === Number(cartId)
        )?.product;
        if (!cartProduct) continue;

        const directCandidates = eligibleRules
            .filter((rule) =>
                [KIND_QTY_BREAK, KIND_STANDARD_DISCOUNT].includes(rule.kind)
            )
            .map((rule) => {
                const ruleBreaks = qtyBreaks.filter(
                    (b) => Number(b.pricing_rule_id) === Number(rule.id)
                );
                return calculateLineCandidate(rule, cartProduct, remainingQty, ruleBreaks);
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (Number(b.rule.priority) !== Number(a.rule.priority))
                    return Number(b.rule.priority) - Number(a.rule.priority);
                if (Number(b.line_discount) !== Number(a.line_discount))
                    return Number(b.line_discount) - Number(a.line_discount);
                return Number(a.rule.id) - Number(b.rule.id);
            });

        const candidate = directCandidates[0];
        if (!candidate || Number(candidate.line_discount) <= 0) continue;

        const currentItem = items[cartId];
        currentItem.line_total -= Number(candidate.line_discount);
        currentItem.line_discount_total += Number(candidate.line_discount);
        currentItem.pricing_rule = serializeRule(candidate.rule);
        currentItem.applied_rules.push(serializeRule(candidate.rule));
        currentItem.pricing_group_key ??= `rule-${candidate.rule.id}`;
        currentItem.pricing_group_label ??= candidate.rule.name;
    }

    // Normalize
    for (const cartId in items) {
        const item = items[cartId];
        item.line_total = Math.max(0, Number(item.line_total));
        item.line_discount_total = Math.max(0, Number(item.line_discount_total));
        item.effective_unit_price = Math.round(
            item.line_total / Math.max(1, Number(item.qty))
        );
    }

    const itemsArray = Object.values(items);
    const baseSubtotal = itemsArray.reduce(
        (sum, item) => sum + Number(item.line_base_total),
        0
    );
    const promoDiscountTotal = itemsArray.reduce(
        (sum, item) => sum + Number(item.line_discount_total),
        0
    );
    const subtotalAfterPromo = Math.max(0, baseSubtotal - promoDiscountTotal);

    return {
        items: itemsArray,
        applied_groups: appliedGroups,
        consumed_quantities: Object.fromEntries(
            Object.entries(remainingQuantities).map(([cartId, qty]) => {
                const original =
                    itemsArray.find((i) => Number(i.cart_id) === Number(cartId))
                        ?.qty ?? 0;
                return [cartId, Math.max(0, original - qty)];
            })
        ),
        unmatched_items: Object.fromEntries(
            Object.entries(remainingQuantities).filter(
                ([, qty]) => qty > 0
            )
        ),
        summary: {
            base_subtotal: baseSubtotal,
            promo_discount_total: promoDiscountTotal,
            subtotal_after_promo: subtotalAfterPromo,
        },
    };
}

// ── Internal: apply complex stage (bundle/buy-get) ────────────

function applyComplexStage(rules, items, remainingQuantities, stage, pricingBundles, pricingBuyGet) {
    const groups = [];

    while (true) {
        const candidates = rules
            .map((rule) => {
                return stage === 'bundle'
                    ? buildBundleCandidate(rule, Object.values(items), remainingQuantities, pricingBundles)
                    : buildBuyGetCandidate(rule, Object.values(items), remainingQuantities, pricingBuyGet);
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (Number(b.priority) !== Number(a.priority))
                    return Number(b.priority) - Number(a.priority);
                if (Number(b.discount_total) !== Number(a.discount_total))
                    return Number(b.discount_total) - Number(a.discount_total);
                return Number(a.rule_id) - Number(b.rule_id);
            });

        const candidate = candidates[0];
        if (!candidate) break;

        for (const participant of candidate.participants) {
            const cartId = Number(participant.cart_id);
            const consumeQty = Number(participant.quantity);
            remainingQuantities[cartId] = Math.max(
                0,
                (remainingQuantities[cartId] ?? 0) - consumeQty
            );

            const currentItem = items[cartId];
            currentItem.line_total -= Number(participant.discount_total);
            currentItem.line_discount_total += Number(participant.discount_total);
            currentItem.pricing_group_key = candidate.group_key;
            currentItem.pricing_group_label = candidate.group_label;
            currentItem.pricing_rule = serializeRule(candidate.rule);
            currentItem.applied_rules.push(serializeRule(candidate.rule));
        }

        groups.push({
            key: candidate.group_key,
            label: candidate.group_label,
            rule: serializeRule(candidate.rule),
            discount_total: Number(candidate.discount_total),
            participants: candidate.participants,
        });
    }

    return groups;
}
