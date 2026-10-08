# 🏛️ POS IPAY - ARSITEKTUR SISTEM (ARSITEKTUR.md)

Dokumen ini menjelaskan arsitektur tingkat tinggi (High-Level Architecture) dan tingkat rendah (Low-Level Architecture) dari aplikasi **POS IPAY** — Sistem Kasir Modern, Integrasi PPOB, Servis HP, dan Akuntansi Terintegrasi.

---

## 1. Diagram Arsitektur Menyeluruh

```
                     ┌────────────────────────────────────────┐
                     │          Browser / Klien Kasir         │
                     │  (Desktop, Tablet, HP Android/iOS)     │
                     └───────────────────┬────────────────────┘
                                         │ HTTPS / HTTP
                                         ▼
                     ┌────────────────────────────────────────┐
                     │        Cloudflare Zero Trust /         │
                     │         Nginx Reverse Proxy            │
                     └───────────────────┬────────────────────┘
                                         │ Port 3001
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SERVER NODE.JS (EXPRESS 5 + TSX)                      │
│                                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────────────────────┐  │
│  │ Static SPA Files      │  │ Tenant Context Middleware                  │  │
│  │ (/dist/index.html)    │  │ (Resolves: Subdomain / X-Tenant-ID Header) │  │
│  └───────────────────────┘  └─────────────────────┬──────────────────────┘  │
│                                                   │                         │
│                                                   ▼                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          REST API ROUTER                              │  │
│  │  /api/auth, /api/orders, /api/returns, /api/ppob, /api/accounting,   │  │
│  │  /api/services, /api/shifts, /api/reports, /api/backup, /api/users    │  │
│  └────────────────────────────────────────┬──────────────────────────────┘  │
│                                           │                                 │
│  ┌────────────────────────────────────────┴──────────────────────────────┐  │
│  │                          SERVICE LAYER                                │  │
│  │  - AccountingService (Double-Entry Ledger & Financial Reports)        │  │
│  │  - PPOBService (ipay.my.id Integration & Webhooks)                    │  │
│  │  - InventoryService (Stock Control & Serial Numbers)                  │  │
│  │  - ServiceDeskService (Repair Tracking & WhatsApp Alerts)             │  │
│  │  - ShiftService (Drawer Cash Float & Session Controls)                │  │
│  │  - BackupService (Hot SQLite Snapshots & Retention)                   │  │
│  │  - PrinterService (Thermal ESC/POS & WhatsApp Digital Receipts)       │  │
│  └────────────────────────────────────────┬──────────────────────────────┘  │
│                                           │                                 │
│                                           ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               MULTI-TENANT ASYNC LOCAL STORAGE PROXY                  │  │
│  │        db.prepare(), db.exec(), db.transaction() -> Tenant DB         │  │
│  └──────────────────────┬──────────────────────────────────┬─────────────┘  │
└─────────────────────────┼──────────────────────────────────┼────────────────┘
                          │                                  │
                          ▼                                  ▼
           ┌──────────────────────────────┐   ┌──────────────────────────────┐
           │    Default Tenant DB         │   │   Tenant DBs (Isolated)      │
           │    data/pos.db (WAL Mode)    │   │   data/tenants/*.db (WAL)    │
           └──────────────────────────────┘   └──────────────────────────────┘
```

---

## 2. Arsitektur Multi-Tenant (Database-per-Tenant)

Sistem mengadopsi pola **Database-per-Tenant** dengan isolasi data 100%:
1. **Lokasi File Database**:
   - Tenant Default: `data/pos.db`
   - Tenant Lain: `data/tenants/<tenant_id>.db`
2. **Dynamic Context Resolution**:
   - `server/middleware/tenant.ts`: Mengekstrak `tenantId` dari:
     - Header HTTP `X-Tenant-ID`
     - Subdomain host (contoh: `toko-berkah.posipay.id` &rarr; `toko-berkah`)
     - Query parameter `?tenant_id=...`
     - Fallback ke `default`
   - Menggunakan Node.js `AsyncLocalStorage` (`tenantContext` di `server/db/tenant.ts`) untuk menyimpan konteks database per lifecycle request secara asinkron tanpa *data leak*.
3. **Transparent Database Proxy**:
   - `server/db/database.ts` mengekspos objek `db` singleton:
     ```ts
     export const db = new Proxy({} as Database.Database, {
       get(_target, prop) {
         const activeDb = getActiveDatabase();
         const value = (activeDb as any)[prop];
         return typeof value === 'function' ? value.bind(activeDb) : value;
       }
     });
     ```
   - Semua service dapat memanggil `db.prepare(...)` seperti biasa, dan query otomatis diarahkan ke database tenant yang tepat.

---

## 3. Arsitektur Akuntansi Double-Entry (SAK ETAP)

Modul akuntansi dibangun dengan ketelitian audit keuangan tinggi:
1. **Struktur Jurnal (`journal_entries` & `journal_entry_lines`)**:
   - Setiap entri memiliki `reference_type` (`SALE`, `PURCHASE`, `RETURN`, `PPOB`, `SERVICE`, `EXPENSE`, `OTHER_INCOME`, `DEPOSIT`).
   - Setiap baris memiliki kolom `debit` dan `credit`.
   - Validasi ketat: `SUM(debit) === SUM(credit)`.
