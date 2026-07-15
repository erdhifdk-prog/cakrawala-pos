// routes/products.js - Product Management (Complete)
const express = require('express');
const router = express.Router();

module.exports = function(db, auth) {
    // List products with search & filter
    router.get('/', auth, (req, res) => {
        const { category_id, search, stock_status } = req.query;
        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
        const params = [];
        
        if (category_id) { query += ' AND p.category_id = ?'; params.push(parseInt(category_id)); }
        if (search) { query += ' AND (p.title LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        if (stock_status === 'low') { query += ' AND p.stock <= p.min_stock AND p.min_stock > 0'; }
        if (stock_status === 'out') { query += ' AND p.stock <= 0'; }
        
        query += ' ORDER BY p.title';
        res.json(dbAll(db, query, params));
    });

    // Get single product
    router.get('/:id', auth, (req, res) => {
        const product = dbGet(db, 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });
        
        // Get units
        product.units = dbAll(db, 'SELECT pu.*, u.name as unit_name FROM product_units pu JOIN units u ON pu.unit_id = u.id WHERE pu.product_id = ?', [req.params.id]);
        // Get warehouse stock
        product.warehouse_stock = dbAll(db, 'SELECT pw.*, w.name as warehouse_name FROM product_warehouse pw JOIN warehouses w ON pw.warehouse_id = w.id WHERE pw.product_id = ?', [req.params.id]);
        
        res.json(product);
    });

    // Create product
    router.post('/', auth, (req, res) => {
        const { barcode, sku, title, description, image, buy_price, sell_price, stock, min_stock, max_stock, category_id, tax_type, tax_rate, is_composite } = req.body;
        dbRun(db, `INSERT INTO products (barcode, sku, title, description, image, buy_price, sell_price, stock, min_stock, max_stock, category_id, tax_type, tax_rate, is_composite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [barcode, sku, title, description, image, buy_price||0, sell_price||0, stock||0, min_stock||0, max_stock||0, category_id, tax_type||'exclusive', tax_rate||11.0, is_composite||0]);
        
        const product = dbGet(db, 'SELECT * FROM products WHERE id = last_insert_rowid()');
        res.json(product);
    });

    // Update product
    router.put('/:id', auth, (req, res) => {
        const { barcode, sku, title, description, image, buy_price, sell_price, stock, min_stock, max_stock, category_id, tax_type, tax_rate, is_composite } = req.body;
        dbRun(db, `UPDATE products SET barcode=?, sku=?, title=?, description=?, image=?, buy_price=?, sell_price=?, stock=?, min_stock=?, max_stock=?, category_id=?, tax_type=?, tax_rate=?, is_composite=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [barcode, sku, title, description, image, buy_price, sell_price, stock, min_stock, max_stock, category_id, tax_type, tax_rate, is_composite, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM products WHERE id = ?', [req.params.id]));
    });

    // Delete product
    router.delete('/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    // Categories
    router.get('/categories/all', auth, (req, res) => {
        res.json(dbAll(db, 'SELECT * FROM categories ORDER BY name'));
    });

    router.post('/categories', auth, (req, res) => {
        const { name, description, image } = req.body;
        dbRun(db, 'INSERT INTO categories (name, description, image) VALUES (?, ?, ?)', [name, description, image]);
        res.json(dbGet(db, 'SELECT * FROM categories WHERE id = last_insert_rowid()'));
    });

    router.put('/categories/:id', auth, (req, res) => {
        const { name, description, image } = req.body;
        dbRun(db, 'UPDATE categories SET name=?, description=?, image=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, description, image, req.params.id]);
        res.json(dbGet(db, 'SELECT * FROM categories WHERE id = ?', [req.params.id]));
    });

    router.delete('/categories/:id', auth, (req, res) => {
        dbRun(db, 'DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    // Units
    router.get('/units/all', auth, (req, res) => {
        res.json(dbAll(db, 'SELECT * FROM units ORDER BY name'));
    });

    router.post('/units', auth, (req, res) => {
        const { name } = req.body;
        dbRun(db, 'INSERT INTO units (name) VALUES (?)', [name]);
        res.json(dbGet(db, 'SELECT * FROM units WHERE id = last_insert_rowid()'));
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
