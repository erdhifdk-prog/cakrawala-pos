// routes/reports.js - Sales, Profit, Aging Reports
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // Sales report
    router.get('/sales', auth, (req, res) => {
        const { start_date, end_date, group_by } = req.query;
        let query = 'SELECT DATE(t.created_at) as date, COUNT(*) as count, SUM(t.grand_total) as total, SUM(t.discount) as discount_total, SUM(t.shipping_cost) as shipping_total FROM transactions t WHERE 1=1';
        const params = [];
        if (start_date) { query += ' AND DATE(t.created_at) >= ?'; params.push(start_date); }
        if (end_date) { query += ' AND DATE(t.created_at) <= ?'; params.push(end_date); }
        query += ' GROUP BY DATE(t.created_at) ORDER BY date DESC';
        res.json(dbAll(db, query, params));
    });

    // Profit report
    router.get('/profits', auth, (req, res) => {
        const { start_date, end_date } = req.query;
        let query = 'SELECT DATE(t.created_at) as date, SUM(p.total) as total_profit, COUNT(DISTINCT t.id) as transaction_count FROM profits p JOIN transactions t ON p.transaction_id = t.id WHERE 1=1';
        const params = [];
        if (start_date) { query += ' AND DATE(t.created_at) >= ?'; params.push(start_date); }
        if (end_date) { query += ' AND DATE(t.created_at) <= ?'; params.push(end_date); }
        query += ' GROUP BY DATE(t.created_at) ORDER BY date DESC';
        res.json(dbAll(db, query, params));
    });

    // Aging report (receivables)
    router.get('/aging', auth, (req, res) => {
        const unpaid = dbAll(db, 'SELECT r.*, c.name as customer_name FROM receivables r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.status != "paid" ORDER BY r.due_date');
        const today = new Date();
        const buckets = { 'belum_jatuh_tempo': 0, '1_30_hari': 0, '31_60_hari': 0, '61_90_hari': 0, 'lebih_90_hari': 0 };
        for (const r of unpaid) {
            const remaining = (r.total || 0) - (r.paid || 0);
            if (!r.due_date) { buckets.belum_jatuh_tempo += remaining; continue; }
            const days = Math.floor((today - new Date(r.due_date)) / (1000 * 60 * 60 * 24));
            if (days <= 0) buckets.belum_jatuh_tempo += remaining;
            else if (days <= 30) buckets['1_30_hari'] += remaining;
            else if (days <= 60) buckets['31_60_hari'] += remaining;
            else if (days <= 90) buckets['61_90_hari'] += remaining;
            else buckets['lebih_90_hari'] += remaining;
        }
        res.json({ items: unpaid, summary: buckets });
    });

    // Dashboard stats
    router.get('/dashboard', auth, (req, res) => {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = dbGet(db, 'SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(discount), 0) as discount FROM transactions WHERE DATE(created_at) = ?', [today]);
        const yesterdaySales = dbGet(db, 'SELECT COALESCE(SUM(grand_total), 0) as total FROM transactions WHERE DATE(created_at) = date(?, "-1 day")', [today]);
        const monthSales = dbGet(db, 'SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM transactions WHERE STRFTIME("%Y-%m", created_at) = STRFTIME("%Y-%m", "now")');
        const totalProducts = dbGet(db, 'SELECT COUNT(*) as count FROM products')?.count || 0;
        const totalCustomers = dbGet(db, 'SELECT COUNT(*) as count FROM customers')?.count || 0;
        const lowStock = dbGet(db, 'SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0')?.count || 0;
        const totalProfit = dbGet(db, 'SELECT COALESCE(SUM(total), 0) as total FROM profits')?.total || 0;
        
        // Recent transactions
        const recentTransactions = dbAll(db, `SELECT t.*, c.name as customer_name FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id ORDER BY t.created_at DESC LIMIT 5`);
        
        // Top products
        const topProducts = dbAll(db, `SELECT p.title, SUM(td.qty) as total_qty, SUM(td.price) as total_revenue
            FROM transaction_details td JOIN products p ON td.product_id = p.id
            JOIN transactions t ON td.transaction_id = t.id
            WHERE DATE(t.created_at) >= DATE('now', '-30 days')
            GROUP BY p.id ORDER BY total_qty DESC LIMIT 5`);

        res.json({
            today_sales: todaySales,
            yesterday_sales: yesterdaySales,
            month_sales: monthSales,
            total_products: totalProducts,
            total_customers: totalCustomers,
            low_stock_count: lowStock,
            total_profit: totalProfit,
            recent_transactions: recentTransactions,
            top_products: topProducts
        });
    });

    // Audit logs
    router.get('/audit-logs', auth, (req, res) => {
        const { module: mod, user_id } = req.query;
        let query = 'SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1';
        const params = [];
        if (mod) { query += ' AND al.module = ?'; params.push(mod); }
        if (user_id) { query += ' AND al.user_id = ?'; params.push(parseInt(user_id)); }
        query += ' ORDER BY al.created_at DESC LIMIT 100';
        res.json(dbAll(db, query, params));
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
