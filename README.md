# 🌅 Cakrawala POS

Sistem Point of Sale (POS) untuk UMKM - Ringan, Offline-First, Modern

## ✨ Fitur

- 🛒 **Kasir/POS** - Transaksi cepat dengan barcode scanner
- 📦 **Produk** - Manajemen produk dengan foto & barcode
- 👥 **Pelanggan** - Customer management + loyalty
- 📊 **Laporan** - Sales, profit, inventory reports
- 🔄 **Offline Mode** - Tetap jualan tanpa internet
- 📱 **Mobile Friendly** - Responsive di HP/tablet
- 📷 **Barcode Scanner** - Scan langsung dari kamera
- 📸 **Foto Produk** - Ambil foto dari kamera

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/erdhifdk-prog/cakrawala-pos.git
cd cakrawala-pos
npm install

# Seed database
npm run seed

# Start server
npm start

# Buka http://localhost:3000
```

## 👤 Login Default

| Role | Email | Password |
|------|-------|----------|
| Admin | cakrawalapos@cakrawala.id | password |
| Kasir | kasir@cakrawala.id | password |

## 📱 Build Android APK

```bash
# Setup Capacitor
npm run cap:init
npm run cap:add:android
npm run cap:sync

# Build APK
npm run apk:build

# APK ada di: android/app/build/outputs/apk/debug/
```

Atau pakai **GitHub Actions** (otomatis build APK setiap push):

1. Push kode ke GitHub
2. Buka tab "Actions"
3. Download APK dari artifacts

## 🌐 Deploy

### Docker
```bash
docker-compose up -d
```

### Manual
```bash
npm install
npm run seed
npm start
```

## 📂 Struktur Project

```
cakrawala-pos/
├── server.js           → Backend (Express + SQLite)
├── schema.js           → Database schema (61 tables)
├── seed.js             → Data awal
├── capacitor.config.json → Konfigurasi Android
├── .github/workflows/  → GitHub Actions (auto build APK)
├── public/
│   ├── index.html      → Frontend SPA
│   ├── manifest.json   → PWA manifest
│   ├── sw.js           → Service Worker (offline)
│   └── icons/          → App icons
└── data/               → SQLite database
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (sql.js) |
| Frontend | HTML + CSS + JavaScript |
| Auth | JWT + bcryptjs |
| Mobile | Capacitor (Android) |
| PWA | Service Worker + Manifest |
| Deploy | Docker / VPS / STB |

## 📊 Resource Usage

| Resource | Usage |
|----------|-------|
| RAM | ~60-100 MB |
| Disk | ~50 MB |
| CPU | Minimal |

## 📄 License

MIT License

## 👨‍💻 Developer

Cakrawala POS - InternetProject
