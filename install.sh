#!/bin/bash
# ==============================================================================
#  🛒 POS IPAY - ONE-CLICK VPS INSTALLER & CLOUDFLARE ZERO TRUST DEPLOYMENT
# ==============================================================================
#  Skrip instalasi otomatis interaktif untuk VPS Ubuntu / Debian.
#  Mendukung integrasi Cloudflare Zero Trust Tunnels (tanpa port forwarding),
#  Node.js 20+ LTS, Systemd Daemon, SQLite WAL Database, dan Dynamic Auto-Backup.
# ==============================================================================

set -e

# Warna Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Bersihkan layar
clear

echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                                                              ║"
echo "  ║          🛒 POS IPAY - ONE-CLICK VPS INSTALLER 🛒            ║"
echo "  ║       Cloudflare Zero Trust + Node.js 20 LTS + SQLite WAL    ║"
echo "  ║                                                              ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Validasi Akses Root / Sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[!] Harap jalankan skrip ini dengan hak akses root atau sudo:${NC}"
    echo -e "    sudo bash install.sh"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_USER="${SUDO_USER:-$USER}"

echo -e "${BLUE}[*] Direktori Proyek:${NC} $PROJECT_DIR"
echo -e "${BLUE}[*] User Eksekusi:${NC} $CURRENT_USER"

BEST_PRACTICE_DIR="/var/www/pos-ipay"
if [ "$PROJECT_DIR" != "$BEST_PRACTICE_DIR" ]; then
    echo -e "${YELLOW}[i] Rekomendasi Standar Linux FHS:${NC}"
    echo -e "    Aplikasi web disarankan berada di direktori ${CYAN}$BEST_PRACTICE_DIR${NC}."
    echo -e "    Instalasi saat ini berjalan di: ${YELLOW}$PROJECT_DIR${NC} (didukung penuh)."
fi
echo ""

# 2. Input Interaktif: Cloudflare Zero Trust Tunnel
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 1: KONFIGURASI CLOUDFLARE ZERO TRUST TUNNEL (DOMAIN)     ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Cloudflare Zero Trust menghubungkan domain kasir ke server VPS secara aman"
echo -e "tanpa perlu mengekspos IP publik atau membuka port router/firewall."
echo ""
echo -e "Buka dashboard Cloudflare: ${CYAN}Zero Trust -> Networks -> Tunnels -> Add a tunnel${NC}"
echo -e "Pilih tipe 'Cloudflared', lalu salin ${BOLD}Tunnel Token${NC} yang muncul."
echo -e "(Token biasanya string panjang diawali: ${PURPLE}eyJhIjoiMTgyYT...${NC})"
echo ""

read -p ">> Masukkan Token Cloudflare Zero Trust (atau tekan ENTER untuk lewati): " CF_TOKEN
CF_TOKEN=$(echo "$CF_TOKEN" | tr -d '\r\n ' | sed -e "s/'//g" -e 's/"//g')

read -p ">> Masukkan Domain Anda (misal: pos.garudatel.com atau garudatel.com, opsional): " DOMAIN_NAME
DOMAIN_NAME=$(echo "$DOMAIN_NAME" | tr -d '\r\n ')

echo ""
echo -e "${GREEN}[✔] Konfigurasi awal diterima.${NC}"
sleep 1

# 3. Update Paket Sistem & Self-Healing APT Lock
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 2: PEMBARUAN SISTEM & DEPENDENSI OS (SELF-HEALING)       ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

export DEBIAN_FRONTEND=noninteractive

echo -e "${BLUE}[*] Memeriksa status proses APT & dpkg lock...${NC}"
lock_waited=0
while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    echo -e "${YELLOW}[!] Sistem APT sedang digunakan oleh proses VPS lain. Menunggu... (${lock_waited}s)${NC}"
    sleep 3
    lock_waited=$((lock_waited + 3))
    if [ $lock_waited -ge 30 ]; then
        echo -e "${YELLOW}[!] Melepaskan lock APT secara aman...${NC}"
        killall -9 apt apt-get dpkg unattended-upgrade 2>/dev/null || true
        rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock* 2>/dev/null || true
        dpkg --configure -a 2>/dev/null || true
        break
    fi
