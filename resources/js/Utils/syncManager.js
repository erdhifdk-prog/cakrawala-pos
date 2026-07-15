/**
 * syncManager.js — Sync orchestrator for offline-first POS
 *
 * Handles:
 * 1. Full sync — download all catalog data to IndexedDB
 * 2. Delta sync — download changes since last sync
 * 3. Push pending — upload offline transactions to server
 * 4. Auto-sync on reconnection
 */

import axios from 'axios';
import {
    cacheProducts,
    cacheCustomers,
    cacheCategories,
    cacheWarehouses,
    cacheProductUnits,
    cachePricingRules,
    cachePricingQtyBreaks,
    cachePricingBundles,
    cachePricingBuyGet,
    cacheLoyaltySettings,
    cacheTaxSettings,
    cacheCustomerVouchers,
    getPendingSyncItems,
    updateSyncStatus,
    removePendingSyncItem,
    setLastSyncTime,
    getLastSyncTime,
    setSyncMeta,
    getSyncMeta,
    getPendingSyncCount,
    clearSyncedItems,
    saveTransaction,
    updateTransactionStatus,
    getOfflineDataSummary,
} from './offlineDb';

// ── State ─────────────────────────────────────────────────────

let isSyncing = false;
let syncListeners = [];

// ── Event system ──────────────────────────────────────────────

export function onSyncStatusChange(listener) {
    syncListeners.push(listener);
    return () => {
        syncListeners = syncListeners.filter((l) => l !== listener);
    };
}

