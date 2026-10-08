# 📜 POS IPAY - CODING & ARCHITECTURAL RULES (RULES.md)

Dokumen ini adalah **panduan aturan mutlak (Rules of Engagement)** untuk seluruh pengembang dan asisten AI yang bekerja pada codebase **POS IPAY**. Semua aturan di bawah ini **WAJIB dipatuhi tanpa pengecualian** untuk menjaga integritas data, stabilitas pembukuan, keamanan multi-tenant, dan konsistensi sistem.

---

## 1. Aturan Multi-Tenant & Database (KRITIKAL)

1. **JANGAN PERNAH mengakses database SQLite langsung tanpa Tenant Context**:
   - Aplikasi menggunakan arsitektur **Database-per-Tenant** (`data/tenants/<tenant_id>.db` dan `data/pos.db` untuk default).
   - Selalu gunakan `db` dari `server/db/database.ts` yang merupakan transparent proxy yang otomatis me-resolve database tenant yang sedang aktif melalui `tenantContext.getStore()`.
   - Jika membuat script standalone atau background task, bungkus proses di dalam:
     ```ts
     await tenantContext.run({ tenantId, db: getTenantDatabase(tenantId) }, async () => {
       // Operasi database
     });
     ```
2. **Sinkronisasi Skema Ganda**:
   - Setiap penambahan tabel atau kolom baru **WAJIB** ditambahkan di DUA tempat:
     1. `server/db/schema.sql` (untuk tenant default / instalasi baru).
     2. `initTenantDatabase()` di `server/db/tenant.ts` (untuk tenant yang baru di-provisioning).
   - Selalu gunakan klausa `CREATE TABLE IF NOT EXISTS` dan `ALTER TABLE ... ADD COLUMN` yang ramah migrasi agar tidak merusak data produksi yang sudah berjalan.
3. **Penyimpanan Angka Rupiah**:
   - Simpan semua nilai uang dalam satuan integer penuh (`INTEGER` atau `REAL` tanpa desimal receh).
   - Format tampilan ke pengguna menggunakan `toLocaleString('id-ID')`.

---

## 2. Aturan Pembukuan Akuntansi Double-Entry (SISTEM KEUANGAN)

Sistem POS IPAY terikat pada **Standar Akuntansi Keuangan (SAK ETAP)**:
1. **Prinsip Keseimbangan Mutlak**:
   - Setiap transaksi finansial (penjualan, retur, pengeluaran kas, deposit, pelunasan kasbon, pembelian supplier) **WAJIB** mencatat jurnal umum dengan `total_debit === total_credit`.
   - Dilarang keras membuat entri jurnal yang debit dan kreditnya tidak seimbang.
2. **Bagan Akun Standar (COA)**:
   - `1-1001`: Kas Laci Kasir (Cash on Hand / Kas Fisik Shift)
   - `1-1002`: Bank Toko (BCA / QRIS / Rekening Giro)
   - `1-1003`: Saldo Deposit PPOB (Saldo Virtual di ipay.my.id)
   - `1-1004`: Piutang Usaha (Pelanggan Kasbon)
   - `1-1005`: Persediaan Barang Dagangan (Nilai Aset Inventory Toko)
   - `2-1001`: Hutang Usaha Supplier (Kewajiban Pembelian Tempo)
   - `3-1001`: Modal Awal / Ekuitas Pemilik
   - `3-2001`: Laba Ditahan (Retained Earnings)
   - `4-1001`: Pendapatan Penjualan Ritel Toko
   - `4-1002`: Pendapatan Transaksi PPOB
   - `4-1003`: Pendapatan Jasa Servis HP / Gadget
   - `4-1004`: Pendapatan Lain-lain (Hasil jual kardus, jasa titip, dll.)
   - `5-1001`: HPP (Harga Pokok Penjualan) Ritel
   - `5-1002`: HPP Transaksi PPOB (Modal Pulsa/Token dari Provider)
   - `5-1003`: Biaya Sparepart Servis HP
   - `6-1001`: Beban Operasional Toko (Listrik, Plastik, Operasional)
   - `6-1002`: Beban Gaji Karyawan
   - `6-1003`: Beban Sewa & Fasilitas Toko