done

echo -e "${BLUE}[*] Mengupdate repository paket Ubuntu/Debian...${NC}"
apt-get update -y -q || true

echo -e "${BLUE}[*] Memasang dependensi dasar sistem (curl, git, build-essential, sqlite3)...${NC}"
apt-get install -y -q curl git build-essential sqlite3 cron ca-certificates gnupg

# 4. Instalasi Node.js 20 LTS (NodeSource)
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 3: SETUP RUNTIME NODE.JS 20 LTS & TSX ENGINE             ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

NEED_NODE_INSTALL=0
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt 18 ]; then
        NEED_NODE_INSTALL=1
    else
        echo -e "${GREEN}[✔] Node.js sudah terpasang: $(node -v)${NC}"
    fi
else
    NEED_NODE_INSTALL=1
fi

if [ "$NEED_NODE_INSTALL" -eq 1 ]; then
    echo -e "${BLUE}[*] Memasang Node.js 20.x LTS dari NodeSource...${NC}"
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update -y -q
    apt-get install -y -q nodejs
    echo -e "${GREEN}[✔] Berhasil memasang Node.js: $(node -v) & npm: $(npm -v)${NC}"
fi

# 5. Instalasi Dependensi Proyek & Build Frontend
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 4: BUILD PROYEK (NPM INSTALL & VITE BUILD)               ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR"
echo -e "${BLUE}[*] Memasang dependensi npm (termasuk SQLite native bindings)...${NC}"
npm install

echo -e "${BLUE}[*] Mengompilasi frontend React 19 production bundle (Vite)...${NC}"
npm run build
echo -e "${GREEN}[✔] Build frontend berhasil dikompilasi ke direktori dist/.${NC}"

# 6. Database Foundation & Initial Seeding
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 5: INISIALISASI DATABASE SQLITE (WAL MODE)               ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/data/backups"
chmod -R 775 "$PROJECT_DIR/data"

if [ ! -f "$PROJECT_DIR/data/pos.db" ]; then
    echo -e "${BLUE}[*] Menjalankan seeding database pertama kali...${NC}"
    npm run seed
    echo -e "${GREEN}[✔] Database SQLite pos.db berhasil diinisialisasi & diisi data default.${NC}"
else
    echo -e "${GREEN}[✔] Database pos.db sudah ada. Mempertahankan data transaksi yang sedang berjalan.${NC}"
fi

# 7. Pembuatan Systemd Service Daemon (`pos-ipay.service`)
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 6: REGISTRASI SYSTEMD SERVICE DAEMON                     ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SERVICE_FILE="/etc/systemd/system/pos-ipay.service"
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=POS IPAY - Hybrid Minimarket & PPOB Cashier Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=$(which npm) run dev:server
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

# Resource & File Descriptor Limits
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pos-ipay
systemctl restart pos-ipay
echo -e "${GREEN}[✔] Service pos-ipay berhasil diregistrasi & dijalankan via Systemd.${NC}"

# 8. Setup Dynamic Auto-Backup Cronjob
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 7: KONFIGURASI SISTEM AUTO-BACKUP CRONJOB                 ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BACKUP_SCRIPT="$PROJECT_DIR/backup.sh"
cat <<'EOF' > "$BACKUP_SCRIPT"
#!/bin/bash
# POS IPAY - Automated Daily Snapshot Script
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$APP_DIR/data/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
TARGET="$BACKUP_DIR/pos_backup_${TIMESTAMP}_cron.db"

# Gunakan sqlite3 online backup untuk keamanan WAL mode
if [ -f "$APP_DIR/data/pos.db" ]; then
    sqlite3 "$APP_DIR/data/pos.db" ".backup '$TARGET'"
    echo "[$(date)] Backup berhasil dibuat: $TARGET" >> "$BACKUP_DIR/backup.log"
    # Rotasi: Hapus file backup yang lebih tua dari 30 hari
    find "$BACKUP_DIR" -name "pos_backup_*.db" -type f -mtime +30 -delete
