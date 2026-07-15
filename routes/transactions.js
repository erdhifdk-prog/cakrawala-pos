// routes/transactions.js - Transaction & POS (Complete)
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // List transactions
    router.get('/', auth, (req, res) => {
        const { start_date, end_date, status, customer_id } = req.query;
        let query = 'SELECT t.*, u.name as cashier_name, c.name as customer_name FROM transactions t LEFT JOIN users u ON t.cashier_id = u.id LEFT JOIN customers c ON t.customer_id = c.id WHERE 1=1';
        const params = [];
        if (start_date) { query += ' AND DATE(t.created_at) >= ?'; params.push(start_date); }
        if (end_date) { query += ' AND DATE(t.created_at) <= ?'; params.push(end_date); }
        if (status) { query += ' AND t.payment_status = ?'; params.push(status); }
        if (customer_id) { query += ' AND t.customer_id = ?'; params.push(parseInt(customer_id)); }
        query += ' ORDER BY t.created_at DESC LIMIT 100';
        res.json(dbAll(db, query, params));
    });

    // Get single transaction with details
    router.get('/:id', auth, (req, res) => {
        const tx = dbGet(db, 'SELECT t.*, u.name as cashier_name, c.name as customer_name FROM transactions t LEFT JOIN users u ON t.cashier_id = u.id LEFT JOIN customers c ON t.customer_id = c.id WHERE t.id = ?', [req.params.id]);
        if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        tx.details = dbAll(db, 'SELECT td.*, p.title as product_title FROM transaction_details td JOIN products p ON td.product_id = p.id WHERE td.transaction_id = ?', [req.params.id]);
        tx.profit = dbGet(db, 'SELECT * FROM profits WHERE transaction_id = ?', [req.params.id]);
        res.json(tx);
    });

    // Create transaction (checkout)
    router.post('/', auth, (req, res) => {
        const { customer_id, items, discount, shipping_cost, cash, payment_method, local_id } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: 'Keranjang kosong' });

        const invoice = 'TRX-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        let subtotal = 0;
        for (const item of items) subtotal += (item.sell_price || 0) * (item.qty || 1);

        const discountAmount = discount || 0;
        const shipping = shipping_cost || 0;
        const grandTotal = Math.max(0, subtotal - discountAmount + shipping);
        const cashAmount = cash || grandTotal;
        const change = Math.max(0, cashAmount - grandTotal);

        const warehouse = dbGet(db, 'SELECT id FROM warehouses WHERE is_active = 1 LIMIT 1');
        const warehouse_id = warehouse?.id || 1;
        const cust_id = customer_id || null;
        const localId = local_id || null;

        dbRun(db, `INSERT INTO transactions (invoice, cashier_id, customer_id, warehouse_id, discount, shipping_cost, grand_total, cash, change, payment_method, payment_status, local_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoice, req.user.id, cust_id, warehouse_id, discountAmount, shipping, grandTotal, cashAmount, change, payment_method || 'cash', 'paid', localId]);

        const txId = dbGet(db, 'SELECT id FROM transactions WHERE invoice = ?', [invoice])?.id;

        for (const item of items) {
            const itemPrice = (item.sell_price || 0) * (item.qty || 1);
            dbRun(db, `INSERT INTO transaction_details (transaction_id, product_id, qty, unit_price, price, discount_total) VALUES (?, ?, ?, ?, ?, ?)`,
                [txId, item.product_id, item.qty || 1, item.sell_price || 0, itemPrice, 0]);
            dbRun(db, 'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.qty || 1, item.product_id]);
            dbRun(db, 'UPDATE product_warehouse SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND warehouse_id = ?', [item.qty || 1, item.product_id, warehouse_id]);
        }

        let totalProfit = 0;
        for (const item of items) {
            const product = dbGet(db, 'SELECT buy_price FROM products WHERE id = ?', [item.product_id]);
            if (product) totalProfit += ((item.sell_price || 0) - (product.buy_price || 0)) * (item.qty || 1);
        }
        dbRun(db, 'INSERT INTO profits (transaction_id, total) VALUES (?, ?)', [txId, totalProfit]);

        if (customer_id) {
            dbRun(db, `UPDATE customers SET loyalty_total_spent = loyalty_total_spent + ?, loyalty_transaction_count = loyalty_transaction_count + 1, last_purchase_at = CURRENT_TIMESTAMP WHERE id = ?`, [grandTotal, customer_id]);
        }

        res.json({ id: txId, invoice, grand_total: grandTotal, cash: cashAmount, change, items_count: items.length, profit: totalProfit });
    });

    // Hold transaction
    router.post('/hold', auth, (req, res) => {
        const { label } = req.body;
        const holdId = 'HOLD-' + Date.now().toString(36).toUpperCase();
        const holdLabel = label || 'Transaksi ' + new Date().toLocaleTimeString('id-ID');
        dbRun(db, 'UPDATE carts SET hold_id=?, hold_label=?, held_at=CURRENT_TIMESTAMP WHERE cashier_id=? AND hold_id IS NULL',
            [holdId, holdLabel, req.user.id]);
        res.json({ success: true, hold_id: holdId, label: holdLabel });
    });

    // Resume held transaction
    router.post('/resume/:holdId', auth, (req, res) => {
        dbRun(db, 'UPDATE carts SET hold_id=NULL, hold_label=NULL, held_at=NULL WHERE cashier_id=? AND hold_id=?',
            [req.user.id, req.params.holdId]);
        res.json({ success: true });
    });

    // Delete held transaction
    router.delete('/held/:holdId', auth, (req, res) => {
        dbRun(db, 'DELETE FROM carts WHERE cashier_id=? AND hold_id=?', [req.user.id, req.params.holdId]);
        res.json({ success: true });
    });

    // Get held transactions
    router.get('/held/list', auth, (req, res) => {
        const held = dbAll(db, 'SELECT hold_id, hold_label, held_at, COUNT(*) as items_count, SUM(price) as total FROM carts WHERE cashier_id=? AND hold_id IS NOT NULL GROUP BY hold_id', [req.user.id]);
        res.json(held);
    });

    // Search product
    router.post('/search', auth, (req, res) => {
        const { barcode } = req.body;
        const product = dbGet(db, 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.barcode = ?', [barcode]);
        res.json(product || { error: 'Produk tidak ditemukan' });
    });

    // Confirm payment (bank transfer)
    router.post('/:id/confirm-payment', auth, (req, res) => {
        dbRun(db, 'UPDATE transactions SET payment_status="paid", updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
        res.json({ success: true });
    });

    // Transaction history
    router.get('/history/all', auth, (req, res) => {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const transactions = dbAll(db, `
            SELECT t.*, u.name as cashier_name, c.name as customer_name FROM transactions t
            LEFT JOIN users u ON t.cashier_id = u.id LEFT JOIN customers c ON t.customer_id = c.id
            ORDER BY t.created_at DESC LIMIT ? OFFSET ?
        `, [parseInt(limit), offset]);
        const total = dbGet(db, 'SELECT COUNT(*) as count FROM transactions')?.count || 0;
        res.json({ transactions, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    });

    return router;
};

function dbGet(db, sql, params) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
    stmt.free();
    return null;
}

function dbAll(db, sql, params) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) { results.push(stmt.getAsObject()); }
    stmt.free();
    return results;
}

function dbRun(db, sql, params) {
    db.run(sql, params);
}
