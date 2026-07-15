import { openDB } from 'idb';

const DB_NAME = 'pos-offline';
const DB_VERSION = 2;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
        // v1 → v2: expand schema for full offline-first support

        // ── Master Data Stores ──────────────────────────────────

        if (!db.objectStoreNames.contains('products')) {
            db.createObjectStore('products', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('product_units')) {
            db.createObjectStore('product_units', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('customers')) {
            db.createObjectStore('customers', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('customer_vouchers')) {
            db.createObjectStore('customer_vouchers', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('warehouses')) {
            db.createObjectStore('warehouses', { keyPath: 'id' });
        }

        // ── Pricing Rules Stores ────────────────────────────────

        if (!db.objectStoreNames.contains('pricing_rules')) {
            db.createObjectStore('pricing_rules', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('pricing_qty_breaks')) {
            db.createObjectStore('pricing_qty_breaks', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('pricing_bundles')) {
            db.createObjectStore('pricing_bundles', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('pricing_buy_get')) {
            db.createObjectStore('pricing_buy_get', { keyPath: 'id' });
        }

        // ── Settings Stores ─────────────────────────────────────

        if (!db.objectStoreNames.contains('loyalty_settings')) {
            db.createObjectStore('loyalty_settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('tax_settings')) {
            db.createObjectStore('tax_settings', { keyPath: 'key' });
        }

        // ── Local State Stores ──────────────────────────────────

        if (!db.objectStoreNames.contains('cart')) {
            const cartStore = db.createObjectStore('cart', {
                keyPath: 'id',
                autoIncrement: true,
            });
            cartStore.createIndex('cashier_id', 'cashier_id');
            cartStore.createIndex('product_id', 'product_id');
        }

        if (!db.objectStoreNames.contains('held_carts')) {
            db.createObjectStore('held_carts', { keyPath: 'hold_id' });
        }

        if (!db.objectStoreNames.contains('transactions')) {
            const txStore = db.createObjectStore('transactions', {
                keyPath: 'id',
            });
            txStore.createIndex('status', 'status');
            txStore.createIndex('created_at', 'created_at');
            txStore.createIndex('cashier_id', 'cashier_id');
        }

        // ── Sync Queue Store ────────────────────────────────────

        if (!db.objectStoreNames.contains('pending_sync')) {
            const syncStore = db.createObjectStore('pending_sync', {
                keyPath: 'id',
                autoIncrement: true,
            });
            syncStore.createIndex('status', 'status');
            syncStore.createIndex('transaction_id', 'transaction_id');
        }

        // ── Sync Metadata Store ─────────────────────────────────

        if (!db.objectStoreNames.contains('sync_meta')) {
            db.createObjectStore('sync_meta', { keyPath: 'key' });
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Products
// ════════════════════════════════════════════════════════════════

export async function cacheProducts(products) {
    const db = await dbPromise;
    const tx = db.transaction('products', 'readwrite');
    for (const product of products) {
        await tx.store.put(product);
    }
    await tx.done;
}

export async function getCachedProducts() {
    const db = await dbPromise;
    return db.getAll('products');
}

export async function getCachedProduct(id) {
    const db = await dbPromise;
    return db.get('products', id);
}

export async function clearProducts() {
    const db = await dbPromise;
    return db.clear('products');
}

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Product Units
// ════════════════════════════════════════════════════════════════

export async function cacheProductUnits(units) {
    const db = await dbPromise;
    const tx = db.transaction('product_units', 'readwrite');
    for (const unit of units) {
        await tx.store.put(unit);
    }
    await tx.done;
}

export async function getCachedProductUnits() {
    const db = await dbPromise;
    return db.getAll('product_units');
}

export async function getCachedUnitsForProduct(productId) {
    const db = await dbPromise;
    const all = await db.getAll('product_units');
    return all.filter((u) => u.product_id === productId);
}

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Customers
// ════════════════════════════════════════════════════════════════

export async function cacheCustomers(customers) {
    const db = await dbPromise;
    const tx = db.transaction('customers', 'readwrite');
    for (const customer of customers) {
        await tx.store.put(customer);
    }
    await tx.done;
}

export async function getCachedCustomers() {
    const db = await dbPromise;
    return db.getAll('customers');
}

export async function getCachedCustomer(id) {
    const db = await dbPromise;
    return db.get('customers', id);
}

export async function clearCustomers() {
    const db = await dbPromise;
    return db.clear('customers');
}

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Customer Vouchers
// ════════════════════════════════════════════════════════════════

export async function cacheCustomerVouchers(vouchers) {
    const db = await dbPromise;
    const tx = db.transaction('customer_vouchers', 'readwrite');
    for (const voucher of vouchers) {
        await tx.store.put(voucher);
    }
    await tx.done;
}

export async function getCachedCustomerVouchers(customerId) {
    const db = await dbPromise;
    const all = await db.getAll('customer_vouchers');
    return all.filter((v) => v.customer_id === customerId);
}

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Categories
// ════════════════════════════════════════════════════════════════

export async function cacheCategories(categories) {
    const db = await dbPromise;
    const tx = db.transaction('categories', 'readwrite');
    for (const cat of categories) {
        await tx.store.put(cat);
    }
    await tx.done;
}

export async function getCachedCategories() {
    const db = await dbPromise;
    return db.getAll('categories');
}

// ════════════════════════════════════════════════════════════════
//  MASTER DATA — Warehouses
// ════════════════════════════════════════════════════════════════

export async function cacheWarehouses(warehouses) {
    const db = await dbPromise;
    const tx = db.transaction('warehouses', 'readwrite');
    for (const wh of warehouses) {
        await tx.store.put(wh);
    }
    await tx.done;
}

export async function getCachedWarehouses() {
    const db = await dbPromise;
    return db.getAll('warehouses');
}

// ════════════════════════════════════════════════════════════════
//  PRICING RULES
// ════════════════════════════════════════════════════════════════

export async function cachePricingRules(rules) {
    const db = await dbPromise;
    const tx = db.transaction('pricing_rules', 'readwrite');
    for (const rule of rules) {
        await tx.store.put(rule);
    }
    await tx.done;
}

export async function getCachedPricingRules() {
    const db = await dbPromise;
    return db.getAll('pricing_rules');
}

export async function cachePricingQtyBreaks(breaks) {
    const db = await dbPromise;
    const tx = db.transaction('pricing_qty_breaks', 'readwrite');
    for (const brk of breaks) {
        await tx.store.put(brk);
    }
    await tx.done;
}

export async function getCachedPricingQtyBreaks() {
    const db = await dbPromise;
    return db.getAll('pricing_qty_breaks');
}

export async function cachePricingBundles(bundles) {
    const db = await dbPromise;
    const tx = db.transaction('pricing_bundles', 'readwrite');
    for (const bundle of bundles) {
        await tx.store.put(bundle);
    }
    await tx.done;
}

export async function getCachedPricingBundles() {
    const db = await dbPromise;
    return db.getAll('pricing_bundles');
}

export async function cachePricingBuyGet(items) {
    const db = await dbPromise;
    const tx = db.transaction('pricing_buy_get', 'readwrite');
    for (const item of items) {
        await tx.store.put(item);
    }
    await tx.done;
}

export async function getCachedPricingBuyGet() {
    const db = await dbPromise;
    return db.getAll('pricing_buy_get');
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS — Loyalty & Tax
// ════════════════════════════════════════════════════════════════

export async function cacheLoyaltySettings(settings) {
    const db = await dbPromise;
    const tx = db.transaction('loyalty_settings', 'readwrite');
    for (const [key, value] of Object.entries(settings)) {
        await tx.store.put({ key, value });
    }
    await tx.done;
}

export async function getCachedLoyaltySettings() {
    const db = await dbPromise;
    const all = await db.getAll('loyalty_settings');
    const settings = {};
    for (const item of all) {
        settings[item.key] = item.value;
    }
    return settings;
}

export async function cacheTaxSettings(settings) {
    const db = await dbPromise;
    const tx = db.transaction('tax_settings', 'readwrite');
    for (const [key, value] of Object.entries(settings)) {
        await tx.store.put({ key, value });
    }
    await tx.done;
}

export async function getCachedTaxSettings() {
    const db = await dbPromise;
    const all = await db.getAll('tax_settings');
    const settings = {};
    for (const item of all) {
        settings[item.key] = item.value;
    }
    return settings;
}

// ════════════════════════════════════════════════════════════════
//  LOCAL CART
// ════════════════════════════════════════════════════════════════

export async function addToCart(item) {
    const db = await dbPromise;
    return db.add('cart', {
        ...item,
        created_at: new Date().toISOString(),
    });
}

export async function updateCartItem(id, updates) {
    const db = await dbPromise;
    const existing = await db.get('cart', id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await db.put('cart', updated);
    return updated;
}

export async function removeCartItem(id) {
    const db = await dbPromise;
    return db.delete('cart', id);
}

export async function getCartItems() {
    const db = await dbPromise;
    return db.getAll('cart');
}

export async function clearCart() {
    const db = await dbPromise;
    return db.clear('cart');
}

export async function getCartItemCount() {
    const db = await dbPromise;
    return db.count('cart');
}

// ════════════════════════════════════════════════════════════════
//  HELD CARTS (Hold/Resume)
// ════════════════════════════════════════════════════════════════

export async function holdCart(holdId, label, items) {
    const db = await dbPromise;
    await db.put('held_carts', {
        hold_id: holdId,
        label,
        items,
        held_at: new Date().toISOString(),
    });
    // Clear active cart
    await db.clear('cart');
}

export async function getHeldCarts() {
    const db = await dbPromise;
    return db.getAll('held_carts');
}

export async function resumeCart(holdId) {
    const db = await dbPromise;
    const held = await db.get('held_carts', holdId);
    if (!held) return null;

    // Move items back to cart
    const tx = db.transaction(['cart', 'held_carts'], 'readwrite');
    for (const item of held.items) {
        await tx.objectStore('cart').put({
            ...item,
            id: undefined, // auto-increment
        });
    }
    await tx.objectStore('held_carts').delete(holdId);
    await tx.done;
    return held;
}

export async function deleteHeldCart(holdId) {
    const db = await dbPromise;
    return db.delete('held_carts', holdId);
}

// ════════════════════════════════════════════════════════════════
//  LOCAL TRANSACTIONS (Completed offline)
// ════════════════════════════════════════════════════════════════

export async function saveTransaction(transaction) {
    const db = await dbPromise;
    return db.put('transactions', transaction);
}

export async function getTransaction(id) {
    const db = await dbPromise;
    return db.get('transactions', id);
}

export async function getAllTransactions() {
    const db = await dbPromise;
    return db.getAll('transactions');
}

export async function getTransactionsByStatus(status) {
    const db = await dbPromise;
    const index = db.transaction('transactions').store.index('status');
    return index.getAll(status);
}

export async function updateTransactionStatus(id, status, serverData = {}) {
    const db = await dbPromise;
    const existing = await db.get('transactions', id);
    if (!existing) return null;
    const updated = { ...existing, ...serverData, status };
    await db.put('transactions', updated);
    return updated;
}

// ════════════════════════════════════════════════════════════════
//  SYNC QUEUE (Pending sync to server)
// ════════════════════════════════════════════════════════════════

export async function queueForSync(transactionId, payload) {
    const db = await dbPromise;
    return db.add('pending_sync', {
        transaction_id: transactionId,
        payload,
        status: 'pending', // pending | syncing | synced | failed
        attempts: 0,
        last_error: null,
        created_at: new Date().toISOString(),
    });
}

export async function getPendingSyncItems() {
    const db = await dbPromise;
    const index = db.transaction('pending_sync').store.index('status');
    return index.getAll('pending');
}

export async function getPendingSyncCount() {
    const items = await getPendingSyncItems();
    return items.length;
}

export async function updateSyncStatus(id, status, error = null) {
    const db = await dbPromise;
    const existing = await db.get('pending_sync', id);
    if (!existing) return null;
    const updated = {
        ...existing,
        status,
        attempts: existing.attempts + 1,
        last_error: error,
        synced_at: status === 'synced' ? new Date().toISOString() : existing.synced_at,
    };
    await db.put('pending_sync', updated);
    return updated;
}

export async function removePendingSyncItem(id) {
    const db = await dbPromise;
    return db.delete('pending_sync', id);
}

export async function clearSyncedItems() {
    const db = await dbPromise;
    const all = await db.getAll('pending_sync');
    const synced = all.filter((item) => item.status === 'synced');
    const tx = db.transaction('pending_sync', 'readwrite');
    for (const item of synced) {
        await tx.store.delete(item.id);
    }
    await tx.done;
}

// ════════════════════════════════════════════════════════════════
//  SYNC METADATA
// ════════════════════════════════════════════════════════════════

export async function setSyncMeta(key, value) {
    const db = await dbPromise;
    return db.put('sync_meta', { key, value, updated_at: new Date().toISOString() });
}

export async function getSyncMeta(key) {
    const db = await dbPromise;
    const meta = await db.get('sync_meta', key);
    return meta?.value ?? null;
}

export async function getLastSyncTime() {
    return getSyncMeta('last_full_sync');
}

export async function setLastSyncTime(timestamp) {
    return setSyncMeta('last_full_sync', timestamp);
}

// ════════════════════════════════════════════════════════════════
//  UTILITY — Clear all offline data
// ════════════════════════════════════════════════════════════════

export async function clearAllOfflineData() {
    const db = await dbPromise;
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
        await tx.objectStore(name).clear();
    }
    await tx.done;
}

// ════════════════════════════════════════════════════════════════
//  UTILITY — Get offline data summary (for debugging)
// ════════════════════════════════════════════════════════════════

export async function getOfflineDataSummary() {
    const db = await dbPromise;
    const storeNames = Array.from(db.objectStoreNames);
    const summary = {};
    for (const name of storeNames) {
        summary[name] = await db.count(name);
    }
    return summary;
}
