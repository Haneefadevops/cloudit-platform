#!/usr/bin/env bash
set -euo pipefail

# CloudIT Backup Script
# Backs up PostgreSQL, Redis, n8n, and Uptime Kuma data to /opt/backups/local.
# Encrypts the archive with GPG if BACKUP_ENCRYPTION_KEY is set.
# Retains only the last 7 days of backups.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/local}"
LOG_FILE="${LOG_FILE:-/var/log/cloudit-backup.log}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATE_STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_NAME="cloudit-backup-${DATE_STAMP}"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

die() {
  log "ERROR: $*"
  exit 1
}

POSTGRES_USER="${POSTGRES_USER:-cloudit}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

log "Starting backup: $BACKUP_NAME"

# --- PostgreSQL: dump all databases ---
log "Dumping PostgreSQL databases..."
if ! docker exec postgres pg_dumpall -U "$POSTGRES_USER" > "${TMP_DIR}/postgres.sql"; then
  die "PostgreSQL dump failed"
fi

# --- Redis: export RDB snapshot ---
log "Exporting Redis snapshot..."
if docker exec redis redis-cli -a "$REDIS_PASSWORD" --rdb /data/dump-backup.rdb >/dev/null 2>&1; then
  docker cp "redis:/data/dump-backup.rdb" "${TMP_DIR}/redis.rdb" || log "WARNING: Could not copy Redis RDB file"
else
  log "WARNING: Redis snapshot failed (Redis is cache-only; skipping)"
fi

# --- n8n: backup volume ---
log "Backing up n8n volume..."
if docker ps --format '{{.Names}}' | grep -qx n8n; then
  docker run --rm --volumes-from n8n \
    -v "${TMP_DIR}:/backup-out" \
    alpine:3.19 \
    tar czf /backup-out/n8n-data.tar.gz -C /home/node/.n8n . \
    || log "WARNING: n8n volume backup failed"
else
  log "WARNING: n8n container not running (skipping)"
fi

# --- Uptime Kuma: backup volume ---
log "Backing up Uptime Kuma volume..."
if docker ps --format '{{.Names}}' | grep -qx uptime-kuma; then
  docker run --rm --volumes-from uptime-kuma \
    -v "${TMP_DIR}:/backup-out" \
    alpine:3.19 \
    tar czf /backup-out/uptime-kuma-data.tar.gz -C /app/data . \
    || log "WARNING: Uptime Kuma volume backup failed"
else
  log "WARNING: Uptime Kuma container not running (skipping)"
fi

# --- Create aggregate archive ---
log "Creating aggregate archive..."
mkdir -p "${TMP_DIR}/archive"
mv "${TMP_DIR}/postgres.sql" "${TMP_DIR}/archive/" 2>/dev/null || true
mv "${TMP_DIR}/n8n-data.tar.gz" "${TMP_DIR}/archive/" 2>/dev/null || true
mv "${TMP_DIR}/uptime-kuma-data.tar.gz" "${TMP_DIR}/archive/" 2>/dev/null || true
mv "${TMP_DIR}/redis.rdb" "${TMP_DIR}/archive/" 2>/dev/null || true

tar czf "${TMP_DIR}/${BACKUP_NAME}.tar.gz" -C "${TMP_DIR}/archive" .

if [ ! -f "${TMP_DIR}/${BACKUP_NAME}.tar.gz" ]; then
  die "Archive creation failed"
fi

# --- Encrypt archive ---
FINAL_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  log "Encrypting archive with GPG..."
  gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --output "${FINAL_FILE}.gpg" \
    "${TMP_DIR}/${BACKUP_NAME}.tar.gz"
  FINAL_FILE="${FINAL_FILE}.gpg"
else
  mv "${TMP_DIR}/${BACKUP_NAME}.tar.gz" "$FINAL_FILE"
  log "WARNING: BACKUP_ENCRYPTION_KEY not set; archive is unencrypted"
fi

# --- Retention: delete backups older than RETENTION_DAYS ---
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f \( -name 'cloudit-backup-*.tar.gz' -o -name 'cloudit-backup-*.tar.gz.gpg' \) \
  -mtime +"$RETENTION_DAYS" -delete

log "Backup completed: $FINAL_FILE"
