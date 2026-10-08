# 📖 POS IPAY - PANDUAN LENGKAP FITUR SISTEM (PANDUAN_FITUR.md)

Dokumen ini merinci seluruh fitur fungsional yang tersedia di aplikasi **POS IPAY** beserta panduan penggunaannya bagi Operator, Kasir, Teknisi, dan Owner.

---

## 1. Fitur Kasir POS (Point of Sale) & Penjualan Cepat
- **Pencarian Produk**: Barcode scanner, pencarian nama barang, filter kategori, dan pencarian nomor IMEI/Serial Number.
- **Hold & Recall Transaksi**: Menahan transaksi keranjang sementara saat pelanggan mengambil barang tambahan, lalu memanggilnya kembali.
- **Diskon Fleksibel**: Diskon per item atau diskon global transaksi (persen atau nominal rupiah).
- **Multi Metode Pembayaran**:
  - `CASH` (Tunai) &rarr; Dilengkapi kalkulator kembalian dan sinyal RJ11 buka laci kasir otomatis.
  - `BANK_TRANSFER` / `QRIS` &rarr; Sinkronisasi ke akun Bank Toko (`1-1002`).
  - `KASBON` &rarr; Piutang pelanggan terdaftar.
  - `SPLIT` &rarr; Pembayaran gabungan tunai + non-tunai.

---

## 2. Fitur Kasbon & Tambah Pelanggan Instan (On-the-Fly)
- **Limit Piutang**: Setiap pelanggan memiliki limit kredit kasbon maksimal.
- **Pendaftaran Pelanggan Baru dari Layar Kasir**:
  - Saat memilih metode Kasbon, kasir dapat langsung mengklik tombol **"+ Pelanggan Baru"**.
  - Masukkan Nama, Nomor WhatsApp, Limit Kasbon, dan Alamat tanpa perlu berpindah halaman.
  - Pelanggan baru langsung aktif dan otomatis terpilih untuk transaksi tersebut.
- **Riwayat & Pelunasan Piutang**: Riwayat hutang per pelanggan, pembayaran sebagian/lunas, dan cetak struk pelunasan kasbon.

---

## 3. Fitur Retur Penjualan (Sales Return)
- **Akses**: Tombol **Retur** tersedia pada setiap invoice lunas di menu Laporan Transaksi.
- **Pilihan Barang & Qty**: Kasir dapat memilih barang spesifik dan kuantitas yang ingin diretur (tidak harus meretur seluruh isi nota).
- **Metode Pengembalian Dana**:
  - *Tunai (Kas Laci)* &rarr; Mengurangi kas laci fisik shift kasir saat ini.
  - *Potong Piutang (Kasbon)* &rarr; Memotong saldo hutang pelanggan secara otomatis.
- **Restock Otomatis**: Jika opsi *"Kembalikan ke Stok Toko"* dicentang, stok fisik barang bertambah kembali dan HPP dipulihkan di pembukuan akuntansi.
- **Cetak Nota Retur**: Mencetak struk bukti retur barang resmi bertanda tangan.

---

## 4. Fitur Pengeluaran Operasional & Pemasukan Lain-Lain
- **Akses**: Tombol **Catat Kas Masuk/Keluar** di kasir atau tab **Operasional & Biaya** di menu Akuntansi.
- **Tombol Kategori Cepat**:
  - *Beli Kantong Plastik / ATK*
  - *Biaya Operasional Toko*
  - *Makan / Minum Karyawan*
  - *Listrik / Pulsa Toko*
  - *Hasil Jual Kardus Bekas*
  - *Jasa Titip / Komisi*
- **Keterangan Dinamis**: Pengguna bebas mengetik deskripsi mutasi sesuai kenyataan.
- **Pilihan Sumber Dana**: Kas Laci Kasir (`1-1001`) atau Bank Toko (`1-1002`). Transaksi kas laci langsung menyinkronkan saldo kas pada shift yang sedang berjalan.

---

## 5. Fitur Integrasi PPOB (ipay.my.id)
- **Katalog Lengkap**: Pulsa All Operator, Paket Data, Token PLN, Tagihan PLN Pascabayar, PDAM, BPJS, E-Money (Dana, Gopay, Ovo, ShopeePay, Maxim, dll.), Voucher Game.
- **Alur Deposit Aman (Perbaikan Bug)**:
  - Tiket deposit baru masuk dengan status `PENDING`.
  - Saldo virtual kasir **tidak bertambah otomatis** sampai tiket diverifikasi dan disetujui (*Approve*) oleh admin di tab Deposit PPOB.
- **Cek Tagihan (Inquiry)**: Menampilkan nama pelanggan, periode tagihan, daya tarif, dan rincian denda sebelum pembayaran.
- **Auto-Poller 20 Detik**: Latar belakang server secara otomatis memperbarui status transaksi pending ke server provider sampai berstatus sukses atau gagal.

---

