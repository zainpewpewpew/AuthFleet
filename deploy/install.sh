#!/bin/bash
# AuthFleet install script untuk VPS Ubuntu/Debian.
#
# Usage:
#   sudo bash install.sh <domain>
# Contoh:
#   sudo bash install.sh authfleet.sociofy.com
#
# Script aman dijalankan ulang (idempotent). Tidak menyentuh Sociofy atau
# config nginx existing — hanya menambah satu server block baru untuk
# AuthFleet dan satu systemd service. Certbot dijalankan terpisah di akhir
# karena butuh DNS sudah propagate.

set -euo pipefail

DOMAIN="${1:-}"
REPO="https://github.com/zainpewpewpew/AuthFleet.git"
AUTHFLEET_USER=authfleet
AUTHFLEET_HOME=/home/$AUTHFLEET_USER
INSTALL_DIR=$AUTHFLEET_HOME/AuthFleet
NODE_REQUIRED=20

die() { echo "❌ $*" >&2; exit 1; }
info() { echo "→ $*"; }
ok()   { echo "✓ $*"; }

[[ $EUID -eq 0 ]] || die "Jalankan dengan sudo: sudo bash install.sh <domain>"
[[ -n "$DOMAIN" ]] || die "Butuh argumen domain. Contoh: sudo bash install.sh authfleet.sociofy.com"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Domain tidak valid: $DOMAIN"

# Detect kalau dijalankan dari dalam clone lokal AuthFleet (bukan curl-piped).
# Kalau ya, pakai clone itu sebagai source — hindari git clone ulang yang butuh
# auth untuk repo private.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [[ -f "$SCRIPT_DIR/../package.json" ]] && grep -q '"name": "authfleet"' "$SCRIPT_DIR/../package.json"; then
  LOCAL_SOURCE="$( cd "$SCRIPT_DIR/.." && pwd )"
else
  LOCAL_SOURCE=""
fi

# ─── Prerequisites ─────────────────────────────────────
command -v nginx >/dev/null || die "nginx belum terpasang di VPS ini"
command -v openssl >/dev/null || die "openssl wajib ada (seharusnya default)"
command -v curl >/dev/null || die "curl wajib ada"

# Cek port 3000 tidak sedang dipakai Sociofy atau process lain
if ss -tlnp 2>/dev/null | grep -qE ':3000[[:space:]]'; then
  die "Port 3000 sedang dipakai process lain. AuthFleet butuh port ini."
fi

# ─── Step 1: User authfleet ────────────────────────────
if id -u $AUTHFLEET_USER >/dev/null 2>&1; then
  ok "User $AUTHFLEET_USER sudah ada"
else
  info "Membuat user $AUTHFLEET_USER"
  adduser --disabled-password --gecos "" $AUTHFLEET_USER
  mkdir -p $AUTHFLEET_HOME/backups
  chown -R $AUTHFLEET_USER:$AUTHFLEET_USER $AUTHFLEET_HOME
  ok "User $AUTHFLEET_USER dibuat"
fi

# ─── Step 2: Build tools, Node.js 20+, sqlite3 ─────────
# better-sqlite3 dan argon2 adalah native modules. Kalau VPS pakai Node yang
# tidak punya prebuilt (misal Node 24), node-gyp akan compile dari source —
# butuh make/gcc/g++/python3.
if ! command -v make >/dev/null || ! command -v g++ >/dev/null; then
  info "Install build tools (make, gcc, g++, python3) untuk compile native modules"
  apt-get update -qq
  apt-get install -y build-essential python3
  ok "Build tools terpasang"
fi

if command -v node >/dev/null; then
  CURRENT_NODE=$(node -v | sed 's/v//;s/\..*//')
  if [[ "$CURRENT_NODE" -ge "$NODE_REQUIRED" ]]; then
    ok "Node.js v$(node -v) sudah terpasang"
  else
    die "Node.js versi $CURRENT_NODE terdeteksi. AuthFleet butuh Node $NODE_REQUIRED+. Upgrade manual dulu sebelum lanjut."
  fi
