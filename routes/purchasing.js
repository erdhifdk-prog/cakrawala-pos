// routes/purchasing.js - Purchasing, Suppliers, Goods Receiving
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // === SUPPLIERS ===
    router.get('/suppliers', auth, (req, res) => {
        res.json(dbAll(db, 'SELECT * FROM suppliers ORDER BY name'));
    });
    router.post('/suppliers', auth, (req, res) => {
        const { name, address, no_telp } = req.body;
        dbRun(db, 'INSERT INTO suppliers (name, address, no_telp) VALUES (?, ?, ?)', [name, address, no_telp]);
        res.json(dbGet(db, 'SELECT * FROM suppliers WHERE id = last_insert_rowid()'));
    });
    router.put('/suppliers/:id', auth, (req, res) => {
        const { name, address, no_telp } = req.body;
        dbRun(db, 'UPDATE suppliers SET name=?, address=?, no_telp=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, address, no_telp, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
    });
    router.delete('/suppliers/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM suppliers WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    // === PURCHASE ORDERS ===
    router.get('/purchase-orders', auth, (req, res) => {
        const pos = dbAll(db, `SELECT po.*, s.name as supplier_name, w.name as warehouse_name
            FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN warehouses w ON po.warehouse_id = w.id ORDER BY po.created_at DESC`);
        for (const po of pos) {
            po.items = dbAll(db, 'SELECT poi.*, p.title as product_title FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?', [po.id]);
        }
        res.json(pos);
    });
    router.get('/purchase-orders/:id', auth, (req, res) => {
        const po = dbGet(db, `SELECT po.*, s.name as supplier_name, w.name as warehouse_name
            FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN warehouses w ON po.warehouse_id = w.id WHERE po.id = ?`, [req.params.id]);
        if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
        po.items = dbAll(db, 'SELECT poi.*, p.title as product_title FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?', [po.id]);
        res.json(po);
    });
    router.post('/purchase-orders', auth, (req, res) => {
        const { supplier_id, warehouse_id, items, notes } = req.body;
        const orderNumber = 'PO-' + Date.now().toString(36).toUpperCase();
        let total = 0;
        if (items) for (const item of items) total += (item.unit_price || 0) * (item.qty || 1);
        dbRun(db, 'INSERT INTO purchase_orders (supplier_id, warehouse_id, order_number, status, total, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [supplier_id, warehouse_id, orderNumber, 'draft', total, notes]);
        const poId = dbGet(db, 'SELECT id FROM purchase_orders WHERE order_number = ?', [orderNumber])?.id;
        if (items) for (const item of items) {
            const subtotal = (item.unit_price || 0) * (item.qty || 1);
            dbRun(db, 'INSERT INTO purchase_order_items (purchase_order_id, product_id, qty, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
                [poId, item.product_id, item.qty, item.unit_price, subtotal]);
        }
        res.json({ id: poId, order_number: orderNumber, total });
    });
    router.post('/purchase-orders/:id/place', auth, (req, res) => {
        dbRun(db, 'UPDATE purchase_orders SET status="ordered", updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
        res.json({ success: true });
    });
    router.post('/purchase-orders/:id/cancel', auth, (req, res) => {
        dbRun(db, 'UPDATE purchase_orders SET status="cancelled", updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
        res.json({ success: true });
    });

    // === GOODS RECEIVING ===
    router.get('/goods-receivings', auth, (req, res) => {
        res.json(dbAll(db, `SELECT gr.*, s.name as supplier_name, w.name as warehouse_name
            FROM goods_receivings gr LEFT JOIN suppliers s ON gr.supplier_id = s.id
            LEFT JOIN warehouses w ON gr.warehouse_id = w.id ORDER BY gr.created_at DESC`));
    });
    router.get('/goods-receivings/:id', auth, (req, res) => {
        const gr = dbGet(db, `SELECT gr.*, s.name as supplier_name, w.name as warehouse_name
            FROM goods_receivings gr LEFT JOIN suppliers s ON gr.supplier_id = s.id
            LEFT JOIN warehouses w ON gr.warehouse_id = w.id WHERE gr.id = ?`, [req.params.id]);
        if (!gr) return res.status(404).json({ error: 'GR tidak ditemukan' });
        gr.items = dbAll(db, 'SELECT gri.*, p.title as product_title FROM goods_receiving_items gri JOIN products p ON gri.product_id = p.id WHERE gri.goods_receiving_id = ?', [gr.id]);
        res.json(gr);
    });
    router.post('/goods-receivings', auth, (req, res) => {
        const { supplier_id, warehouse_id, purchase_order_id, items, notes } = req.body;
        const receivingNumber = 'GR-' + Date.now().toString(36).toUpperCase();
        dbRun(db, 'INSERT INTO goods_receivings (purchase_order_id, supplier_id, warehouse_id, receiving_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [purchase_order_id, supplier_id, warehouse_id, receivingNumber, 'received', notes]);
        const grId = dbGet(db, 'SELECT id FROM goods_receivings WHERE receiving_number = ?', [receivingNumber])?.id;
        if (items) for (const item of items) {
            dbRun(db, 'INSERT INTO goods_receiving_items (goods_receiving_id, product_id, qty_received, unit_price, batch_number, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
                [grId, item.product_id, item.qty_received, item.unit_price, item.batch_number, item.expiry_date]);
            dbRun(db, 'UPDATE products SET stock = stock + ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [item.qty_received, item.product_id]);
        }
        res.json({ id: grId, receiving_number: receivingNumber });
    });

    // === SUPPLIER RETURNS ===
    router.get('/supplier-returns', auth, (req, res) => {
        res.json(dbAll(db, `SELECT sr.*, s.name as supplier_name FROM supplier_returns sr LEFT JOIN suppliers s ON sr.supplier_id = s.id ORDER BY sr.created_at DESC`));
    });
    router.get('/supplier-returns/:id', auth, (req, res) => {
        const sr = dbGet(db, `SELECT sr.*, s.name as supplier_name FROM supplier_returns sr LEFT JOIN suppliers s ON sr.supplier_id = s.id WHERE sr.id = ?`, [req.params.id]);
        if (!sr) return res.status(404).json({ error: 'Return tidak ditemukan' });
        sr.items = dbAll(db, 'SELECT sri.*, p.title as product_title FROM supplier_return_items sri JOIN products p ON sri.product_id = p.id WHERE sri.supplier_return_id = ?', [sr.id]);
        res.json(sr);
    });
    router.post('/supplier-returns', auth, (req, res) => {
        const { supplier_id, warehouse_id, items, notes } = req.body;
        const returnNumber = 'SR-' + Date.now().toString(36).toUpperCase();
        let total = 0;
        if (items) for (const item of items) total += (item.unit_price || 0) * (item.qty_return || 1);
        dbRun(db, 'INSERT INTO supplier_returns (supplier_id, warehouse_id, return_number, status, total, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [supplier_id, warehouse_id, returnNumber, 'pending', total, notes]);
        const srId = dbGet(db, 'SELECT id FROM supplier_returns WHERE return_number = ?', [returnNumber])?.id;
        if (items) for (const item of items) {
            const subtotal = (item.unit_price || 0) * (item.qty_return || 1);
            dbRun(db, 'INSERT INTO supplier_return_items (supplier_return_id, product_id, qty_return, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
                [srId, item.product_id, item.qty_return, item.unit_price, subtotal]);
            dbRun(db, 'UPDATE products SET stock = stock - ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?', [item.qty_return, item.product_id]);
        }
        res.json({ id: srId, return_number: returnNumber });
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
