// routes/finance.js - Receivables, Payables, Bank Accounts
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // === RECEIVABLES (Customer Debt) ===
    router.get('/receivables', auth, (req, res) => {
        const { status } = req.query;
        let query = 'SELECT r.*, c.name as customer_name FROM receivables r LEFT JOIN customers c ON r.customer_id = c.id WHERE 1=1';
        const params = [];
        if (status) { query += ' AND r.status = ?'; params.push(status); }
        query += ' ORDER BY r.created_at DESC';
        res.json(dbAll(db, query, params));
    });
    router.get('/receivables/:id', auth, (req, res) => {
        const r = dbGet(db, 'SELECT r.*, c.name as customer_name FROM receivables r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.id = ?', [req.params.id]);
        if (!r) return res.status(404).json({ error: 'Piutang tidak ditemukan' });
        r.payments = dbAll(db, 'SELECT * FROM receivable_payments WHERE receivable_id = ? ORDER BY payment_date DESC', [req.params.id]);
        res.json(r);
    });
    router.post('/receivables/:id/pay', auth, (req, res) => {
        const { amount, payment_method, notes } = req.body;
        const receivable = dbGet(db, 'SELECT * FROM receivables WHERE id = ?', [req.params.id]);
        if (!receivable) return res.status(404).json({ error: 'Piutang tidak ditemukan' });
        dbRun(db, 'INSERT INTO receivable_payments (receivable_id, amount, payment_date, payment_method, notes) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)',
            [req.params.id, amount, payment_method || 'cash', notes]);
        const newPaid = (receivable.paid || 0) + amount;
        const newStatus = newPaid >= receivable.total ? 'paid' : 'partial';
        dbRun(db, 'UPDATE receivables SET paid=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [newPaid, newStatus, req.params.id]);
        res.json({ success: true, paid: newPaid, remaining: receivable.total - newPaid });
    });

    // Aging analysis
    router.get('/aging', auth, (req, res) => {
        const unpaid = dbAll(db, 'SELECT r.*, c.name as customer_name FROM receivables r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.status != "paid" ORDER BY r.due_date');
        const today = new Date();
        for (const r of unpaid) {
            if (!r.due_date) { r.aging_bucket = 'Belum ditentukan'; continue; }
            const due = new Date(r.due_date);
            const days = Math.floor((today - due) / (1000 * 60 * 60 * 24));
            if (days <= 0) r.aging_bucket = 'Belum jatuh tempo';
            else if (days <= 30) r.aging_bucket = '1-30 hari';
            else if (days <= 60) r.aging_bucket = '31-60 hari';
            else if (days <= 90) r.aging_bucket = '61-90 hari';
            else r.aging_bucket = '> 90 hari';
        }
        res.json(unpaid);
    });

    // === PAYABLES (Supplier Debt) ===
    router.get('/payables', auth, (req, res) => {
        const { status } = req.query;
        let query = 'SELECT p.*, s.name as supplier_name FROM payables p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE 1=1';
        const params = [];
        if (status) { query += ' AND p.status = ?'; params.push(status); }
        query += ' ORDER BY p.created_at DESC';
        res.json(dbAll(db, query, params));
    });
    router.get('/payables/:id', auth, (req, res) => {
        const p = dbGet(db, 'SELECT p.*, s.name as supplier_name FROM payables p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?', [req.params.id]);
        if (!p) return res.status(404).json({ error: 'Hutang tidak ditemukan' });
        p.payments = dbAll(db, 'SELECT * FROM payable_payments WHERE payable_id = ? ORDER BY payment_date DESC', [req.params.id]);
        res.json(p);
    });
    router.post('/payables/:id/pay', auth, (req, res) => {
        const { amount, payment_method, notes } = req.body;
        const payable = dbGet(db, 'SELECT * FROM payables WHERE id = ?', [req.params.id]);
        if (!payable) return res.status(404).json({ error: 'Hutang tidak ditemukan' });
        dbRun(db, 'INSERT INTO payable_payments (payable_id, amount, payment_date, payment_method, notes) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)',
            [req.params.id, amount, payment_method || 'cash', notes]);
        const newPaid = (payable.paid || 0) + amount;
        const newStatus = newPaid >= payable.total ? 'paid' : 'partial';
        dbRun(db, 'UPDATE payables SET paid=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [newPaid, newStatus, req.params.id]);
        res.json({ success: true, paid: newPaid, remaining: payable.total - newPaid });
    });

    // === BANK ACCOUNTS ===
    router.get('/bank-accounts', auth, (req, res) => {
        res.json(dbAll(db, 'SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY sort_order'));
    });
    router.post('/bank-accounts', auth, (req, res) => {
        const { bank_name, account_number, account_name } = req.body;
        dbRun(db, 'INSERT INTO bank_accounts (bank_name, account_number, account_name) VALUES (?, ?, ?)', [bank_name, account_number, account_name]);
        res.json(dbGet(db, 'SELECT * FROM bank_accounts WHERE id = last_insert_rowid()'));
    });
    router.put('/bank-accounts/:id', auth, (req, res) => {
        const { bank_name, account_number, account_name } = req.body;
        dbRun(db, 'UPDATE bank_accounts SET bank_name=?, account_number=?, account_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [bank_name, account_number, account_name, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]));
    });
    router.delete('/bank-accounts/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM bank_accounts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });
    router.patch('/bank-accounts/:id/toggle', auth, (req, res) => {
        const ba = dbGet(db, 'SELECT is_active FROM bank_accounts WHERE id = ?', [req.params.id]);
        dbRun(db, 'UPDATE bank_accounts SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [ba.is_active ? 0 : 1, req.params.id]);
        res.json({ success: true, is_active: ba.is_active ? 0 : 1 });
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
