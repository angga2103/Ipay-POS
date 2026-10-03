# 🚀 Panduan Deployment VPS (One-Click Installer) - POS IPAY

Dokumen ini merinci langkah-langkah instalasi otomatis aplikasi **POS IPAY** pada server VPS (Ubuntu 20.04/22.04 LTS atau Debian 11/12) menggunakan skrip installer satu klik (`install.sh`), terintegrasi dengan **Cloudflare Zero Trust Tunnel**, **Systemd Daemon**, dan **Sistem Dinamis Auto-Backup Database**.

---

## 📋 Persyaratan Minimal Server VPS
* **Sistem Operasi**: Ubuntu 20.04 LTS / 22.04 LTS atau Debian 11 / 12
* **RAM**: Minimal 1 GB (Direkomendasikan 2 GB)
* **Penyimpanan**: Minimal 10 GB SSD
* **Akses**: User `root` atau user dengan hak akses `sudo`

---

## ⚡ Langkah Cepat Deployment (3 Langkah)

### 1. Hubungkan ke Server VPS via SSH
```bash
ssh root@IP_VPS_ANDA
```

### 2. Kloning Repositori ke Direktori Web
```bash
git clone https://github.com/angga2103/Ipay-POS.git /var/www/pos-ipay
cd /var/www/pos-ipay
```

### 3. Jalankan Skrip Instalasi Satu Klik
```bash
sudo bash install.sh
```

---

## 🌐 Tahapan Instalasi Otomatis & Cloudflare Zero Trust

Saat skrip berjalan, installer akan meminta 2 input interaktif:

### 1. Token Cloudflare Zero Trust Tunnel (Opsional)
Menghubungkan domain ke server kasir tanpa perlu membuka port firewall (Port 80/443 tetap tertutup aman):
1. Buka dashboard Cloudflare: **Zero Trust &rarr; Networks &rarr; Tunnels &rarr; Add a tunnel**.
2. Pilih tipe **Cloudflared**, beri nama tunnel (misal: `pos-minimarket`), lalu salin **Tunnel Token** yang muncul.
3. Token diawali dengan: `eyJhIjoiMTgyYT...`
4. Tempel token saat installer memintanya di terminal.

### 2. Domain Utama Anda (Opsional)
* Masukkan nama domain/subdomain yang Anda gunakan (contoh: `pos.garudatel.com` atau `kasir.toko.com`).
* Pada Dashboard Cloudflare Tunnel, tambahkan **Public Hostname**:
  * **Subdomain / Domain**: `pos.garudatel.com`
  * **Service Type**: `HTTP`
  * **URL**: `localhost:3001`

*(Catatan: Jika token dilewati, aplikasi kasir tetap aktif di port `3001` dan dapat diakses langsung via IP VPS atau dipasangkan Nginx reverse-proxy secara manual).*

---

## 📦 Apa Saja yang Dikonfigurasi Otomatis oleh Skrip?

Skrip `install.sh` menjalankan 9 tahapan otomatis:
1. **Pemeriksaan Hak Akses & Direktori FHS**: Memastikan script dijalankan dengan hak root di path `/var/www/pos-ipay`.
2. **Pembersihan APT Lock**: Melepaskan lock APT otomatis jika VPS sedang menjalankan update background.
3. **Instalasi Dependensi Sistem**: Memasang `curl`, `git`, `build-essential`, `sqlite3`, dan `cron`.
4. **Instalasi Node.js 20 LTS**: Memasang runtime Node.js resmi dari repository NodeSource.
5. **Kompilasi Frontend Production**: Menjalankan `npm install` dan mengompilasi bundel Vite React 19 ke folder `dist/`.
6. **Inisialisasi Database SQLite WAL**: Membuat database `data/pos.db` dengan WAL mode dan menjalankan initial seed.
7. **Pendaftaran Systemd Service Daemon**: Membuat service `/etc/systemd/system/pos-ipay.service` dengan proteksi auto-restart saat crash atau server reboot.
8. **Konfigurasi Auto-Backup Harian (Crontab)**: Menjadwalkan script `/var/www/pos-ipay/backup.sh` setiap jam 02:00 malam dengan rotasi 30 hari.
9. **Koneksi Cloudflare Tunnel & Sertifikasi**: Menginstal daemon `cloudflared` dan melakukan pengujian *health check* ke endpoint `http://localhost:3001/health`.

---

## 💾 Sistem Dinamis Auto-Backup & Pemulihan

Selain backup cron harian di tingkat OS, aplikasi POS IPAY telah dilengkapi dengan **Sistem Dinamis Auto-Backup di Antarmuka Web**:

### Cara Mengelola Backup dari Layar Kasir:
1. Masuk ke Web POS sebagai **Owner**.
2. Buka menu **Pengaturan** (`/settings`).
3. Pada kartu **Sistem Dinamis Auto-Backup & Pemulihan Database**, Anda dapat:
   * **Mengubah Frekuensi**: Setiap 1 Jam, Setiap 6 Jam, Setiap 12 Jam, Harian, atau Mingguan.
   * **Mengatur Retensi**: Simpan 7, 14, 30, atau 60 hari terakhir.
   * **Backup 1-Klik**: Klik tombol **"Backup Database Sekarang"** kapan saja sebelum melakukan perubahan besar.
   * **Unduh File Backup**: Klik tombol **Unduh** pada daftar snapshot untuk menyimpan file `.db` ke flashdisk atau komputer kasir.
   * **Pemulihan Darurat (Restore)**: Klik tombol **Pulihkan** untuk mengembalikan seluruh data toko dari file snapshot terpilih secara instan.

---

## 🛠️ Perintah Berguna untuk Manajemen Server

* **Mengecek Status Aplikasi**:
  ```bash
  systemctl status pos-ipay
  ```
* **Melihat Log Real-time**:
  ```bash
  journalctl -u pos-ipay -f
  ```
* **Merestart Aplikasi**:
  ```bash
  systemctl restart pos-ipay
  ```
* **Mengecek Status Cloudflare Tunnel**:
  ```bash
  systemctl status cloudflared
  ```
* **Menjalankan Backup Manual via Terminal**:
  ```bash
  bash /var/www/pos-ipay/backup.sh
  ```

---

## 👤 Kredensial Login Default
* **Owner**: `owner` | Password: `admin123` | PIN: `112233`
* **Supervisor**: `spv` | Password: `spv123` | PIN: `223344`
* **Kasir**: `kasir1` | Password: `kasir123` | PIN: `123456`
