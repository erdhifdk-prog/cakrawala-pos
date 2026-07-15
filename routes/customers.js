// routes/customers.js - Customer Management (Complete)
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // List customers
    router.get('/', auth, (req, res) => {
        const { search, loyalty } = req.query;
        let query = 'SELECT * FROM customers WHERE 1=1';
        const params = [];
        if (search) { query += ' AND (name LIKE ? OR no_telp LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (loyalty === 'member') { query += ' AND is_loyalty_member = 1'; }
        query += ' ORDER BY name';
        res.json(dbAll(db, query, params));
    });

    // Get single customer
    router.get('/:id', auth, (req, res) => {
        const customer = dbGet(db, 'SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan' });
        customer.transactions = dbAll(db, 'SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
        customer.vouchers = dbAll(db, 'SELECT * FROM customer_vouchers WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(customer);
    });

    // Create customer
    router.post('/', auth, (req, res) => {
        const { name, no_telp, address } = req.body;
        dbRun(db, 'INSERT INTO customers (name, no_telp, address) VALUES (?, ?, ?)', [name, no_telp, address]);
        res.json(dbGet(db, 'SELECT * FROM customers WHERE id = last_insert_rowid()'));
    });

    // Create customer AJAX
    router.post('/store-ajax', auth, (req, res) => {
        const { name, no_telp, address } = req.body;
        dbRun(db, 'INSERT INTO customers (name, no_telp, address) VALUES (?, ?, ?)', [name, no_telp, address]);
        const customer = dbGet(db, 'SELECT * FROM customers WHERE id = last_insert_rowid()');
        res.json(customer);
    });

    // Update customer
    router.put('/:id', auth, (req, res) => {
        const { name, no_telp, address, province_id, province_name, regency_id, regency_name, district_id, district_name, village_id, village_name } = req.body;
        dbRun(db, `UPDATE customers SET name=?, no_telp=?, address=?, province_id=?, province_name=?, regency_id=?, regency_name=?, district_id=?, district_name=?, village_id=?, village_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [name, no_telp, address, province_id, province_name, regency_id, regency_name, district_id, district_name, village_id, village_name, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM customers WHERE id = ?', [req.params.id]));
    });

    // Delete customer
    router.delete('/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    // Customer history
    router.get('/:id/history', auth, (req, res) => {
        const transactions = dbAll(db, `
            SELECT t.*, u.name as cashier_name FROM transactions t 
            LEFT JOIN users u ON t.cashier_id = u.id 
            WHERE t.customer_id = ? ORDER BY t.created_at DESC
        `, [req.params.id]);
        res.json(transactions);
    });

    // Upgrade to member
    router.post('/:id/upgrade-member', auth, (req, res) => {
        const memberCode = 'MEM-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        dbRun(db, `UPDATE customers SET is_loyalty_member=1, member_code=?, loyalty_tier='regular', loyalty_member_since=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [memberCode, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM customers WHERE id = ?', [req.params.id]));
    });

    // Loyalty points
    router.get('/:id/loyalty', auth, (req, res) => {
        const history = dbAll(db, 'SELECT * FROM loyalty_point_histories WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id]);
        const customer = dbGet(db, 'SELECT loyalty_points, loyalty_tier, loyalty_total_spent FROM customers WHERE id = ?', [req.params.id]);
        res.json({ customer, history });
    });

    // Customer segments
    router.get('/segments/all', auth, (req, res) => {
        const segments = dbAll(db, 'SELECT * FROM customer_segments ORDER BY name');
        for (const seg of segments) {
            seg.member_count = dbGet(db, 'SELECT COUNT(*) as count FROM customer_segment_memberships WHERE segment_id = ?', [seg.id])?.count || 0;
        }
        res.json(segments);
    });

    router.post('/segments', auth, (req, res) => {
        const { name, description } = req.body;
        dbRun(db, 'INSERT INTO customer_segments (name, description) VALUES (?, ?)', [name, description]);
        res.json(dbGet(db, 'SELECT * FROM customer_segments WHERE id = last_insert_rowid()'));
    });

    router.post('/segments/:id/members', auth, (req, res) => {
        const { customer_id } = req.body;
        dbRun(db, 'INSERT OR IGNORE INTO customer_segment_memberships (customer_id, segment_id, source) VALUES (?, ?, ?)', [customer_id, req.params.id, 'manual']);
        res.json({ success: true });
    });

    // Customer vouchers
    router.get('/:id/vouchers', auth, (req, res) => {
        const vouchers = dbAll(db, 'SELECT * FROM customer_vouchers WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(vouchers);
    });

    router.post('/vouchers', auth, (req, res) => {
        const { customer_id, code, name, discount_type, discount_value, minimum_order, starts_at, expires_at } = req.body;
        dbRun(db, `INSERT INTO customer_vouchers (customer_id, code, name, discount_type, discount_value, minimum_order, starts_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [customer_id, code, name, discount_type||'percentage', discount_value||0, minimum_order||0, starts_at, expires_at]);
        res.json(dbGet(db, 'SELECT * FROM customer_vouchers WHERE id = last_insert_rowid()'));
    });

    router.put('/vouchers/:id', auth, (req, res) => {
        const { is_active, discount_type, discount_value, minimum_order, starts_at, expires_at } = req.body;
        dbRun(db, `UPDATE customer_vouchers SET is_active=?, discount_type=?, discount_value=?, minimum_order=?, starts_at=?, expires_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [is_active, discount_type, discount_value, minimum_order, starts_at, expires_at, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM customer_vouchers WHERE id = ?', [req.params.id]));
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
