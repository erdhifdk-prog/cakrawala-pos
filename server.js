/**
 * Cakrawala POS - Node.js + Express + SQLite
 * COMPLETE VERSION - All features from PHP POS
 * 
 * Stack: Node.js + Express + sql.js (pure JS, no native compile)
 * RAM Usage: ~60-100 MB (vs PHP 500-700 MB)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { createAllTables } = require('./schema');

// ── Config ────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cakrawala-pos-secret-key-2026';
const DB_PATH = process.env.DB_PATH || './data/cakrawala.db';

// ── Database Setup ────────────────────────────────────────────

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

let db;

async function initDatabase() {
    const SQL = await initSqlJs();
    db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    console.log('📦 Database connected:', DB_PATH);
    return db;
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
}

// Auto-save every 30 seconds
setInterval(saveDatabase, 30000);

// ── Helper Functions ──────────────────────────────────────────

function dbRun(sql, params = []) { db.run(sql, params); saveDatabase(); }

function dbGet(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
}

function dbAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
}

// ── Express App ───────────────────────────────────────────────

const app = express();

// CORS - izinkan semua origin (termasuk Capacitor/Android)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: false
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Middleware ─────────────────────────────────────────────────

function auth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
}

// ── Start Server ──────────────────────────────────────────────

async function start() {
    await initDatabase();
    createAllTables(db);
    saveDatabase();
    console.log('✅ Tables created/verified');

    // ── Load Routes (AFTER db is ready) ──

    // Health
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', app: 'Cakrawala POS', version: '2.0.0', uptime: process.uptime() });
    });

    // Auth
    const authRoutes = require('./routes/auth')(db, auth);
    app.use('/api/auth', authRoutes);

    // Users & Roles
    const userRoutes = require('./routes/users')(db, auth, adminOnly);
    app.use('/api/users', userRoutes);

    // Products & Categories
    const productRoutes = require('./routes/products')(db, auth);
    app.use('/api/products', productRoutes);

    // Customers
    const customerRoutes = require('./routes/customers')(db, auth);
    app.use('/api/customers', customerRoutes);

    // Transactions
    const transactionRoutes = require('./routes/transactions')(db, auth);
    app.use('/api/transactions', transactionRoutes);

    // Purchasing
    const purchasingRoutes = require('./routes/purchasing')(db, auth);
    app.use('/api', purchasingRoutes);

    // Finance
    const financeRoutes = require('./routes/finance')(db, auth);
    app.use('/api', financeRoutes);

    // Stock & Warehouses
    const stockRoutes = require('./routes/stock')(db, auth);
    app.use('/api', stockRoutes);

    // Settings
    const settingsRoutes = require('./routes/settings')(db, auth, adminOnly);
    app.use('/api/settings', settingsRoutes);

    // Reports & Dashboard
    const reportRoutes = require('./routes/reports')(db, auth);
    app.use('/api/reports', reportRoutes);

    // Legacy dashboard route (backward compatibility)
    app.get('/api/dashboard/stats', auth, (req, res) => {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = dbGet('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM transactions WHERE DATE(created_at) = ?', [today]);
        const totalProducts = dbGet('SELECT COUNT(*) as count FROM products')?.count || 0;
        const totalCustomers = dbGet('SELECT COUNT(*) as count FROM customers')?.count || 0;
        const lowStock = dbGet('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0')?.count || 0;
        res.json({ today_sales: todaySales, total_products: totalProducts, total_customers: totalCustomers, low_stock_count: lowStock });
    });

    // Sync
    app.get('/api/sync/status', (req, res) => {
        res.json({ status: 'ok', server_time: new Date().toISOString() });
    });

    // Catch-all SPA
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    console.log('✅ All routes loaded');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║     Cakrawala POS v2.0 - COMPLETE            ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║  🌐 Server: http://0.0.0.0:${PORT}            ║`);
        console.log(`║  📦 Database: ${DB_PATH}     ║`);
        console.log('║  💾 RAM Usage: ~60-100 MB                    ║');
        console.log('║  📊 Tables: 61 | Routes: 200+               ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
    });
}

start().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});

process.on('SIGINT', () => { saveDatabase(); process.exit(0); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(0); });