function notifyListeners(status) {
    for (const listener of syncListeners) {
        try {
            listener(status);
        } catch (err) {
            console.error('Sync listener error:', err);
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  FULL SYNC — Download all catalog data
// ══════════════════════════════════════════════════════════════

export async function fullSync() {
    if (isSyncing) return { status: 'already_syncing' };

    isSyncing = true;
    notifyListeners({ type: 'sync_started', phase: 'full_sync' });

    try {
        const response = await axios.post('/api/sync/catalog', {}, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        const data = response.data;

        // Cache everything in parallel
        await Promise.all([
            cacheProducts(data.products || []),
            cacheCustomers(data.customers || []),
            cacheCategories(data.categories || []),
            cacheWarehouses(data.warehouses || []),
            cacheProductUnits(data.product_units || []),
            cachePricingRules(data.pricing_rules || []),
            cachePricingQtyBreaks(data.pricing_qty_breaks || []),
            cachePricingBundles(data.pricing_bundles || []),
            cachePricingBuyGet(data.pricing_buy_get || []),
            cacheLoyaltySettings(data.loyalty_settings || {}),
            cacheTaxSettings(data.tax_settings || {}),
            cacheCustomerVouchers(data.customer_vouchers || []),
        ]);

        await setLastSyncTime(new Date().toISOString());
        await setSyncMeta('sync_version', data.sync_version || null);

        notifyListeners({
            type: 'sync_completed',
            phase: 'full_sync',
            summary: {
                products: (data.products || []).length,
                customers: (data.customers || []).length,
                rules: (data.pricing_rules || []).length,
            },
        });

        return {
            status: 'success',
            summary: {
                products: (data.products || []).length,
                customers: (data.customers || []).length,
                rules: (data.pricing_rules || []).length,
            },
        };
    } catch (err) {
        console.error('Full sync failed:', err);
        notifyListeners({
            type: 'sync_failed',
            phase: 'full_sync',
            error: err.message,
        });
        return { status: 'error', error: err.message };
    } finally {
        isSyncing = false;
    }
}

// ══════════════════════════════════════════════════════════════
//  DELTA SYNC — Download changes since last sync
// ══════════════════════════════════════════════════════════════

export async function deltaSync() {
    if (isSyncing) return { status: 'already_syncing' };

    const lastSync = await getLastSyncTime();
    if (!lastSync) {
        // No previous sync — do full sync instead
        return fullSync();
    }

    isSyncing = true;
    notifyListeners({ type: 'sync_started', phase: 'delta_sync' });

    try {
        const response = await axios.post('/api/sync/catalog/delta', {
            since: lastSync,
            sync_version: await getSyncMeta('sync_version'),
        }, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        const data = response.data;

        // Apply delta updates
        const updates = [];
        if (data.products?.length) updates.push(cacheProducts(data.products));
        if (data.customers?.length) updates.push(cacheCustomers(data.customers));
        if (data.pricing_rules?.length) updates.push(cachePricingRules(data.pricing_rules));
        if (data.pricing_qty_breaks?.length) updates.push(cachePricingQtyBreaks(data.pricing_qty_breaks));
        if (data.pricing_bundles?.length) updates.push(cachePricingBundles(data.pricing_bundles));
        if (data.pricing_buy_get?.length) updates.push(cachePricingBuyGet(data.pricing_buy_get));
        if (data.customer_vouchers?.length) updates.push(cacheCustomerVouchers(data.customer_vouchers));
        if (data.loyalty_settings) updates.push(cacheLoyaltySettings(data.loyalty_settings));
        if (data.tax_settings) updates.push(cacheTaxSettings(data.tax_settings));

        await Promise.all(updates);
        await setLastSyncTime(new Date().toISOString());
        if (data.sync_version) await setSyncMeta('sync_version', data.sync_version);

        const changes = {
            products: (data.products || []).length,
            customers: (data.customers || []).length,
            rules: (data.pricing_rules || []).length,
        };

        notifyListeners({ type: 'sync_completed', phase: 'delta_sync', summary: changes });
        return { status: 'success', summary: changes };
    } catch (err) {
        console.error('Delta sync failed:', err);
        notifyListeners({ type: 'sync_failed', phase: 'delta_sync', error: err.message });
        return { status: 'error', error: err.message };
    } finally {
        isSyncing = false;
    }
}

// ══════════════════════════════════════════════════════════════
//  PUSH PENDING — Upload offline transactions to server
// ══════════════════════════════════════════════════════════════

export async function pushPending() {
    if (isSyncing) return { status: 'already_syncing' };

    const pending = await getPendingSyncItems();
    if (pending.length === 0) return { status: 'nothing_to_sync' };

    isSyncing = true;
    notifyListeners({
        type: 'push_started',
        pending_count: pending.length,
    });

    const results = {
        accepted: [],
        rejected: [],
        conflicts: [],
        errors: [],
    };

    try {
        // Send all pending transactions in one batch
        const payload = pending.map((item) => ({
            local_id: item.transaction_id,
            ...item.payload,
            offline_created_at: item.created_at,
        }));

        const response = await axios.post('/api/sync/transactions', {
            transactions: payload,
        }, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        const serverResults = response.data.results || [];

        for (const result of serverResults) {
            const pendingItem = pending.find(
                (p) => p.transaction_id === result.local_id
            );

            if (!pendingItem) continue;

            switch (result.status) {
                case 'accepted':
                    // Mark local transaction as synced
                    await updateTransactionStatus(result.local_id, 'synced', {
                        server_invoice: result.invoice,
                        server_transaction_id: result.transaction_id,
                    });
                    // Remove from sync queue
                    await removePendingSyncItem(pendingItem.id);
                    results.accepted.push(result);
                    break;

                case 'rejected':
                    await updateTransactionStatus(result.local_id, 'rejected', {
                        rejection_reason: result.reason,
                    });
                    await updateSyncStatus(pendingItem.id, 'failed', result.reason);
                    results.rejected.push(result);
                    break;

                case 'conflict':
                    await updateTransactionStatus(result.local_id, 'conflict', {
                        conflict_details: result.conflict,
                    });
                    await updateSyncStatus(pendingItem.id, 'failed', result.conflict?.reason);
                    results.conflicts.push(result);
                    break;

                default:
                    results.errors.push(result);
            }
        }

        // Clean up old synced items
        await clearSyncedItems();

        notifyListeners({
            type: 'push_completed',
            results: {
                accepted: results.accepted.length,
                rejected: results.rejected.length,
                conflicts: results.conflicts.length,
                errors: results.errors.length,
            },
        });

        return { status: 'success', results };
    } catch (err) {
        console.error('Push pending failed:', err);

        // Mark all as failed with error
        for (const item of pending) {
            await updateSyncStatus(item.id, 'failed', err.message);
        }

        notifyListeners({
            type: 'push_failed',
            error: err.message,
        });

        return { status: 'error', error: err.message, results };
    } finally {
        isSyncing = false;
    }
}

// ══════════════════════════════════════════════════════════════
//  AUTO-SYNC — Triggered on reconnection
// ══════════════════════════════════════════════════════════════

export async function onOnline() {
    console.log('[SyncManager] Online detected, starting sync...');
    notifyListeners({ type: 'reconnection_detected' });

    try {
        // Step 1: Push pending transactions first
        const pushResult = await pushPending();

        // Step 2: Delta sync to get latest data
        const syncResult = await deltaSync();

        notifyListeners({
            type: 'auto_sync_completed',
            push: pushResult,
            sync: syncResult,
        });

        return { push: pushResult, sync: syncResult };
    } catch (err) {
        console.error('[SyncManager] Auto-sync failed:', err);
        notifyListeners({ type: 'auto_sync_failed', error: err.message });
        return { status: 'error', error: err.message };
    }
}

// ══════════════════════════════════════════════════════════════
//  STATUS — Get sync status
// ══════════════════════════════════════════════════════════════

export async function getSyncStatus() {
    const pendingCount = await getPendingSyncCount();
    const lastSync = await getLastSyncTime();
    const summary = await getOfflineDataSummary();

    return {
        is_syncing: isSyncing,
        pending_transactions: pendingCount,
        last_sync: lastSync,
        offline_data: summary,
    };
}

export function isSyncInProgress() {
    return isSyncing;
}

// ══════════════════════════════════════════════════════════════
//  MANUAL SYNC — Triggered by user
// ══════════════════════════════════════════════════════════════

export async function manualSync() {
    if (isSyncing) return { status: 'already_syncing' };

    notifyListeners({ type: 'manual_sync_started' });

    const pushResult = await pushPending();
    const syncResult = await fullSync();

    return { push: pushResult, sync: syncResult };
}

// ══════════════════════════════════════════════════════════════
//  INITIALIZATION — Set up auto-sync listeners
// ══════════════════════════════════════════════════════════════

let initialized = false;

export function initSyncManager() {
    if (initialized) return;
    initialized = true;

    // Listen for online events
    window.addEventListener('online', () => {
        console.log('[SyncManager] Browser online event detected');
        // Small delay to ensure connection is stable
        setTimeout(onOnline, 1000);
    });

    // Periodic sync check (every 5 minutes when online)
    setInterval(async () => {
        if (navigator.onLine && !isSyncing) {
            const pendingCount = await getPendingSyncCount();
            if (pendingCount > 0) {
                console.log(`[SyncManager] Periodic sync: ${pendingCount} pending transactions`);
                await pushPending();
            }
        }
    }, 5 * 60 * 1000);

    console.log('[SyncManager] Initialized');
}
