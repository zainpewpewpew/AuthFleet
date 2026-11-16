#!/bin/bash
# AuthFleet daily backup
# Place at: /usr/local/bin/authfleet-backup.sh
# Schedule via cron:
#   echo "0 3 * * * authfleet /usr/local/bin/authfleet-backup.sh" | sudo tee -a /etc/cron.d/authfleet-backup

set -euo pipefail

BACKUP_DIR=/home/authfleet/backups
SOURCE=/home/authfleet/AuthFleet/data/authfleet.sqlite
ENCRYPT_KEY=/home/authfleet/AuthFleet/data/encrypt.key
DATE=$(date +%Y%m%d-%H%M%S)
TARGET="$BACKUP_DIR/authfleet-$DATE.sqlite"

mkdir -p "$BACKUP_DIR"

# Crash-consistent SQLite copy via .backup command (safer than cp during writes)
sqlite3 "$SOURCE" ".backup '$TARGET'"
gzip "$TARGET"

# Also backup encrypt.key (needed to decrypt refresh tokens on restore)
if [ -f "$ENCRYPT_KEY" ]; then
    cp "$ENCRYPT_KEY" "$BACKUP_DIR/encrypt.key.$DATE"
fi

# Retention: keep last 30 days
find "$BACKUP_DIR" -name 'authfleet-*.sqlite.gz' -mtime +30 -delete
find "$BACKUP_DIR" -name 'encrypt.key.*' -mtime +30 -delete

echo "[$(date -Is)] Backup created: $TARGET.gz"
