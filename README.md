# 🛒 POS IPAY - Sistem Hybrid Web POS & Integrasi PPOB (`ipay.my.id`)

[![Test Suite](https://img.shields.io/badge/Tests-4%2F4%20Passing%20(100%25)-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20POS%20%7C%20PWA%20Ready-blue.svg)]()
[![Accounting](https://img.shields.io/badge/Accounting-Double--Entry%20Automated-purple.svg)]()
[![Database](https://img.shields.io/badge/Database-SQLite%20WAL%20Mode-orange.svg)]()

Aplikasi Kasir Web POS modern terpadu setara minimarket modern (Indomaret / Alfamart) dan konter handphone yang terintegrasi penuh dengan ekosistem produk digital **`ipay.my.id` (GarudaTel Engine)**. Didukung pembukuan akuntansi berpasangan (*Double-Entry Bookkeeping*) otomatis, manajemen inventaris Multi-Satuan (Multi-UOM), harga bertingkat grosir, pelacakan kedaluwarsa FEFO, manajemen IMEI smartphone, servis HP & gadget, plafon kasbon pelanggan, hutang supplier, serta rekonsiliasi shift kasir (X/Z-Report).

---

## 📑 Daftar Isi
- [Fitur Utama](#-fitur-utama)
  - [1. Layar Kasir Terpadu (Single Pane of Glass)](#1-layar-kasir-terpadu-single-pane-of-glass)
  - [2. Ekosistem Produk Digital PPOB (ipay.my.id)](#2-ekosistem-produk-digital-ppob-ipaymyid)
  - [3. Konter Handphone & Service Desk Gadget](#3-konter-handphone--service-desk-gadget)
  - [4. Modul Inventaris Multi-Satuan & FEFO](#4-modul-inventaris-multi-satuan--fefo)
  - [5. Pelanggan & Plafon Kasbon (Credit Limit)](#5-pelanggan--plafon-kasbon-credit-limit)
  - [6. Supplier & Pelunasan Hutang Usaha](#6-supplier--pelunasan-hutang-usaha)
  - [7. Pembukuan Akuntansi Double-Entry & Day-1 Setup](#7-pembukuan-akuntansi-double-entry--day-1-setup)
  - [8. Sesi Shift Kasir & Rekonsiliasi Laci](#8-sesi-shift-kasir--rekonsiliasi-laci)
- [Arsitektur & Tech Stack](#-arsitektur--tech-stack)
- [Bagan Akun Akuntansi (Chart of Accounts)](#-bagan-akun-akuntansi-chart-of-accounts)
- [Petunjuk Instalasi & Menjalankan](#-petunjuk-instalasi--menjalankan)
- [Akun Pengguna Bawaan (RBAC)](#-akun-pengguna-bawaan-rbac)
- [Integrasi API PPOB ipay.my.id](#-integrasi-api-ppob-ipaymyid)
- [Suite Pengujian Otomatis (Automated Tests)](#-suite-pengujian-otomatis-automated-tests)

---

## 🚀 Fitur Utama

### 1. Layar Kasir Terpadu (*Single Pane of Glass*)
* **Keranjang Belanja Hibrida (*Hybrid Cart*):** Menggabungkan scan barcode barang fisik toko dan produk digital PPOB (pulsa, token PLN, e-wallet, paket data, tagihan bulanan) ke dalam **satu transaksi dan satu kertas struk**.
* **Pintasan Keyboard Cepat (*Minimarket Hotkeys*):**
  * <kbd>F1</kbd>: Fokus instan ke scanner barcode
  * <kbd>F2</kbd>: Buka pencarian katalog ritel
  * <kbd>F4</kbd>: Buka menu cepat PPOB digital `ipay.my.id`
  * <kbd>F8</kbd>: Tahan & Panggil Transaksi (*Hold & Recall Bill*)
  * <kbd>F9</kbd>: Diskon transaksi
  * <kbd>F10</kbd>: Mutasi uang laci kasir (*Cash In / Cash Out*)
  * <kbd>F12</kbd>: Pembayaran / Checkout
  * <kbd>Esc</kbd>: Tutup modal / Reset form
* **Multi-Payment & Split Payment:** Mendukung Tunai (kalkulator kembalian otomatis), QRIS Dinamis, Kartu Debit/Kredit EDC, Kasbon Pelanggan, dan Pembayaran Campuran (*Split Pay*).
* **Thermal Printer Engine (58mm & 80mm):** Struk rapi standar ritel, mencetak Serial Number (SN) / Token PLN 20-digit, dukungan buka laci otomatis (*RJ11 Cash Drawer Kick*), dan kirim nota via WhatsApp.

---

### 2. Ekosistem Produk Digital PPOB (`ipay.my.id`)
* **Dual-Mode Engine:**
  * **Built-in Sandbox Simulator:** Dilengkapi generator token PLN 20-digit otomatis, validasi inquiry meteran, simulasi status pending/gagal, dan pengujian webhook tanpa memotong saldo asli.
  * **Live Production Mode:** Terhubung langsung ke API resmi `https://ipay.my.id` dengan autentikasi `X-API-KEY`, MD5 signature, dan Idempotency Key (`ref_id`) anti-transaksi dobel.
* **Widget Saldo Real-Time:** Menampilkan saldo aktif `ipay.my.id` di bilah atas (*top bar*) kasir dengan peringatan dini (*Low Balance Alert*) jika saldo di bawah batas aman.
* **Auto-Pricing Markup Rules:** Atur margin keuntungan toko secara global atau per-produk (Nominal Tetap / Persentase). Jika harga modal dari provider naik, harga jual kasir otomatis menyesuaikan.
* **Inquiry Tagihan Pascabayar:** Cek nama pemilik dan jumlah tagihan PLN, PDAM, BPJS, dan tagihan bulanan secara akurat sebelum pembayaran.
* **Auto-Reversal Webhook:** Jika transaksi berstatus `PENDING` berubah menjadi `FAILED`, sistem secara otomatis membalikkan jurnal akuntansi dan mengembalikan saldo deposit.

---

### 3. Konter Handphone & Service Desk Gadget
* **Pelacakan IMEI / Serial Number:** Penjualan smartphone baru/bekas mewajibkan input nomor IMEI yang otomatis tertera pada struk dan kartu garansi resmi.
* **Siklus Hidup Servis Lengkap (*Service Desk Lifecycle*):**
  * Formulir penerimaan perangkat: Merk/tipe HP, IMEI/SN, kelengkapan, pola/sandi kunci layar, dan keluhan kerusakan.
  * Uang Muka (*Down Payment* / DP): Otomatis mencatat kas masuk dan membukukan jurnal titipan uang muka.
  * Pelacak Status: `PENDING` &rarr; `PROCESSING` &rarr; `WAITING_PARTS` &rarr; `COMPLETED` &rarr; `PICKED_UP` &rarr; `CANCELLED`.
  * Cetak Tanda Terima Servis (SPK) saat unit masuk dan Nota Pelunasan dengan klausul garansi servis 7 hari saat unit diambil.

---

### 4. Modul Inventaris Multi-Satuan & FEFO
* **Multi-Satuan (Multi-UOM):** Jual barang dalam satuan *Pcs*, *Pack*, *Renceng*, hingga *Dus*. Sistem otomatis mengonversi dan memotong stok satuan dasar secara presisi.
* **Harga Bertingkat Grosir (*Tiered Wholesale Pricing*):** Potongan harga otomatis saat kuantitas beli bertambah (contoh: beli $\ge$ 10 pcs harga otomatis turun).
* **Pelacakan Batch & FEFO (*First Expired, First Out*):** Deteksi dini barang mendekati kedaluwarsa dengan indikator warna visual (30, 60, dan 90 hari).
* **Stock Opname Interaktif:** Audit fisik stok toko dengan barcode scanner, perbandingan otomatis dengan sistem, dan auto-journaling selisih persediaan (*Shrinkage / Surplus*).
* **Banner Valuasi Aset Inventaris:** Menghitung total modal HPP yang tertanam di barang, total potensi nilai omzet jual, dan estimasi laba kotor toko secara real-time.

---

### 5. Pelanggan & Plafon Kasbon (*Credit Limit*)
* **Plafon Kredit Pelanggan:** Batasi maksimal nominal kasbon per pelanggan. Kasir otomatis diblokir jika transaksi melebihi limit kredit.
* **Pelunasan & Cicilan Kasbon:** Pembayaran kasbon bisa dicicil atau lunas via Tunai Kasir, Transfer Bank, atau QRIS.
* **Sinkronisasi Kas Kasir:** Pelunasan tunai otomatis tercatat ke `shift_cash_logs` (jenis `CASH_IN`) sehingga uang fisik di laci kasir saat tutup shift (*Z-Report*) tidak selisih.
* **Bukti Pembayaran Kasbon Termal:** Mencetak nomor nota pelunasan, nama pelanggan, nominal bayar, dan sisa hutang terbaru.
* **Proteksi Anti-Fraud:** Pelanggan dengan saldo kasbon aktif dilarang keras untuk dihapus.

---

### 6. Supplier & Pelunasan Hutang Usaha
* **Master Data Mitra Supplier:** Menyimpan nama vendor, kontak PIC (*Salesman*), no WhatsApp, alamat, dan data rekening bank tujuan transfer.
* **Alur Bayar Hutang Supplier:**
  * **Tunai (Laci Kasir):** Otomatis mencatat kas keluar (`CASH_OUT`) dari laci kasir shift aktif dan memotong uang fisik yang diharapkan (*expected cash*).
  * **Transfer Bank:** Memotong saldo rekening Bank Toko (`1-1002`) tanpa mengganggu uang laci kasir.
* **Auto-Journaling:** Debit Hutang Usaha (`2-1001`), Kredit Kas Laci (`1-1001`) atau Bank (`1-1002`).
* **Bukti Pengeluaran Kas Termal (Voucher 58mm/80mm):** Dilengkapi rincian pembayaran, sisa hutang, dan kolom tanda tangan kasir & supplier.

---

### 7. Pembukuan Akuntansi Double-Entry & Day-1 Setup
Pemisahan akuntansi mutlak antara kas laci fisik, kas bank, dan saldo deposit PPOB:

$$\text{Total Aset (Aktiva)} = \text{Total Hutang (Liabilitas)} + \text{Modal Pemilik (Ekuitas)}$$

* **Wizard Setup Saldo Awal (Day 1):** Fitur inisialisasi pembukuan saat pertama kali toko menggunakan aplikasi:
  * Tombol 1-klik **"Tarik Total HPP Modal Katalog"** untuk menghitung modal persediaan barang di rak toko.
  * Input modal kas di laci kasir, rekening bank, deposit PPOB, rincian hutang supplier, dan rincian kasbon pelanggan.
  * Sistem otomatis menghitung **Modal Disetor Pemilik (`3-1001`)** sehingga neraca hari pertama langsung seimbang 100% (*Balanced*).
* **Live Status Banner Rekonsiliasi:** Memantau 4 pilar sinkronisasi secara real-time:
  1. Neraca Saldo Seimbang ($\sum \text{Debit} == \sum \text{Credit}$).
  2. Persediaan Fisik vs HPP Katalog Produk.
  3. Piutang Pelanggan vs Saldo Akun `1-1004`.
  4. Hutang Supplier vs Saldo Akun `2-1001`.
* **Buku Besar Interaktif (*General Ledger*):** Kartu mutasi lengkap per akun dengan pencatatan saldo akhir berjalan (*running balance*).
* **Laporan Laba-Rugi (P&L):** Memisahkan Laba Kotor Ritel, Laba Kotor PPOB, Beban Operasional, dan Laba Bersih Toko.

---

### 8. Sesi Shift Kasir & Rekonsiliasi Laci
* Buka kasir dengan input modal awal receh laci.
* Pencatatan kas masuk / kas keluar operasional toko (<kbd>F10</kbd>).
* Penutupan shift kasir dengan perhitungan uang fisik aktual vs ekspektasi sistem.
* Cetak struk rekapitulasi shift (*X-Report* & *Z-Report*).

---

## 🛠️ Arsitektur & Tech Stack

```
pos-ipay/
├── client/                 # Frontend React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/     # TopBar, Sidebar, BottomNav, Modals
│   │   ├── context/        # AuthContext, CartContext, PPOBContext
│   │   ├── pages/          # CashierPOS, Inventory, PPOBManager, Accounting,
│   │   │                   # Customer, Supplier, Service, Shift, Reports, Settings
│   │   └── types/          # TypeScript Domain Interfaces
├── server/                 # Backend Node.js Express + TypeScript
│   ├── db/
│   │   ├── database.ts     # SQLite Initializer with WAL Mode & Foreign Keys
│   │   ├── schema.sql      # DDL Schema, Indexes, & Relations
│   │   └── seed.ts         # Initial Database Seeder
│   ├── routes/
│   │   └── api.ts          # Unified REST API Router
│   ├── services/           # Service-Oriented Business Logic
│   │   ├── accounting.ts   # Double-Entry Auto-Journaling & Reconciliation
│   │   ├── inventory.ts    # Multi-UOM & Moving Average Valuation
│   │   ├── ppob.ts         # ipay.my.id Integration & Webhook Handler
│   │   ├── ppob-simulator.ts # Built-in Sandbox Testing Simulator
│   │   ├── printer.ts      # ESC/POS Thermal 58mm/80mm Formatting Engine
│   │   ├── service-desk.ts # Phone Repair Order Lifecycle Management
│   │   └── shift.ts        # Cashier Shift & Drawer Balancing
│   └── tests/              # 4 Automated Integration Test Suites
├── data/                   # SQLite database storage (pos.db in WAL mode)
└── start-pos.bat           # 1-Click Launcher untuk Windows
```

---

## 📊 Bagan Akun Akuntansi (*Chart of Accounts*)

| Kode Akun | Nama Akun | Tipe | Saldo Normal | Keterangan Sistem |
| :--- | :--- | :--- | :--- | :--- |
| `1-1001` | Kas Laci Kasir | ASSET | DEBIT | Uang tunai fisik di laci kasir |
| `1-1002` | Kas Bank Toko / EDC | ASSET | DEBIT | Penerimaan transfer bank, QRIS, dan EDC |
| `1-1003` | Deposit Saldo PPOB (`ipay.my.id`) | ASSET | DEBIT | Saldo modal digital terpotong saat transaksi digital sukses |
| `1-1004` | Piutang Usaha / Kasbon | ASSET | DEBIT | Tagihan kasbon pelanggan |
| `1-1005` | Persediaan Barang Dagangan | ASSET | DEBIT | Nilai HPP barang fisik di rak toko |
| `2-1001` | Hutang Usaha Supplier | LIABILITY | KREDIT | Tagihan faktur dari supplier |
| `2-1002` | Uang Muka Servis (DP) | LIABILITY | KREDIT | Titipan uang muka pengerjaan servis HP |
| `3-1001` | Modal Pemilik | EQUITY | KREDIT | Ekuitas bersih modal awal toko |
| `4-1001` | Pendapatan Penjualan Ritel | REVENUE | KREDIT | Omzet penjualan barang fisik |
| `4-1002` | Pendapatan Penjualan PPOB | REVENUE | KREDIT | Omzet penjualan pulsa, token, dan tagihan |
| `4-1003` | Pendapatan Jasa Servis | REVENUE | KREDIT | Pendapatan jasa reparasi handphone |
| `5-1001` | HPP Barang Dagangan Ritel | EXPENSE | DEBIT | Beban pokok barang fisik yang terjual |
| `5-1002` | HPP Produk Digital PPOB | EXPENSE | DEBIT | Beban pokok saldo deposit terpakai |
| `5-1003` | Beban Selisih Kas / Operasional | EXPENSE | DEBIT | Penyesuaian selisih uang laci kasir |

---

## 💻 Petunjuk Instalasi & Menjalankan

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) v18+ atau versi lebih tinggi
* npm (disertakan bersama Node.js)
* Git

### 2. Kloning Repositori
```bash
git clone https://github.com/angga2103/Ipay-POS.git
cd Ipay-POS
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Inisialisasi Database & Seeding Data
```bash
npm run seed
```
*Perintah ini akan membuat database SQLite `data/pos.db` dengan mode WAL, mengisi Bagan Akun (COA), pengguna default multi-role, katalog produk sembako minimarket, Multi-UOM, dan produk PPOB bawaan.*

### 5. Menjalankan Aplikasi
* **Menggunakan Shortcut Windows (1-Klik):**
  Klik ganda pada file `start-pos.bat`.
* **Menggunakan Terminal / CLI:**
  ```bash
  npm run dev
  ```

Buka peramban (*browser*) Anda:
* **Frontend Kasir POS:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:3001/api](http://localhost:3001/api)
* **PPOB Webhook Endpoint:** [http://localhost:3001/api/ppob/webhook](http://localhost:3001/api/ppob/webhook)

---

## 👤 Akun Pengguna Bawaan (RBAC)

Sistem telah dilengkapi dengan otentikasi kata sandi dan **Quick PIN Login** kasir:

| Role | Username | Password | PIN Kasir | Hak Akses Utama |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | `owner` | `admin123` | `112233` | Akses penuh seluruh sistem, pengaturan API PPOB, setup saldo awal, laporan laba rugi |
| **Supervisor** | `spv` | `spv123` | `223344` | Katalog produk, Stock Opname, persetujuan pembatalan transaksi (*Void Approval*) |
| **Kasir** | `kasir1` | `kasir123` | `123456` | Transaksi kasir, buka/tutup shift laci, transaksi PPOB, cetak struk |

---

## 🔌 Integrasi API PPOB ipay.my.id

Untuk menghubungkan aplikasi kasir ke server live `ipay.my.id`:

1. Buka menu **PPOB & Saldo** (`/ppob`) pada aplikasi POS.
2. Pada bagian **Konfigurasi API ipay.my.id**, masukkan parameter:
   * **Mode**: `live` (atau `sandbox` untuk simulasi lokal).
   * **Base URL**: `https://ipay.my.id`
   * **Merchant ID**: Masukkan ID Merchant Anda (contoh: `IPAY_MCH_...`).
   * **API Key**: Masukkan API Key Anda (`X-API-KEY`).
   * **Secret Key**: Masukkan Secret Key untuk enkripsi signature MD5.
3. Klik **Simpan Pengaturan**, lalu klik **Uji Koneksi API**.
4. **URL Callback Webhook:** Daftarkan URL berikut pada panel admin `ipay.my.id`:
   ```
   http://<domain-atau-ip-pos-anda>:3001/api/ppob/webhook
   ```

---

## 🧪 Suite Pengujian Otomatis (*Automated Tests*)

Sistem telah dilengkapi dengan 4 suite pengujian integrasi otomatis end-to-end yang menguji keabsahan logika bisnis secara menyeluruh:

```bash
npm test
```

### Hasil Pengujian yang Dijalankan:
1. **Core POS & Unified Ledger Test (`run-tests.ts`):**
   * Auto-journaling hibrida ritel & PPOB dalam 1 transaksi.
   * Multi-UOM stock conversion (pengurangan Dus menjadi Pcs dasar).
   * Tiered wholesale pricing calculation.
   * Moving Average inventory costing.
   * PPOB sandbox purchase & webhook auto-reversal pada transaksi gagal.
   * Keseimbangan Neraca Saldo ($\sum \text{Debit} == \sum \text{Credit}$).
2. **Konter HP & Service Desk Test (`test-konter-service.ts`):**
   * Multi-role quick PIN authentication.
   * Penjualan unit smartphone dengan tracking nomor IMEI/SN & cetak struk thermal.
   * Siklus lengkap servis HP: DP, progress servis, pelunasan sisa biaya, garansi 7 hari, dan auto-journaling jasa servis.
3. **Pelanggan & Kasbon Test (`test-customer-kasbon.ts`):**
   * Setup Saldo Awal (Day 1) neraca pembuka.
   * Valuasi total nominal inventaris HPP vs total potensi omzet jual.
   * Pembuatan pelanggan & validasi batas plafon kasbon.
   * Pelunasan kasbon dengan auto-sync uang laci kasir & cetak struk nota kasbon termal.
   * Proteksi anti-fraud penghapusan pelanggan berhutang aktif.
4. **Supplier & Day-1 Sync Test (`test-supplier-and-day1-sync.ts`):**
   * Master supplier & info rekening bank pembayaran.
   * Pelunasan hutang supplier via Tunai Kasir (memotong *expected cash* laci kasir).
   * Pelunasan hutang supplier via Transfer Bank (memotong rekening bank).
   * Cetak Bukti Pengeluaran Kas (Voucher Termal 58mm/80mm) dengan kolom tanda tangan.
   * Live Status Banner: Verifikasi 4 pilar rekonsiliasi saldo awal Day 1.
   * Proteksi penghapusan data supplier berhutang aktif & arsip soft-delete.

---

## 📄 Lisensi
Hak Cipta © 2026 POS IPAY. Didistribusikan di bawah lisensi ISC.
