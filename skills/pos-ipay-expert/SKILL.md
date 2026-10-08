---
name: pos-ipay-expert
description: Expert developer and architect skill for POS IPAY (Hybrid Web POS, PPOB ipay.my.id, Multi-Tenant SQLite, Double-Entry Accounting, Service Desk, Thermal ESC/POS printing, and VPS Deployment). Use this skill whenever inspecting, developing, debugging, extending, or maintaining any part of the POS IPAY codebase.
---

# POS IPAY Expert Skill

Sistem **POS IPAY** adalah aplikasi POS Kasir hybrid modern yang mengintegrasikan layanan ritel, transaksi digital PPOB (melalui provider `ipay.my.id`), antrian servis perangkat/HP, dan pembukuan akuntansi terstandarisasi (*Double-Entry SAK ETAP*).

Gunakan panduan dalam skill ini untuk memahami konteks, struktur arsitektur, pola database, dan tata cara pengembangan proyek.

---

## 1. Peta File Utama Codebase (Core Files Map)

### Backend & Database (`server/`)
- `server/index.ts`: Entry point server Express 5, static file server dari `dist/`, background auto-poller PPOB (interval 20 detik), dan dynamic auto-backup scheduler.
- `server/db/database.ts`: Transparent proxy singleton `db` yang otomatis mengarahkan query (`prepare`, `exec`, `transaction`) ke database tenant aktif melalui `tenantContext`.
- `server/db/tenant.ts`: `TenantManager` pengelola isolasi database per tenant (`data/tenants/<tenantId>.db`) dan inisialisasi skema awal (`initTenantDatabase`).
- `server/db/schema.sql`: Skema SQLite lengkap (tabel orders, order_items, users, shifts, products, customers, suppliers, journal_entries, ppob_deposits, sales_returns, operational_transactions, backup_configs, dll.).
- `server/middleware/tenant.ts`: Resolver tenant berbasis header `X-Tenant-ID`, subdomain host, atau query parameter.
- `server/routes/api.ts`: Seluruh endpoint REST API (kasir, transaksi, retur, PPOB, akuntansi, servis, shift, laporan analitik, operator RBAC, backup).
- `server/services/accounting.ts`: Mesin akuntansi double-entry (Neraca, Laba Rugi, Buku Besar, Jurnal Umum, Arus Kas).
- `server/services/ppob.ts`: Integrasi API `https://api.ipay.my.id` (inquiry, transaksi, callback/webhook, auto-sync pending).
- `server/services/sales-return.ts`: Logika retur penjualan, pemulihan stok inventaris, dan pembalikan piutang/kas.
- `server/services/service-desk.ts`: Manajemen tiket servis HP/laptop dan integrasi pesan WhatsApp pelanggan.
- `server/services/printer.ts`: Formatting ESC/POS thermal receipt (58mm/80mm), RJ11 cash drawer kick, dan format WhatsApp.
- `server/services/backup.ts`: Cadangan SQLite online hot snapshot, rotasi retensi, dan pemulihan darurat.

### Frontend (`client/src/`)
- `client/src/App.tsx`: Routing halaman utama aplikasi.
- `client/src/pages/CashierPOS.tsx`: Layar utama kasir POS ritel & digital.
- `client/src/pages/AccountingPage.tsx`: Laporan Laba Rugi standar, Buku Besar, Neraca, dan pencatatan Operasional Kas.
- `client/src/pages/ReportsPage.tsx`: Riwayat transaksi, retur penjualan, ranking produk terlaris, dan stok limit menipis.
- `client/src/pages/PPOBManagerPage.tsx`: Manajemen katalog PPOB, tiket deposit pending/approve, dan log webhook.
- `client/src/pages/ServicePage.tsx`: Antrian servis HP dan modal notifikasi WhatsApp "Siap Diambil".
- `client/src/pages/SettingsPage.tsx`: Konfigurasi toko, backup database, dan manajemen operator & hak akses.
- `client/src/components/Header.tsx`: Header responsif desktop & mobile.
- `client/src/components/PaymentModal.tsx`: Popup pembayaran multi-metode dengan pendaftaran pelanggan baru instan (*on-the-fly*).
- `client/src/components/ReceiptModal.tsx`: Preview thermal receipt otentik dan format WhatsApp dengan kotak token PLN/SN.
- `client/src/components/SalesReturnModal.tsx`: Modal interaktif pemilihan barang retur, alasan, dan metode refund.
- `client/src/components/SwitchUserModal.tsx`: Modal pergantian kasir/operator dengan verifikasi PIN/password.
- `client/src/components/CashInOutModal.tsx`: Modal pencatatan pengeluaran operasional & pemasukan lain-lain dinamis.

---

## 2. Aturan Baku yang Wajib Diingat (Critical Invariants)

1. **Multi-Tenant Context**:
   - Selalu akses database melalui `db` dari `server/db/database.ts`. Jangan membuka file SQLite hardcoded secara manual tanpa tenant context.
   - Perubahan skema tabel baru **wajib** ada di `server/db/schema.sql` dan `initTenantDatabase()` di `server/db/tenant.ts`.
2. **Double-Entry Balance**:
   - Jurnal akuntansi selalu mencatat `Debit` dan `Kredit` seimbang.
   - Pemasukan/pengeluaran kas laci (`1-1001`) wajib menyinkronkan saldo fisik shift kasir yang sedang berjalan.
3. **PPOB Deposit**:
   - Tiket deposit baru harus berstatus `PENDING`. Dilarang menambah saldo `1-1003` sebelum disetujui admin.
4. **Alur Update Produksi**:
   - Kode frontend React disajikan oleh server Express dari folder `/dist/`.
   - Setiap kali melakukan perubahan di `client/`, wajib jalankan:
     ```bash
     npm run build
     ```
   - Di VPS, daemon server dikelola oleh systemd (`sudo systemctl restart pos-ipay`).

---

## 3. Menjalankan Tes & Verifikasi

Sebelum menyatakan suatu tugas selesai, selalu jalankan test suite otomatis:
```bash
npm test
```
Dan pastikan build frontend berhasil:
```bash
npm run build
```
Tes mencakup pengujian isolasi multi-tenant, akuntansi jurnal kasbon & supplier, retur penjualan, mutasi operasional, deposit PPOB, dan rotasi backup database.