## 6. Fitur Servis HP & Notifikasi WhatsApp
- **Pelacakan Servis**: Mencatat Merk/Tipe HP, Keluhan Kerusakan, Kelengkapan, Estimasi Biaya, DP, Teknisi Penanggung Jawab, dan Garansi.
- **Alur Status**: `Diterima` &rarr; `Pengecekan` &rarr; `Tunggu Sparepart` &rarr; `Dikerjakan` &rarr; `Siap Diambil` &rarr; `Selesai / Diambil`.
- **Notifikasi WhatsApp Otomatis**:
  - Saat status diubah menjadi **Siap Diambil (`COMPLETED`)**, muncul pop-up berisi pesan WhatsApp yang rapi dan terformat.
  - Tombol 1-klik membuka aplikasi WhatsApp (`wa.me`) dengan nomor tujuan pelanggan yang sudah terisi otomatis.
- **Penggunaan Sparepart**: Pemakaian sparepart toko otomatis memotong stok gudang dan mencatat HPP servis ke jurnal akuntansi.

---

## 7. Fitur Laporan Stok Limit & Peringkat Penjualan
- **Peringkat Penjualan Produk**: Ranking barang terlaris berdasarkan kuantitas unit dan omzet rupiah, dilengkapi filter *Hari Ini*, *Bulan Ini*, atau *Tahun Ini*.
- **Stok Limit / Menipis**: Peringatan stok kritis (`stock <= min_stock`) dengan indikator warna dan tombol cepat restock.
- **Peringkat Pelanggan & Supplier**: Menampilkan pelanggan terloyal dan supplier dengan volume pasokan terbesar.

---

## 8. Fitur Pembukuan Akuntansi (Laba Rugi & Buku Besar)
- **Laporan Laba Rugi Standar**:
  1. Pendapatan Penjualan Bersih
  2. Harga Pokok Penjualan (HPP)
  3. Laba Kotor (Gross Profit)
  4. Beban Operasional Usaha
  5. Pendapatan & Biaya Lain-lain (termasuk hasil jual kardus bekas)
  6. Laba Bersih Berjalan & Persentase Margin
- **Buku Besar (General Ledger)**:
  - 4 Kartu Metrik Ringkas: Saldo Normal, Total Mutasi Debit, Total Mutasi Kredit, Total Mutasi Bersih.
  - Filter interaktif per akun dan rentang tanggal transaksi.
- **Neraca & Neraca Saldo**: Pemantauan aset, kewajiban hutang, dan ekuitas toko yang 100% seimbang.

---

## 9. Fitur Format Struk Thermal & Pesan WhatsApp
- **Struk Thermal**: Preview kertas kasir dengan pilihan lebar kertas `58mm` atau `80mm`, garis potong kertas, dan dukungan print langsung via browser.
- **Pesan WhatsApp Digital**:
  - Header resmi toko dan nomor nota.
  - Pemisahan jelas barang ritel vs produk digital/PPOB.
  - **Kotak Token PLN / Serial Number**: Diformat dengan bingkai ASCII tebal agar pelanggan mudah melihat dan memasukkan 20 digit token listrik:
    ```text
    ┌───────────────────────┐
    │ 🔑 *TOKEN / SERIAL NUMBER:*  │
    │ *1234-5678-9012-3456-7890* │
    └───────────────────────┘
    ```
  - Total bayar, uang diterima, kembalian, dan cap status `LUNAS ✅`.

---

## 10. Fitur Manajemen Operator & Hak Akses (RBAC)
- **Otentikasi Pergantian Kasir (Switch User)**: Mewajibkan memasukkan PIN atau Password sebelum beralih operator.
- **Hak Akses Berjenjang**:
  - `ADMIN`: Akses penuh ke seluruh menu dan pembukuan.
  - `CASHIER`: Kasir POS, Kasbon, Shift, dan PPOB Cepat.
  - `TECHNICIAN`: Antrian servis dan penggunaan sparepart.
- **Supervisor PIN**: Melindungi aksi sensitif kasir seperti pembatalan barang atau pemberian diskon khusus.

---

## 11. Fitur Multi-Supplier & Hutang Usaha
- **Master Supplier**: Nama pemasok, kontak PIC, nomor rekening bank, dan tempo pembayaran.
- **Pencatatan Hutang Pembelian**: Pembelian barang secara tempo otomatis menambah hutang usaha akun `2-1001`.
- **Pelunasan Hutang**: Pembayaran hutang via kas laci atau transfer bank dilengkapi bukti voucher pengeluaran bertanda tangan.

---

## 12. Fitur Auto-Backup Dinamis & Pemulihan
- **Pengaturan dari Web**: Jadwal otomatis setiap 1 Jam, 6 Jam, 12 Jam, Harian, atau Mingguan.
- **Kebijakan Retensi**: Pembersihan otomatis file backup lama (7, 14, 30, atau 60 hari).
- **Unduh & Restore**: Unduh snapshot `.db` kapan saja dan pulihkan database dengan satu klik saat kondisi darurat.