else
  info "Install Node.js $NODE_REQUIRED via NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_REQUIRED}.x" | bash -
  apt-get install -y nodejs
  ok "Node.js $(node -v) terpasang"
fi

if ! command -v sqlite3 >/dev/null; then
  info "Install sqlite3 (untuk backup script)"
  apt-get install -y sqlite3
  ok "sqlite3 terpasang"
fi

# ─── Step 3: Source code ───────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repo sudah ada di $INSTALL_DIR"
  if [[ -n "$LOCAL_SOURCE" && "$LOCAL_SOURCE" != "$INSTALL_DIR" ]]; then
    info "Sync dari local clone $LOCAL_SOURCE (pakai rsync)"
    command -v rsync >/dev/null || apt-get install -y rsync
    rsync -a --delete --exclude=.next --exclude=node_modules --exclude=data \
      "$LOCAL_SOURCE/" "$INSTALL_DIR/"
    chown -R $AUTHFLEET_USER:$AUTHFLEET_USER "$INSTALL_DIR"
  else
    info "Update via git pull"
    sudo -u $AUTHFLEET_USER git -C "$INSTALL_DIR" pull --ff-only || \
      info "git pull gagal (mungkin repo private tanpa auth) — pakai state saat ini"
  fi
elif [[ -n "$LOCAL_SOURCE" ]]; then
  info "Copy dari local clone $LOCAL_SOURCE → $INSTALL_DIR"
  command -v rsync >/dev/null || apt-get install -y rsync
  mkdir -p "$INSTALL_DIR"
  rsync -a --exclude=.next --exclude=node_modules --exclude=data \
    "$LOCAL_SOURCE/" "$INSTALL_DIR/"
  chown -R $AUTHFLEET_USER:$AUTHFLEET_USER "$INSTALL_DIR"
else
  info "Clone AuthFleet dari GitHub (butuh auth kalau repo private)"
  sudo -u $AUTHFLEET_USER git clone "$REPO" "$INSTALL_DIR" || \
    die "Clone gagal. Repo mungkin private — clone manual dulu lalu run install.sh dari dalam folder: git clone <url> && cd AuthFleet && sudo bash deploy/install.sh $DOMAIN"
fi
ok "Source code di $INSTALL_DIR"

# ─── Step 4: Install deps + build ──────────────────────
info "npm ci (bisa makan 1-2 menit)"
sudo -u $AUTHFLEET_USER -H bash -c "cd $INSTALL_DIR && npm ci --no-audit --no-fund"
info "npm run build"
sudo -u $AUTHFLEET_USER -H bash -c "cd $INSTALL_DIR && npm run build"
ok "Build selesai"

# ─── Step 5: .env.server (jangan pernah overwrite) ─────
ENV_FILE="$INSTALL_DIR/.env.server"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env.server sudah ada, tidak di-overwrite"
  OPERATOR_PASSWORD=""
else
  info "Generate .env.server dengan kunci fresh"
  OPERATOR_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  ENCRYPT_KEY=$(openssl rand -base64 32)
  SESSION_KEY=$(openssl rand -base64 32)
  cat > "$ENV_FILE" <<ENVEOF
AUTHFLEET_PASSWORD=$OPERATOR_PASSWORD
AUTHFLEET_ENCRYPT_KEY=$ENCRYPT_KEY
AUTHFLEET_SESSION_KEY=$SESSION_KEY
PORT=3000
NODE_ENV=production
ENVEOF
  chown $AUTHFLEET_USER:$AUTHFLEET_USER "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env.server dibuat dengan permission 600"
fi

# ─── Step 6: Systemd service ───────────────────────────
SERVICE_FILE=/etc/systemd/system/authfleet.service
if [[ -f "$SERVICE_FILE" ]]; then
  info "Update systemd service dari deploy/authfleet.service"
else
  info "Install systemd service"