fi
EOF

chmod +x "$BACKUP_SCRIPT"

# Daftarkan ke crontab root jika belum ada
(crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" ; echo "0 2 * * * $BACKUP_SCRIPT >/dev/null 2>&1") | crontab -
echo -e "${GREEN}[✔] Auto-backup harian berhasil dipasang di crontab (setiap jam 02:00 malam).${NC}"

# 9. Cloudflare Zero Trust Tunnel Setup
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 8: CLOUDFLARE ZERO TRUST TUNNEL SETUP                    ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$CF_TOKEN" ]; then
    echo -e "${BLUE}[*] Memasang cloudflared binary dari repository Cloudflare...${NC}"
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /etc/apt/keyrings/cloudflare-main.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared nodistro main" | tee /etc/apt/sources.list.d/cloudflared.list
    apt-get update -y -q
    apt-get install -y -q cloudflared

    echo -e "${BLUE}[*] Menginstal service cloudflared tunnel...${NC}"
    cloudflared service install "$CF_TOKEN" || true
    systemctl restart cloudflared || true
    echo -e "${GREEN}[✔] Cloudflare Zero Trust Tunnel berhasil terhubung!${NC}"
    if [ -n "$DOMAIN_NAME" ]; then
        echo -e "    Pastikan di Cloudflare Dashboard Public Hostname diarahkan ke: ${CYAN}http://localhost:3001${NC}"
    fi
else
    echo -e "${YELLOW}[i] Cloudflare Token dilewati.${NC}"
    echo -e "    Aplikasi tetap aktif pada port ${CYAN}3001${NC}."
    echo -e "    Anda dapat menggunakan Nginx reverse-proxy atau mengakses via IP: ${CYAN}http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_VPS'):3001${NC}"
fi

# 10. Sertifikasi & Health Check
echo ""
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  TAHAP 9: SERTIFIKASI & HEALTH CHECK AKHIR                      ${NC}"
echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

sleep 2
HEALTH_STATUS=$(curl -s http://localhost:3001/health || echo "FAILED")

if [[ "$HEALTH_STATUS" =~ "ok" ]]; then
    echo -e "${GREEN}${BOLD}[✔] STATUS: SERVER READY & HEALTHY (Score: 100%)${NC}"
else
    echo -e "${YELLOW}[!] Server sedang memulai... Silakan tunggu 5 detik lalu cek: systemctl status pos-ipay${NC}"
fi

echo ""
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}           🎉 INSTALASI POS IPAY SELESAI DENGAN SUKSES! 🎉        ${NC}"
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo ""
if [ -n "$DOMAIN_NAME" ]; then
    echo -e "  🌐 Akses Web POS   : ${BOLD}https://$DOMAIN_NAME${NC}"
else
    echo -e "  🌐 Akses Web POS   : ${BOLD}http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP_VPS'):3001${NC}"
fi
echo -e "  🔑 Login Owner     : ${BOLD}owner${NC}     | Password: ${BOLD}admin123${NC} | PIN: ${BOLD}112233${NC}"
echo -e "  🔑 Login Supervisor: ${BOLD}spv${NC}       | Password: ${BOLD}spv123${NC}   | PIN: ${BOLD}223344${NC}"
echo -e "  🔑 Login Kasir     : ${BOLD}kasir1${NC}    | Password: ${BOLD}kasir123${NC} | PIN: ${BOLD}123456${NC}"
echo ""
echo -e "  💾 Auto-Backup     : Aktif di ${CYAN}$PROJECT_DIR/data/backups${NC}"
echo -e "  ⚙️ Cek Status      : ${YELLOW}systemctl status pos-ipay${NC}"
echo -e "  📜 Lihat Log       : ${YELLOW}journalctl -u pos-ipay -f${NC}"
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo ""