2. **Pencatatan Otomatis Setiap Aksi Sistem**:
   - **Penjualan Kasir Tunai**:
     - Debit `1-1001` (Kas Laci Kasir)
     - Kredit `4-1001` (Pendapatan Penjualan Ritel)
     - Debit `5-1001` (HPP) & Kredit `1-1005` (Persediaan Barang)
   - **Penjualan Kasbon (Piutang)**:
     - Debit `1-1004` (Piutang Usaha)
     - Kredit `4-1001` (Pendapatan Penjualan Ritel)
   - **Retur Penjualan**:
     - Debit `4-1001` (Retur Penjualan)
     - Kredit `1-1001` (Kas Laci) atau `1-1004` (Piutang Usaha)
     - *(Jika restock aktif)*: Debit `1-1005` & Kredit `5-1001`.
   - **Pengeluaran Operasional Toko**:
     - Debit `6-1001` (Beban Operasional)
     - Kredit `1-1001` (Kas Laci) atau `1-1002` (Bank Toko)
   - **Pemasukan Lain-lain (Jual Kardus, dll.)**:
     - Debit `1-1001` atau `1-1002`
     - Kredit `4-1004` (Pendapatan Lain-lain)
3. **Laporan Finansial Standar**:
   - **Laba Rugi**: Multi-step standard (Pendapatan Kotor &minus; Retur &minus; HPP = Laba Kotor &minus; Beban Operasional + Pendapatan Lain = Laba Bersih).
   - **Buku Besar**: Ringkasan saldo mutasi per akun dengan filter periode tanggal.
   - **Neraca & Neraca Saldo**: Verifikasi kesetaraan Aset = Kewajiban + Ekuitas.

---

## 4. Arsitektur Integrasi PPOB (ipay.my.id)

1. **Komunikasi Provider**:
   - Base URL: `https://api.ipay.my.id`
   - Otentikasi: API Key, Merchant ID, dan MD5/HMAC Signature anti-tamper.
2. **State Machine Transaksi PPOB**:
   ```
   [INQUIRY/CEK TAGIHAN] ──► [PAYMENT REQUEST] ──► [PENDING] ────► [SUCCESS]
                                                      │             (SN Terbit & Jurnal Masuk)
                                                      ▼
                                                  [FAILED]
                                            (Saldo Deposit Dikembalikan)
   ```
3. **Background Auto-Poller**:
   - Setiap 20 detik, interval worker di `server/index.ts` memeriksa seluruh transaksi `PENDING` untuk setiap tenant dan memperbarui status secara otomatis jika provider telah menyelesaikan transaksi.
4. **Simulator Mode (`ppob-simulator.ts`)**:
   - Menyediakan simulasi instan untuk pengujian lokal saat koneksi ke provider dinonaktifkan atau offline.

---

## 5. Arsitektur Perangkat Keras & Pencetakan (Printer & Hardware)

1. **Protokol ESC/POS Thermal**:
   - Format cetak mendukung kertas **58mm** (32 karakter/baris) dan **80mm** (48 karakter/baris).
   - Perintah RJ11 Kick Drawer: Mengirimkan pulsa elektrik `ESC p 0 25 250` ke printer thermal untuk membuka laci kasir otomatis saat pembayaran tunai selesai.
2. **Format Struk Digital WhatsApp**:
   - Format string siap kirim ke API WhatsApp Web / Desktop (`wa.me/?text=...`) dengan pemformatan tebal (`*bold*`), miring (`_italic_`), serta kotak berbingkai ASCII khusus untuk Token PLN dan Serial Number.

---

## 6. Arsitektur Cadangan & Pemulihan (Backup & Disaster Recovery)

1. **Online Hot SQLite Snapshot**:
   - Menggunakan API bawaan `better-sqlite3` backup mechanism: database dapat dicadangkan saat server sedang aktif melayani transaksi tanpa mengunci pembaca (*zero downtime*).
2. **Dynamic Web Scheduler**:
   - Frekuensi cadangan dapat diatur langsung dari GUI kasir: Setiap 1 Jam, 6 Jam, 12 Jam, Harian, atau Mingguan.
   - Rotasi retensi otomatis: Menghapus file backup lama setelah melewati batas hari (7, 14, 30, atau 60 hari).
3. **Restorasi Instan**:
   - Admin dapat mengunggah file `.db` atau memilih snapshot cadangan langsung dari web untuk melakukan pemulihan darurat.

---

## 7. Arsitektur Frontend (React 19 + Vite + Tailwind CSS)

1. **Struktur Direktori**:
   - `client/src/pages/`: Halaman utama aplikasi (Kasir POS, Akuntansi, Servis, Inventaris, Supplier, Pelanggan, Laporan, PPOB, Pengaturan, Shift).
   - `client/src/components/`: Komponen modal interaktif (Pembayaran, Retur, Kasbon, Cetak Struk, Tambah Pelanggan On-the-fly, Operasional Kas).
   - `client/src/context/AuthContext.tsx`: Mengelola status login, session operator aktif, dan pergantian user ber-PIN.
2. **Navigasi Responsif**:
   - Desktop: Sidebar vertikal dengan ikon dan status shift.
   - Mobile: Bottom Navigation Bar + Header ringkas ramah sentuhan.
3. **Penyajian Web Produksi**:
   - Hasil kompilasi Vite disimpan di direktori `dist/`.
   - Node.js Express bertindak sebagai static server untuk `dist/` dan menyediakan fallback HTML5 History API untuk SPA routing.
