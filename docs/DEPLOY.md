# AuthFleet — Panduan Deploy ke VPS

Deploy AuthFleet ke VPS Ubuntu/Debian berdampingan dengan Sociofy, lewat Nginx sebagai reverse proxy. Guide ini memakai contoh domain `authfleet.sociofy.com` — ganti dengan domain Anda (bisa subdomain Sociofy, atau domain gratis dari paket VPS).

## Target Arsitektur

```
Internet
    ↓ HTTPS 443
Nginx (VPS)
    ├── sociofy.yourdomain.com    → 127.0.0.1:<port-sociofy>
    └── authfleet.yourdomain.com  → 127.0.0.1:3000

Sociofy → http://127.0.0.1:3000/api/v1/otp/wait  (internal, ~1 ms)
```

**Prinsip keamanan:**

- AuthFleet listen **hanya di `127.0.0.1:3000`** — tidak reachable dari internet langsung, wajib lewat nginx.
- Linux user `authfleet` **terpisah** dari user Sociofy — file `data/authfleet.sqlite` + `.env.server` permission `600` + owned by `authfleet`.
- `MASTER_KEY` + `SESSION_SECRET` production **beda total** dari dev.
- Firewall UFW: expose cuma 80/443 untuk Nginx; 3000 tertutup dari luar.

## Prerequisites

Centang sebelum lanjut:

- [ ] Akses `sudo` ke VPS
- [ ] Nginx sudah terpasang (dari deploy Sociofy)
- [ ] Node.js 20+ tersedia (cek: `node -v`)
- [ ] DNS A record `authfleet.yourdomain.com` → IP VPS sudah propagated
- [ ] `certbot` terpasang (atau mau diinstall di Step 7)

## Step 1 — Buat User Linux Terpisah

```bash
sudo adduser --disabled-password --gecos "" authfleet
sudo mkdir -p /home/authfleet/backups
sudo chown -R authfleet:authfleet /home/authfleet
```

## Step 2 — Install Node.js 20 (skip kalau sudah ada)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3
node -v   # harus >= v20
```

## Step 3 — Clone Repo + Build

```bash
sudo -u authfleet -i   # masuk sebagai user authfleet
cd ~
git clone https://github.com/zainpewpewpew/AuthFleet.git
cd AuthFleet
npm ci
npm run build
exit   # kembali ke user sudo
```

## Step 4 — Environment Variables Production

```bash
sudo -u authfleet -i
cd ~/AuthFleet

# Generate kunci baru — JANGAN pakai nilai dari dev
cat > .env.server <<EOF
AUTHFLEET_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
AUTHFLEET_ENCRYPT_KEY=$(openssl rand -base64 32)
AUTHFLEET_SESSION_KEY=$(openssl rand -base64 32)
PORT=3000
NODE_ENV=production
EOF
chmod 600 .env.server

# Catat password login untuk dashboard
grep AUTHFLEET_PASSWORD .env.server
# Salin value ke password manager — ini password login operator
```

PENTING: simpan `AUTHFLEET_PASSWORD` yang baru di-generate ke password manager sebelum keluar shell. Kalau hilang, tinggal generate ulang tapi harus restart service.

```bash
exit   # keluar dari user authfleet
```

## Step 5 — Systemd Service

```bash
sudo cp /home/authfleet/AuthFleet/deploy/authfleet.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now authfleet
sudo systemctl status authfleet   # harus "active (running)"
```

Kalau gagal, cek log: `sudo journalctl -u authfleet -n 50`.

Verifikasi listen di localhost saja:

```bash
sudo ss -tlnp | grep 3000
# Harus: 127.0.0.1:3000 ... bukan *:3000 atau 0.0.0.0:3000
```

## Step 6 — Nginx Server Block

```bash
sudo cp /home/authfleet/AuthFleet/deploy/nginx-authfleet.conf /etc/nginx/sites-available/authfleet

# Edit server_name ke domain Anda
sudo sed -i 's/authfleet.yourdomain.com/authfleet.sociofy.com/g' /etc/nginx/sites-available/authfleet

# Rate limit zone (hanya sekali — kalau sudah ada, skip)
sudo sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=authfleet_otp:10m rate=30r/m;' /etc/nginx/nginx.conf

sudo ln -s /etc/nginx/sites-available/authfleet /etc/nginx/sites-enabled/
sudo nginx -t   # harus "test is successful"
sudo systemctl reload nginx
```

## Step 7 — SSL dengan Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d authfleet.sociofy.com
# Pilih "Redirect" saat ditanya HTTP → HTTPS
```

Certbot akan modify nginx config otomatis dan setup renew timer (cek `sudo systemctl status certbot.timer`).

## Step 8 — Update Google Cloud OAuth

Di Google Cloud Console → **APIs & Services → Credentials** → untuk tiap OAuth client AuthFleet:

**Authorized redirect URIs** tambahkan baris baru (jangan hapus yang localhost):

```
https://authfleet.sociofy.com/api/oauth/callback
```

**Authorized JavaScript origins** tambahkan:

```
https://authfleet.sociofy.com
```

Simpan. OAuth client yang sama kini jalan baik di dev (localhost) maupun production (VPS).

## Step 9 — Backup Harian

