/**
 * cartStore.js — React Context for local-first cart management
 *
 * All cart state lives in IndexedDB. This context provides
 * React-friendly access with automatic re-rendering on changes.
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import {
    addToCart as dbAddToCart,
    updateCartItem as dbUpdateCartItem,
    removeCartItem as dbRemoveCartItem,
    getCartItems as dbGetCartItems,
    clearCart as dbClearCart,
    getCartItemCount,
    holdCart as dbHoldCart,
    getHeldCarts as dbGetHeldCarts,
    resumeCart as dbResumeCart,
    deleteHeldCart as dbDeleteHeldCart,
    getCachedPricingRules,
    getCachedPricingQtyBreaks,
    getCachedPricingBundles,
    getCachedPricingBuyGet,
    getCachedCustomers,
    getCachedLoyaltySettings,
    getCachedTaxSettings,
    getCachedCustomerVouchers,
    getCachedProducts,
    getCachedProductUnits,
} from '../Utils/offlineDb';
import { buildCartPreview } from '../Utils/pricingEngine';
import { previewCheckout } from '../Utils/loyaltyEngine';

const CartContext = createContext(null);

export function CartProvider({ children, activeShift = null, currentUser = null }) {
    const [cartItems, setCartItems] = useState([]);
    const [heldCarts, setHeldCarts] = useState([]);
    const [pricingPreview, setPricingPreview] = useState(null);
    const [checkoutPreview, setCheckoutPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [checkoutOptions, setCheckoutOptions] = useState({
        customer: null,
        discount: 0,
        shipping: 0,
        redeemPoints: 0,
        voucher: null,
    });

    // Debounce ref for pricing recalculation
    const pricingTimerRef = useRef(null);

    // ── Load cart from IndexedDB ────────────────────────────────

    const refreshCart = useCallback(async () => {
        try {
            const items = await dbGetCartItems();
            setCartItems(items);
        } catch (err) {
            console.error('Failed to load cart:', err);
        }
    }, []);

    const refreshHeldCarts = useCallback(async () => {
        try {
            const held = await dbGetHeldCarts();
            setHeldCarts(held);
        } catch (err) {
            console.error('Failed to load held carts:', err);
        }
    }, []);

    // ── Recalculate pricing preview ─────────────────────────────

    const recalculatePricing = useCallback(async (items, customer) => {
        try {
            const [rules, qtyBreaks, bundles, buyGet] = await Promise.all([
                getCachedPricingRules(),
                getCachedPricingQtyBreaks(),
                getCachedPricingBundles(),
                getCachedPricingBuyGet(),
            ]);

            // Enrich cart items with product data
            const products = await getCachedProducts();
            const productMap = {};
            for (const p of products) {
                productMap[p.id] = p;
            }

            const enrichedItems = items.map((item) => ({
                ...item,
                cart_id: item.id,
                product: item.product || productMap[item.product_id] || null,
            }));

            const preview = buildCartPreview(enrichedItems, customer, {
                rules,
                qtyBreaks,
                bundles,
                buyGet,
            });

            setPricingPreview(preview);
            return preview;
        } catch (err) {
            console.error('Failed to calculate pricing:', err);
            return null;
        }
    }, []);

    // ── Recalculate checkout preview (with loyalty, tax, etc.) ──

    const recalculateCheckout = useCallback(
        async (pricing, customer, options = {}) => {
            try {
                const [loyaltySettings, taxSettings, allVouchers] = await Promise.all([
                    getCachedLoyaltySettings(),
                    getCachedTaxSettings(),
                    getCachedCustomerVouchers(customer?.id),
                ]);

                const checkout = previewCheckout(
                    pricing || pricingPreview,
                    customer,
                    options,
                    {
                        loyaltySettings,
                        taxSettings,
                        allVouchers,
                    }
                );

                setCheckoutPreview(checkout);
                return checkout;
            } catch (err) {
                console.error('Failed to calculate checkout:', err);
                return null;
            }
        },
        [pricingPreview]
    );

    // ── Debounced pricing recalculation ─────────────────────────

    const debouncedRecalculate = useCallback(
        (items, customer, options) => {
            if (pricingTimerRef.current) {
                clearTimeout(pricingTimerRef.current);
            }
            pricingTimerRef.current = setTimeout(async () => {
                const pricing = await recalculatePricing(items, customer);
                if (pricing) {
                    await recalculateCheckout(pricing, customer, options);
                }
            }, 150); // 150ms debounce
        },
        [recalculatePricing, recalculateCheckout]
    );

    // ── Cart operations ─────────────────────────────────────────

    const addItem = useCallback(
        async (product, qty = 1, unitId = null, conversionFactor = 1) => {
            setIsLoading(true);
            try {
                // Check if product already in cart
                const existing = cartItems.find(
                    (item) => item.product_id === product.id && item.unit_id === (unitId || null)
                );

                if (existing) {
                    await dbUpdateCartItem(existing.id, {
                        qty: existing.qty + qty,
                        price: Number(product.sell_price) * (existing.qty + qty),
                    });
                } else {
                    await dbAddToCart({
                        cashier_id: currentUser?.id || 0,
                        warehouse_id: activeShift?.warehouse_id || null,
                        product_id: product.id,
                        unit_id: unitId,
                        conversion_factor: conversionFactor,
                        qty,
                        price: Number(product.sell_price) * qty,
                        product, // cache product data locally
                    });
                }

                await refreshCart();
            } catch (err) {
                console.error('Failed to add to cart:', err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [cartItems, currentUser, activeShift, refreshCart]
    );

    const updateQty = useCallback(
        async (cartItemId, newQty) => {
            if (newQty < 1) return removeItem(cartItemId);
            setIsLoading(true);
            try {
                const item = cartItems.find((i) => i.id === cartItemId);
                if (item) {
                    const product = item.product;
                    await dbUpdateCartItem(cartItemId, {
                        qty: newQty,
                        price: Number(product?.sell_price || 0) * newQty,
                    });
                    await refreshCart();
                }
            } catch (err) {
                console.error('Failed to update quantity:', err);
            } finally {
                setIsLoading(false);
            }
        },
        [cartItems, refreshCart]
    );

    const removeItem = useCallback(
        async (cartItemId) => {
            setIsLoading(true);
            try {
                await dbRemoveCartItem(cartItemId);
                await refreshCart();
            } catch (err) {
                console.error('Failed to remove item:', err);
            } finally {
                setIsLoading(false);
            }
        },
        [refreshCart]
    );

    const clearAll = useCallback(async () => {
        setIsLoading(true);
        try {
            await dbClearCart();
            setCartItems([]);
            setPricingPreview(null);
            setCheckoutPreview(null);
        } catch (err) {
            console.error('Failed to clear cart:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Hold / Resume ───────────────────────────────────────────

    const hold = useCallback(
        async (label = null) => {
            if (cartItems.length === 0) return;
            const holdId = `HOLD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const holdLabel = label || `Transaksi ${new Date().toLocaleTimeString('id-ID')}`;
            await dbHoldCart(holdId, holdLabel, cartItems);
            setCartItems([]);
            setPricingPreview(null);
            setCheckoutPreview(null);
            await refreshHeldCarts();
            return holdId;
        },
        [cartItems, refreshHeldCarts]
    );

    const resume = useCallback(
        async (holdId) => {
            const held = await dbResumeCart(holdId);
            if (held) {
                await refreshCart();
                await refreshHeldCarts();
            }
            return held;
        },
        [refreshCart, refreshHeldCarts]
    );

    const deleteHeld = useCallback(
        async (holdId) => {
            await dbDeleteHeldCart(holdId);
            await refreshHeldCarts();
        },
        [refreshHeldCarts]
    );

    // ── Update checkout options ──────────────────────────────────

    const updateCheckoutOptions = useCallback(
        async (newOptions) => {
            const merged = { ...checkoutOptions, ...newOptions };
            setCheckoutOptions(merged);
            if (pricingPreview) {
                await recalculateCheckout(pricingPreview, merged.customer, {
                    manual_discount: merged.discount,
                    shipping_cost: merged.shipping,
                    redeem_points: merged.redeemPoints,
                    voucher: merged.voucher,
                });
            }
        },
        [checkoutOptions, pricingPreview, recalculateCheckout]
    );

    // ── Load customer for checkout ───────────────────────────────

    const selectCustomer = useCallback(
        async (customer) => {
            await updateCheckoutOptions({ customer });
        },
        [updateCheckoutOptions]
    );

    // ── Initial load ────────────────────────────────────────────

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            await Promise.all([refreshCart(), refreshHeldCarts()]);
            setIsLoading(false);
        })();
    }, [refreshCart, refreshHeldCarts]);

    // ── Auto-recalculate on cart change ─────────────────────────

    useEffect(() => {
        if (cartItems.length > 0) {
            debouncedRecalculate(cartItems, checkoutOptions.customer, {
                manual_discount: checkoutOptions.discount,
                shipping_cost: checkoutOptions.shipping,
                redeem_points: checkoutOptions.redeemPoints,
                voucher: checkoutOptions.voucher,
            });
        } else {
            setPricingPreview(null);
            setCheckoutPreview(null);
        }
    }, [cartItems, checkoutOptions, debouncedRecalculate]);

    // ── Context value ───────────────────────────────────────────

    const value = {
        // State
        cartItems,
        heldCarts,
        pricingPreview,
        checkoutPreview,
        isLoading,
        checkoutOptions,

        // Cart operations
        addItem,
        updateQty,
        removeItem,
        clearAll,

        // Hold/Resume
        hold,
        resume,
        deleteHeld,

        // Checkout options
        updateCheckoutOptions,
        selectCustomer,

        // Refresh
        refreshCart,
        refreshHeldCarts,

        // Raw count (for badge)
        getCartItemCount,

        // Computed
        cartTotal: pricingPreview?.summary?.subtotal_after_promo ?? 0,
        grandTotal: checkoutPreview?.summary?.grand_total ?? 0,
        cartCount: cartItems.reduce((sum, item) => sum + Number(item.qty), 0),
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}

export default CartContext;
