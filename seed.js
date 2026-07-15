/**
 * Cakrawala POS - Seed Data
 * 
 * Jalankan: npm run seed
 */

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');

if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}

async function seed() {
    console.log('🌱 Seeding database...');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'cashier',
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            image TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT,
            sku TEXT,
            title TEXT NOT NULL,
            description TEXT,
            image TEXT,
            buy_price INTEGER DEFAULT 0,
            sell_price INTEGER DEFAULT 0,
            stock INTEGER DEFAULT 0,
            min_stock INTEGER DEFAULT 0,
            max_stock INTEGER DEFAULT 0,
            category_id INTEGER,
            tax_type TEXT DEFAULT 'exclusive',
            tax_rate REAL DEFAULT 11.0,
            is_composite INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            no_telp TEXT,
            address TEXT,
            is_loyalty_member INTEGER DEFAULT 0,
            member_code TEXT,
            loyalty_tier TEXT DEFAULT 'regular',
            loyalty_points INTEGER DEFAULT 0,
            loyalty_total_spent INTEGER DEFAULT 0,
            loyalty_transaction_count INTEGER DEFAULT 0,
            loyalty_member_since DATETIME,
            last_purchase_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'main',
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS product_warehouse (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            warehouse_id INTEGER NOT NULL,
            stock INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
            UNIQUE(product_id, warehouse_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice TEXT UNIQUE NOT NULL,
            cashier_id INTEGER,
            customer_id INTEGER,
            warehouse_id INTEGER,
            discount INTEGER DEFAULT 0,
            shipping_cost INTEGER DEFAULT 0,
            tax_rate REAL DEFAULT 0,
            tax_total INTEGER DEFAULT 0,
            grand_total INTEGER DEFAULT 0,
            cash INTEGER DEFAULT 0,
            change INTEGER DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            payment_status TEXT DEFAULT 'paid',
            local_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cashier_id) REFERENCES users(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS transaction_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            qty INTEGER DEFAULT 1,
            unit_price INTEGER DEFAULT 0,
            price INTEGER DEFAULT 0,
            discount_total INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS profits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            total INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ── Users ─────────────────────────────────────────────────────

    const adminPassword = bcrypt.hashSync('password', 10);
    const cashierPassword = bcrypt.hashSync('password', 10);

    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Administrator', 'admin@cakrawala.id', adminPassword, 'admin']);

    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Kasir', 'kasir@cakrawala.id', cashierPassword, 'cashier']);

    console.log('✅ Users created');

    // ── Categories ────────────────────────────────────────────────

    const categories = [
        { name: 'Makanan', description: 'Makanan ringan & berat' },
        { name: 'Minuman', description: 'Minuman dingin & panas' },
        { name: 'Sembako', description: 'Beras, gula, minyak, dll' },
        { name: 'Rokok', description: 'Rokok & tembakau' },
        { name: 'Perawatan', description: 'Sabun, shampoo, dll' },
        { name: 'Lainnya', description: 'Produk lainnya' },
    ];

    for (const cat of categories) {
        db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description]);
    }

    console.log('✅ Categories created');

    // ── Warehouse ─────────────────────────────────────────────────

    db.run('INSERT INTO warehouses (code, name, type, is_active) VALUES (?, ?, ?, ?)',
        ['PUSAT', 'Gudang Pusat', 'main', 1]);

    console.log('✅ Warehouse created');

    // ── Products ──────────────────────────────────────────────────

    const products = [
        // Makanan
        { title: 'Mie Instan Goreng', barcode: '8992388111015', buy_price: 2500, sell_price: 3500, stock: 100, category: 'Makanan' },
        { title: 'Mie Instan Kuah', barcode: '8992388111022', buy_price: 2500, sell_price: 3500, stock: 80, category: 'Makanan' },
        { title: 'Roti Tawar', barcode: '8991234560001', buy_price: 8000, sell_price: 12000, stock: 20, category: 'Makanan' },
        { title: 'Keripik Kentang', barcode: '8991234560002', buy_price: 5000, sell_price: 8000, stock: 50, category: 'Makanan' },
        { title: 'Biskuit Coklat', barcode: '8991234560003', buy_price: 3000, sell_price: 5000, stock: 60, category: 'Makanan' },
        
        // Minuman
        { title: 'Air Mineral 600ml', barcode: '8992761111015', buy_price: 1500, sell_price: 3000, stock: 100, category: 'Minuman' },
        { title: 'Kopi Sachet', barcode: '8992761111022', buy_price: 1000, sell_price: 2000, stock: 80, category: 'Minuman' },
        { title: 'Teh Botol', barcode: '8992761111039', buy_price: 2500, sell_price: 4000, stock: 50, category: 'Minuman' },
        { title: 'Susu UHT', barcode: '8992761111046', buy_price: 3000, sell_price: 5000, stock: 40, category: 'Minuman' },
        
        // Sembako
        { title: 'Beras 5kg', barcode: '8991234560010', buy_price: 55000, sell_price: 65000, stock: 10, category: 'Sembako' },
        { title: 'Gula Pasir 1kg', barcode: '8991234560011', buy_price: 12000, sell_price: 15000, stock: 20, category: 'Sembako' },
        { title: 'Minyak Goreng 1L', barcode: '8991234560012', buy_price: 14000, sell_price: 18000, stock: 15, category: 'Sembako' },
        
        // Rokok
        { title: 'Rokok Kretek', barcode: '8991234560020', buy_price: 15000, sell_price: 18000, stock: 30, category: 'Rokok' },
        { title: 'Rokok Filter', barcode: '8991234560021', buy_price: 20000, sell_price: 25000, stock: 25, category: 'Rokok' },
        
        // Perawatan
        { title: 'Sabun Mandi', barcode: '8991234560030', buy_price: 3000, sell_price: 5000, stock: 30, category: 'Perawatan' },
        { title: 'Shampoo Sachet', barcode: '8991234560031', buy_price: 500, sell_price: 1500, stock: 100, category: 'Perawatan' },
        { title: 'Pasta Gigi', barcode: '8991234560032', buy_price: 5000, sell_price: 8000, stock: 20, category: 'Perawatan' },
    ];

    for (const product of products) {
        // Get category ID
        const stmt = db.prepare('SELECT id FROM categories WHERE name = ?');
        stmt.bind([product.category]);
        let categoryId = 6; // default to 'Lainnya'
        if (stmt.step()) {
            categoryId = stmt.getAsObject().id;
        }
        stmt.free();

        db.run(`
            INSERT INTO products (barcode, title, buy_price, sell_price, stock, category_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [product.barcode, product.title, product.buy_price, product.sell_price, product.stock, categoryId]);

        // Get product ID and add warehouse stock
        const prodStmt = db.prepare('SELECT id FROM products WHERE barcode = ?');
        prodStmt.bind([product.barcode]);
        if (prodStmt.step()) {
            const productId = prodStmt.getAsObject().id;
            db.run('INSERT INTO product_warehouse (product_id, warehouse_id, stock) VALUES (?, ?, ?)',
                [productId, 1, product.stock]);
        }
        prodStmt.free();
    }

    console.log('✅ Products created');

    // ── Customers ─────────────────────────────────────────────────

    const customers = [
        { name: 'Umum', no_telp: '', address: '' },
        { name: 'Pak Budi', no_telp: '081234567890', address: 'Jl. Merdeka No. 10' },
        { name: 'Bu Ani', no_telp: '085678901234', address: 'Jl. Pahlawan No. 5' },
        { name: 'Mas Dudung', no_telp: '087890123456', address: 'Jl. Sudirman No. 15' },
    ];

    for (const cust of customers) {
        db.run('INSERT INTO customers (name, no_telp, address) VALUES (?, ?, ?)', [cust.name, cust.no_telp, cust.address]);
    }

    console.log('✅ Customers created');

    // ── Settings ──────────────────────────────────────────────────

    const settings = [
        { key: 'store_name', value: 'Cakrawala POS', description: 'Nama toko' },
        { key: 'store_address', value: 'Jl. Contoh No. 123', description: 'Alamat toko' },
        { key: 'store_phone', value: '081234567890', description: 'Telepon toko' },
        { key: 'tax_default_rate', value: '11', description: 'PPN default (%)' },
        { key: 'currency', value: 'IDR', description: 'Mata uang' },
    ];

    for (const setting of settings) {
        db.run('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)', 
            [setting.key, setting.value, setting.description]);
    }

    console.log('✅ Settings created');

    // ── Save Database ─────────────────────────────────────────────

    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync('./data/cakrawala.db', buffer);

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║        Seed Complete!                       ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log('║  👤 Admin: admin@cakrawala.id / password    ║');
    console.log('║  👤 Kasir: kasir@cakrawala.id / password    ║');
    console.log('║  📦 Products: ' + products.length + ' items                    ║');
    console.log('║  👥 Customers: ' + customers.length + ' items                   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    db.close();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
