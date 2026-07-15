/**
 * Cakrawala POS - Complete SQLite Schema
 * Port dari 75 migrations PHP → 1 file schema
 * 
 * 19 kategori tabel, ~50+ tabel total
 */

function createAllTables(db) {
    // ══════════════════════════════════════════════════════════════
    // 1. AUTH & USER (Spatie Permission)
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        email_verified_at DATETIME,
        password TEXT NOT NULL,
        remember_token TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'cashier',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        guard_name TEXT DEFAULT 'web',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, guard_name)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        guard_name TEXT DEFAULT 'web',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, guard_name)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS model_has_roles (
        role_id INTEGER NOT NULL,
        model_type TEXT NOT NULL,
        model_id INTEGER NOT NULL,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, model_type, model_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS model_has_permissions (
        permission_id INTEGER NOT NULL,
        model_type TEXT NOT NULL,
        model_id INTEGER NOT NULL,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (permission_id, model_type, model_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS role_has_permissions (
        permission_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (permission_id, role_id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 2. PRODUCT
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        image TEXT,
        barcode TEXT UNIQUE,
        sku TEXT,
        title TEXT NOT NULL,
        description TEXT,
        buy_price INTEGER DEFAULT 0,
        sell_price INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        max_stock INTEGER DEFAULT 0,
        tax_type TEXT DEFAULT 'exclusive',
        tax_rate REAL DEFAULT 11.0,
        is_composite INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        unit_id INTEGER NOT NULL,
        is_base INTEGER DEFAULT 0,
        conversion_factor REAL DEFAULT 1,
        buy_price INTEGER DEFAULT 0,
        sell_price INTEGER DEFAULT 0,
        barcode TEXT,
        sku_suffix TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id) REFERENCES units(id),
        UNIQUE(product_id, unit_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_warehouse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        UNIQUE(product_id, warehouse_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_number TEXT,
        expiry_date DATE,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS composite_product_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        composite_product_id INTEGER NOT NULL,
        component_product_id INTEGER NOT NULL,
        qty INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (composite_product_id) REFERENCES products(id),
        FOREIGN KEY (component_product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 3. CUSTOMER
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        no_telp TEXT,
        address TEXT,
        province_id INTEGER,
        province_name TEXT,
        regency_id INTEGER,
        regency_name TEXT,
        district_id INTEGER,
        district_name TEXT,
        village_id INTEGER,
        village_name TEXT,
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
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_segment_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        segment_id INTEGER NOT NULL,
        source TEXT DEFAULT 'manual',
        matched_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES customer_segments(id) ON DELETE CASCADE,
        UNIQUE(customer_id, segment_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'draft',
        scheduled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_campaign_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        customer_id INTEGER,
        transaction_id INTEGER,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES customer_campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        name TEXT,
        discount_type TEXT DEFAULT 'percentage',
        discount_value REAL DEFAULT 0,
        minimum_order INTEGER DEFAULT 0,
        starts_at DATETIME,
        expires_at DATETIME,
        is_active INTEGER DEFAULT 1,
        is_used INTEGER DEFAULT 0,
        used_at DATETIME,
        used_transaction_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`);

    // ══════════════════════════════════════════════════════════════
    // 4. WAREHOUSE
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'main',
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ══════════════════════════════════════════════════════════════
    // 5. TRANSACTION
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS cashier_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        opened_by INTEGER NOT NULL,
        warehouse_id INTEGER,
        opened_at DATETIME,
        opening_cash INTEGER DEFAULT 0,
        expected_cash INTEGER DEFAULT 0,
        actual_cash INTEGER DEFAULT 0,
        cash_difference INTEGER DEFAULT 0,
        cash_sales_total INTEGER DEFAULT 0,
        non_cash_sales_total INTEGER DEFAULT 0,
        cash_refund_total INTEGER DEFAULT 0,
        non_cash_refund_total INTEGER DEFAULT 0,
        transactions_count INTEGER DEFAULT 0,
        sales_returns_count INTEGER DEFAULT 0,
        notes TEXT,
        close_notes TEXT,
        closed_by INTEGER,
        closed_at DATETIME,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice TEXT UNIQUE NOT NULL,
        cashier_id INTEGER,
        cashier_shift_id INTEGER,
        warehouse_id INTEGER,
        customer_id INTEGER,
        cash INTEGER DEFAULT 0,
        change INTEGER DEFAULT 0,
        discount INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        shipping_cost INTEGER DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        customer_npwp TEXT,
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'paid',
        payment_reference TEXT,
        payment_url TEXT,
        bank_account_id INTEGER,
        loyalty_points_earned INTEGER DEFAULT 0,
        loyalty_points_redeemed INTEGER DEFAULT 0,
        loyalty_discount_total INTEGER DEFAULT 0,
        customer_voucher_discount INTEGER DEFAULT 0,
        customer_voucher_code TEXT,
        customer_voucher_name TEXT,
        discount_approved_by INTEGER,
        discount_approved_at DATETIME,
        discount_approval_status TEXT,
        access_token TEXT,
        local_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashier_id) REFERENCES users(id),
        FOREIGN KEY (cashier_shift_id) REFERENCES cashier_shifts(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transaction_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        unit_id INTEGER,
        conversion_factor REAL DEFAULT 1,
        qty INTEGER DEFAULT 1,
        base_unit_price INTEGER DEFAULT 0,
        unit_price INTEGER DEFAULT 0,
        price INTEGER DEFAULT 0,
        discount_total INTEGER DEFAULT 0,
        pricing_rule_id INTEGER,
        pricing_rule_name TEXT,
        pricing_rule_kind TEXT,
        pricing_group_key TEXT,
        pricing_group_label TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS profits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        total INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_id INTEGER NOT NULL,
        warehouse_id INTEGER,
        product_id INTEGER NOT NULL,
        unit_id INTEGER,
        conversion_factor REAL DEFAULT 1,
        qty INTEGER DEFAULT 1,
        price INTEGER DEFAULT 0,
        hold_id TEXT,
        hold_label TEXT,
        held_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashier_id) REFERENCES users(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 6. SALES RETURN
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_id INTEGER,
        cashier_shift_id INTEGER,
        customer_id INTEGER,
        warehouse_id INTEGER,
        transaction_id INTEGER NOT NULL,
        invoice TEXT UNIQUE NOT NULL,
        return_type TEXT DEFAULT 'refund_cash',
        refund_amount INTEGER DEFAULT 0,
        credited_amount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_return_id INTEGER NOT NULL,
        transaction_detail_id INTEGER,
        product_id INTEGER NOT NULL,
        qty_return INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 7. PURCHASING
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        no_telp TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'draft',
        total INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS goods_receivings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER,
        supplier_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        receiving_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        total INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS goods_receiving_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goods_receiving_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty_received INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        batch_number TEXT,
        expiry_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (goods_receiving_id) REFERENCES goods_receivings(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS supplier_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        return_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        total INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS supplier_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_return_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty_return INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_return_id) REFERENCES supplier_returns(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 8. FINANCE
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS receivables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        transaction_id INTEGER NOT NULL,
        invoice TEXT NOT NULL,
        total INTEGER DEFAULT 0,
        paid INTEGER DEFAULT 0,
        due_date DATE,
        status TEXT DEFAULT 'unpaid',
        aging_bucket TEXT,
        collection_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receivable_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receivable_id INTEGER NOT NULL,
        amount INTEGER DEFAULT 0,
        payment_date DATETIME,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        purchase_order_id INTEGER,
        document_number TEXT NOT NULL,
        total INTEGER DEFAULT 0,
        paid INTEGER DEFAULT 0,
        due_date DATE,
        status TEXT DEFAULT 'unpaid',
        aging_bucket TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payable_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payable_id INTEGER NOT NULL,
        amount INTEGER DEFAULT 0,
        payment_date DATETIME,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payable_id) REFERENCES payables(id) ON DELETE CASCADE
    )`);

    // ══════════════════════════════════════════════════════════════
    // 9. BANK ACCOUNT & PAYMENT SETTING
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payment_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        midtrans_enabled INTEGER DEFAULT 0,
        midtrans_server_key TEXT,
        midtrans_client_key TEXT,
        xendit_enabled INTEGER DEFAULT 0,
        xendit_secret_key TEXT,
        xendit_callback_token TEXT,
        default_gateway TEXT DEFAULT 'cash',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ══════════════════════════════════════════════════════════════
    // 10. PRICING
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS pricing_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT DEFAULT 'standard_discount',
        target_type TEXT DEFAULT 'all',
        product_id INTEGER,
        category_id INTEGER,
        customer_scope TEXT DEFAULT 'all',
        eligible_loyalty_tiers TEXT,
        discount_type TEXT DEFAULT 'percentage',
        discount_value REAL DEFAULT 0,
        preview_quantity_multiplier INTEGER,
        priority INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        starts_at DATETIME,
        ends_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pricing_rule_qty_breaks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pricing_rule_id INTEGER NOT NULL,
        min_qty INTEGER DEFAULT 1,
        discount_type TEXT DEFAULT 'percentage',
        discount_value REAL DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pricing_rule_bundle_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pricing_rule_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pricing_rule_buy_get_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pricing_rule_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        role TEXT DEFAULT 'buy',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS price_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS price_list_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        price_list_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        price INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 11. LOYALTY
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS loyalty_point_histories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        transaction_id INTEGER,
        type TEXT DEFAULT 'earn',
        points_delta INTEGER DEFAULT 0,
        balance_after INTEGER DEFAULT 0,
        amount_delta INTEGER DEFAULT 0,
        reference TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 12. DISCOUNT APPROVAL
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS discount_approval_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        cashier_id INTEGER NOT NULL,
        requested_discount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id),
        FOREIGN KEY (cashier_id) REFERENCES users(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 13. STOCK
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS stock_opnames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER NOT NULL,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_by INTEGER,
        finalized_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_opname_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_opname_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        system_stock INTEGER DEFAULT 0,
        actual_stock INTEGER DEFAULT 0,
        difference INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_opname_id) REFERENCES stock_opnames(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_mutations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        type TEXT DEFAULT 'in',
        quantity INTEGER DEFAULT 0,
        before_stock INTEGER DEFAULT 0,
        after_stock INTEGER DEFAULT 0,
        reference TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_warehouse_id INTEGER NOT NULL,
        destination_warehouse_id INTEGER NOT NULL,
        transfer_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_transfer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty_sent INTEGER DEFAULT 0,
        qty_received INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 14. AUDIT LOG
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT NOT NULL,
        module TEXT,
        auditable_type TEXT,
        auditable_id INTEGER,
        description TEXT,
        before_snapshot TEXT,
        after_snapshot TEXT,
        meta TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 15. REGION (Data Indonesia)
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS provinces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        province_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (province_id) REFERENCES provinces(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (city_id) REFERENCES cities(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS villages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        district_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (district_id) REFERENCES districts(id)
    )`);

    // ══════════════════════════════════════════════════════════════
    // 16. SETTINGS
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ══════════════════════════════════════════════════════════════
    // 17. PENDING SYNC (for offline transactions)
    // ══════════════════════════════════════════════════════════════

    db.run(`CREATE TABLE IF NOT EXISTS pending_sync (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT,
        payload TEXT,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME
    )`);

    // ══════════════════════════════════════════════════════════════
    // INDEXES
    // ══════════════════════════════════════════════════════════════

    db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transaction_details_tx ON transaction_details(transaction_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transaction_details_product ON transaction_details(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_carts_cashier ON carts(cashier_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_carts_product ON carts(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_carts_hold ON carts(hold_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_receivables_customer ON receivables(customer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payables_supplier ON payables(supplier_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_customer_vouchers_customer ON customer_vouchers(customer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_loyalty_histories_customer ON loyalty_point_histories(customer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_stock_mutations_product ON stock_mutations(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module)');
}

module.exports = { createAllTables };