3. **Sinkronisasi Kas Laci dengan Shift Kasir**:
   - Jika suatu transaksi operasional/penjualan menggunakan akun `1-1001` (Kas Laci Kasir), nilai kas fisik shift yang sedang aktif **WAJIB** disinkronkan melalui pembaruan `expected_cash_end` / `cash_in` / `cash_out` pada tabel `shifts`.

---

## 3. Aturan Transaksi PPOB (ipay.my.id)

1. **Alur Tiket Deposit**:
   - Pembuatan tiket deposit **DILARANG KERAS** langsung menambah saldo `1-1003`.
   - Tiket deposit baru **WAJIB** berstatus `PENDING`.
   - Saldo deposit dan pencatatan kas keluar/debit `1-1003` **HANYA BOLEH** bertambah setelah ada persetujuan resmi dari admin (`/api/ppob/deposit/:refId/approve`).
2. **Transaksi Produk Digital & SN/Token**:
   - Jika transaksi berstatus `SUCCESS`, Token / Serial Number (SN) **WAJIB** disimpan di kolom `ppob_sn_token`.
   - Format struk thermal dan WhatsApp wajib menampilkan Token / SN dalam blok khusus yang jelas terbaca oleh pelanggan.
3. **Background Auto-Poller**:
   - Transaksi PPOB dengan status `PENDING` diperiksa statusnya secara otomatis setiap 20 detik oleh poller di `server/index.ts`. Jaga poller tetap efisien dan tidak blocking.

---

## 4. Aturan Keamanan & Hak Akses (RBAC)

1. **Pergantian Operator (Switch User)**:
   - Pergantian operator **WAJIB** memvalidasi PIN atau Password melalui endpoint `/api/auth/switch-user-verify`.
   - Dilarang memberikan shortcut pergantian user tanpa otentikasi.
2. **Level Role Pengguna**:
   - `ADMIN` / `OWNER`: Hak akses penuh ke Pengaturan, Akuntansi, Laporan, Pembatalan Transaksi, dan Manajemen Operator.
   - `CASHIER`: Terbatas pada Kasir POS, Kasbon, Shift Kasir, Riwayat Cetak Struk, dan Layanan Cepat PPOB.
   - `TECHNICIAN`: Terbatas pada Antrian Servis HP, input sparepart, dan ubah status pengerjaan servis.
3. **Pencegahan Kehilangan Data (Data Loss Prevention)**:
   - Pelanggan yang masih memiliki sisa hutang kasbon (`debt > 0`) **DILARANG DIHAPUS**.
   - Supplier yang masih memiliki sisa hutang (`current_debt > 0`) **DILARANG DIHAPUS**.
   - Jika pelanggan/supplier memiliki riwayat transaksi lama, gunakan soft delete (`is_active = 0`).

---

## 5. Aturan Frontend & Desain UI (React 19 + Tailwind CSS)

1. **Responsivitas Mobile-First**:
   - Semua halaman dan modal harus nyaman diakses dari layar smartphone (lebar 360px - 412px) hingga desktop widescreen (1920px).
   - Jangan pernah menggunakan fixed pixel lebar berlebih tanpa fallback `w-full max-w-lg`.
2. **Struk Cetak & Format WhatsApp**:
   - Struk thermal mendukung dua standar: `58mm` (standar) dan `80mm` (lebar).
   - Gunakan font monospace (`font-mono`) untuk preview thermal receipt.
   - Teks pesan WhatsApp harus memuat header toko resmi, detail per item, kotak ASCII untuk token PLN/SN, dan catatan status lunas yang jelas.
3. **Kompilasi Produksi**:
   - Setelah mengedit kode di `client/`, **SELALU** jalankan `npm run build` sebelum mendeploy ke server produksi.
   - Server Node.js Express menyajikan bundle frontend dari direktori `dist/`. Jika `dist/` belum di-build ulang, VPS akan tetap menampilkan UI lama!

---

## 6. Aturan Pengujian Kode (Testing Suite)

1. **Jalankan `npm test` Sebelum Commit**:
   - Test suite di `server/tests/` mencakup:
     - `test-konter-service.ts`
     - `test-customer-kasbon.ts`
     - `test-supplier-and-day1-sync.ts`
     - `test-backup-system.ts`
     - `test-multitenant.ts`
     - `test-retur-and-operational.ts`
2. Semua tes wajib menghasilkan **100% PASS (Exit code 0)** sebelum kode di-push ke branch `main`.
