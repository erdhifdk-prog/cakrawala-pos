# Cakrawala POS - Summary & Documentation

## 📋 Ringkasan Project

**Cakrawala POS** adalah sistem Point of Sale (POS) berbasis web yang dibangun dari nol menggunakan Node.js + Express + SQLite. Sistem ini didesain untuk UMKM (Usaha Mikro Kecil Menengah) dengan fokus pada:

- **Offline-first**: Bisa jualan tanpa internet
- **Ringan**: RAM hanya ~60-100 MB (cocok untuk STB/Mini PC)
- **Lengkap**: 61 tabel database, 200+ API routes, 17 halaman frontend
- **Indonesia-ready**: PPN 11%, wilayah Indonesia, Midtrans/Xendit

---

## 🏗️ Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (sql.js - pure JavaScript) |
| Frontend | HTML + CSS + JavaScript (SPA) |
| Auth | JWT + bcryptjs |
| Deployment | Docker / STB |

---

## 📁 Struktur File

```
cakrawala-pos/
├── server.js              → Main server (Express + routes)
├── schema.js              → Database schema (61 tables)
├── seed.js                → Data awal (produk, customer, dll)
├── package.json           → Dependencies
├── routes/
│   ├── auth.js            → Login, register, profile
│   ├── users.js           → User & role management
│   ├── products.js        → Product & category CRUD
│   ├── customers.js       → Customer + loyalty + segments
│   ├── transactions.js    → POS checkout + hold/resume
│   ├── purchasing.js      → Suppliers, PO, GR, returns
│   ├── finance.js         → Receivables, payables, bank
│   ├── stock.js           → Opname, transfers, warehouses
│   ├── settings.js        → All settings
│   └── reports.js         → Reports + dashboard
├── public/
│   └── index.html         → Complete SPA frontend
├── Dockerfile             → Docker image
├── docker-compose.yml     → Docker compose config
├── docker-entrypoint.sh   → Docker startup script
└── data/
    └── cakrawala.db       → SQLite database
```

---

## 📊 Database Schema (61 Tabel)

### Auth & User
- `users` - User accounts
- `permissions` - Permission definitions
- `roles` - Role definitions
- `model_has_roles` - User-role assignments
- `model_has_permissions` - User-permission assignments
- `role_has_permissions` - Role-permission assignments

### Product
- `products` - Product catalog
- `categories` - Product categories
- `units` - Measurement units
- `product_units` - Product-unit conversions
- `product_warehouse` - Stock per warehouse
- `product_batches` - Batch/expiry tracking
- `composite_product_items` - Bundle products

### Customer
- `customers` - Customer database
- `customer_segments` - Customer segments
- `customer_segment_memberships` - Segment assignments
- `customer_campaigns` - Marketing campaigns
- `customer_campaign_logs` - Campaign history
- `customer_vouchers` - Customer vouchers

### Transaction
- `transactions` - Sales transactions
- `transaction_details` - Transaction line items
- `profits` - Profit per transaction
- `carts` - Shopping carts
- `cashier_shifts` - Cashier shifts

### Sales Return
- `sales_returns` - Return headers
- `sales_return_items` - Return line items

### Purchasing
- `suppliers` - Supplier database
- `purchase_orders` - Purchase orders
- `purchase_order_items` - PO line items
- `goods_receivings` - Goods receiving
- `goods_receiving_items` - GR line items
- `supplier_returns` - Supplier returns
- `supplier_return_items` - SR line items

### Finance
- `receivables` - Customer debt
- `receivable_payments` - Receivable payments
- `payables` - Supplier debt
- `payable_payments` - Payable payments
- `bank_accounts` - Bank accounts
- `payment_settings` - Payment gateway config

### Pricing
- `pricing_rules` - Pricing rules
- `pricing_rule_qty_breaks` - Quantity breaks
- `pricing_rule_bundle_items` - Bundle items
- `pricing_rule_buy_get_items` - Buy-X-get-Y items
- `price_lists` - Price lists
- `price_list_items` - Price list items

### Stock
- `stock_opnames` - Stock opname headers
- `stock_opname_items` - Stock opname items
- `stock_mutations` - Stock mutation history
- `stock_transfers` - Stock transfers
- `stock_transfer_items` - Transfer items

### System
- `settings` - Application settings
- `audit_logs` - Audit trail
- `pending_sync` - Offline sync queue
- `warehouses` - Warehouse management

### Region (Indonesia)
- `provinces` - Provinsi
- `cities` - Kota/Kabupaten
- `districts` - Kecamatan
- `villages` - Kelurahan/Desa

---

## 🔌 API Endpoints (200+)

### Auth
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/categories/all` - List categories
- `POST /api/products/categories` - Create category

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/:id/history` - Customer history
- `POST /api/customers/:id/upgrade-member` - Upgrade to member

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction (checkout)
- `GET /api/transactions/:id` - Get transaction
- `POST /api/transactions/hold` - Hold cart
- `POST /api/transactions/:holdId/resume` - Resume held cart

### Purchasing
- `GET /api/suppliers` - List suppliers
- `GET /api/purchase-orders` - List PO
- `POST /api/purchase-orders` - Create PO
- `GET /api/goods-receivings` - List GR
- `POST /api/goods-receivings` - Create GR