fi
cp "$INSTALL_DIR/deploy/authfleet.service" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable authfleet >/dev/null
systemctl restart authfleet
sleep 2
if systemctl is-active --quiet authfleet; then
  ok "Service authfleet running"
else
  die "Service authfleet gagal start. Cek: journalctl -u authfleet -n 50"
fi

# Verifikasi listen di 127.0.0.1 only
if ! ss -tlnp 2>/dev/null | grep -qE '127\.0\.0\.1:3000'; then
  die "AuthFleet tidak listen di 127.0.0.1:3000. Cek .env.server dan systemd config."
fi
ok "AuthFleet listen di 127.0.0.1:3000 (tidak reachable dari internet langsung)"

# ─── Step 7: Nginx site ────────────────────────────────
NGINX_SITE=/etc/nginx/sites-available/authfleet
NGINX_ENABLED=/etc/nginx/sites-enabled/authfleet

info "Install nginx server block untuk $DOMAIN"
sed "s/authfleet\.yourdomain\.com/$DOMAIN/g" "$INSTALL_DIR/deploy/nginx-authfleet.conf" > "$NGINX_SITE"

# Tambah rate limit zone kalau belum ada
if ! grep -q 'authfleet_otp:10m' /etc/nginx/nginx.conf; then
  info "Tambah rate_limit zone ke nginx.conf"
  sed -i '/^http {/a \    limit_req_zone $binary_remote_addr zone=authfleet_otp:10m rate=30r/m;' /etc/nginx/nginx.conf
fi

[[ -L "$NGINX_ENABLED" ]] || ln -s "$NGINX_SITE" "$NGINX_ENABLED"
nginx -t >/dev/null 2>&1 || die "nginx config invalid — jangan reload. Cek: nginx -t"
systemctl reload nginx
ok "Nginx server block aktif (belum HTTPS — jalankan certbot di langkah akhir)"

# ─── Step 8: Backup cron ───────────────────────────────
cp "$INSTALL_DIR/deploy/backup.sh" /usr/local/bin/authfleet-backup.sh
chmod +x /usr/local/bin/authfleet-backup.sh
if [[ ! -f /etc/cron.d/authfleet-backup ]]; then
  echo "0 3 * * * authfleet /usr/local/bin/authfleet-backup.sh >> /var/log/authfleet-backup.log 2>&1" > /etc/cron.d/authfleet-backup
  ok "Backup cron harian 03:00"
else
  ok "Backup cron sudah ada"
fi

# ─── Step 9: UFW firewall (kalau aktif) ────────────────
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  ok "UFW: Nginx Full allowed (port 3000 tetap tertutup dari luar)"
fi

# ─── Final instructions ────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  AuthFleet terpasang di $DOMAIN"
echo "═══════════════════════════════════════════════════════════"
echo ""
if [[ -n "$OPERATOR_PASSWORD" ]]; then
  echo "  Password login dashboard (SIMPAN SEKARANG, tidak akan muncul lagi):"
  echo "    $OPERATOR_PASSWORD"
  echo ""
  echo "  Atau kapan saja via: sudo grep AUTHFLEET_PASSWORD $ENV_FILE"
fi
echo ""
echo "  Langkah manual terakhir:"
echo ""
echo "  1. Pastikan DNS A record $DOMAIN → IP VPS sudah propagate:"
echo "       dig $DOMAIN +short"
echo ""
echo "  2. Dapatkan SSL cert (interaktif, pilih 'Redirect' saat ditanya):"
echo "       sudo apt-get install -y certbot python3-certbot-nginx"
echo "       sudo certbot --nginx -d $DOMAIN"
echo ""
echo "  3. Buka https://$DOMAIN, login, buat OAuth folder, sambung Gmail,"
echo "     generate API key — paste ke Sociofy Agent (tab AuthFleet)."
echo ""
echo "  Troubleshoot:"
echo "    sudo journalctl -u authfleet -f"
echo "    sudo systemctl status authfleet"
echo ""
