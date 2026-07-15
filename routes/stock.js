// routes/stock.js - Stock Opname, Mutations, Transfers
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // === STOCK OPNAME ===
    router.get('/stock-opnames', auth, (req, res) => {
        const opnames = dbAll(db, `SELECT so.*, w.name as warehouse_name, u1.name as created_by_name, u2.name as finalized_by_name
            FROM stock_opnames so LEFT JOIN warehouses w ON so.warehouse_id = w.id
            LEFT JOIN users u1 ON so.created_by = u1.id LEFT JOIN users u2 ON so.finalized_by = u2.id
            ORDER BY so.created_at DESC`);
        for (const op of opnames) {
            op.items = dbAll(db, 'SELECT soi.*, p.title as product_title FROM stock_opname_items soi JOIN products p ON soi.product_id = p.id WHERE soi.stock_opname_id = ?', [op.id]);
        }
        res.json(opnames);
    });
    router.get('/stock-opnames/:id', auth, (req, res) => {
        const op = dbGet(db, 'SELECT so.*, w.name as warehouse_name FROM stock_opnames so LEFT JOIN warehouses w ON so.warehouse_id = w.id WHERE so.id = ?', [req.params.id]);
        if (!op) return res.status(404).json({ error: 'Stock opname tidak ditemukan' });
        op.items = dbAll(db, 'SELECT soi.*, p.title as product_title, p.barcode FROM stock_opname_items soi JOIN products p ON soi.product_id = p.id WHERE soi.stock_opname_id = ?', [op.id]);
        res.json(op);
    });
    router.post('/stock-opnames', auth, (req, res) => {
        const { warehouse_id, notes } = req.body;
        dbRun(db, 'INSERT INTO stock_opnames (warehouse_id, status, notes, created_by) VALUES (?, ?, ?, ?)', [warehouse_id, 'draft', notes, req.user.id]);
        const opId = dbGet(db, 'SELECT id FROM stock_opnames ORDER BY id DESC LIMIT 1')?.id;
        res.json({ id: opId });
    });
    router.post('/stock-opnames/:id/items', auth, (req, res) => {
        const { product_id, actual_stock } = req.body;
        const systemStock = dbGet(db, 'SELECT COALESCE(pw.stock, 0) as stock FROM product_warehouse pw JOIN stock_opnames so ON pw.warehouse_id = so.warehouse_id WHERE pw.product_id = ? AND so.id = ?', [product_id, req.params.id])?.stock || 0;
        const difference = actual_stock - systemStock;
        dbRun(db, 'INSERT INTO stock_opname_items (stock_opname_id, product_id, system_stock, actual_stock, difference) VALUES (?, ?, ?, ?, ?)',
            [req.params.id, product_id, systemStock, actual_stock, difference]);
        res.json({ success: true });
    });
    router.post('/stock-opnames/:id/finalize', auth, (req, res) => {
        const items = dbAll(db, 'SELECT * FROM stock_opname_items WHERE stock_opname_id = ?', [req.params.id]);
        for (const item of items) {
            if (item.difference !== 0) {
                dbRun(db, 'UPDATE products SET stock = stock + ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [item.difference, item.product_id]);
                dbRun(db, 'UPDATE product_warehouse SET stock = stock + ?, updated_at=CURRENT_TIMESTAMP WHERE product_id = ? AND warehouse_id = (SELECT warehouse_id FROM stock_opnames WHERE id = ?)',
                    [item.difference, item.product_id, req.params.id]);
                dbRun(db, 'INSERT INTO stock_mutations (product_id, warehouse_id, type, quantity, before_stock, after_stock, reference) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.product_id, dbGet(db, 'SELECT warehouse_id FROM stock_opnames WHERE id = ?', [req.params.id])?.warehouse_id, item.difference > 0 ? 'in' : 'out', Math.abs(item.difference), item.system_stock, item.actual_stock, 'stock_opname_' + req.params.id]);
            }
        }
        dbRun(db, 'UPDATE stock_opnames SET status="finalized", finalized_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.user.id, req.params.id]);
        res.json({ success: true });
    });

    // === STOCK MUTATIONS ===
    router.get('/stock-mutations', auth, (req, res) => {
        const { product_id, warehouse_id } = req.query;
        let query = 'SELECT sm.*, p.title as product_title, w.name as warehouse_name FROM stock_mutations sm JOIN products p ON sm.product_id = p.id JOIN warehouses w ON sm.warehouse_id = w.id WHERE 1=1';
        const params = [];
        if (product_id) { query += ' AND sm.product_id = ?'; params.push(parseInt(product_id)); }
        if (warehouse_id) { query += ' AND sm.warehouse_id = ?'; params.push(parseInt(warehouse_id)); }
        query += ' ORDER BY sm.created_at DESC LIMIT 100';
        res.json(dbAll(db, query, params));
    });

    // === STOCK TRANSFERS ===
    router.get('/stock-transfers', auth, (req, res) => {
        const transfers = dbAll(db, `SELECT st.*, ws.name as source_name, wd.name as destination_name
            FROM stock_transfers st LEFT JOIN warehouses ws ON st.source_warehouse_id = ws.id
            LEFT JOIN warehouses wd ON st.destination_warehouse_id = wd.id ORDER BY st.created_at DESC`);
        for (const t of transfers) {
            t.items = dbAll(db, 'SELECT sti.*, p.title as product_title FROM stock_transfer_items sti JOIN products p ON sti.product_id = p.id WHERE sti.stock_transfer_id = ?', [t.id]);
        }
        res.json(transfers);
    });
    router.get('/stock-transfers/:id', auth, (req, res) => {
        const t = dbGet(db, `SELECT st.*, ws.name as source_name, wd.name as destination_name
            FROM stock_transfers st LEFT JOIN warehouses ws ON st.source_warehouse_id = ws.id
            LEFT JOIN warehouses wd ON st.destination_warehouse_id = wd.id WHERE st.id = ?`, [req.params.id]);
        if (!t) return res.status(404).json({ error: 'Transfer tidak ditemukan' });
        t.items = dbAll(db, 'SELECT sti.*, p.title as product_title FROM stock_transfer_items sti JOIN products p ON sti.product_id = p.id WHERE sti.stock_transfer_id = ?', [t.id]);
        res.json(t);
    });
    router.post('/stock-transfers', auth, (req, res) => {
        const { source_warehouse_id, destination_warehouse_id, items, notes } = req.body;
        const transferNumber = 'ST-' + Date.now().toString(36).toUpperCase();
        dbRun(db, 'INSERT INTO stock_transfers (source_warehouse_id, destination_warehouse_id, transfer_number, status, notes) VALUES (?, ?, ?, ?, ?)',
            [source_warehouse_id, destination_warehouse_id, transferNumber, 'draft', notes]);
        const stId = dbGet(db, 'SELECT id FROM stock_transfers WHERE transfer_number = ?', [transferNumber])?.id;
        if (items) for (const item of items) {
            dbRun(db, 'INSERT INTO stock_transfer_items (stock_transfer_id, product_id, qty_sent) VALUES (?, ?, ?)',
                [stId, item.product_id, item.qty_sent]);
        }
        res.json({ id: stId, transfer_number: transferNumber });
    });
    router.post('/stock-transfers/:id/send', auth, (req, res) => {
        const items = dbAll(db, 'SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?', [req.params.id]);
        const transfer = dbGet(db, 'SELECT * FROM stock_transfers WHERE id = ?', [req.params.id]);
        for (const item of items) {
            dbRun(db, 'UPDATE product_warehouse SET stock = stock - ?, updated_at=CURRENT_TIMESTAMP WHERE product_id = ? AND warehouse_id = ?',
                [item.qty_sent, item.product_id, transfer.source_warehouse_id]);
        }
        dbRun(db, 'UPDATE stock_transfers SET status="sent", updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
        res.json({ success: true });
    });
    router.post('/stock-transfers/:id/receive', auth, (req, res) => {
        const items = dbAll(db, 'SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?', [req.params.id]);
        const transfer = dbGet(db, 'SELECT * FROM stock_transfers WHERE id = ?', [req.params.id]);
        for (const item of items) {
            dbRun(db, 'UPDATE product_warehouse SET stock = stock + ?, updated_at=CURRENT_TIMESTAMP WHERE product_id = ? AND warehouse_id = ?',
                [item.qty_sent, item.product_id, transfer.destination_warehouse_id]);
        }
        dbRun(db, 'UPDATE stock_transfers SET status="received", updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
        res.json({ success: true });
    });

    // === WAREHOUSES ===
    router.get('/warehouses', auth, (req, res) => {
        res.json(dbAll(db, 'SELECT * FROM warehouses ORDER BY sort_order, code'));
    });
    router.post('/warehouses', auth, (req, res) => {
        const { code, name, type } = req.body;
        dbRun(db, 'INSERT INTO warehouses (code, name, type) VALUES (?, ?, ?)', [code, name, type || 'branch']);
        res.json(dbGet(db, 'SELECT * FROM warehouses WHERE id = last_insert_rowid()'));
    });
    router.put('/warehouses/:id', auth, (req, res) => {
        const { code, name, type, is_active } = req.body;
        dbRun(db, 'UPDATE warehouses SET code=?, name=?, type=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [code, name, type, is_active, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM warehouses WHERE id = ?', [req.params.id]));
    });
    router.delete('/warehouses/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM warehouses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
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