```bash
sudo cp /home/authfleet/AuthFleet/deploy/backup.sh /usr/local/bin/authfleet-backup.sh
sudo chmod +x /usr/local/bin/authfleet-backup.sh

# Jalankan sekali untuk test
sudo -u authfleet /usr/local/bin/authfleet-backup.sh

# Schedule 03:00 setiap hari
echo "0 3 * * * authfleet /usr/local/bin/authfleet-backup.sh >> /var/log/authfleet-backup.log 2>&1" | sudo tee /etc/cron.d/authfleet-backup
```

## Step 10 — Firewall UFW (kalau dipakai)

```bash
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw status
# Pastikan port 3000 TIDAK muncul di allow list — cuma localhost yang boleh akses
```

## Verifikasi Akhir

```bash
# 1. Service aktif
sudo systemctl is-active authfleet   # harus "active"

# 2. Listen cuma di localhost
sudo ss -tlnp | grep 3000

# 3. Akses dari luar VPS
curl -I https://authfleet.sociofy.com   # harus 200 atau 302 ke /login

# 4. Dari dalam VPS — test rute yang Sociofy akan pakai
curl -I http://127.0.0.1:3000/api/v1/health 2>/dev/null || curl -I http://127.0.0.1:3000
```

Login ke `https://authfleet.sociofy.com` pakai password dari `.env.server`. Buat folder baru, paste OAuth Client ID + Secret dari Google Cloud, sambung Gmail pertama.

## Konfigurasi Sociofy untuk Pakai AuthFleet

Di Sociofy (di VPS yang sama), panggil AuthFleet lewat localhost:

```
POST http://127.0.0.1:3000/api/v1/otp/wait
Header: X-API-Key: <api-key-dari-dashboard-authfleet>
Body: { "email": "akun@gmail.com", "timeout_ms": 30000 }
```

Latency ~1 ms (tidak keluar network), tidak kena nginx rate limit, tidak kena TLS overhead.

## Cloudflare di Depan (Opsional, Direkomendasikan)

Bisa pasang Cloudflare sebagai proxy di depan VPS — gratis, dapat DDoS protection + CDN + hide origin IP:

1. Tambahkan domain ke dashboard Cloudflare
2. Ganti nameserver domain ke Cloudflare
3. Set DNS A record `authfleet` → IP VPS, aktifkan proxy (orange cloud)
4. Di SSL/TLS settings, pilih **Full (strict)** — pakai Let's Encrypt cert dari nginx sebagai origin cert

Nginx + certbot tetap bekerja normal; Cloudflare jadi lapisan pertama saja.

## Update AuthFleet (saat ada commit baru)

```bash
sudo -u authfleet -i
cd ~/AuthFleet
git pull
npm ci
npm run build
exit
sudo systemctl restart authfleet
```

Downtime < 5 detik. Session login operator akan logout (karena JWT re-sign), tapi API key untuk Sociofy tetap valid.

## Logs & Debugging

```bash
# Follow realtime
sudo journalctl -u authfleet -f

# Last 100 lines
sudo journalctl -u authfleet -n 100

# Nginx access
sudo tail -f /var/log/nginx/access.log | grep authfleet

# Nginx error
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting Umum

| Gejala | Penyebab Umum | Fix |
|---|---|---|
| `systemctl status` bilang failed | Env var hilang, port bentrok | `journalctl -u authfleet -n 50` |
| Nginx `502 Bad Gateway` | AuthFleet mati | `sudo systemctl restart authfleet` |
| Google OAuth `redirect_uri_mismatch` | Lupa update Google Cloud | Tambah URI production di Step 8 |
| Login redirect loop | Cookie `Secure` tapi akses HTTP | Pastikan akses lewat HTTPS, bukan IP langsung |
| `EACCES: permission denied` | Ownership salah | `sudo chown -R authfleet:authfleet /home/authfleet/AuthFleet` |
| Backup gagal: `database is locked` | AuthFleet sedang write | Pakai `.backup` command (sudah ada di script), bukan `cp` |

## Restore dari Backup (kalau VPS rebuild)

```bash
sudo -u authfleet -i
cd ~/AuthFleet
# Stop service dulu
exit
sudo systemctl stop authfleet

# Restore
sudo -u authfleet gunzip -c /home/authfleet/backups/authfleet-20260101-030000.sqlite.gz > /home/authfleet/AuthFleet/data/authfleet.sqlite
sudo -u authfleet cp /home/authfleet/backups/encrypt.key.20260101-030000 /home/authfleet/AuthFleet/data/encrypt.key

sudo systemctl start authfleet
```

PENTING: `encrypt.key` dari tanggal yang SAMA dengan SQLite backup — kalau beda tanggal, refresh_token tidak bisa didekripsi dan semua Gmail harus re-auth.

## Checklist Keamanan Final

- [ ] `.env.server` permission `600`, owned `authfleet`
- [ ] `data/authfleet.sqlite` + `data/encrypt.key` permission `600`
- [ ] `ss -tlnp | grep 3000` → cuma `127.0.0.1:3000`
- [ ] Password `AUTHFLEET_PASSWORD` kuat (≥ 24 chars), tersimpan di password manager
- [ ] SSL aktif, `curl -I https://authfleet.sociofy.com` return 200
- [ ] UFW firewall aktif, 3000 tidak di allow list
- [ ] Backup cron jalan (cek `/var/log/authfleet-backup.log` setelah 24 jam)
- [ ] Google Cloud OAuth redirect URI production sudah terdaftar
