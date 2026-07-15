// routes/auth.js - Authentication Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cakrawala-pos-secret-key-2026';

module.exports = function(db, auth) {
    // Login
    router.post('/login', (req, res) => {
        const { email, password } = req.body;
        const user = dbGet(db, 'SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Email atau password salah' });
        }
        
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    });

    // Get current user
    router.get('/me', auth, (req, res) => {
        const user = dbGet(db, 'SELECT id, name, email, role, avatar FROM users WHERE id = ?', [req.user.id]);
        res.json(user);
    });

    // Change password
    router.post('/change-password', auth, (req, res) => {
        const { current_password, new_password } = req.body;
        const user = dbGet(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);
        
        if (!bcrypt.compareSync(current_password, user.password)) {
            return res.status(400).json({ error: 'Password lama salah' });
        }
        
        const hashed = bcrypt.hashSync(new_password, 10);
        dbRun(db, 'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashed, req.user.id]);
        res.json({ success: true, message: 'Password berhasil diubah' });
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

function dbRun(db, sql, params) {
    db.run(sql, params);
}
