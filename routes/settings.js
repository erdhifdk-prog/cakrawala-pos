// routes/settings.js - Settings, Payment, Printer, Loyalty, WhatsApp
const express = require('express');
const router = express.Router();

module.exports = function(db, auth, adminOnly) {
    // Get all settings
    router.get('/', auth, (req, res) => {
        const settings = dbAll(db, 'SELECT * FROM settings ORDER BY key');
        const result = {};
        for (const s of settings) result[s.key] = s.value;
        res.json(result);
    });

    // Get single setting
    router.get('/:key', auth, (req, res) => {
        const setting = dbGet(db, 'SELECT * FROM settings WHERE key = ?', [req.params.key]);
        res.json({ key: req.params.key, value: setting?.value || null, description: setting?.description || null });
    });

    // Update setting
    router.put('/:key', auth, (req, res) => {
        const { value, description } = req.body;
        const existing = dbGet(db, 'SELECT id FROM settings WHERE key = ?', [req.params.key]);
        if (existing) {
            dbRun(db, 'UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key=?', [value, req.params.key]);
        } else {
            dbRun(db, 'INSERT INTO settings (key, value, description) VALUES (?, ?, ?)', [req.params.key, value, description]);
        }
        res.json({ key: req.params.key, value });
    });

    // Update multiple settings
    router.post('/bulk', auth, (req, res) => {
        const { settings } = req.body;
        for (const [key, value] of Object.entries(settings)) {
            const existing = dbGet(db, 'SELECT id FROM settings WHERE key = ?', [key]);
            if (existing) {
                dbRun(db, 'UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key=?', [value, key]);
            } else {
                dbRun(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
            }
        }
        res.json({ success: true });
    });

    // === PAYMENT SETTINGS ===
    router.get('/payments/config', auth, adminOnly, (req, res) => {
        const ps = dbGet(db, 'SELECT * FROM payment_settings LIMIT 1');
        res.json(ps || { midtrans_enabled: 0, xendit_enabled: 0, default_gateway: 'cash' });
    });
    router.put('/payments/config', auth, adminOnly, (req, res) => {
        const { midtrans_enabled, midtrans_server_key, midtrans_client_key, xendit_enabled, xendit_secret_key, xendit_callback_token, default_gateway } = req.body;
        const existing = dbGet(db, 'SELECT id FROM payment_settings LIMIT 1');
        if (existing) {
            dbRun(db, `UPDATE payment_settings SET midtrans_enabled=?, midtrans_server_key=?, midtrans_client_key=?, xendit_enabled=?, xendit_secret_key=?, xendit_callback_token=?, default_gateway=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [midtrans_enabled?1:0, midtrans_server_key, midtrans_client_key, xendit_enabled?1:0, xendit_secret_key, xendit_callback_token, default_gateway, existing.id]);
        } else {
            dbRun(db, `INSERT INTO payment_settings (midtrans_enabled, midtrans_server_key, midtrans_client_key, xendit_enabled, xendit_secret_key, xendit_callback_token, default_gateway) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [midtrans_enabled?1:0, midtrans_server_key, midtrans_client_key, xendit_enabled?1:0, xendit_secret_key, xendit_callback_token, default_gateway]);
        }
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
