// routes/users.js - User & Role Management
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

module.exports = function(db, auth, adminOnly) {
    // List users
    router.get('/', auth, adminOnly, (req, res) => {
        const users = dbAll(db, 'SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name');
        res.json(users);
    });

    // Create user
    router.post('/', auth, adminOnly, (req, res) => {
        const { name, email, password, role } = req.body;
        const hashed = bcrypt.hashSync(password || 'password', 10);
        dbRun(db, 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashed, role || 'cashier']);
        const user = dbGet(db, 'SELECT id, name, email, role FROM users WHERE email = ?', [email]);
        res.json(user);
    });

    // Update user
    router.put('/:id', auth, adminOnly, (req, res) => {
        const { name, email, role, password } = req.body;
        if (password) {
            const hashed = bcrypt.hashSync(password, 10);
            dbRun(db, 'UPDATE users SET name=?, email=?, role=?, password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [name, email, role, hashed, req.params.id]);
        } else {
            dbRun(db, 'UPDATE users SET name=?, email=?, role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [name, email, role, req.params.id]);
        }
        const user = dbGet(db, 'SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id]);
        res.json(user);
    });

    // Delete user
    router.delete('/:id', auth, adminOnly, (req, res) => {
        if (req.params.id == req.user.id) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
        dbRun(db, 'DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    // Roles
    router.get('/roles', auth, adminOnly, (req, res) => {
        const roles = dbAll(db, 'SELECT * FROM roles ORDER BY name');
        res.json(roles);
    });

    // Permissions
    router.get('/permissions', auth, adminOnly, (req, res) => {
        const permissions = dbAll(db, 'SELECT * FROM permissions ORDER BY name');
        res.json(permissions);
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