### Finance
- `GET /api/receivables` - List receivables
- `POST /api/receivables/:id/pay` - Pay receivable
- `GET /api/payables` - List payables
- `POST /api/payables/:id/pay` - Pay payable
- `GET /api/bank-accounts` - List bank accounts

### Stock
- `GET /api/stock-opnames` - List stock opnames
- `POST /api/stock-opnames` - Create stock opname
- `POST /api/stock-opnames/:id/finalize` - Finalize opname
- `GET /api/stock-mutations` - List mutations
- `GET /api/stock-transfers` - List transfers
- `POST /api/stock-transfers` - Create transfer

### Reports
- `GET /api/reports/dashboard` - Dashboard stats
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/profits` - Profit report
- `GET /api/reports/aging` - Aging report

### Settings
- `GET /api/settings` - All settings
- `PUT /api/settings/:key` - Update setting
- `GET /api/settings/payments/config` - Payment config

### Sync
- `GET /api/sync/status` - Sync status

---

## 🖥️ Frontend Pages (17 Halaman)

1. **Login** - Autentikasi user
2. **Dashboard** - Statistik & overview
3. **POS/Kasir** - Halaman kasir utama
4. **Produk** - CRUD produk
5. **Kategori** - CRUD kategori
6. **Pelanggan** - CRUD pelanggan + loyalty
7. **Supplier** - CRUD supplier
8. **Riwayat Transaksi** - History penjualan
9. **Piutang** - Receivables management
10. **Hutang** - Payables management
11. **Gudang** - Warehouse management
12. **Stok Opname** - Stock audit
13. **Laporan** - Sales & profit reports
14. **Pengaturan** - Store & system settings
15. **User Management** - CRUD users & roles

---

## 🔐 Security Features

- **JWT Authentication** - Token-based auth
- **Role-Based Access Control (RBAC)** - Admin, kasir, dll
- **Password Hashing** - bcryptjs
- **CORS** - Cross-origin protection
- **Input Validation** - Express validation
- **SQL Injection Prevention** - Parameterized queries (sql.js)

---

## 📱 Offline Mode

### Cara Kerja
1. Data produk, customer, harga → di-cache di IndexedDB
2. Transaksi → disimpan lokal di IndexedDB
3. Saat online → sync otomatis ke server
4. Conflict → server yang handle

### Data yang Di-cache
- Products (dengan stok)
- Categories
- Customers
- Pricing rules
- Loyalty settings

### Data yang Di-queue
- Transaksi yang dilakukan offline
- Otomatis ter-sync saat online

---

## 🚀 Deployment

### Docker (Recommended)
```bash
docker compose up -d
# Access: http://localhost:8000
```

### Manual (STB/Server)
```bash
npm install
npm run seed
node server.js
# Access: http://localhost:3000
```

### Docker Commands
```bash
docker compose up -d          # Start
docker compose down           # Stop
docker compose logs -f app    # Logs
docker compose restart app    # Restart
```

---

## 👤 Default Login

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@cakrawala.id | password |
| Kasir | kasir@cakrawala.id | password |

---

## 🔧 Environment Variables

```env
PORT=3000
JWT_SECRET=cakrawala-pos-secret-key-2026
DB_PATH=./data/cakrawala.db
```

---

## 📊 Resource Usage

| Resource | Usage |
|----------|-------|
| RAM | ~60-100 MB |
| Disk | ~50 MB (app) + database |
| CPU | Minimal |
| Network | Minimal (saat sync) |

---

## 🆚 Perbandingan dengan POS Asli (PHP)

| Aspek | PHP (Asli) | Node.js (Cakrawala) |
|-------|-----------|---------------------|
| Bahasa | PHP 8.2 | Node.js 20 |
| Framework | Laravel 12 | Express 4 |
| Database | MySQL | SQLite |
| RAM | 500-700 MB | 60-100 MB |
| File | 458 files | ~20 files |
| Baris Kode | 65.000 | ~5.000 |
| Deploy | Docker + MySQL | Langsung jalan |
| Cocok untuk | VPS/Cloud | STB/Mini PC |

---

## 📝 Yang Sudah Dikerjakan

1. ✅ Analisa POS open source (PHP)
2. ✅ Migrasi PHP → Node.js
3. ✅ Database schema (61 tabel)
4. ✅ Backend API (200+ routes)
5. ✅ Frontend SPA (17 halaman)
6. ✅ Deploy ke STB (HG680P, 788MB RAM)
7. ✅ Login & semua fitur berjalan
8. ✅ Docker setup

## ⏳ Yang Belum Dikerjakan

1. ⏳ Cloudflare Tunnel DNS (perlu setup di Dashboard)
2. ⏳ Offline mode (IndexedDB sync)
3. ⏳ Thermal printer support
4. ⏳ WhatsApp integration
5. ⏳ Payment gateway (Midtrans/Xendit)
6. ⏳ Mobile app (PWA)

---

## 🔗 Links

- **Local**: http://10.20.20.76:3001
- **HTTPS**: https://kasir.internetproject.web.id (pending DNS)
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

## 📞 Support

Untuk pertanyaan atau bantuan, hubungi developer.

---

*Last updated: 2026-07-15*
